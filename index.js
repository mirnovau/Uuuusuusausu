const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  AuditLogEvent,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const OWNER_ID = "1179433017064820747";
const GUILD_ID = "1523658452382126101";

/* =========================================================
   CHECK ENV
========================================================= */

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID غير موجود");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود");
  process.exit(1);
}

/* =========================================================
   DATABASE
========================================================= */

const db = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false }
});

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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildExpressions
  ],

  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

/* =========================================================
   LOG TYPES
========================================================= */

const LOG_TYPES = {
  member_join: "إنضمام الأعضاء",
  timeout: "سجل الميوت",
  channel_permissions: "تحديث صلاحيات الرومات",
  channel_update: "تحديث الرومات",
  channel_create_delete: "إنشاء وحذف الرومات",
  member_leave: "خروج الأعضاء",
  kick: "طرد الأعضاء",
  ban: "حظر الأعضاء",
  unban: "إزالة حظر الأعضاء",
  voice: "دخول/خروج/طرد صوتي",
  voice_permissions: "منع/سماح الإستماع والتحدث",
  guild_update: "تحديث إعدادات السيرفر",
  bulk_delete: "حذف مجموعة رسائل",
  voice_move: "تنقل/سحب الأعضاء",
  emoji: "إضافة/تعديل/حذف إيموجي",
  sticker: "إضافة/تعديل/حذف ستيكر",
  reaction: "إضافة رياكشن",
  member_roles: "تحديث رُتب الأعضاء",
  message_delete: "الرسائل المحذوفة",
  role_create_delete: "إنشاء وحذف الرُتب",
  role_update: "تحديث الرُتب",
  role_permissions: "تحديث صلاحيات الرُتب",
  timeout_update: "إضافة/إزالة تايم أوت"
};

function defaultLogSettings() {
  const settings = {};

  for (const key of Object.keys(LOG_TYPES)) {
    settings[key] = true;
  }

  return settings;
}

/* =========================================================
   DATABASE SETUP
========================================================= */

async function setupDatabase() {
  console.log("🔄 فحص قاعدة البيانات...");

  await db.query(`
    CREATE TABLE IF NOT EXISTS warns (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS autoreplies (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, trigger)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS shortcuts (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(guild_id, name)
    )
  `);

  /* LOG CHANNELS */

  await db.query(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY
    )
  `);

  await db.query(`
    ALTER TABLE log_channels
    ADD COLUMN IF NOT EXISTS channel_id TEXT
  `);

  /* LOG SETTINGS */

  await db.query(`
    CREATE TABLE IF NOT EXISTS log_settings (
      guild_id TEXT PRIMARY KEY
    )
  `);

  /*
     هذا هو الإصلاح لمشكلتك:
     column "enabled" does not exist
  */

  await db.query(`
    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await db.query(`
    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `);

  await db.query(`
    INSERT INTO bot_sessions (started_at)
    VALUES (NOW())
  `);

  console.log("✅ قاعدة البيانات جاهزة");
}

/* =========================================================
   LOG SETTINGS
========================================================= */

async function ensureLogSettings(guildId) {
  await db.query(
    `
    INSERT INTO log_settings
    (guild_id, enabled, settings)
    VALUES ($1, TRUE, $2::jsonb)
    ON CONFLICT (guild_id)
    DO NOTHING
    `,
    [
      guildId,
      JSON.stringify(defaultLogSettings())
    ]
  );
}

