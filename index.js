const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  AuditLogEvent,
  MessageFlags,
  ActivityType,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const OWNER_ID = "1179433017064820747";
const SPECIAL_ID = "1523658452382126101";

const WHITE = 0xFFFFFF;

if (!TOKEN || !CLIENT_ID || !process.env.DATABASE_URL) {
  console.error(
    "❌ تأكد من وجود DISCORD_TOKEN و CLIENT_ID و DATABASE_URL في Railway Variables"
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =========================================================
   LOG TYPES
========================================================= */

const LOG_TYPES = {
  member_join: "إنضمام الأعضاء",
  member_leave: "خروج الأعضاء",
  member_kick: "طرد الأعضاء",
  member_ban: "حظر الأعضاء",
  member_unban: "إزالة حظر الأعضاء",
  timeout: "إضافة/إزالة تايم أوت",
  message_delete: "الرسائل المحذوفة",
  message_edit: "الرسائل المعدلة",
  message_bulk_delete: "حذف مجموعة رسائل",
  channel_create_delete: "إنشاء وحذف الرومات",
  channel_update: "تحديث الرومات",
  channel_permissions: "تحديث صلاحيات الرومات",
  role_create_delete: "إنشاء وحذف الرتب",
  role_update: "تحديث الرتب",
  role_permissions: "تحديث صلاحيات الرتب",
  member_roles: "تحديث رتب الأعضاء",
  voice: "دخول/خروج/طرد صوتي",
  voice_move: "تنقل/سحب الأعضاء صوتياً",
  voice_permissions: "منع/سماح الإستماع والتحدث",
  guild_update: "تحديث إعدادات السيرفر",
  emoji: "إضافة/تعديل/حذف إيموجي",
  sticker: "إضافة/تعديل/حذف ستيكر",
  reaction: "إضافة رياكشن",
  bot_add: "إضافة بوت",
  moderation: "أوامر الإدارة"
};

function defaultSettings() {
  return Object.fromEntries(
    Object.keys(LOG_TYPES).map(key => [key, true])
  );
}

/* =========================================================
   DATABASE
   إصلاح مشكلة:
   column "enabled" does not exist
========================================================= */

async function setupDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT
    );

    ALTER TABLE log_channels
    ADD COLUMN IF NOT EXISTS channel_id TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_settings (
      guild_id TEXT PRIMARY KEY
    );

    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warns (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS warns_guild_user_idx
    ON warns(guild_id, user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoreplies (
      guild_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      response TEXT NOT NULL,
      PRIMARY KEY (guild_id, trigger)
    );

    CREATE TABLE IF NOT EXISTS shortcuts (
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      response TEXT NOT NULL,
      PRIMARY KEY (guild_id, name)
    );

    CREATE TABLE IF NOT EXISTS bot_sessions (
      id BIGSERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log("✅ قاعدة البيانات جاهزة");
}

/* =========================================================
   LOG CONFIG
========================================================= */

async function getConfig(guildId) {

  const channelResult = await pool.query(
    `SELECT channel_id
     FROM log_channels
     WHERE guild_id = $1`,
    [guildId]
  );

  const channelId =
    channelResult.rows[0]?.channel_id || null;

  const settingsResult = await pool.query(
    `SELECT enabled, settings
     FROM log_settings
     WHERE guild_id = $1`,
    [guildId]
  );

  if (!settingsResult.rows.length) {

    const settings = defaultSettings();

    await pool.query(
      `INSERT INTO log_settings
       (guild_id, enabled, settings)
       VALUES ($1, TRUE, $2::jsonb)
       ON CONFLICT (guild_id)
       DO NOTHING`,
      [guildId, JSON.stringify(settings)]
    );

    return {
      channelId,
      enabled: true,
      settings
    };
  }

  let settings =
    settingsResult.rows[0].settings || {};

  if (typeof settings === "string") {
    try {
      settings = JSON.parse(settings);
    } catch {
      settings = {};
    }
  }

  return {
    channelId,
    enabled: settingsResult.rows[0].enabled !== false,
    settings: {
      ...defaultSettings(),
      ...settings
    }
  };
}

async function isLogEnabled(guildId, type) {

  const config = await getConfig(guildId);

  return (
    config.enabled &&
    config.settings[type] !== false &&
    !!config.channelId
  );
}

/* =========================================================
   CLIENT
========================================================= */

const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences
  ],

  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]

});

