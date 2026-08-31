const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  AuditLogEvent
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const OWNER_ID = "1179433017064820747";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID غير موجود");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود");
  process.exit(1);
}

/* =========================================================
   DATABASE
========================================================= */

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ]
});

/* =========================================================
   BOT STATUS
========================================================= */

let botStartedAt = null;
let lastReadyAt = null;
let lastDisconnectAt = null;

/* =========================================================
   OWNER
========================================================= */

function isOwner(interaction) {
  return interaction.user.id === OWNER_ID;
}

/* =========================================================
   COMMAND PERMISSIONS
========================================================= */

const commandPermissions = {
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  untimeout: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ModerateMembers,
  warnlist: PermissionFlagsBits.ModerateMembers,

  clear: PermissionFlagsBits.ManageMessages,

  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  slowmode: PermissionFlagsBits.ManageChannels,

  role: PermissionFlagsBits.ManageRoles,
  nickname: PermissionFlagsBits.ManageNicknames,

  autoreply: PermissionFlagsBits.ManageGuild,
  shortcut: PermissionFlagsBits.ManageGuild,

  logsetup: PermissionFlagsBits.ManageGuild,
  logs: PermissionFlagsBits.ManageGuild,
  log: PermissionFlagsBits.ManageGuild
};

function checkCommandPermission(interaction) {
  if (isOwner(interaction)) {
    return true;
  }

  const required =
    commandPermissions[interaction.commandName];

  if (!required) {
    return true;
  }

  return (
    interaction.memberPermissions?.has(required) ??
    false
  );
}

/* =========================================================
   LOG TYPES
========================================================= */

const LOG_TYPES = {
  member_join: "إنضمام الأعضاء",
  member_leave: "خروج الأعضاء",
  member_kick: "طرد الأعضاء",

  ban: "حظر الأعضاء",
  unban: "إزالة حظر الأعضاء",

  timeout: "إضافة Timeout",
  untimeout: "إزالة Timeout",
  mute: "سجل الميوت",

  voice_join: "دخول صوتي",
  voice_leave: "خروج صوتي",
  voice_kick: "طرد صوتي",
  voice_move: "تنقل/سحب الأعضاء",

  voice_speak: "منع/سماح التحدث",
  voice_listen: "منع/سماح الإستماع",

  guild_update: "تحديث إعدادات السيرفر",

  channel_update: "تحديث الرومات",
  channel_create: "إنشاء الرومات",
  channel_delete: "حذف الرومات",
  channel_permissions: "تحديث صلاحيات الرومات",

  message_delete: "الرسائل المحذوفة",
  message_bulk_delete: "حذف مجموعة رسائل",
  message_update: "تعديل الرسائل",

  role_create: "إنشاء الرُتب",
  role_delete: "حذف الرُتب",
  role_update: "تحديث الرُتب",
  role_permissions: "تحديث صلاحيات الرُتب",

  member_roles: "تحديث رُتب الأعضاء",

  emoji_create: "إضافة إيموجي",
  emoji_update: "تعديل إيموجي",
  emoji_delete: "حذف إيموجي",

  sticker_create: "إضافة ستيكر",
  sticker_update: "تعديل ستيكر",
  sticker_delete: "حذف ستيكر",

  reaction_add: "إضافة رياكشن"
};

/* =========================================================
   DEFAULT LOG SETTINGS
========================================================= */

function defaultLogTypes() {
  const obj = {};

  for (const key of Object.keys(LOG_TYPES)) {
    obj[key] = true;
  }

  return obj;
}

/* =========================================================
   DATABASE SETUP
========================================================= */

async function setupDatabase() {

  await db.query(`
    CREATE TABLE IF NOT EXISTS warns (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS autoreplies (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      response TEXT NOT NULL,
      UNIQUE(guild_id, trigger)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS shortcuts (
      id SERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      shortcut TEXT NOT NULL,
      command TEXT NOT NULL,
      UNIQUE(guild_id, shortcut)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS log_settings (
      guild_id TEXT PRIMARY KEY,
      enabled BOOLEAN DEFAULT TRUE,
      types JSONB NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL,
      disconnected_at TIMESTAMPTZ
    )
  `);

  console.log("✅ PostgreSQL جاهز");
}

/* =========================================================
   LOG SETTINGS
========================================================= */