async function getLogSettings(guildId) {
  await ensureLogSettings(guildId);

  const result = await db.query(
    `
    SELECT enabled, settings
    FROM log_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  if (!result.rows[0]) {
    return {
      enabled: true,
      settings: defaultLogSettings()
    };
  }

  let settings = result.rows[0].settings;

  if (!settings || typeof settings !== "object") {
    settings = defaultLogSettings();
  }

  for (const key of Object.keys(LOG_TYPES)) {
    if (typeof settings[key] !== "boolean") {
      settings[key] = true;
    }
  }

  return {
    enabled: result.rows[0].enabled !== false,
    settings
  };
}

async function isLogEnabled(guildId, type) {
  const data = await getLogSettings(guildId);

  if (!data.enabled) {
    return false;
  }

  return data.settings[type] === true;
}

/* =========================================================
   SEND LOG
========================================================= */

async function sendLog(guild, type, embed) {
  try {
    if (!guild) return;

    if (!LOG_TYPES[type]) return;

    if (!(await isLogEnabled(guild.id, type))) {
      return;
    }

    const result = await db.query(
      `
      SELECT channel_id
      FROM log_channels
      WHERE guild_id = $1
      `,
      [guild.id]
    );

    const channelId =
      result.rows[0]?.channel_id;

    if (!channelId) return;

    const channel =
      await guild.channels.fetch(channelId)
        .catch(() => null);

    if (!channel) return;

    if (!channel.isTextBased()) return;

    await channel.send({
      embeds: [embed]
    });

  } catch (error) {
    console.error(
      "❌ خطأ إرسال اللوق:",
      error.message
    );
  }
}

/* =========================================================
   EMBED
========================================================= */

function logEmbed(title) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0xFFFFFF)
    .setTimestamp();
}

function userText(user) {
  if (!user) {
    return "غير معروف";
  }

  return `${user} \`${user.id}\``;
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إزالة حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.BanMembers
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.KickMembers
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء تايم أوت")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("عدد الدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("حذف رسائل")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تفعيل السلو مود")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  /* =====================================================
     ROLE
  ===================================================== */

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة من عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("اختر العضو")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("اختر الرتبة")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("action")
        .setDescription("اختر الحالة")
        .setRequired(true)
        .addChoices(
          {
            name: "➕ إضافة",
            value: "add"
          },
          {
            name: "➖ إزالة",
            value: "remove"
          }
        )
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("تغيير اسم عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("name")
        .setDescription("الاسم الجديد")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageNicknames
    ),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("عرض صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("عرض بانر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("عرض رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")
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
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")
    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إضافة اختصار")
        .addStringOption(o =>
          o.setName("name")
            .setDescription("الاسم")
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
            .setDescription("الاسم")
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName("list")
        .setDescription("عرض الاختصارات")
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  /* =====================================================
     LOG
  ===================================================== */

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إدارة نظام اللوق")
    .addSubcommand(s =>
      s.setName("setup")
        .setDescription("تحديد روم اللوق الحالي")
    )
    .addSubcommand(s =>
      s.setName("status")
        .setDescription("عرض حالة اللوق")
    )
    .addSubcommand(s =>
      s.setName("enable")
        .setDescription("تشغيل جميع اللوقات")
    )
    .addSubcommand(s =>
      s.setName("disable")
        .setDescription("إيقاف جميع اللوقات")
    )
    .addSubcommand(s =>
      s.setName("edit")
        .setDescription("تعديل أنواع اللوق")
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    ),

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("معلومات البوت"),

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("من أنا؟")
];

/* =========================================================
   REGISTER COMMANDS
========================================================= */

async function registerCommands() {

  const rest =
    new REST({ version: "10" })
      .setToken(TOKEN);

  console.log("🔄 تسجيل الأوامر للسيرفر...");

  await rest.put(
    Routes.applicationGuildCommands(
      CLIENT_ID,
      GUILD_ID
    ),
    {
      body: commands.map(c => c.toJSON())
    }
  );

  console.log("✅ تم تسجيل الأوامر");
}

/* =========================================================
   READY
========================================================= */

client.once("ready", () => {

  console.log("================================");
  console.log(`✅ البوت متصل: ${client.user.tag}`);
  console.log(`🆔 ${client.user.id}`);
  console.log(`🏠 السيرفرات: ${client.guilds.cache.size}`);
  console.log("================================");

  client.user.setPresence({
    activities: [
      {
        name: "/help | إدارة السيرفر",
        type: 3
      }
    ],
    status: "online"
  });
});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {

  try {

    /* =====================================================
       LOG SELECT MENU
    ===================================================== */

    if (interaction.isStringSelectMenu()) {

      if (!interaction.customId.startsWith("log_edit_")) {
        return;
      }

      if (!interaction.guild) {
        return;
      }

      const isOwner =
        interaction.user.id === OWNER_ID;

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const type =
        interaction.values[0];

      if (!LOG_TYPES[type]) {
        return interaction.reply({
          content: "❌ نوع اللوق غير معروف.",
          ephemeral: true
        });
      }

      const data =
        await getLogSettings(
          interaction.guildId
        );

      data.settings[type] =
        !data.settings[type];

      await db.query(
        `
        UPDATE log_settings
        SET settings = $1::jsonb
        WHERE guild_id = $2
        `,
        [
          JSON.stringify(data.settings),
          interaction.guildId
        ]
      );

      return interaction.update({
        content:
          `✅ **${LOG_TYPES[type]}**\n\n` +
          `الحالة الآن: ${
            data.settings[type]
              ? "🟢 مفعّل"
              : "🔴 متوقف"
          }`,
        components: []
      });
    }

    /* =====================================================
       COMMAND ONLY
    ===================================================== */

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.guild) {
      return interaction.reply({
        content:
          "❌ هذا الأمر يعمل داخل السيرفر فقط.",
        ephemeral: true
      });
    }

    const isOwner =
      interaction.user.id === OWNER_ID;

    /* =====================================================
       BAN
    ===================================================== */

    if (interaction.commandName === "ban") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.BanMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية الحظر.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      await interaction.guild.members.ban(
        user.id,
        { reason }
      );

      await interaction.reply({
        content:
          `🔨 تم حظر ${user}\n` +
          `**السبب:** ${reason}`
      });

      const embed =
        logEmbed("🔨 حظر عضو")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            },
            {
              name: "السبب",
              value: reason
            }
          );

      await sendLog(
        interaction.guild,
        "ban",
        embed
      );

      return;
    }

    /* =====================================================
       UNBAN
    ===================================================== */

    if (interaction.commandName === "unban") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.BanMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const id =
        interaction.options.getString("userid");

      await interaction.guild.members.unban(id);

      await interaction.reply({
        content:
          `🔓 تم إزالة الحظر عن \`${id}\`.`
      });

      const embed =
        logEmbed("🔓 إزالة حظر")
          .addFields(
            {
              name: "العضو",
              value: `\`${id}\``
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            }
          );

      await sendLog(
        interaction.guild,
        "unban",
        embed
      );

      return;
    }

    /* =====================================================
       KICK
    ===================================================== */

    if (interaction.commandName === "kick") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.KickMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية الطرد.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      await member.kick(reason);

      await interaction.reply({
        content:
          `👢 تم طرد ${user}\n` +
          `**السبب:** ${reason}`
      });

      const embed =
        logEmbed("👢 طرد عضو")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            },
            {
              name: "السبب",
              value: reason
            }
          );

      await sendLog(
        interaction.guild,
        "kick",
        embed
      );

      return;
    }

    /* =====================================================
       TIMEOUT
    ===================================================== */

    if (interaction.commandName === "timeout") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const minutes =
        interaction.options.getInteger("minutes");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      await member.timeout(
        minutes * 60 * 1000,
        reason
      );

      await interaction.reply({
        content:
          `🔇 تم إعطاء ${user} تايم أوت لمدة **${minutes} دقيقة**.`
      });

      const embed =
        logEmbed("🔇 إضافة تايم أوت")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "المدة",
              value: `${minutes} دقيقة`
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            },
            {
              name: "السبب",
              value: reason
            }
          );

      await sendLog(
        interaction.guild,
        "timeout_update",
        embed
      );

      return;
    }

    /* =====================================================
       UNTIMEOUT
    ===================================================== */

    if (interaction.commandName === "untimeout") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      await member.timeout(null);

      await interaction.reply({
        content:
          `🔊 تم إزالة التايم أوت عن ${user}.`
      });

      const embed =
        logEmbed("🔊 إزالة تايم أوت")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            }
          );

      await sendLog(
        interaction.guild,
        "timeout_update",
        embed
      );

      return;
    }

    /* =====================================================
       WARN
    ===================================================== */

    if (interaction.commandName === "warn") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason");

      await db.query(
        `
        INSERT INTO warns
        (guild_id, user_id, moderator_id, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [
          interaction.guildId,
          user.id,
          interaction.user.id,
          reason
        ]
      );

      await interaction.reply({
        content:
          `⚠️ تم تحذير ${user}\n` +
          `**السبب:** ${reason}`
      });

      return;
    }

    /* =====================================================
       WARNLIST
    ===================================================== */

    if (interaction.commandName === "warnlist") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      let result;

      if (user) {

        result = await db.query(
          `
          SELECT *
          FROM warns
          WHERE guild_id = $1
          AND user_id = $2
          ORDER BY created_at DESC
          `,
          [
            interaction.guildId,
            user.id
          ]
        );

      } else {

        result = await db.query(
          `
          SELECT *
          FROM warns
          WHERE guild_id = $1
          ORDER BY created_at DESC
          LIMIT 50
          `,
          [interaction.guildId]
        );
      }

      if (!result.rows.length) {
        return interaction.reply({
          content: "✅ لا توجد تحذيرات.",
          ephemeral: true
        });
      }

      const text =
        result.rows.map((row, i) => {
          return (
            `**${i + 1}.** <@${row.user_id}>\n` +
            `السبب: ${row.reason || "بدون سبب"}\n` +
            `الإداري: <@${row.moderator_id}>\n` +
            `التاريخ: <t:${Math.floor(
              new Date(row.created_at).getTime() / 1000
            )}:R>`
          );
        }).join("\n\n");

      return interaction.reply({
        embeds: [
          logEmbed("⚠️ سجل التحذيرات")
            .setDescription(text)
        ],
        ephemeral: true
      });
    }

    /* =====================================================
       CLEAR
    ===================================================== */

    if (interaction.commandName === "clear") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageMessages
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const amount =
        interaction.options.getInteger("amount");

      const messages =
        await interaction.channel.bulkDelete(
          amount,
          true
        );

      await interaction.reply({
        content:
          `🧹 تم حذف **${messages.size}** رسالة.`,
        ephemeral: true
      });

      const embed =
        logEmbed("🧹 حذف مجموعة رسائل")
          .addFields(
            {
              name: "العدد",
              value: `${messages.size}`
            },
            {
              name: "الروم",
              value: `${interaction.channel}`
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            }
          );

      await sendLog(
        interaction.guild,
        "bulk_delete",
        embed
      );

      return;
    }

    /* =====================================================
       LOCK
    ===================================================== */

    if (interaction.commandName === "lock") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageChannels
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      await interaction.reply({
        content: "🔒 تم قفل الروم."
      });

      return;
    }

    /* =====================================================
       UNLOCK
    ===================================================== */

    if (interaction.commandName === "unlock") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageChannels
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      await interaction.reply({
        content: "🔓 تم فتح الروم."
      });

      return;
    }

    /* =====================================================
       SLOWMODE
    ===================================================== */

    if (interaction.commandName === "slowmode") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageChannels
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const seconds =
        interaction.options.getInteger("seconds");

      await interaction.channel.setRateLimitPerUser(
        seconds
      );

      await interaction.reply({
        content:
          seconds === 0
            ? "⚡ تم إيقاف السلو مود."
            : `🐌 السلو مود: **${seconds} ثانية**.`
      });

      return;
    }

    /* =====================================================
       ROLE
    ===================================================== */

    if (interaction.commandName === "role") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageRoles
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية إدارة الرتب.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const role =
        interaction.options.getRole("role");

      const action =
        interaction.options.getString("action");

      if (!role) {
        return interaction.reply({
          content: "❌ الرتبة غير موجودة.",
          ephemeral: true
        });
      }

      if (role.managed) {
        return interaction.reply({
          content:
            "❌ لا يمكن إدارة هذه الرتبة.",
          ephemeral: true
        });
      }

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      const botMember =
        await interaction.guild.members.fetchMe();

      /* رتبة البوت */

      if (
        role.position >=
        botMember.roles.highest.position
      ) {
        return interaction.reply({
          content:
            "❌ رتبة البوت أقل من هذه الرتبة.\n" +
            "ارفع رتبة البوت فوق الرتبة المطلوبة.",
          ephemeral: true
        });
      }

      /* رتبة الإداري */

      if (
        !isOwner &&
        role.position >=
        interaction.member.roles.highest.position
      ) {
        return interaction.reply({
          content:
            "❌ لا تستطيع إدارة رتبة أعلى من أو مساوية لأعلى رتبة لديك.",
          ephemeral: true
        });
      }

      /* ADD */

      if (action === "add") {

        if (member.roles.cache.has(role.id)) {
          return interaction.reply({
            content:
              `ℹ️ ${user} يملك ${role} بالفعل.`,
            ephemeral: true
          });
        }

        await member.roles.add(role);

        await interaction.reply({
          content:
            `✅ تمت إضافة ${role} إلى ${user}.`
        });
      }

      /* REMOVE */

      if (action === "remove") {

        if (!member.roles.cache.has(role.id)) {
          return interaction.reply({
            content:
              `ℹ️ ${user} لا يملك ${role}.`,
            ephemeral: true
          });
        }

        await member.roles.remove(role);

        await interaction.reply({
          content:
            `✅ تمت إزالة ${role} من ${user}.`
        });
      }

      const embed =
        logEmbed("🎭 تحديث رتبة عضو")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "الرول",
              value: `${role} \`${role.id}\``
            },
            {
              name: "الحالة",
              value:
                action === "add"
                  ? "➕ إضافة"
                  : "➖ إزالة"
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            }
          );

      await sendLog(
        interaction.guild,
        "member_roles",
        embed
      );

      return;
    }

    /* =====================================================
       NICKNAME
    ===================================================== */

    if (interaction.commandName === "nickname") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageNicknames
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const name =
        interaction.options.getString("name");

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      const oldName =
        member.nickname ||
        member.user.username;

      await member.setNickname(name);

      await interaction.reply({
        content:
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
      });

      const embed =
        logEmbed("✏️ تغيير اسم عضو")
          .addFields(
            {
              name: "العضو",
              value: userText(user)
            },
            {
              name: "الاسم السابق",
              value: oldName
            },
            {
              name: "الاسم الجديد",
              value: name
            },
            {
              name: "الإداري",
              value: userText(interaction.user)
            }
          );

      await sendLog(
        interaction.guild,
        "member_roles",
        embed
      );

      return;
    }

    /* =====================================================
       INFO
    ===================================================== */

    if (interaction.commandName === "info") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      const embed =
        logEmbed("👤 معلومات العضو")
          .setThumbnail(
            user.displayAvatarURL()
          )
          .addFields(
            {
              name: "الاسم",
              value: user.username
            },
            {
              name: "ID",
              value: user.id
            },
            {
              name: "بوت",
              value: user.bot ? "نعم" : "لا"
            }
          );

      if (member) {
        embed.addFields({
          name: "الرتب",
          value:
            member.roles.cache
              .filter(r =>
                r.id !== interaction.guild.id
              )
              .map(r => `${r}`)
              .join(" ") ||
            "لا توجد"
        });
      }

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* =====================================================
       SERVERINFO
    ===================================================== */

    if (interaction.commandName === "serverinfo") {

      const guild =
        interaction.guild;

      const embed =
        logEmbed("🏠 معلومات السيرفر")
          .setThumbnail(
            guild.iconURL()
          )
          .addFields(
            {
              name: "الاسم",
              value: guild.name
            },
            {
              name: "ID",
              value: guild.id
            },
            {
              name: "الأعضاء",
              value: `${guild.memberCount}`
            },
            {
              name: "الرومات",
              value: `${guild.channels.cache.size}`
            },
            {
              name: "الرتب",
              value: `${guild.roles.cache.size}`
            }
          );

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* =====================================================
       AVATAR
    ===================================================== */

    if (interaction.commandName === "avatar") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const url =
        user.displayAvatarURL({
          size: 4096,
          extension: "png"
        });

      return interaction.reply({
        embeds: [
          logEmbed("🖼️ صورة العضو")
            .setImage(url)
        ]
      });
    }

    /* =====================================================
       BANNER
    ===================================================== */

    if (interaction.commandName === "banner") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const fullUser =
        await client.users.fetch(
          user.id,
          { force: true }
        );

      if (!fullUser.banner) {
        return interaction.reply({
          content:
            "❌ هذا العضو لا يملك بانر.",
          ephemeral: true
        });
      }

      return interaction.reply({
        embeds: [
          logEmbed("🎨 بانر العضو")
            .setImage(
              fullUser.bannerURL({
                size: 4096,
                extension: "png"
              })
            )
        ]
      });
    }

    /* =====================================================
       ROLES
    ===================================================== */

    if (interaction.commandName === "roles") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      const roles =
        member.roles.cache
          .filter(r =>
            r.id !== interaction.guild.id
          )
          .sort(
            (a, b) =>
              b.position - a.position
          )
          .map(r => `${r}`)
          .join(" ");

      return interaction.reply({
        embeds: [
          logEmbed("🎭 رتب العضو")
            .setDescription(
              roles || "لا توجد رتب."
            )
        ]
      });
    }

    /* =====================================================
       AUTOREPLY
    ===================================================== */

    if (interaction.commandName === "autoreply") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const sub =
        interaction.options.getSubcommand();

      if (sub === "add") {

        const trigger =
          interaction.options
            .getString("trigger")
            .toLowerCase();

        const response =
          interaction.options
            .getString("response");

        await db.query(
          `
          INSERT INTO autoreplies
          (guild_id, trigger, response)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id, trigger)
          DO UPDATE SET response = EXCLUDED.response
          `,
          [
            interaction.guildId,
            trigger,
            response
          ]
        );

        return interaction.reply({
          content:
            `✅ تم حفظ الرد.\n` +
            `**${trigger}** → ${response}`
        });
      }

      if (sub === "remove") {

        const trigger =
          interaction.options
            .getString("trigger")
            .toLowerCase();

        await db.query(
          `
          DELETE FROM autoreplies
          WHERE guild_id = $1
          AND trigger = $2
          `,
          [
            interaction.guildId,
            trigger
          ]
        );

        return interaction.reply({
          content:
            `🗑️ تم حذف **${trigger}**.`
        });
      }
    }

    /* =====================================================
       LIST
    ===================================================== */

    if (interaction.commandName === "list") {

      const result =
        await db.query(
          `
          SELECT trigger, response
          FROM autoreplies
          WHERE guild_id = $1
          ORDER BY trigger
          `,
          [interaction.guildId]
        );

      if (!result.rows.length) {
        return interaction.reply({
          content:
            "📭 لا توجد ردود تلقائية."
        });
      }

      const text =
        result.rows
          .map(x =>
            `**${x.trigger}** → ${x.response}`
          )
          .join("\n");

      return interaction.reply({
        embeds: [
          logEmbed("🤖 الردود التلقائية")
            .setDescription(text)
        ]
      });
    }

    /* =====================================================
       SHORTCUT
    ===================================================== */

    if (interaction.commandName === "shortcut") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const sub =
        interaction.options.getSubcommand();

      if (sub === "set") {

        const name =
          interaction.options.getString("name");

        const response =
          interaction.options.getString("response");

        await db.query(
          `
          INSERT INTO shortcuts
          (guild_id, name, response)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id, name)
          DO UPDATE SET response = EXCLUDED.response
          `,
          [
            interaction.guildId,
            name,
            response
          ]
        );

        return interaction.reply({
          content:
            `✅ تم حفظ الاختصار **${name}**.`
        });
      }

      if (sub === "remove") {

        const name =
          interaction.options.getString("name");

        await db.query(
          `
          DELETE FROM shortcuts
          WHERE guild_id = $1
          AND name = $2
          `,
          [
            interaction.guildId,
            name
          ]
        );

        return interaction.reply({
          content:
            `🗑️ تم حذف الاختصار **${name}**.`
        });
      }

      if (sub === "list") {

        const result =
          await db.query(
            `
            SELECT name, response
            FROM shortcuts
            WHERE guild_id = $1
            ORDER BY name
            `,
            [interaction.guildId]
          );

        if (!result.rows.length) {
          return interaction.reply({
            content:
              "📭 لا توجد اختصارات."
          });
        }

        return interaction.reply({
          embeds: [
            logEmbed("⚡ الاختصارات")
              .setDescription(
                result.rows
                  .map(x =>
                    `**${x.name}** → ${x.response}`
                  )
                  .join("\n")
              )
          ]
        });
      }
    }

    /* =====================================================
       LOG SETUP
    ===================================================== */

    if (
      interaction.commandName === "log" &&
      interaction.options.getSubcommand() === "setup"
    ) {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.channel;

      const me =
        await interaction.guild.members.fetchMe();

      const permissions =
        channel.permissionsFor(me);

      if (
        !permissions?.has(
          PermissionFlagsBits.ViewChannel
        ) ||
        !permissions?.has(
          PermissionFlagsBits.SendMessages
        ) ||
        !permissions?.has(
          PermissionFlagsBits.EmbedLinks
        )
      ) {
        return interaction.reply({
          content:
            "❌ البوت يحتاج:\n" +
            "• View Channel\n" +
            "• Send Messages\n" +
            "• Embed Links",
          ephemeral: true
        });
      }

      await db.query(
        `
        INSERT INTO log_channels
        (guild_id, channel_id)
        VALUES ($1, $2)
        ON CONFLICT (guild_id)
        DO UPDATE SET channel_id = EXCLUDED.channel_id
        `,
        [
          interaction.guildId,
          channel.id
        ]
      );

      await ensureLogSettings(
        interaction.guildId
      );

      return interaction.reply({
        embeds: [
          logEmbed("✅ تم إعداد اللوق")
            .setDescription(
              `روم اللوق: ${channel}\n\n` +
              "🟢 جميع اللوقات مفعلة."
            )
        ]
      });
    }

    /* =====================================================
       LOG STATUS
    ===================================================== */

    if (
      interaction.commandName === "log" &&
      interaction.options.getSubcommand() === "status"
    ) {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const data =
        await getLogSettings(
          interaction.guildId
        );

      const channelResult =
        await db.query(
          `
          SELECT channel_id
          FROM log_channels
          WHERE guild_id = $1
          `,
          [interaction.guildId]
        );

      const channelId =
        channelResult.rows[0]?.channel_id;

      const enabled =
        Object.values(data.settings)
          .filter(Boolean).length;

      const total =
        Object.keys(LOG_TYPES).length;

      const text =
        `**النظام:** ${
          data.enabled
            ? "🟢 مفعّل"
            : "🔴 متوقف"
        }\n` +
        `**روم اللوق:** ${
          channelId
            ? `<#${channelId}>`
            : "❌ غير محدد"
        }\n` +
        `**المفعّل:** ${enabled}/${total}\n\n` +
        Object.entries(LOG_TYPES)
          .map(([key, name]) =>
            `${data.settings[key] ? "🟢" : "🔴"} ${name}`
          )
          .join("\n");

      return interaction.reply({
        embeds: [
          logEmbed("📋 حالة نظام اللوق")
            .setDescription(text)
        ],
        ephemeral: true
      });
    }

    /* =====================================================
       LOG ENABLE
    ===================================================== */

    if (
      interaction.commandName === "log" &&
      interaction.options.getSubcommand() === "enable"
    ) {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      await ensureLogSettings(
        interaction.guildId
      );

      await db.query(
        `
        UPDATE log_settings
        SET enabled = TRUE
        WHERE guild_id = $1
        `,
        [interaction.guildId]
      );

      return interaction.reply({
        content:
          "🟢 تم تشغيل نظام اللوق بالكامل."
      });
    }

    /* =====================================================
       LOG DISABLE
    ===================================================== */

    if (
      interaction.commandName === "log" &&
      interaction.options.getSubcommand() === "disable"
    ) {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      await ensureLogSettings(
        interaction.guildId
      );

      await db.query(
        `
        UPDATE log_settings
        SET enabled = FALSE
        WHERE guild_id = $1
        `,
        [interaction.guildId]
      );

      return interaction.reply({
        content:
          "🔴 تم إيقاف نظام اللوق بالكامل."
      });
    }

    /* =====================================================
       LOG EDIT
    ===================================================== */

    if (
      interaction.commandName === "log" &&
      interaction.options.getSubcommand() === "edit"
    ) {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const data =
        await getLogSettings(
          interaction.guildId
        );

      const menu =
        new StringSelectMenuBuilder()
          .setCustomId(
            `log_edit_${interaction.guildId}`
          )
          .setPlaceholder(
            "اختر نوع اللوق"
          )
          .setMinValues(1)
          .setMaxValues(1);

      for (
        const [key, name]
        of Object.entries(LOG_TYPES)
      ) {

        menu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(name)
            .setValue(key)
            .setDescription(
              data.settings[key]
                ? "🟢 مفعّل - اضغط لإيقافه"
                : "🔴 متوقف - اضغط لتفعيله"
            )
        );
      }

      const row =
        new ActionRowBuilder()
          .addComponents(menu);

      return interaction.reply({
        content:
          "⚙️ اختر نوع اللوق الذي تريد تشغيله أو إيقافه:",
        components: [row],
        ephemeral: true
      });
    }

    /* =====================================================
       LOG TEST
    ===================================================== */

    if (interaction.commandName === "logs") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const embed =
        logEmbed("🧪 اختبار اللوق")
          .setDescription(
            "إذا ظهر هذا الإمبد هنا، فنظام اللوق يعمل."
          )
          .addFields({
            name: "الإداري",
            value: userText(interaction.user)
          });

      await sendLog(
        interaction.guild,
        "guild_update",
        embed
      );

      return interaction.reply({
        content:
          "✅ تم إرسال اختبار اللوق."
      });
    }

    /* =====================================================
       BOT
    ===================================================== */

    if (interaction.commandName === "bot") {

      const uptime =
        client.uptime || 0;

      const totalSeconds =
        Math.floor(uptime / 1000);

      const days =
        Math.floor(totalSeconds / 86400);

      const hours =
        Math.floor(
          (totalSeconds % 86400) / 3600
        );

      const minutes =
        Math.floor(
          (totalSeconds % 3600) / 60
        );

      const seconds =
        totalSeconds % 60;

      return interaction.reply({
        embeds: [
          logEmbed("🤖 معلومات البوت")
            .setThumbnail(
              client.user.displayAvatarURL()
            )
            .addFields(
              {
                name: "الحالة",
                value: "🟢 متصل"
              },
              {
                name: "الاسم",
                value: client.user.username
              },
              {
                name: "ID",
                value: client.user.id
              },
              {
                name: "السيرفرات",
                value:
                  `${client.guilds.cache.size}`
              },
              {
                name: "مدة التشغيل",
                value:
                  `${days} يوم ${hours} ساعة ` +
                  `${minutes} دقيقة ${seconds} ثانية`
              },
              {
                name: "Ping",
                value:
                  `${client.ws.ping}ms`
              }
            )
        ]
      });
    }

    /* =====================================================
       ME
    ===================================================== */

    if (interaction.commandName === "me") {

      return interaction.reply({
        embeds: [
          logEmbed("🤖 مين أنا؟")
            .setDescription(
              "أنا بوت خاص لـ **.v5d.**\n\n" +
              "ولدي سيرفر **Mr Nova**.\n\n" +
              "مهمتي إدارة السيرفر والحماية واللوقات."
            )
        ]
      });
    }

  } catch (error) {

    console.error("================================");
    console.error("❌ INTERACTION ERROR:");
    console.error(error);
    console.error("================================");

    if (
      interaction.replied ||
      interaction.deferred
    ) {

      await interaction.followUp({
        content:
          "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    } else {

      await interaction.reply({
        content:
          "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {

  const embed =
    logEmbed("📥 إنضمام عضو")
      .addFields(
        {
          name: "العضو",
          value: userText(member.user)
        },
        {
          name: "عدد الأعضاء",
          value: `${member.guild.memberCount}`
        }
      );

  await sendLog(
    member.guild,
    "member_join",
    embed
  );
});

/* =========================================================
   MEMBER LEAVE
========================================================= */

client.on("guildMemberRemove", async member => {

  const embed =
    logEmbed("📤 خروج عضو")
      .addFields({
        name: "العضو",
        value: userText(member.user)
      });

  await sendLog(
    member.guild,
    "member_leave",
    embed
  );
});

/* =========================================================
   MEMBER UPDATE
========================================================= */

client.on(
  "guildMemberUpdate",
  async (oldMember, newMember) => {

    const added =
      newMember.roles.cache.filter(
        r =>
          !oldMember.roles.cache.has(r.id)
      );

    const removed =
      oldMember.roles.cache.filter(
        r =>
          !newMember.roles.cache.has(r.id)
      );

    if (added.size || removed.size) {

      const embed =
        logEmbed("🎭 تحديث رتب عضو")
          .addFields(
            {
              name: "العضو",
              value: userText(newMember.user)
            },
            {
              name: "تمت الإضافة",
              value:
                added.map(r => `${r}`).join(" ") ||
                "لا يوجد"
            },
            {
              name: "تمت الإزالة",
              value:
                removed.map(r => `${r}`).join(" ") ||
                "لا يوجد"
            }
          );

      await sendLog(
        newMember.guild,
        "member_roles",
        embed
      );
    }

    const oldTimeout =
      oldMember.communicationDisabledUntilTimestamp;

    const newTimeout =
      newMember.communicationDisabledUntilTimestamp;

    if (oldTimeout !== newTimeout) {

      const embed =
        logEmbed("🔇 تحديث التايم أوت")
          .addFields(
            {
              name: "العضو",
              value: userText(newMember.user)
            },
            {
              name: "الحالة",
              value:
                newTimeout
                  ? `🔴 حتى <t:${Math.floor(
                      newTimeout / 1000
                    )}:F>`
                  : "🟢 تمت إزالة التايم أوت"
            }
          );

      await sendLog(
        newMember.guild,
        "timeout_update",
        embed
      );
    }
  }
);

/* =========================================================
   VOICE
========================================================= */

client.on(
  "voiceStateUpdate",
  async (oldState, newState) => {

    const guild =
      newState.guild || oldState.guild;

    const member =
      newState.member || oldState.member;

    if (!member) return;

    if (
      !oldState.channelId &&
      newState.channelId
    ) {

      const embed =
        logEmbed("🔊 دخول صوتي")
          .addFields(
            {
              name: "العضو",
              value: userText(member.user)
            },
            {
              name: "الروم",
              value: `${newState.channel}`
            }
          );

      await sendLog(
        guild,
        "voice",
        embed
      );

      return;
    }

    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      const embed =
        logEmbed("🔇 خروج صوتي")
          .addFields(
            {
              name: "العضو",
              value: userText(member.user)
            },
            {
              name: "الروم",
              value: `${oldState.channel}`
            }
          );

      await sendLog(
        guild,
        "voice",
        embed
      );

      return;
    }

    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
        newState.channelId
    ) {

      const embed =
        logEmbed("🔀 تنقل صوتي")
          .addFields(
            {
              name: "العضو",
              value: userText(member.user)
            },
            {
              name: "من",
              value: `${oldState.channel}`
            },
            {
              name: "إلى",
              value: `${newState.channel}`
            }
          );

      await sendLog(
        guild,
        "voice_move",
        embed
      );

      return;
    }

    if (
      oldState.serverMute !==
        newState.serverMute ||
      oldState.serverDeaf !==
        newState.serverDeaf
    ) {

      const embed =
        logEmbed("🎙️ تحديث صلاحيات الصوت")
          .addFields(
            {
              name: "العضو",
              value: userText(member.user)
            },
            {
              name: "التحدث",
              value:
                newState.serverMute
                  ? "🔴 ممنوع"
                  : "🟢 مسموح"
            },
            {
              name: "الإستماع",
              value:
                newState.serverDeaf
                  ? "🔴 ممنوع"
                  : "🟢 مسموح"
            }
          );

      await sendLog(
        guild,
        "voice_permissions",
        embed
      );
    }
  }
);

/* =========================================================
   CHANNEL CREATE
========================================================= */

client.on(
  "channelCreate",
  async channel => {

    if (!channel.guild) return;

    const embed =
      logEmbed("📁 إنشاء روم")
        .addFields(
          {
            name: "الروم",
            value: `${channel}`
          },
          {
            name: "الاسم",
            value: channel.name
          }
        );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      embed
    );
  }
);

/* =========================================================
   CHANNEL DELETE
========================================================= */

client.on(
  "channelDelete",
  async channel => {

    if (!channel.guild) return;

    const embed =
      logEmbed("🗑️ حذف روم")
        .addFields(
          {
            name: "الاسم",
            value: channel.name
          },
          {
            name: "ID",
            value: channel.id
          }
        );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      embed
    );
  }
);

/* =========================================================
   CHANNEL UPDATE
========================================================= */

client.on(
  "channelUpdate",
  async (oldChannel, newChannel) => {

    if (!newChannel.guild) return;

    if (
      oldChannel.name !==
        newChannel.name ||
      oldChannel.topic !==
        newChannel.topic ||
      oldChannel.parentId !==
        newChannel.parentId ||
      oldChannel.rateLimitPerUser !==
        newChannel.rateLimitPerUser
    ) {

      const embed =
        logEmbed("✏️ تحديث روم")
          .addFields(
            {
              name: "الروم",
              value: `${newChannel}`
            },
            {
              name: "الاسم السابق",
              value: oldChannel.name
            },
            {
              name: "الاسم الجديد",
              value: newChannel.name
            }
          );

      await sendLog(
        newChannel.guild,
        "channel_update",
        embed
      );
    }
  }
);

/* =========================================================
   ROLE CREATE
========================================================= */

client.on(
  "roleCreate",
  async role => {

    const embed =
      logEmbed("🎭 إنشاء رتبة")
        .addFields(
          {
            name: "الرتبة",
            value: `${role}`
          },
          {
            name: "الاسم",
            value: role.name
          }
        );

    await sendLog(
      role.guild,
      "role_create_delete",
      embed
    );
  }
);

/* =========================================================
   ROLE DELETE
========================================================= */

client.on(
  "roleDelete",
  async role => {

    const embed =
      logEmbed("🗑️ حذف رتبة")
        .addFields(
          {
            name: "الاسم",
            value: role.name
          },
          {
            name: "ID",
            value: role.id
          }
        );

    await sendLog(
      role.guild,
      "role_create_delete",
      embed
    );
  }
);

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on(
  "roleUpdate",
  async (oldRole, newRole) => {

    if (
      oldRole.name !== newRole.name ||
      oldRole.color !== newRole.color ||
      oldRole.hoist !== newRole.hoist ||
      oldRole.mentionable !==
        newRole.mentionable
    ) {

      const embed =
        logEmbed("✏️ تحديث رتبة")
          .addFields(
            {
              name: "الرتبة",
              value: `${newRole}`
            },
            {
              name: "الاسم السابق",
              value: oldRole.name
            },
            {
              name: "الاسم الجديد",
              value: newRole.name
            }
          );

      await sendLog(
        newRole.guild,
        "role_update",
        embed
      );
    }

    if (
      oldRole.permissions.bitfield !==
      newRole.permissions.bitfield
    ) {

      const embed =
        logEmbed("🔐 تحديث صلاحيات رتبة")
          .addFields({
            name: "الرتبة",
            value: `${newRole}`
          });

      await sendLog(
        newRole.guild,
        "role_permissions",
        embed
      );
    }
  }
);

/* =========================================================
   GUILD UPDATE
========================================================= */

client.on(
  "guildUpdate",
  async (oldGuild, newGuild) => {

    if (
      oldGuild.name !== newGuild.name ||
      oldGuild.icon !== newGuild.icon ||
      oldGuild.banner !== newGuild.banner ||
      oldGuild.description !==
        newGuild.description ||
      oldGuild.verificationLevel !==
        newGuild.verificationLevel
    ) {

      const embed =
        logEmbed("⚙️ تحديث إعدادات السيرفر")
          .addFields(
            {
              name: "الاسم السابق",
              value: oldGuild.name
            },
            {
              name: "الاسم الجديد",
              value: newGuild.name
            }
          );

      await sendLog(
        newGuild,
        "guild_update",
        embed
      );
    }
  }
);

/* =========================================================
   MESSAGE DELETE
   يظهر الإداري الذي حذف الرسالة
========================================================= */

client.on(
  "messageDelete",
  async message => {

    try {

      if (!message.guild) return;

      if (message.author?.bot) return;

      let moderator = null;

      try {

        const logs =
          await message.guild.fetchAuditLogs({
            type: AuditLogEvent.MessageDelete,
            limit: 10
          });

        const entry =
          logs.entries.find(entry => {

            if (!entry.target) {
              return false;
            }

            if (
              message.author &&
              entry.target.id !==
                message.author.id
            ) {
              return false;
            }

            return (
              Date.now() -
                entry.createdTimestamp <
              10000
            );
          });

        moderator =
          entry?.executor || null;

      } catch (error) {

        console.log(
          "⚠️ لم أستطع معرفة الإداري:",
          error.message
        );
      }

      const embed =
        logEmbed("🗑️ حذف رسالة")
          .addFields(
            {
              name: "العضو",
              value:
                message.author
                  ? userText(message.author)
                  : "غير معروف"
            },
            {
              name: "الإداري",
              value:
                moderator
                  ? userText(moderator)
                  : "غير معروف"
            },
            {
              name: "الروم",
              value:
                message.channel
                  ? `${message.channel}`
                  : "غير معروف"
            },
            {
              name: "المحتوى",
              value:
                message.content
                  ? message.content.slice(0, 1000)
                  : "لا يوجد محتوى محفوظ"
            }
          );

      await sendLog(
        message.guild,
        "message_delete",
        embed
      );

    } catch (error) {

      console.error(
        "❌ خطأ حذف الرسالة:",
        error
      );
    }
  }
);

/* =========================================================
   BULK DELETE
========================================================= */

client.on(
  "messageDeleteBulk",
  async messages => {

    try {

      const message =
        messages.first();

      if (!message?.guild) {
        return;
      }

      let moderator = null;

      try {

        const logs =
          await message.guild.fetchAuditLogs({
            type: AuditLogEvent.MessageBulkDelete,
            limit: 5
          });

        const entry =
          logs.entries.find(entry =>
            Date.now() -
              entry.createdTimestamp <
            10000
          );

        moderator =
          entry?.executor || null;

      } catch {}

      const embed =
        logEmbed("🧹 حذف مجموعة رسائل")
          .addFields(
            {
              name: "عدد الرسائل",
              value: `${messages.size}`
            },
            {
              name: "الروم",
              value: `${message.channel}`
            },
            {
              name: "الإداري",
              value:
                moderator
                  ? userText(moderator)
                  : "غير معروف"
            }
          );

      await sendLog(
        message.guild,
        "bulk_delete",
        embed
      );

    } catch (error) {

      console.error(
        "❌ Bulk delete error:",
        error
      );
    }
  }
);

/* =========================================================
   REACTION
========================================================= */

client.on(
  "messageReactionAdd",
  async (reaction, user) => {

    if (user.bot) return;

    if (!reaction.message.guild) {
      return;
    }

    const embed =
      logEmbed("😀 إضافة رياكشن")
        .addFields(
          {
            name: "العضو",
            value: userText(user)
          },
          {
            name: "الرياكشن",
            value:
              reaction.emoji.toString()
          },
          {
            name: "الروم",
            value:
              `${reaction.message.channel}`
          }
        );

    await sendLog(
      reaction.message.guild,
      "reaction",
      embed
    );
  }
);

/* =========================================================
   EMOJI
========================================================= */

client.on(
  "emojiCreate",
  async emoji => {

    const embed =
      logEmbed("😀 إضافة إيموجي")
        .addFields(
          {
            name: "الإيموجي",
            value: `${emoji}`
          },
          {
            name: "الاسم",
            value:
              emoji.name || "غير معروف"
          }
        );

    await sendLog(
      emoji.guild,
      "emoji",
      embed
    );
  }
);

client.on(
  "emojiDelete",
  async emoji => {

    const embed =
      logEmbed("🗑️ حذف إيموجي")
        .addFields(
          {
            name: "الاسم",
            value:
              emoji.name || "غير معروف"
          },
          {
            name: "ID",
            value: emoji.id
          }
        );

    await sendLog(
      emoji.guild,
      "emoji",
      embed
    );
  }
);

client.on(
  "emojiUpdate",
  async (oldEmoji, newEmoji) => {

    const embed =
      logEmbed("✏️ تحديث إيموجي")
        .addFields(
          {
            name: "الاسم السابق",
            value:
              oldEmoji.name || "غير معروف"
          },
          {
            name: "الاسم الجديد",
            value:
              newEmoji.name || "غير معروف"
          }
        );

    await sendLog(
      newEmoji.guild,
      "emoji",
      embed
    );
  }
);

/* =========================================================
   STICKERS
========================================================= */

client.on(
  "stickerCreate",
  async sticker => {

    const embed =
      logEmbed("🏷️ إضافة ستيكر")
        .addFields(
          {
            name: "الاسم",
            value: sticker.name
          },
          {
            name: "ID",
            value: sticker.id
          }
        );

    await sendLog(
      sticker.guild,
      "sticker",
      embed
    );
  }
);

client.on(
  "stickerDelete",
  async sticker => {

    const embed =
      logEmbed("🗑️ حذف ستيكر")
        .addFields(
          {
            name: "الاسم",
            value: sticker.name
          },
          {
            name: "ID",
            value: sticker.id
          }
        );

    await sendLog(
      sticker.guild,
      "sticker",
      embed
    );
  }
);

client.on(
  "stickerUpdate",
  async (oldSticker, newSticker) => {

    const embed =
      logEmbed("✏️ تحديث ستيكر")
        .addFields(
          {
            name: "الاسم السابق",
            value: oldSticker.name
          },
          {
            name: "الاسم الجديد",
            value: newSticker.name
          }
        );

    await sendLog(
      newSticker.guild,
      "sticker",
      embed
    );
  }
);

/* =========================================================
   AUTO REPLY + SHORTCUT
========================================================= */

client.on(
  "messageCreate",
  async message => {

    try {

      if (!message.guild) return;

      if (message.author.bot) return;

      const content =
        message.content.trim().toLowerCase();

      const auto =
        await db.query(
          `
          SELECT response
          FROM autoreplies
          WHERE guild_id = $1
          AND trigger = $2
          LIMIT 1
          `,
          [
            message.guild.id,
            content
          ]
        );

      if (auto.rows[0]) {

        await message.reply(
          auto.rows[0].response
        );

        return;
      }

      const shortcut =
        await db.query(
          `
          SELECT response
          FROM shortcuts
          WHERE guild_id = $1
          AND name = $2
          LIMIT 1
          `,
          [
            message.guild.id,
            content
          ]
        );

      if (shortcut.rows[0]) {

        await message.reply(
          shortcut.rows[0].response
        );
      }

    } catch (error) {

      console.error(
        "❌ Message error:",
        error.message
      );
    }
  }
);

/* =========================================================
   ERRORS
========================================================= */

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "❌ Unhandled Rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  error => {
    console.error(
      "❌ Uncaught Exception:",
      error
    );
  }
);

/* =========================================================
   START
========================================================= */

(async () => {

  try {

    await setupDatabase();

    await registerCommands();

    await client.login(TOKEN);

  } catch (error) {

    console.error("================================");
    console.error("❌ BOT START ERROR");
    console.error(error);
    console.error("================================");

    process.exit(1);
  }

})();