/* =========================================================
   HELPERS
========================================================= */

function isOwner(interaction) {
  return interaction.user?.id === OWNER_ID;
}

function hasPermission(interaction, permission) {

  if (isOwner(interaction)) {
    return true;
  }

  return Boolean(
    interaction.memberPermissions?.has(permission)
  );
}

function limit(text, max = 1000) {

  text = String(text ?? "غير متاح");

  if (text.length > max) {
    return text.slice(0, max - 3) + "...";
  }

  return text;
}

async function errorReply(interaction, message) {

  if (interaction.replied || interaction.deferred) {

    return interaction.followUp({
      content: message,
      flags: MessageFlags.Ephemeral
    }).catch(() => {});

  }

  return interaction.reply({
    content: message,
    flags: MessageFlags.Ephemeral
  }).catch(() => {});
}

function createEmbed(title, description) {

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || "لا توجد تفاصيل.")
    .setColor(WHITE)
    .setTimestamp()
    .setFooter({
      text: "Powered by .v5d."
    });
}

/* =========================================================
   SEND LOG
========================================================= */

async function sendLog(guild, type, title, description) {

  try {

    if (!await isLogEnabled(guild.id, type)) {
      return;
    }

    const config = await getConfig(guild.id);

    const channel =
      guild.channels.cache.get(config.channelId) ||
      await guild.channels.fetch(config.channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return;
    }

    await channel.send({
      embeds: [
        createEmbed(title, description)
      ]
    });

  } catch (error) {

    console.error(
      "❌ خطأ اللوق:",
      error.message
    );

  }
}

/* =========================================================
   AUDIT LOG
========================================================= */

async function getAuditExecutor(
  guild,
  type,
  predicate = null
) {

  try {

    const logs =
      await guild.fetchAuditLogs({
        type,
        limit: 10
      });

    const now = Date.now();

    const entry =
      logs.entries.find(entry => {

        if (
          now - entry.createdTimestamp >
          10000
        ) {
          return false;
        }

        if (
          predicate &&
          !predicate(entry)
        ) {
          return false;
        }

        return true;
      });

    return entry?.executor || null;

  } catch {

    return null;
  }
}

/* =========================================================
   RECENT MESSAGE CACHE
========================================================= */

const recentMessages = new Map();

/* =========================================================
   COMMANDS
========================================================= */

const userOption = option =>
  option
    .setName("user")
    .setDescription("العضو")
    .setRequired(true);