async function getLogSettings(guildId) {

  const result = await db.query(
    `
    SELECT enabled, types
    FROM log_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  if (!result.rows.length) {

    const types =
      defaultLogTypes();

    await db.query(
      `
      INSERT INTO log_settings
      (guild_id, enabled, types)
      VALUES ($1, TRUE, $2)
      ON CONFLICT (guild_id)
      DO NOTHING
      `,
      [
        guildId,
        JSON.stringify(types)
      ]
    );

    return {
      enabled: true,
      types
    };
  }

  return {
    enabled:
      result.rows[0].enabled,
    types:
      result.rows[0].types || defaultLogTypes()
  };
}

/* =========================================================
   CHECK LOG TYPE
========================================================= */

async function isLogEnabled(guildId, type) {

  const settings =
    await getLogSettings(guildId);

  if (!settings.enabled) {
    return false;
  }

  return settings.types[type] !== false;
}

/* =========================================================
   GET LOG CHANNEL
========================================================= */

async function getLogChannel(guild) {

  if (!guild) {
    return null;
  }

  const result = await db.query(
    `
    SELECT channel_id
    FROM log_channels
    WHERE guild_id = $1
    `,
    [guild.id]
  );

  if (!result.rows.length) {
    return null;
  }

  return (
    guild.channels.cache.get(
      result.rows[0].channel_id
    ) || null
  );
}

/* =========================================================
   SEND LOG
========================================================= */

async function sendLog(
  guild,
  type,
  title,
  description,
  color = 0xF1C40F
) {

  if (!guild) {
    return;
  }

  try {

    const enabled =
      await isLogEnabled(
        guild.id,
        type
      );

    if (!enabled) {
      return;
    }

    const channel =
      await getLogChannel(guild);

    if (!channel) {
      return;
    }

    const embed =
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
          description || "لا توجد تفاصيل"
        )
        .setFooter({
          text: ".v5d. • Logs"
        })
        .setTimestamp();

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
   AUDIT LOG
========================================================= */

async function getAuditExecutor(
  guild,
  action,
  targetId
) {

  try {

    const logs =
      await guild.fetchAuditLogs({
        type: action,
        limit: 10
      });

    const entry =
      logs.entries.find(
        e =>
          e.target?.id === targetId &&
          Date.now() - e.createdTimestamp < 10000
      );

    return entry?.executor || null;

  } catch {
    return null;
  }
}

/* =========================================================
   UPTIME
========================================================= */

function formatUptime(ms) {

  if (!ms || ms < 0) {
    return "غير متوفر";
  }

  let seconds =
    Math.floor(ms / 1000);

  const days =
    Math.floor(seconds / 86400);

  seconds %= 86400;

  const hours =
    Math.floor(seconds / 3600);

  seconds %= 3600;

  const minutes =
    Math.floor(seconds / 60);

  seconds %= 60;

  return `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${seconds} ثانية`;
}

/* =========================================================
   LOG COMMAND
========================================================= */

const logCommand =
  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إدارة نظام اللوق")

    .addSubcommand(sub =>
      sub
        .setName("setup")
        .setDescription("تحديد روم اللوق")
        .addChannelOption(o =>
          o
            .setName("channel")
            .setDescription("روم اللوق")
            .addChannelTypes(
              ChannelType.GuildText
            )
            .setRequired(true)
        )
    )

    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription("تشغيل اللوق")
    )

    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("إيقاف اللوق")
    )

    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("عرض حالة اللوق")
    )

    .addSubcommand(sub =>
      sub
        .setName("edit")
        .setDescription("تعديل أنواع اللوق")
    );

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  /* ================= ADMIN ================= */

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o
        .setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء Timeout")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o
        .setName("minutes")
        .setDescription("الدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("حذف رسائل")
    .addIntegerOption(o =>
      o
        .setName("amount")
        .setDescription("العدد")
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
    .setDescription("تفعيل Slowmode")
    .addIntegerOption(o =>
      o
        .setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o
        .setName("role")
        .setDescription("الرتبة")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("action")
        .setDescription("الإجراء")
        .setRequired(true)
        .addChoices(
          {
            name: "إضافة",
            value: "add"
          },
          {
            name: "إزالة",
            value: "remove"
          }
        )
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("تغيير اسم عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("name")
        .setDescription("الاسم الجديد")
        .setRequired(true)
    ),

  /* ================= INFO ================= */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* ================= AUTOREPLY ================= */

  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")

    .addSubcommand(s =>
      s
        .setName("add")
        .setDescription("إضافة رد")
        .addStringOption(o =>
          o
            .setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("response")
            .setDescription("الرد")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("remove")
        .setDescription("حذف رد")
        .addStringOption(o =>
          o
            .setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("list")
        .setDescription("عرض الردود")
    ),

  /* ================= SHORTCUT ================= */

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")

    .addSubcommand(s =>
      s
        .setName("set")
        .setDescription("إنشاء اختصار")
        .addStringOption(o =>
          o
            .setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("command")
            .setDescription("الأمر")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o =>
          o
            .setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("list")
        .setDescription("عرض الاختصارات")
    ),

  /* ================= OLD LOG ================= */

  new SlashCommandBuilder()
    .setName("logsetup")
    .setDescription("تحديد روم اللوق")
    .addChannelOption(o =>
      o
        .setName("channel")
        .setDescription("روم اللوق")
        .addChannelTypes(
          ChannelType.GuildText
        )
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق"),

  /* ================= BOT ================= */

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("حالة البوت"),

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت"),

  logCommand

].map(c => c.toJSON());

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {

  botStartedAt = Date.now();
  lastReadyAt = new Date();

  console.log("====================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🟢 البوت Online");
  console.log(`👑 Owner: ${OWNER_ID}`);
  console.log(
    `🏠 السيرفرات: ${client.guilds.cache.size}`
  );
  console.log(
    `📋 الأوامر: ${commands.length}`
  );
  console.log("====================================");

  try {

    await setupDatabase();

    await db.query(`
      UPDATE bot_sessions
      SET disconnected_at = NOW()
      WHERE disconnected_at IS NULL
    `);

    await db.query(
      `
      INSERT INTO bot_sessions
      (started_at)
      VALUES ($1)
      `,
      [lastReadyAt]
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      {
        body: []
      }
    );

    for (
      const guild
      of client.guilds.cache.values()
    ) {

      try {

        await rest.put(
          Routes.applicationGuildCommands(
            CLIENT_ID,
            guild.id
          ),
          {
            body: commands
          }
        );

        console.log(
          `✅ ${guild.name}: ${commands.length} أمر`
        );

      } catch (error) {

        console.error(
          `❌ ${guild.name}:`,
          error.message
        );
      }
    }

    console.log(
      "🚀 البوت جاهز بالكامل"
    );

  } catch (error) {

    console.error(
      "❌ READY ERROR:",
      error
    );
  }
});

/* =========================================================
   GUILD CREATE
========================================================= */

client.on(
  "guildCreate",
  async guild => {

    try {

      const rest =
        new REST({
          version: "10"
        }).setToken(TOKEN);

      await rest.put(
        Routes.applicationGuildCommands(
          CLIENT_ID,
          guild.id
        ),
        {
          body: commands
        }
      );

      console.log(
        `🆕 تم تسجيل الأوامر في ${guild.name}`
      );

    } catch (error) {

      console.error(
        "❌ Guild Create:",
        error.message
      );
    }
  }
);

/* =========================================================
   DISCONNECT
========================================================= */

client.on(
  "shardDisconnect",
  async () => {

    lastDisconnectAt =
      new Date();

    try {

      await db.query(`
        UPDATE bot_sessions
        SET disconnected_at = NOW()
        WHERE disconnected_at IS NULL
      `);

    } catch {}
  }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    try {

      /* =====================================================
         SELECT MENU
      ===================================================== */

      if (
        interaction.isStringSelectMenu()
      ) {

        if (
          interaction.customId !==
          "log_edit_select"
        ) {
          return;
        }

        if (!isOwner(interaction)) {

          if (
            !interaction.memberPermissions?.has(
              PermissionFlagsBits.ManageGuild
            )
          ) {

            return interaction.reply({
              content:
                "❌ ما عندك صلاحية تعديل اللوق.",
              ephemeral: true
            });
          }
        }

        const selected =
          interaction.values;

        const settings =
          await getLogSettings(
            interaction.guildId
          );

        for (
          const type
          of Object.keys(LOG_TYPES)
        ) {

          settings.types[type] =
            selected.includes(type);
        }

        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, enabled, types)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id)
          DO UPDATE SET
            enabled = EXCLUDED.enabled,
            types = EXCLUDED.types
          `,
          [
            interaction.guildId,
            settings.enabled,
            JSON.stringify(
              settings.types
            )
          ]
        );

        return interaction.update({
          content:
            "✅ تم حفظ إعدادات اللوق.",
          embeds: [],
          components: []
        });
      }

      /* =====================================================
         COMMANDS ONLY
      ===================================================== */

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      /* =====================================================
         PERMISSION
      ===================================================== */

      if (
        !checkCommandPermission(
          interaction
        )
      ) {

        return interaction.reply({
          content:
            "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });
      }

      /* =====================================================
         LOG COMMAND
      ===================================================== */

      if (
        interaction.commandName ===
        "log"
      ) {

        const sub =
          interaction.options.getSubcommand();

        /* ================= SETUP ================= */

        if (sub === "setup") {

          const channel =
            interaction.options.getChannel(
              "channel"
            );

          await db.query(
            `
            INSERT INTO log_channels
            (guild_id, channel_id)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET
              channel_id = EXCLUDED.channel_id
            `,
            [
              interaction.guildId,
              channel.id
            ]
          );

          await getLogSettings(
            interaction.guildId
          );

          await interaction.reply({
            content:
              `✅ تم تحديد ${channel} كروم اللوق.`,
            ephemeral: true
          });

          await sendLog(
            interaction.guild,
            "guild_update",
            "📋 إعداد اللوق",
            `**بواسطة:** ${interaction.user}\n**الروم:** ${channel}`,
            0x2ECC71
          );

          return;
        }

        /* ================= ENABLE ================= */

        if (sub === "enable") {

          const channel =
            await getLogChannel(
              interaction.guild
            );

          if (!channel) {

            return interaction.reply({
              content:
                "❌ حدد روم اللوق أولاً باستخدام `/log setup`.",
              ephemeral: true
            });
          }

          const settings =
            await getLogSettings(
              interaction.guildId
            );

          await db.query(
            `
            INSERT INTO log_settings
            (guild_id, enabled, types)
            VALUES ($1, TRUE, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET
              enabled = TRUE
            `,
            [
              interaction.guildId,
              JSON.stringify(
                settings.types
              )
            ]
          );

          return interaction.reply({
            content:
              `🟢 تم تشغيل نظام اللوق.\nروم اللوق: ${channel}`,
            ephemeral: true
          });
        }

        /* ================= DISABLE ================= */

        if (sub === "disable") {

          const settings =
            await getLogSettings(
              interaction.guildId
            );

          await db.query(
            `
            INSERT INTO log_settings
            (guild_id, enabled, types)
            VALUES ($1, FALSE, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET
              enabled = FALSE
            `,
            [
              interaction.guildId,
              JSON.stringify(
                settings.types
              )
            ]
          );

          return interaction.reply({
            content:
              "🔴 تم إيقاف نظام اللوق.",
            ephemeral: true
          });
        }

        /* ================= STATUS ================= */

        if (sub === "status") {

          const settings =
            await getLogSettings(
              interaction.guildId
            );

          const channel =
            await getLogChannel(
              interaction.guild
            );

          const enabledTypes =
            Object.entries(
              settings.types
            )
              .filter(
                ([, value]) => value
              )
              .map(
                ([key]) =>
                  `• ${LOG_TYPES[key]}`
              )
              .join("\n");

          const disabledTypes =
            Object.entries(
              settings.types
            )
              .filter(
                ([, value]) => !value
              )
              .map(
                ([key]) =>
                  `• ${LOG_TYPES[key]}`
              )
              .join("\n");

          const embed =
            new EmbedBuilder()
              .setColor(
                settings.enabled
                  ? 0x2ECC71
                  : 0xE74C3C
              )
              .setTitle(
                "📋 حالة نظام اللوق"
              )
              .addFields(

                {
                  name: "الحالة",
                  value:
                    settings.enabled
                      ? "🟢 مفعّل"
                      : "🔴 متوقف",
                  inline: true
                },

                {
                  name: "روم اللوق",
                  value:
                    channel
                      ? `${channel}`
                      : "❌ غير محدد",
                  inline: true
                },

                {
                  name: "الأنواع المفعلة",
                  value:
                    enabledTypes ||
                    "لا يوجد",
                  inline: false
                },

                {
                  name: "الأنواع المتوقفة",
                  value:
                    disabledTypes ||
                    "لا يوجد",
                  inline: false
                }

              )
              .setFooter({
                text: ".v5d. • Log System"
              })
              .setTimestamp();

          return interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }

        /* ================= EDIT ================= */

        if (sub === "edit") {

          const settings =
            await getLogSettings(
              interaction.guildId
            );

          const options =
            Object.entries(
              LOG_TYPES
            ).map(
              ([key, name]) => {

                const option =
                  new StringSelectMenuOptionBuilder()
                    .setLabel(name)
                    .setValue(key)
                    .setDescription(
                      settings.types[key]
                        ? "🟢 مفعّل"
                        : "🔴 متوقف"
                    );

                if (
                  settings.types[key]
                ) {
                  option.setDefault(true);
                }

                return option;
              }
            );

          const menu =
            new StringSelectMenuBuilder()
              .setCustomId(
                "log_edit_select"
              )
              .setPlaceholder(
                "اختر أنواع اللوق التي تريدها"
              )
              .setMinValues(0)
              .setMaxValues(
                options.length
              )
              .addOptions(options);

          const row =
            new ActionRowBuilder()
              .addComponents(menu);

          return interaction.reply({
            content:
              "📋 **تعديل أنواع اللوق**\n\n" +
              "حدد الأنواع التي تريد أن يرسلها البوت في روم اللوق، ثم اضغط تأكيد الاختيار.",
            components: [row],
            ephemeral: true
          });
        }
      }

      /* =====================================================
         OLD LOGSETUP
      ===================================================== */

      if (
        interaction.commandName ===
        "logsetup"
      ) {

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        await db.query(
          `
          INSERT INTO log_channels
          (guild_id, channel_id)
          VALUES ($1, $2)
          ON CONFLICT (guild_id)
          DO UPDATE SET
            channel_id = EXCLUDED.channel_id
          `,
          [
            interaction.guildId,
            channel.id
          ]
        );

        await interaction.reply({
          content:
            `✅ تم تحديد ${channel} كروم اللوق.\n\nاستخدم الآن \`/log edit\` لاختيار أنواع اللوق.`,
          ephemeral: true
        });

        return;
      }

      /* =====================================================
         LOG TEST
      ===================================================== */

      if (
        interaction.commandName ===
        "logs"
      ) {

        const channel =
          await getLogChannel(
            interaction.guild
          );

        if (!channel) {

          return interaction.reply({
            content:
              "❌ لم يتم تحديد روم اللوق.\nاستخدم `/log setup` أولاً.",
            ephemeral: true
          });
        }

        const embed =
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(
              "🧪 اختبار نظام اللوق"
            )
            .setDescription(
              `**بواسطة:** ${interaction.user}\n` +
              `**السيرفر:** ${interaction.guild.name}\n` +
              `**الروم:** ${channel}\n\n` +
              "✅ نظام اللوق يعمل."
            )
            .setTimestamp();

        await channel.send({
          embeds: [embed]
        });

        return interaction.reply({
          content:
            `✅ تم إرسال الاختبار إلى ${channel}.`,
          ephemeral: true
        });
      }

      /* =====================================================
         BOT
      ===================================================== */

      if (
        interaction.commandName ===
        "bot"
      ) {

        const online =
          client.isReady();

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(
                online
                  ? 0x2ECC71
                  : 0xE74C3C
              )
              .setTitle(
                "🤖 حالة البوت"
              )
              .addFields(

                {
                  name: "الحالة",
                  value:
                    online
                      ? "🟢 Online"
                      : "🔴 Offline",
                  inline: true
                },

                {
                  name: "Ping",
                  value:
                    online
                      ? `${client.ws.ping}ms`
                      : "غير متوفر",
                  inline: true
                },

                {
                  name: "السيرفرات",
                  value:
                    `${client.guilds.cache.size}`,
                  inline: true
                },

                {
                  name:
                    "مدة الاتصال",
                  value:
                    online &&
                    botStartedAt
                      ? formatUptime(
                          Date.now() -
                          botStartedAt
                        )
                      : "غير متصل"
                },

                {
                  name:
                    "Owner / Developer",
                  value:
                    `<@${OWNER_ID}>`
                }

              )
              .setTimestamp()

          ]

        });
      }

      /* =====================================================
         ME
      ===================================================== */

      if (
        interaction.commandName ===
        "me"
      ) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle(
                "🤖 معلومات البوت"
              )
              .setDescription(
                `**البوت:** ${client.user}\n` +
                `**الحالة:** 🟢 Online\n` +
                `**الأوامر:** ${commands.length}\n` +
                `**السيرفرات:** ${client.guilds.cache.size}\n` +
                `**Owner:** <@${OWNER_ID}>\n\n` +
                `Powered by **.v5d.**`
              )
              .setTimestamp()

          ]

        });
      }

      /* =====================================================
         BAN
      ===================================================== */

      if (
        interaction.commandName ===
        "ban"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (
          !member ||
          !member.bannable
        ) {

          return interaction.reply({
            content:
              "❌ لا أستطيع حظر هذا العضو.",
            ephemeral: true
          });
        }

        await member.ban({
          reason
        });

        await interaction.reply(
          `🔨 تم حظر ${user}\n**السبب:** ${reason}`
        );

        return;
      }

      /* =====================================================
         UNBAN
      ===================================================== */

      if (
        interaction.commandName ===
        "unban"
      ) {

        const id =
          interaction.options.getString(
            "userid"
          );

        try {

          await interaction.guild.members.unban(
            id
          );

        } catch {

          return interaction.reply({
            content:
              "❌ لم أستطع فك الحظر.",
            ephemeral: true
          });
        }

        await interaction.reply(
          `🔓 تم فك الحظر عن <@${id}>.`
        );

        return;
      }

      /* =====================================================
         KICK
      ===================================================== */

      if (
        interaction.commandName ===
        "kick"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (
          !member ||
          !member.kickable
        ) {

          return interaction.reply({
            content:
              "❌ لا أستطيع طرد هذا العضو.",
            ephemeral: true
          });
        }

        await member.kick(reason);

        await interaction.reply(
          `👢 تم طرد ${user}\n**السبب:** ${reason}`
        );

        return;
      }

      /* =====================================================
         TIMEOUT
      ===================================================== */

      if (
        interaction.commandName ===
        "timeout"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const minutes =
          interaction.options.getInteger(
            "minutes"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (
          !member ||
          !member.moderatable
        ) {

          return interaction.reply({
            content:
              "❌ لا أستطيع إعطاء Timeout.",
            ephemeral: true
          });
        }

        await member.timeout(
          minutes * 60 * 1000,
          reason
        );

        await interaction.reply(
          `⏳ تم إعطاء ${user} Timeout لمدة **${minutes} دقيقة**.`
        );

        return;
      }

      /* =====================================================
         UNTIMEOUT
      ===================================================== */

      if (
        interaction.commandName ===
        "untimeout"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {

          return interaction.reply({
            content:
              "❌ العضو غير موجود.",
            ephemeral: true
          });
        }

        await member.timeout(null);

        await interaction.reply(
          `✅ تم إزالة Timeout عن ${user}.`
        );

        return;
      }

      /* =====================================================
         WARN
      ===================================================== */

      if (
        interaction.commandName ===
        "warn"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        await db.query(
          `
          INSERT INTO warns
          (guild_id,user_id,moderator_id,reason)
          VALUES ($1,$2,$3,$4)
          `,
          [
            interaction.guildId,
            user.id,
            interaction.user.id,
            reason
          ]
        );

        const count =
          await db.query(
            `
            SELECT COUNT(*)::int AS count
            FROM warns
            WHERE guild_id=$1
            AND user_id=$2
            `,
            [
              interaction.guildId,
              user.id
            ]
          );

        await interaction.reply(
          `⚠️ تم تحذير ${user}\n**السبب:** ${reason}\n**إجمالي التحذيرات:** ${count.rows[0].count}`
        );

        return;
      }

      /* =====================================================
         WARNLIST
      ===================================================== */

      if (
        interaction.commandName ===
        "warnlist"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const result =
          user
            ? await db.query(
                `
                SELECT *
                FROM warns
                WHERE guild_id=$1
                AND user_id=$2
                ORDER BY created_at DESC
                `,
                [
                  interaction.guildId,
                  user.id
                ]
              )
            : await db.query(
                `
                SELECT *
                FROM warns
                WHERE guild_id=$1
                ORDER BY created_at DESC
                LIMIT 25
                `,
                [
                  interaction.guildId
                ]
              );

        if (!result.rows.length) {

          return interaction.reply(
            "✅ لا توجد تحذيرات."
          );
        }

        const text =
          result.rows
            .map(
              (w, i) =>
                `**${i + 1}.** <@${w.user_id}>\n` +
                `السبب: ${w.reason}\n` +
                `بواسطة: <@${w.moderator_id}>\n` +
                `<t:${Math.floor(
                  new Date(
                    w.created_at
                  ).getTime() / 1000
                )}:R>`
            )
            .join("\n\n");

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle(
                user
                  ? `⚠️ تحذيرات ${user.username}`
                  : "⚠️ قائمة التحذيرات"
              )
              .setDescription(text)

          ]

        });
      }

      /* =====================================================
         CLEAR
      ===================================================== */

      if (
        interaction.commandName ===
        "clear"
      ) {

        const amount =
          interaction.options.getInteger(
            "amount"
          );

        const deleted =
          await interaction.channel.bulkDelete(
            amount,
            true
          );

        await interaction.reply({
          content:
            `🧹 تم حذف ${deleted.size} رسالة.`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          "message_bulk_delete",
          "🧹 حذف مجموعة رسائل",
          `**الروم:** ${interaction.channel}\n` +
          `**العدد:** ${deleted.size}\n` +
          `**بواسطة:** ${interaction.user}`,
          0xE74C3C
        );

        return;
      }

      /* =====================================================
         LOCK / UNLOCK
      ===================================================== */

      if (
        interaction.commandName === "lock" ||
        interaction.commandName === "unlock"
      ) {

        const locked =
          interaction.commandName === "lock";

        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages: !locked
          }
        );

        await interaction.reply(
          locked
            ? "🔒 تم قفل الروم."
            : "🔓 تم فتح الروم."
        );

        await sendLog(
          interaction.guild,
          "channel_permissions",
          locked
            ? "🔒 قفل الروم"
            : "🔓 فتح الروم",
          `**الروم:** ${interaction.channel}\n**بواسطة:** ${interaction.user}`,
          locked
            ? 0xE74C3C
            : 0x2ECC71
        );

        return;
      }

      /* =====================================================
         SLOWMODE
      ===================================================== */

      if (
        interaction.commandName ===
        "slowmode"
      ) {

        const seconds =
          interaction.options.getInteger(
            "seconds"
          );

        await interaction.channel.setRateLimitPerUser(
          seconds
        );

        await interaction.reply(
          seconds === 0
            ? "✅ تم إلغاء Slowmode."
            : `🐌 Slowmode: ${seconds} ثانية`
        );

        await sendLog(
          interaction.guild,
          "channel_update",
          "🐌 تحديث Slowmode",
          `**الروم:** ${interaction.channel}\n` +
          `**المدة:** ${seconds} ثانية\n` +
          `**بواسطة:** ${interaction.user}`,
          0x9B59B6
        );

        return;
      }

      /* =====================================================
         ROLE
      ===================================================== */

      if (
        interaction.commandName ===
        "role"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const role =
          interaction.options.getRole(
            "role"
          );

        const action =
          interaction.options.getString(
            "action"
          );

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        if (
          role.id ===
          interaction.guild.id
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكن استخدام @everyone.",
            ephemeral: true
          });
        }

        if (
          role.position >=
          interaction.guild.members.me.roles.highest.position
        ) {

          return interaction.reply({
            content:
              "❌ رتبة البوت أقل من الرتبة.",
            ephemeral: true
          });
        }

        if (action === "add") {

          await member.roles.add(
            role
          );

          await interaction.reply(
            `✅ تم إعطاء ${user} رتبة ${role}.`
          );

        } else {

          await member.roles.remove(
            role
          );

          await interaction.reply(
            `✅ تم إزالة ${role} من ${user}.`
          );
        }

        return;
      }

      /* =====================================================
         NICKNAME
      ===================================================== */

      if (
        interaction.commandName ===
        "nickname"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const name =
          interaction.options.getString(
            "name"
          );

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        await member.setNickname(
          name
        );

        await interaction.reply(
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
        );

        return;
      }

      /* =====================================================
         INFO
      ===================================================== */

      if (
        interaction.commandName ===
        "info"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `👤 معلومات ${user.username}`
              )
              .setThumbnail(
                user.displayAvatarURL({
                  size: 256
                })
              )
              .addFields(

                {
                  name: "الاسم",
                  value: `${user}`,
                  inline: true
                },

                {
                  name: "ID",
                  value: `\`${user.id}\``,
                  inline: true
                },

                {
                  name: "الحساب",
                  value:
                    `<t:${Math.floor(
                      user.createdTimestamp /
                      1000
                    )}:R>`,
                  inline: true
                },

                {
                  name: "دخل السيرفر",
                  value:
                    member?.joinedTimestamp
                      ? `<t:${Math.floor(
                          member.joinedTimestamp /
                          1000
                        )}:R>`
                      : "غير معروف"
                }

              )

          ]

        });
      }

      /* =====================================================
         SERVERINFO
      ===================================================== */

      if (
        interaction.commandName ===
        "serverinfo"
      ) {

        const guild =
          interaction.guild;

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🏠 ${guild.name}`
              )
              .addFields(

                {
                  name: "الأعضاء",
                  value:
                    `${guild.memberCount}`,
                  inline: true
                },

                {
                  name: "الرومات",
                  value:
                    `${guild.channels.cache.size}`,
                  inline: true
                },

                {
                  name: "الرتب",
                  value:
                    `${guild.roles.cache.size}`,
                  inline: true
                },

                {
                  name: "ID",
                  value:
                    `\`${guild.id}\``
                }

              )

          ]

        });
      }

      /* =====================================================
         AVATAR
      ===================================================== */

      if (
        interaction.commandName ===
        "avatar"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🖼️ Avatar - ${user.username}`
              )
              .setImage(
                user.displayAvatarURL({
                  size: 1024
                })
              )

          ]

        });
      }

      /* =====================================================
         BANNER
      ===================================================== */

      if (
        interaction.commandName ===
        "banner"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const fetched =
          await user.fetch();

        const banner =
          fetched.bannerURL({
            size: 1024
          });

        if (!banner) {

          return interaction.reply(
            "❌ لا يوجد Banner."
          );
        }

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🎨 Banner - ${user.username}`
              )
              .setImage(banner)

          ]

        });
      }

      /* =====================================================
         ROLES
      ===================================================== */

      if (
        interaction.commandName ===
        "roles"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const roles =
          member.roles.cache
            .filter(
              r =>
                r.id !==
                interaction.guild.id
            )
            .sort(
              (a, b) =>
                b.position -
                a.position
            )
            .map(
              r => `${r}`
            )
            .join(" ");

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle(
                `🎭 رتب ${user.username}`
              )
              .setDescription(
                roles ||
                "لا توجد رتب."
              )

          ]

        });
      }

      /* =====================================================
         AUTOREPLY
      ===================================================== */

      if (
        interaction.commandName ===
        "autoreply"
      ) {

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
            (guild_id,trigger,response)
            VALUES ($1,$2,$3)
            ON CONFLICT
            (guild_id,trigger)
            DO UPDATE SET
              response=EXCLUDED.response
            `,
            [
              interaction.guildId,
              trigger,
              response
            ]
          );

          return interaction.reply(
            `✅ تم إضافة الرد:\n**${trigger}** → ${response}`
          );
        }

        if (sub === "remove") {

          const trigger =
            interaction.options
              .getString("trigger")
              .toLowerCase();

          const result =
            await db.query(
              `
              DELETE FROM autoreplies
              WHERE guild_id=$1
              AND trigger=$2
              `,
              [
                interaction.guildId,
                trigger
              ]
            );

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف **${trigger}**.`
              : `❌ غير موجود.`
          );
        }

        if (sub === "list") {

          const result =
            await db.query(
              `
              SELECT trigger,response
              FROM autoreplies
              WHERE guild_id=$1
              ORDER BY trigger
              `,
              [
                interaction.guildId
              ]
            );

          if (!result.rows.length) {
            return interaction.reply(
              "📭 لا توجد ردود."
            );
          }

          return interaction.reply({

            embeds: [

              new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(
                  "🤖 الردود التلقائية"
                )
                .setDescription(
                  result.rows
                    .map(
                      r =>
                        `**${r.trigger}** → ${r.response}`
                    )
                    .join("\n")
                )

            ]

          });
        }
      }

      /* =====================================================
         SHORTCUT
      ===================================================== */

      if (
        interaction.commandName ===
        "shortcut"
      ) {

        const sub =
          interaction.options.getSubcommand();

        if (sub === "set") {

          const shortcut =
            interaction.options
              .getString("shortcut")
              .toLowerCase();

          const command =
            interaction.options
              .getString("command")
              .toLowerCase()
              .replace(
                /^\//,
                ""
              );

          await db.query(
            `
            INSERT INTO shortcuts
            (guild_id,shortcut,command)
            VALUES ($1,$2,$3)
            ON CONFLICT
            (guild_id,shortcut)
            DO UPDATE SET
              command=EXCLUDED.command
            `,
            [
              interaction.guildId,
              shortcut,
              command
            ]
          );

          return interaction.reply(
            `✅ تم إنشاء **${shortcut}** → \`/${command}\``
          );
        }

        if (sub === "remove") {

          const shortcut =
            interaction.options
              .getString("shortcut")
              .toLowerCase();

          const result =
            await db.query(
              `
              DELETE FROM shortcuts
              WHERE guild_id=$1
              AND shortcut=$2
              `,
              [
                interaction.guildId,
                shortcut
              ]
            );

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف **${shortcut}**.`
              : `❌ غير موجود.`
          );
        }

        if (sub === "list") {

          const result =
            await db.query(
              `
              SELECT shortcut,command
              FROM shortcuts
              WHERE guild_id=$1
              ORDER BY shortcut
              `,
              [
                interaction.guildId
              ]
            );

          if (!result.rows.length) {
            return interaction.reply(
              "📭 لا توجد اختصارات."
            );
          }

          return interaction.reply({

            embeds: [

              new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(
                  "🔗 الاختصارات"
                )
                .setDescription(
                  result.rows
                    .map(
                      r =>
                        `**${r.shortcut}** → \`/${r.command}\``
                    )
                    .join("\n")
                )

            ]

          });
        }
      }

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );

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
  }
);

/* =========================================================
   AUTO REPLY + SHORTCUTS
========================================================= */

client.on(
  "messageCreate",
  async message => {

    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    try {

      const text =
        message.content
          .trim()
          .toLowerCase();

      if (!text) {
        return;
      }

      const auto =
        await db.query(
          `
          SELECT response
          FROM autoreplies
          WHERE guild_id=$1
          AND trigger=$2
          LIMIT 1
          `,
          [
            message.guild.id,
            text
          ]
        );

      if (auto.rows.length) {

        await message.reply(
          auto.rows[0].response
        );

        return;
      }

      const shortcut =
        await db.query(
          `
          SELECT command
          FROM shortcuts
          WHERE guild_id=$1
          AND shortcut=$2
          LIMIT 1
          `,
          [
            message.guild.id,
            text
          ]
        );

      if (shortcut.rows.length) {

        await message.reply(
          `🔗 **${text}** → \`/${shortcut.rows[0].command}\``
        );
      }

    } catch (error) {

      console.error(
        "❌ Message Error:",
        error.message
      );
    }
  }
);

/* =========================================================
   MESSAGE DELETE
========================================================= */

client.on(
  "messageDelete",
  async message => {

    if (
      !message.guild ||
      message.author?.bot
    ) {
      return;
    }

    await sendLog(
      message.guild,
      "message_delete",
      "🗑️ حذف رسالة",
      `**العضو:** ${message.author || "غير معروف"}\n` +
      `**الروم:** ${message.channel}\n` +
      `**الرسالة:** ${message.content || "غير متوفرة"}\n` +
      `**ID:** \`${message.id}\``,
      0xE74C3C
    );
  }
);