const commands = [

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("مين أنا؟"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption(userOption)
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إزالة حظر")
    .addStringOption(o =>
      o.setName("user_id")
        .setDescription("ID العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(userOption)
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء تايم أوت")
    .addUserOption(userOption)
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("الدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة تايم أوت")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(userOption)
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("قائمة التحذيرات")
    .addUserOption(o =>
      o.setName("user")
        .setDescription("العضو")
    ),

  new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("تحذيرات عضو")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح رسائل")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تغيير Slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إدارة الرتب")

    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رتبة")
        .addUserOption(userOption)
        .addRoleOption(o =>
          o.setName("role")
            .setDescription("الرتبة")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("إزالة رتبة")
        .addUserOption(userOption)
        .addRoleOption(o =>
          o.setName("role")
            .setDescription("الرتبة")
            .setRequired(true)
        )
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("تغيير اسم عضو")
    .addUserOption(userOption)
    .addStringOption(o =>
      o.setName("name")
        .setDescription("الاسم الجديد")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("معلومات عضو")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة عضو")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر عضو")
    .addUserOption(userOption),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب السيرفر"),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("إرسال رسالة")
    .addStringOption(o =>
      o.setName("message")
        .setDescription("الرسالة")
        .setRequired(true)
    ),

  /* LOG */
  ...["log", "logs"].map(name =>
    new SlashCommandBuilder()
      .setName(name)
      .setDescription("إعدادات اللوق")

      .addSubcommand(s =>
        s.setName("setup")
          .setDescription("تحديد روم اللوق")
          .addChannelOption(o =>
            o.setName("channel")
              .setDescription("روم اللوق")
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true)
          )
      )

      .addSubcommand(s =>
        s.setName("status")
          .setDescription("حالة اللوق")
      )

      .addSubcommand(s =>
        s.setName("enable")
          .setDescription("تشغيل اللوق")
      )

      .addSubcommand(s =>
        s.setName("disable")
          .setDescription("إيقاف اللوق")
      )

      .addSubcommand(s =>
        s.setName("off")
          .setDescription("إيقاف اللوق")
      )

      .addSubcommand(s =>
        s.setName("edit")
          .setDescription("تعديل أنواع اللوق")
      )
  ),

  /* AUTOREPLY */
  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("الردود التلقائية")

    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رد")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName("response")
            .setDescription("الرد")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف رد")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("list")
        .setDescription("قائمة الردود")
    ),

  /* SHORTCUT */
  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("الاختصارات")

    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إضافة اختصار")
        .addStringOption(o =>
          o.setName("name")
            .setDescription("اسم الاختصار")
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName("response")
            .setDescription("الرد")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o =>
          o.setName("name")
            .setDescription("اسم الاختصار")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("list")
        .setDescription("قائمة الاختصارات")
    ),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("قائمة الردود والاختصارات"),

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("حالة البوت"),

  new SlashCommandBuilder()
    .setName("serverguard")
    .setDescription("حماية السيرفر")

].map(command =>
  command.setDMPermission(false)
);

/* =========================================================
   REGISTER
========================================================= */

async function registerCommands() {

  const rest =
    new REST({ version: "10" })
      .setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    {
      body: commands.map(c => c.toJSON())
    }
  );

  console.log(
    `✅ تم تسجيل ${commands.length} أمر`
  );
}

/* =========================================================
   LOG EDIT MENU
========================================================= */