/* =========================================================
   MESSAGE UPDATE
========================================================= */

client.on(
  "messageUpdate",
  async (
    oldMessage,
    newMessage
  ) => {

    if (
      !newMessage.guild ||
      newMessage.author?.bot
    ) {
      return;
    }

    const oldContent =
      oldMessage.content || "";

    const newContent =
      newMessage.content || "";

    if (
      oldContent ===
      newContent
    ) {
      return;
    }

    await sendLog(
      newMessage.guild,
      "message_update",
      "✏️ تعديل رسالة",
      `**العضو:** ${newMessage.author || "غير معروف"}\n` +
      `**الروم:** ${newMessage.channel}\n\n` +
      `**قبل:**\n${oldContent || "فارغة"}\n\n` +
      `**بعد:**\n${newContent || "فارغة"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on(
  "guildMemberAdd",
  async member => {

    await sendLog(
      member.guild,
      "member_join",
      "🟢 إنضمام الأعضاء",
      `**العضو:** ${member.user}\n` +
      `**الاسم:** ${member.user.username}\n` +
      `**ID:** \`${member.id}\``,
      0x2ECC71
    );
  }
);

/* =========================================================
   MEMBER LEAVE / KICK
========================================================= */

client.on(
  "guildMemberRemove",
  async member => {

    const executor =
      await getAuditExecutor(
        member.guild,
        AuditLogEvent.MemberKick,
        member.id
      );

    if (executor) {

      await sendLog(
        member.guild,
        "member_kick",
        "👢 طرد الأعضاء",
        `**العضو:** ${member.user}\n` +
        `**الإداري:** ${executor}\n` +
        `**ID:** \`${member.id}\``,
        0xE67E22
      );

    } else {

      await sendLog(
        member.guild,
        "member_leave",
        "🔴 خروج الأعضاء",
        `**العضو:** ${member.user || "غير معروف"}\n` +
        `**ID:** \`${member.id}\``,
        0xE74C3C
      );
    }
  }
);

/* =========================================================
   MEMBER UPDATE
========================================================= */

client.on(
  "guildMemberUpdate",
  async (
    oldMember,
    newMember
  ) => {

    /* ================= ROLES ================= */

    const oldRoles =
      oldMember.roles.cache;

    const newRoles =
      newMember.roles.cache;

    const added =
      newRoles.filter(
        r =>
          !oldRoles.has(r.id)
      );

    const removed =
      oldRoles.filter(
        r =>
          !newRoles.has(r.id)
      );

    if (
      added.size ||
      removed.size
    ) {

      let text =
        `**العضو:** ${newMember.user}\n`;

      if (added.size) {

        text +=
          `**تمت الإضافة:** ${added.map(r => `${r}`).join(" ")}\n`;
      }

      if (removed.size) {

        text +=
          `**تمت الإزالة:** ${removed.map(r => `${r}`).join(" ")}\n`;
      }

      const executor =
        await getAuditExecutor(
          newMember.guild,
          AuditLogEvent.MemberRoleUpdate,
          newMember.id
        );

      if (executor) {

        text +=
          `**بواسطة:** ${executor}`;
      }

      await sendLog(
        newMember.guild,
        "member_roles",
        "🎭 تحديث رُتب الأعضاء",
        text,
        0x9B59B6
      );
    }

    /* ================= TIMEOUT ================= */

    const oldTimeout =
      oldMember.communicationDisabledUntilTimestamp;

    const newTimeout =
      newMember.communicationDisabledUntilTimestamp;

    if (
      oldTimeout !==
      newTimeout
    ) {

      if (
        newTimeout &&
        newTimeout > Date.now()
      ) {

        const executor =
          await getAuditExecutor(
            newMember.guild,
            AuditLogEvent.MemberUpdate,
            newMember.id
          );

        await sendLog(
          newMember.guild,
          "timeout",
          "⏳ إضافة Timeout",
          `**العضو:** ${newMember.user}\n` +
          `**ينتهي:** <t:${Math.floor(newTimeout / 1000)}:F>\n` +
          `**بواسطة:** ${executor || "غير معروف"}`,
          0x9B59B6
        );

        await sendLog(
          newMember.guild,
          "mute",
          "🔇 سجل الميوت",
          `**العضو:** ${newMember.user}\n` +
          `**النوع:** Timeout\n` +
          `**ينتهي:** <t:${Math.floor(newTimeout / 1000)}:F>\n` +
          `**بواسطة:** ${executor || "غير معروف"}`,
          0x9B59B6
        );

      } else {

        const executor =
          await getAuditExecutor(
            newMember.guild,
            AuditLogEvent.MemberUpdate,
            newMember.id
          );

        await sendLog(
          newMember.guild,
          "untimeout",
          "🔊 إزالة Timeout",
          `**العضو:** ${newMember.user}\n` +
          `**بواسطة:** ${executor || "غير معروف"}`,
          0x2ECC71
        );
      }
    }

    /* ================= NICKNAME ================= */

    if (
      oldMember.nickname !==
      newMember.nickname
    ) {

      await sendLog(
        newMember.guild,
        "member_roles",
        "✏️ تغيير اسم العضو",
        `**العضو:** ${newMember.user}\n` +
        `**السابق:** ${oldMember.nickname || oldMember.user.username}\n` +
        `**الجديد:** ${newMember.nickname || newMember.user.username}`,
        0x3498DB
      );
    }
  }
);