async function showLogEditor(interaction) {

  const config =
    await getConfig(interaction.guildId);

  const options =
    Object.entries(LOG_TYPES).map(
      ([key, name]) => ({
        label: limit(name, 100),
        value: key,
        description:
          config.settings[key]
            ? "🟢 مفعل"
            : "🔴 معطل"
      })
    );

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId("log_edit")
      .setPlaceholder("اختر نوع اللوق")
      .addOptions(options);

  return interaction.reply({
    content:
      "🛠️ اختر نوع اللوق لتفعيله أو تعطيله:",
    components: [
      new ActionRowBuilder()
        .addComponents(menu)
    ],
    flags: MessageFlags.Ephemeral
  });
}

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    try {

      /* LOG MENU */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "log_edit"
      ) {

        const key =
          interaction.values[0];

        const config =
          await getConfig(
            interaction.guildId
          );

        config.settings[key] =
          config.settings[key] === false;

        await pool.query(
          `INSERT INTO log_settings
           (guild_id, enabled, settings)
           VALUES ($1, TRUE, $2::jsonb)

           ON CONFLICT (guild_id)
           DO UPDATE SET
           settings = EXCLUDED.settings`,
          [
            interaction.guildId,
            JSON.stringify(config.settings)
          ]
        );

        return interaction.update({
          content:
            `✅ ${config.settings[key]
              ? "تم تفعيل"
              : "تم تعطيل"} **${LOG_TYPES[key]}**`,
          components: []
        });
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (!interaction.guild) {
        return errorReply(
          interaction,
          "❌ هذا الأمر يعمل داخل السيرفر فقط."
        );
      }

      const guild =
        interaction.guild;

      const command =
        interaction.commandName;

      const member =
        async () =>
          guild.members
            .fetch(
              interaction.options
                .getUser("user").id
            )
            .catch(() => null);

      /* =====================================================
         ME
      ===================================================== */

      if (command === "me") {

        return interaction.reply({
          embeds: [
            createEmbed(
              "🤖 مين أنا؟",
              "**أنا بوت خاص لـ .v5d.**\n\n" +
              "**السيرفر:** MR NOVA\n" +
              "**الخدمة:** Leon و Alshahri"
            )
          ]
        });
      }

      /* =====================================================
         LOG
      ===================================================== */

      if (
        command === "log" ||
        command === "logs"
      ) {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageGuild
          )
        ) {
          return errorReply(
            interaction,
            "❌ تحتاج صلاحية Manage Server."
          );
        }

        const sub =
          interaction.options
            .getSubcommand();

        /* SETUP */

        if (sub === "setup") {

          const channel =
            interaction.options
              .getChannel("channel");

          const me =
            await guild.members.fetchMe();

          const permissions =
            channel.permissionsFor(me);

          if (
            !permissions?.has(
              PermissionFlagsBits.SendMessages
            )
          ) {

            return errorReply(
              interaction,
              "❌ البوت لا يملك صلاحية إرسال الرسائل في روم اللوق."
            );
          }

          await pool.query(
            `INSERT INTO log_channels
             (guild_id, channel_id)
             VALUES ($1, $2)

             ON CONFLICT (guild_id)
             DO UPDATE SET
             channel_id = EXCLUDED.channel_id`,
            [
              guild.id,
              channel.id
            ]
          );

          await getConfig(guild.id);

          await interaction.reply(
            `✅ تم تحديد ${channel} كروم اللوق.`
          );

          return sendLog(
            guild,
            "moderation",
            "📋 إعداد نظام اللوق",
            `📍 الروم: ${channel}\n` +
            `🛡️ الإداري: ${interaction.user}`
          );
        }

        /* STATUS */

        if (sub === "status") {

          const config =
            await getConfig(guild.id);

          const enabledCount =
            Object.values(
              config.settings
            ).filter(Boolean).length;

          return interaction.reply({
            embeds: [
              createEmbed(
                "📋 حالة نظام اللوق",

                `الحالة: ${
                  config.enabled
                    ? "🟢 مفعل"
                    : "🔴 معطل"
                }\n\n` +

                `روم اللوق: ${
                  config.channelId
                    ? `<#${config.channelId}>`
                    : "❌ غير محدد"
                }\n\n` +

                `الأنواع المفعلة: ${
                  enabledCount
                }/${Object.keys(LOG_TYPES).length}`
              )
            ]
          });
        }

        /* ENABLE */

        if (sub === "enable") {

          await pool.query(
            `INSERT INTO log_settings
             (guild_id, enabled, settings)
             VALUES ($1, TRUE, $2::jsonb)

             ON CONFLICT (guild_id)
             DO UPDATE SET
             enabled = TRUE`,
            [
              guild.id,
              JSON.stringify(
                defaultSettings()
              )
            ]
          );

          return interaction.reply(
            "✅ تم تشغيل نظام اللوق."
          );
        }

        /* DISABLE */

        if (
          sub === "disable" ||
          sub === "off"
        ) {

          await pool.query(
            `INSERT INTO log_settings
             (guild_id, enabled, settings)
             VALUES ($1, FALSE, $2::jsonb)

             ON CONFLICT (guild_id)
             DO UPDATE SET
             enabled = FALSE`,
            [
              guild.id,
              JSON.stringify(
                defaultSettings()
              )
            ]
          );

          return interaction.reply(
            "🔴 تم إيقاف نظام اللوق."
          );
        }

        /* EDIT */

        if (sub === "edit") {
          return showLogEditor(
            interaction
          );
        }
      }

      /* =====================================================
         BAN
      ===================================================== */

      if (command === "ban") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.BanMembers
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك صلاحية Ban Members."
          );
        }

        const m = await member();

        if (!m?.bannable) {
          return errorReply(
            interaction,
            "❌ لا أستطيع حظر هذا العضو."
          );
        }

        const reason =
          interaction.options
            .getString("reason") ||
          "بدون سبب";

        await m.ban({
          reason
        });

        await sendLog(
          guild,
          "member_ban",
          "🔨 حظر عضو",
          `👤 العضو: ${m.user}\n` +
          `🛡️ الإداري: ${interaction.user}\n` +
          `📝 السبب: ${reason}`
        );

        return interaction.reply(
          `🔨 تم حظر **${m.user.tag}**.`
        );
      }

      /* =====================================================
         UNBAN
      ===================================================== */

      if (command === "unban") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.BanMembers
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك صلاحية Ban Members."
          );
        }

        const userId =
          interaction.options
            .getString("user_id");

        const reason =
          interaction.options
            .getString("reason") ||
          "بدون سبب";

        await guild.members.unban(
          userId,
          reason
        );

        await sendLog(
          guild,
          "member_unban",
          "♻️ إزالة حظر",
          `🆔 ID: ${userId}\n` +
          `🛡️ الإداري: ${interaction.user}\n` +
          `📝 السبب: ${reason}`
        );

        return interaction.reply(
          `✅ تم إزالة الحظر عن \`${userId}\`.`
        );
      }

      /* =====================================================
         KICK
      ===================================================== */

      if (command === "kick") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.KickMembers
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك صلاحية Kick Members."
          );
        }

        const m = await member();

        if (!m?.kickable) {
          return errorReply(
            interaction,
            "❌ لا أستطيع طرد هذا العضو."
          );
        }

        const reason =
          interaction.options
            .getString("reason") ||
          "بدون سبب";

        await m.kick(reason);

        await sendLog(
          guild,
          "member_kick",
          "👢 طرد عضو",
          `👤 العضو: ${m.user}\n` +
          `🛡️ الإداري: ${interaction.user}\n` +
          `📝 السبب: ${reason}`
        );

        return interaction.reply(
          `👢 تم طرد **${m.user.tag}**.`
        );
      }

      /* =====================================================
         TIMEOUT
      ===================================================== */

      if (
        command === "timeout" ||
        command === "untimeout"
      ) {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ModerateMembers
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Moderate Members."
          );
        }

        const m = await member();

        if (!m?.moderatable) {
          return errorReply(
            interaction,
            "❌ لا أستطيع تعديل هذا العضو."
          );
        }

        if (command === "timeout") {

          const minutes =
            interaction.options
              .getInteger("minutes");

          const reason =
            interaction.options
              .getString("reason") ||
            "بدون سبب";

          await m.timeout(
            minutes * 60000,
            reason
          );

          await sendLog(
            guild,
            "timeout",
            "⏳ إضافة تايم أوت",
            `👤 العضو: ${m.user}\n` +
            `⏱️ المدة: ${minutes} دقيقة\n` +
            `🛡️ الإداري: ${interaction.user}\n` +
            `📝 السبب: ${reason}`
          );

          return interaction.reply(
            `⏳ تم إعطاء **${m.user.tag}** تايم أوت.`
          );
        }

        await m.timeout(
          null,
          "إزالة Timeout"
        );

        await sendLog(
          guild,
          "timeout",
          "✅ إزالة تايم أوت",
          `👤 العضو: ${m.user}\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply(
          `✅ تم إزالة التايم أوت عن **${m.user.tag}**.`
        );
      }

      /* =====================================================
         WARN
      ===================================================== */

      if (command === "warn") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ModerateMembers
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Moderate Members."
          );
        }

        const m = await member();

        if (!m) {
          return errorReply(
            interaction,
            "❌ العضو غير موجود."
          );
        }

        const reason =
          interaction.options
            .getString("reason");

        await pool.query(
          `INSERT INTO warns
           (guild_id,user_id,reason,moderator_id)
           VALUES ($1,$2,$3,$4)`,
          [
            guild.id,
            m.id,
            reason,
            interaction.user.id
          ]
        );

        await sendLog(
          guild,
          "moderation",
          "⚠️ تحذير عضو",
          `👤 العضو: ${m.user}\n` +
          `🛡️ الإداري: ${interaction.user}\n` +
          `📝 السبب: ${reason}`
        );

        return interaction.reply(
          `⚠️ تم تحذير **${m.user.tag}**.`
        );
      }

      /* =====================================================
         WARNLIST / WARNINGS
      ===================================================== */

      if (
        command === "warnlist" ||
        command === "warnings"
      ) {

        const user =
          interaction.options
            .getUser("user");

        const result =
          user
            ? await pool.query(
                `SELECT *
                 FROM warns
                 WHERE guild_id=$1
                 AND user_id=$2
                 ORDER BY created_at DESC`,
                [
                  guild.id,
                  user.id
                ]
              )
            : await pool.query(
                `SELECT *
                 FROM warns
                 WHERE guild_id=$1
                 ORDER BY created_at DESC
                 LIMIT 50`,
                [guild.id]
              );

        if (!result.rows.length) {
          return interaction.reply(
            "✅ لا توجد تحذيرات."
          );
        }

        const text =
          result.rows
            .map(
              (w, index) =>
                `**${index + 1}.** ` +
                `<@${w.user_id}> — ` +
                `${limit(w.reason, 250)} — ` +
                `بواسطة <@${w.moderator_id}>`
            )
            .join("\n");

        return interaction.reply({
          embeds: [
            createEmbed(
              user
                ? `⚠️ تحذيرات ${user.tag}`
                : "⚠️ قائمة التحذيرات",
              limit(text, 4000)
            )
          ]
        });
      }

      /* =====================================================
         CLEAR
      ===================================================== */

      if (command === "clear") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageMessages
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Messages."
          );
        }

        const amount =
          interaction.options
            .getInteger("amount");

        const deleted =
          await interaction.channel
            .bulkDelete(
              amount,
              true
            );

        await sendLog(
          guild,
          "message_bulk_delete",
          "🧹 حذف مجموعة رسائل",
          `📍 الروم: ${interaction.channel}\n` +
          `🗑️ العدد: ${deleted.size}\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply({
          content:
            `🧹 تم مسح ${deleted.size} رسالة.`,
          flags:
            MessageFlags.Ephemeral
        });
      }

      /* =====================================================
         LOCK / UNLOCK
      ===================================================== */

      if (
        command === "lock" ||
        command === "unlock"
      ) {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageChannels
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Channels."
          );
        }

        const locked =
          command === "lock";

        await interaction.channel
          .permissionOverwrites.edit(
            guild.roles.everyone,
            {
              SendMessages:
                locked ? false : null
            }
          );

        await sendLog(
          guild,
          "channel_permissions",
          locked
            ? "🔒 قفل روم"
            : "🔓 فتح روم",
          `📍 الروم: ${interaction.channel}\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply(
          locked
            ? "🔒 تم قفل الروم."
            : "🔓 تم فتح الروم."
        );
      }

      /* =====================================================
         SLOWMODE
      ===================================================== */

      if (command === "slowmode") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageChannels
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Channels."
          );
        }

        const seconds =
          interaction.options
            .getInteger("seconds");

        await interaction.channel
          .setRateLimitPerUser(seconds);

        await sendLog(
          guild,
          "channel_update",
          "🐌 تحديث Slowmode",
          `📍 الروم: ${interaction.channel}\n` +
          `⏱️ المدة: ${seconds} ثانية\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply(
          `🐌 Slowmode: **${seconds} ثانية**.`
        );
      }

      /* =====================================================
         ROLE
      ===================================================== */

      if (command === "role") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageRoles
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Roles."
          );
        }

        const m = await member();

        const role =
          interaction.options
            .getRole("role");

        const action =
          interaction.options
            .getSubcommand();

        if (!m) {
          return errorReply(
            interaction,
            "❌ العضو غير موجود."
          );
        }

        if (
          role.managed ||
          !role.editable
        ) {
          return errorReply(
            interaction,
            "❌ رتبة البوت يجب أن تكون أعلى من هذه الرتبة."
          );
        }

        if (action === "add") {

          await m.roles.add(
            role,
            `بواسطة ${interaction.user.tag}`
          );

        } else {

          await m.roles.remove(
            role,
            `بواسطة ${interaction.user.tag}`
          );
        }

        await sendLog(
          guild,
          "member_roles",
          action === "add"
            ? "➕ إضافة رتبة"
            : "➖ إزالة رتبة",
          `👤 العضو: ${m.user}\n` +
          `🎭 الرتبة: ${role}\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply(
          `✅ تم ${
            action === "add"
              ? "إعطاء"
              : "سحب"
          } رتبة **${role.name}** من **${m.user.tag}**.`
        );
      }

      /* =====================================================
         NICKNAME
      ===================================================== */

      if (command === "nickname") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageNicknames
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Nicknames."
          );
        }

        const m = await member();

        if (!m?.manageable) {
          return errorReply(
            interaction,
            "❌ لا أستطيع تغيير اسم هذا العضو."
          );
        }

        const oldName =
          m.displayName;

        const newName =
          interaction.options
            .getString("name");

        await m.setNickname(
          newName
        );

        await sendLog(
          guild,
          "member_roles",
          "✏️ تغيير اسم عضو",
          `👤 العضو: ${m.user}\n` +
          `قبل: ${oldName}\n` +
          `بعد: ${newName}\n` +
          `🛡️ الإداري: ${interaction.user}`
        );

        return interaction.reply(
          "✅ تم تغيير الاسم."
        );
      }

      /* =====================================================
         USER INFO
      ===================================================== */

      if (
        command === "userinfo" ||
        command === "info"
      ) {

        const user =
          interaction.options
            .getUser("user");

        const m =
          await guild.members
            .fetch(user.id)
            .catch(() => null);

        const embed =
          createEmbed(
            `👤 ${user.tag}`,

            `🆔 ID: \`${user.id}\`\n\n` +
            `📅 إنشاء الحساب: ` +
            `<t:${Math.floor(
              user.createdTimestamp / 1000
            )}:R>\n\n` +

            `📥 دخول السيرفر: ${
              m?.joinedTimestamp
                ? `<t:${Math.floor(
                    m.joinedTimestamp / 1000
                  )}:R>`
                : "غير موجود"
            }\n\n` +

            `🏷️ الاسم: ${
              m?.displayName ||
              user.username
            }`
          );

        embed.setThumbnail(
          user.displayAvatarURL({
            size: 1024
          })
        );

        return interaction.reply({
          embeds: [embed]
        });
      }

      /* =====================================================
         SERVERINFO
      ===================================================== */

      if (command === "serverinfo") {

        const embed =
          createEmbed(
            `🛡️ ${guild.name}`,

            `👥 الأعضاء: ${guild.memberCount}\n` +
            `💬 الرومات: ${guild.channels.cache.size}\n` +
            `🎭 الرتب: ${guild.roles.cache.size}\n` +
            `👑 المالك: <@${guild.ownerId}>`
          );

        if (guild.iconURL()) {
          embed.setThumbnail(
            guild.iconURL({
              size: 1024
            })
          );
        }

        return interaction.reply({
          embeds: [embed]
        });
      }

      /* =====================================================
         AVATAR
      ===================================================== */

      if (command === "avatar") {

        const user =
          interaction.options
            .getUser("user");

        return interaction.reply({
          embeds: [
            createEmbed(
              `🖼️ Avatar — ${user.tag}`,
              `[فتح الصورة](${user.displayAvatarURL({
                size: 4096
              })})`
            )
              .setImage(
                user.displayAvatarURL({
                  size: 4096
                })
              )
          ]
        });
      }

      /* =====================================================
         BANNER
      ===================================================== */

      if (command === "banner") {

        const user =
          await client.users.fetch(
            interaction.options
              .getUser("user").id,
            { force: true }
          );

        if (!user.banner) {
          return interaction.reply(
            "❌ هذا العضو لا يملك بنر."
          );
        }

        return interaction.reply({
          embeds: [
            createEmbed(
              `🖼️ Banner — ${user.tag}`,
              `[فتح البنر](${user.bannerURL({
                size: 4096
              })})`
            )
              .setImage(
                user.bannerURL({
                  size: 4096
                })
              )
          ]
        });
      }

      /* =====================================================
         ROLES
      ===================================================== */

      if (command === "roles") {

        const roles =
          guild.roles.cache
            .filter(r => r.id !== guild.id)
            .sort(
              (a, b) =>
                b.position - a.position
            )
            .map(
              r =>
                `${r} — ${r.members.size} عضو`
            )
            .join("\n");

        return interaction.reply({
          embeds: [
            createEmbed(
              "🎭 رتب السيرفر",
              limit(
                roles ||
                "لا توجد رتب.",
                4000
              )
            )
          ]
        });
      }

      /* =====================================================
         SAY
      ===================================================== */

      if (command === "say") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageMessages
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Messages."
          );
        }

        await interaction.channel.send(
          interaction.options
            .getString("message")
        );

        return interaction.reply({
          content: "✅ تم الإرسال.",
          flags:
            MessageFlags.Ephemeral
        });
      }

      /* =====================================================
         AUTOREPLY
      ===================================================== */

      if (command === "autoreply") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageGuild
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Server."
          );
        }

        const sub =
          interaction.options
            .getSubcommand();

        if (sub === "add") {

          const trigger =
            interaction.options
              .getString("trigger")
              .toLowerCase();

          const response =
            interaction.options
              .getString("response");

          await pool.query(
            `INSERT INTO autoreplies
             (guild_id,trigger,response)
             VALUES ($1,$2,$3)

             ON CONFLICT
             (guild_id,trigger)
             DO UPDATE SET
             response=EXCLUDED.response`,
            [
              guild.id,
              trigger,
              response
            ]
          );

          return interaction.reply(
            "✅ تمت إضافة الرد."
          );
        }

        if (sub === "remove") {

          await pool.query(
            `DELETE FROM autoreplies
             WHERE guild_id=$1
             AND trigger=$2`,
            [
              guild.id,
              interaction.options
                .getString("trigger")
                .toLowerCase()
            ]
          );

          return interaction.reply(
            "✅ تم حذف الرد."
          );
        }

        const result =
          await pool.query(
            `SELECT trigger,response
             FROM autoreplies
             WHERE guild_id=$1
             ORDER BY trigger`,
            [guild.id]
          );

        const text =
          result.rows.length
            ? result.rows
                .map(
                  x =>
                    `**${x.trigger}** → ${limit(
                      x.response,
                      300
                    )}`
                )
                .join("\n")
            : "لا توجد ردود.";

        return interaction.reply({
          embeds: [
            createEmbed(
              "🤖 الردود التلقائية",
              limit(text, 4000)
            )
          ]
        });
      }

      /* =====================================================
         SHORTCUT
      ===================================================== */

      if (command === "shortcut") {

        if (
          !hasPermission(
            interaction,
            PermissionFlagsBits.ManageGuild
          )
        ) {
          return errorReply(
            interaction,
            "❌ لا تملك Manage Server."
          );
        }

        const sub =
          interaction.options
            .getSubcommand();

        if (sub === "set") {
                await message.reply(ar.rows[0].response);
      return;
    }

    if (content.startsWith("!")) {
      const name = content.slice(1);

      const sc = await pool.query(
        `SELECT response FROM shortcuts
         WHERE guild_id = $1 AND name = $2
         LIMIT 1`,
        [message.guild.id, name]
      );

      if (sc.rows[0]) {
        await message.reply(sc.rows[0].response);
      }
    }
  } catch (error) {
    console.error("❌ messageCreate:", error);
  }
});

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log(`✅ البوت شغال: ${client.user.tag}`);
  console.log(`🆔 Owner: ${OWNER_ID}`);
  console.log(`🆔 Special: ${SPECIAL_ID}`);

  client.user.setPresence({
    activities: [
      {
        name: "Powered by .v5d.",
        type: ActivityType.Watching
      }
    ],
    status: "online"
  });
});

/* =========================================================
   START
========================================================= */

process.on("unhandledRejection", error => {
  console.error("❌ UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ UNCAUGHT EXCEPTION:", error);
});

(async () => {
  try {
    await setupDatabase();
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error("❌ فشل تشغيل البوت:", error);
    process.exit(1);
  }
})();