/* =========================================================
   BAN
========================================================= */

client.on(
  "guildBanAdd",
  async ban => {

    const executor =
      await getAuditExecutor(
        ban.guild,
        AuditLogEvent.MemberBanAdd,
        ban.user.id
      );

    await sendLog(
      ban.guild,
      "ban",
      "🔨 حظر الأعضاء",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**الإداري:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   UNBAN
========================================================= */

client.on(
  "guildBanRemove",
  async ban => {

    const executor =
      await getAuditExecutor(
        ban.guild,
        AuditLogEvent.MemberBanRemove,
        ban.user.id
      );

    await sendLog(
      ban.guild,
      "unban",
      "🔓 إزالة حظر الأعضاء",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**الإداري:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   ROLE CREATE
========================================================= */

client.on(
  "roleCreate",
  async role => {

    const executor =
      await getAuditExecutor(
        role.guild,
        AuditLogEvent.RoleCreate,
        role.id
      );

    await sendLog(
      role.guild,
      "role_create",
      "🟢 إنشاء الرُتب",
      `**الرتبة:** ${role}\n` +
      `**الاسم:** ${role.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   ROLE DELETE
========================================================= */

client.on(
  "roleDelete",
  async role => {

    const executor =
      await getAuditExecutor(
        role.guild,
        AuditLogEvent.RoleDelete,
        role.id
      );

    await sendLog(
      role.guild,
      "role_delete",
      "🔴 حذف الرُتب",
      `**الرتبة:** ${role.name}\n` +
      `**ID:** \`${role.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on(
  "roleUpdate",
  async (
    oldRole,
    newRole
  ) => {

    if (
      oldRole.name ===
        newRole.name &&
      oldRole.color ===
        newRole.color &&
      oldRole.permissions.bitfield ===
        newRole.permissions.bitfield &&
      oldRole.mentionable ===
        newRole.mentionable
    ) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newRole.guild,
        AuditLogEvent.RoleUpdate,
        newRole.id
      );

    const permissionChanged =
      oldRole.permissions.bitfield !==
      newRole.permissions.bitfield;

    await sendLog(
      newRole.guild,
      permissionChanged
        ? "role_permissions"
        : "role_update",
      permissionChanged
        ? "🔐 تحديث صلاحيات الرُتب"
        : "✏️ تحديث الرُتب",
      `**الرتبة:** ${newRole}\n` +
      `**الاسم السابق:** ${oldRole.name}\n` +
      `**الاسم الجديد:** ${newRole.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   CHANNEL CREATE
========================================================= */

client.on(
  "channelCreate",
  async channel => {

    if (!channel.guild) {
      return;
    }

    const executor =
      await getAuditExecutor(
        channel.guild,
        AuditLogEvent.ChannelCreate,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_create",
      "🟢 إنشاء الرومات",
      `**الروم:** ${channel}\n` +
      `**الاسم:** ${channel.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   CHANNEL DELETE
========================================================= */

client.on(
  "channelDelete",
  async channel => {

    if (!channel.guild) {
      return;
    }

    const executor =
      await getAuditExecutor(
        channel.guild,
        AuditLogEvent.ChannelDelete,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_delete",
      "🔴 حذف الرومات",
      `**الروم:** ${channel.name}\n` +
      `**ID:** \`${channel.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   CHANNEL UPDATE
========================================================= */

client.on(
  "channelUpdate",
  async (
    oldChannel,
    newChannel
  ) => {

    if (!newChannel.guild) {
      return;
    }

    const changes = [];

    if (
      oldChannel.name !==
      newChannel.name
    ) {
      changes.push(
        `**الاسم:** ${oldChannel.name} → ${newChannel.name}`
      );
    }

    if (
      oldChannel.topic !==
      newChannel.topic
    ) {
      changes.push(
        "**تم تغيير وصف الروم**"
      );
    }

    if (
      oldChannel.rateLimitPerUser !==
      newChannel.rateLimitPerUser
    ) {
      changes.push(
        `**Slowmode:** ${oldChannel.rateLimitPerUser || 0} → ${newChannel.rateLimitPerUser || 0}`
      );
    }

    if (!changes.length) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id
      );

    await sendLog(
      newChannel.guild,
      "channel_update",
      "✏️ تحديث الرومات",
      `**الروم:** ${newChannel}\n` +
      changes.join("\n") +
      `\n**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   CHANNEL OVERWRITE UPDATE
========================================================= */

client.on(
  "channelUpdate",
  async (
    oldChannel,
    newChannel
  ) => {

    if (!newChannel.guild) {
      return;
    }

    if (
      !oldChannel.permissionOverwrites ||
      !newChannel.permissionOverwrites
    ) {
      return;
    }

    const oldPerms =
      oldChannel.permissionOverwrites.cache;

    const newPerms =
      newChannel.permissionOverwrites.cache;

    if (
      oldPerms.size ===
        newPerms.size &&
      oldPerms.every(
        (oldOverwrite, id) => {

          const newOverwrite =
            newPerms.get(id);

          if (!newOverwrite) {
            return false;
          }

          return (
            oldOverwrite.allow.bitfield ===
              newOverwrite.allow.bitfield &&
            oldOverwrite.deny.bitfield ===
              newOverwrite.deny.bitfield
          );
        }
      )
    ) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelOverwriteUpdate,
        newChannel.id
      );

    await sendLog(
      newChannel.guild,
      "channel_permissions",
      "🔐 تحديث صلاحيات الرومات",
      `**الروم:** ${newChannel}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x9B59B6
    );
  }
);

/* =========================================================
   VOICE
========================================================= */

client.on(
  "voiceStateUpdate",
  async (
    oldState,
    newState
  ) => {

    const member =
      newState.member ||
      oldState.member;

    if (!member) {
      return;
    }

    /* ================= JOIN ================= */

    if (
      !oldState.channelId &&
      newState.channelId
    ) {

      await sendLog(
        member.guild,
        "voice_join",
        "🔊 دخول صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${newState.channel}`,
        0x2ECC71
      );

      return;
    }

    /* ================= LEAVE ================= */

    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      await sendLog(
        member.guild,
        "voice_leave",
        "🔇 خروج صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${oldState.channel}`,
        0xE74C3C
      );

      return;
    }

    /* ================= MOVE ================= */

    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
        newState.channelId
    ) {

      const executor =
        await getAuditExecutor(
          member.guild,
          AuditLogEvent.MemberMove,
          member.id
        );

      await sendLog(
        member.guild,
        "voice_move",
        "🔄 تنقل/سحب الأعضاء",
        `**العضو:** ${member.user}\n` +
        `**من:** ${oldState.channel}\n` +
        `**إلى:** ${newState.channel}\n` +
        `**بواسطة:** ${executor || "غير معروف"}`,
        0x3498DB
      );

      return;
    }

    /* ================= SERVER MUTE ================= */

    if (
      oldState.serverMute !==
      newState.serverMute
    ) {

      await sendLog(
        member.guild,
        "mute",
        newState.serverMute
          ? "🔇 سجل الميوت"
          : "🔊 إزالة الميوت",
        `**العضو:** ${member.user}\n` +
        `**الحالة:** ${
          newState.serverMute
            ? "تم منعه من التحدث"
            : "تم السماح له بالتحدث"
        }`,
        newState.serverMute
          ? 0xE74C3C
          : 0x2ECC71
      );

      await sendLog(
        member.guild,
        "voice_speak",
        newState.serverMute
          ? "🔇 منع التحدث"
          : "🔊 السماح بالتحدث",
        `**العضو:** ${member.user}\n` +
        `**الحالة:** ${
          newState.serverMute
            ? "ممنوع"
            : "مسموح"
        }`,
        newState.serverMute
          ? 0xE74C3C
          : 0x2ECC71
      );
    }

    /* ================= SERVER DEAF ================= */

    if (
      oldState.serverDeaf !==
      newState.serverDeaf
    ) {

      await sendLog(
        member.guild,
        "voice_listen",
        newState.serverDeaf
          ? "🔇 منع الإستماع"
          : "🔊 السماح بالإستماع",
        `**العضو:** ${member.user}\n` +
        `**الحالة:** ${
          newState.serverDeaf
            ? "ممنوع"
            : "مسموح"
        }`,
        newState.serverDeaf
          ? 0xE74C3C
          : 0x2ECC71
      );
    }
  }
);

/* =========================================================
   GUILD UPDATE
========================================================= */

client.on(
  "guildUpdate",
  async (
    oldGuild,
    newGuild
  ) => {

    const changes = [];

    if (
      oldGuild.name !==
      newGuild.name
    ) {
      changes.push(
        `**اسم السيرفر:** ${oldGuild.name} → ${newGuild.name}`
      );
    }

    if (
      oldGuild.icon !==
      newGuild.icon
    ) {
      changes.push(
        "**تم تحديث صورة السيرفر**"
      );
    }

    if (
      oldGuild.banner !==
      newGuild.banner
    ) {
      changes.push(
        "**تم تحديث بنر السيرفر**"
      );
    }

    if (!changes.length) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newGuild,
        AuditLogEvent.GuildUpdate,
        newGuild.id
      );

    await sendLog(
      newGuild,
      "guild_update",
      "⚙️ تحديث إعدادات السيرفر",
      changes.join("\n") +
      `\n**بواسطة:** ${executor || "غير معروف"}`,
      0x3498DB
    );
  }
);

/* =========================================================
   EMOJI UPDATE
========================================================= */

client.on(
  "emojiCreate",
  async emoji => {

    const executor =
      await getAuditExecutor(
        emoji.guild,
        AuditLogEvent.EmojiCreate,
        emoji.id
      );

    await sendLog(
      emoji.guild,
      "emoji_create",
      "😀 إضافة إيموجي",
      `**الإيموجي:** ${emoji}\n` +
      `**الاسم:** ${emoji.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

client.on(
  "emojiDelete",
  async emoji => {

    const executor =
      await getAuditExecutor(
        emoji.guild,
        AuditLogEvent.EmojiDelete,
        emoji.id
      );

    await sendLog(
      emoji.guild,
      "emoji_delete",
      "🗑️ حذف إيموجي",
      `**الاسم:** ${emoji.name}\n` +
      `**ID:** \`${emoji.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

client.on(
  "emojiUpdate",
  async (
    oldEmoji,
    newEmoji
  ) => {

    const executor =
      await getAuditExecutor(
        newEmoji.guild,
        AuditLogEvent.EmojiUpdate,
        newEmoji.id
      );

    await sendLog(
      newEmoji.guild,
      "emoji_update",
      "✏️ تعديل إيموجي",
      `**السابق:** ${oldEmoji.name}\n` +
      `**الجديد:** ${newEmoji.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   STICKERS
========================================================= */

client.on(
  "stickerCreate",
  async sticker => {

    const executor =
      await getAuditExecutor(
        sticker.guild,
        AuditLogEvent.StickerCreate,
        sticker.id
      );

    await sendLog(
      sticker.guild,
      "sticker_create",
      "🖼️ إضافة ستيكر",
      `**الاسم:** ${sticker.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

client.on(
  "stickerDelete",
  async sticker => {

    const executor =
      await getAuditExecutor(
        sticker.guild,
        AuditLogEvent.StickerDelete,
        sticker.id
      );

    await sendLog(
      sticker.guild,
      "sticker_delete",
      "🗑️ حذف ستيكر",
      `**الاسم:** ${sticker.name}\n` +
      `**ID:** \`${sticker.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

client.on(
  "stickerUpdate",
  async (
    oldSticker,
    newSticker
  ) => {

    const executor =
      await getAuditExecutor(
        newSticker.guild,
        AuditLogEvent.StickerUpdate,
        newSticker.id
      );

    await sendLog(
      newSticker.guild,
      "sticker_update",
      "✏️ تعديل ستيكر",
      `**السابق:** ${oldSticker.name}\n` +
      `**الجديد:** ${newSticker.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   REACTION ADD
========================================================= */

client.on(
  "messageReactionAdd",
  async (
    reaction,
    user
  ) => {

    if (
      user.bot ||
      !reaction.message.guild
    ) {
      return;
    }

    await sendLog(
      reaction.message.guild,
      "reaction_add",
      "👍 إضافة رياكشن",
      `**العضو:** ${user}\n` +
      `**الرياكت:** ${reaction.emoji}\n` +
      `**الروم:** ${reaction.message.channel}\n` +
      `**الرسالة:** [اضغط هنا](${reaction.message.url})`,
      0xF1C40F
    );
  }
);

/* =========================================================
   ERRORS
========================================================= */

client.on(
  "error",
  error => {
    console.error(
      "❌ Discord Error:",
      error
    );
  }
);

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
   LOGIN
========================================================= */

console.log(
  "🚀 Starting Discord Bot..."
);

client.login(TOKEN);
