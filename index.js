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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions
  ],

  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ]
});

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
  if (isOwner(interaction)) return true;

  const required =
    commandPermissions[interaction.commandName];

  if (!required) return true;

  return (
    interaction.memberPermissions?.has(required) ?? false
  );
}

/* =========================================================
   LOG TYPES
========================================================= */

const LOG_TYPES = {

  member_join: {
    name: "إنضمام الأعضاء",
    emoji: "🟢"
  },

  member_leave: {
    name: "خروج الأعضاء",
    emoji: "🔴"
  },

  member_kick: {
    name: "طرد الأعضاء",
    emoji: "👢"
  },

  member_ban: {
    name: "حظر/إزالة حظر الأعضاء",
    emoji: "🔨"
  },

  member_timeout: {
    name: "إضافة/إزالة تايم أوت",
    emoji: "⏳"
  },

  member_roles: {
    name: "تحديث رُتب الأعضاء",
    emoji: "🎭"
  },

  member_nickname: {
    name: "تحديث أسماء الأعضاء",
    emoji: "✏️"
  },

  member_voice: {
    name: "دخول/خروج/طرد صوتي",
    emoji: "🔊"
  },

  member_voice_permissions: {
    name: "منع/سماح الإستماع/التحدث",
    emoji: "🎙️"
  },

  member_move: {
    name: "تنقل/سحب الأعضاء",
    emoji: "↔️"
  },

  message_delete: {
    name: "الرسائل المحذوفة",
    emoji: "🗑️"
  },

  message_bulk_delete: {
    name: "حذف مجموعة رسائل",
    emoji: "🧹"
  },

  message_edit: {
    name: "تعديل الرسائل",
    emoji: "📝"
  },

  message_reaction: {
    name: "إضافة رياكشن",
    emoji: "❤️"
  },

  channel_create_delete: {
    name: "إنشاء وحذف الرومات",
    emoji: "📁"
  },

  channel_update: {
    name: "تحديث الرومات",
    emoji: "📝"
  },

  channel_permissions: {
    name: "تحديث صلاحيات الرومات",
    emoji: "🔐"
  },

  role_create_delete: {
    name: "إنشاء وحذف الرُتب",
    emoji: "🎭"
  },

  role_update: {
    name: "تحديث الرُتب",
    emoji: "📝"
  },

  role_permissions: {
    name: "تحديث صلاحيات الرُتب",
    emoji: "🔐"
  },

  server_update: {
    name: "تحديث إعدادات السيرفر",
    emoji: "⚙️"
  },

  emoji_update: {
    name: "إضافة/تعديل/حذف إيموجي",
    emoji: "😀"
  },

  sticker_update: {
    name: "إضافة/تعديل/حذف ستيكر",
    emoji: "🏷️"
  },

  warn: {
    name: "سجل الميوت",
    emoji: "⚠️"
  }
};

/* =========================================================
   DEFAULT LOG SETTINGS
========================================================= */

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
      settings JSONB NOT NULL
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
    SELECT settings
    FROM log_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  if (!result.rows.length) {

    const settings = defaultLogSettings();

    await db.query(
      `
      INSERT INTO log_settings
      (guild_id, settings)
      VALUES ($1, $2)
      ON CONFLICT (guild_id) DO NOTHING
      `,
      [
        guildId,
        JSON.stringify(settings)
      ]
    );

    return settings;
  }

  return {
    ...defaultLogSettings(),
    ...result.rows[0].settings
  };
}

async function setLogType(
  guildId,
  type,
  enabled
) {

  const settings =
    await getLogSettings(guildId);

  settings[type] = enabled;

  await db.query(
    `
    INSERT INTO log_settings
    (guild_id, settings)
    VALUES ($1, $2)

    ON CONFLICT (guild_id)
    DO UPDATE SET
      settings = EXCLUDED.settings
    `,
    [
      guildId,
      JSON.stringify(settings)
    ]
  );

  return settings;
}

/* =========================================================
   IS LOG ENABLED
========================================================= */

async function isLogEnabled(
  guildId,
  type
) {

  const settings =
    await getLogSettings(guildId);

  return settings[type] !== false;
}

/* =========================================================
   GET LOG CHANNEL
========================================================= */

async function getLogChannel(guild) {

  if (!guild) return null;

  const result =
    await db.query(
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

  const channel =
    guild.channels.cache.get(
      result.rows[0].channel_id
    );

  return channel || null;
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

  if (!guild) return;

  try {

    const enabled =
      await isLogEnabled(
        guild.id,
        type
      );

    if (!enabled) return;

    const channel =
      await getLogChannel(guild);

    if (!channel) return;

    if (!channel.isTextBased()) return;

    const embed =
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
          description || "لا توجد معلومات"
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
      "❌ LOG ERROR:",
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
  targetId = null
) {

  try {

    const logs =
      await guild.fetchAuditLogs({
        type,
        limit: 5
      });

    const entry =
      logs.entries.find(entry => {

        if (targetId && entry.target?.id !== targetId) {
          return false;
        }

        return (
          Date.now() -
          entry.createdTimestamp <
          10000
        );
      });

    if (!entry) return null;

    return entry.executor || null;

  } catch {

    return null;
  }
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  /* =========================
     BAN
  ========================= */

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
        .setRequired(true)
    ),

  /* =========================
     UNBAN
  ========================= */

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    ),

  /* =========================
     KICK
  ========================= */

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
        .setRequired(true)
    ),

  /* =========================
     TIMEOUT
  ========================= */

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء Timeout")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
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
        .setRequired(true)
    ),

  /* =========================
     UNTIMEOUT
  ========================= */

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  /* =========================
     WARN
  ========================= */

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("إعطاء تحذير")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    ),

  /* =========================
     WARNLIST
  ========================= */

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو - اختياري")
        .setRequired(false)
    ),

  /* =========================
     CLEAR
  ========================= */

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("العدد")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  /* =========================
     LOCK
  ========================= */

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  /* =========================
     UNLOCK
  ========================= */

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  /* =========================
     SLOWMODE
  ========================= */

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تفعيل Slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  /* =========================
     ROLE
  ========================= */

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("الرتبة")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("action")
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

  /* =========================
     NICKNAME
  ========================= */

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
    ),

  /* =========================
     INFO
  ========================= */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =========================
     SERVERINFO
  ========================= */

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  /* =========================
     AVATAR
  ========================= */

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =========================
     BANNER
  ========================= */

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =========================
     ROLES
  ========================= */

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =========================
     AUTOREPLY
  ========================= */

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
    ),

  /* =========================
     LIST
  ========================= */

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* =========================
     SHORTCUT
  ========================= */

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")

    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إنشاء اختصار")
        .addStringOption(o =>
          o.setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName("command")
            .setDescription("الأمر")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o =>
          o.setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("list")
        .setDescription("عرض الاختصارات")
    ),

  /* =========================
     LOG SETUP
  ========================= */

  new SlashCommandBuilder()
    .setName("logsetup")
    .setDescription("تحديد روم اللوق")
    .addChannelOption(o =>
      o.setName("channel")
        .setDescription("روم اللوق")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  /* =========================
     LOG
  ========================= */

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إدارة إعدادات اللوق")

    .addSubcommand(s =>
      s.setName("edit")
        .setDescription("تشغيل أو إيقاف نوع من أنواع اللوق")
        .addStringOption(o =>
          o.setName("type")
            .setDescription("نوع اللوق")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addBooleanOption(o =>
          o.setName("enabled")
            .setDescription("تشغيل أو إيقاف")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("status")
        .setDescription("عرض إعدادات اللوق")
    )

    .addSubcommand(s =>
      s.setName("enableall")
        .setDescription("تشغيل جميع أنواع اللوق")
    )

    .addSubcommand(s =>
      s.setName("disableall")
        .setDescription("إيقاف جميع أنواع اللوق")
    ),

  /* =========================
     LOGS TEST
  ========================= */

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار نظام اللوق"),

  /* =========================
     BOT
  ========================= */

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("حالة البوت"),

  /* =========================
     ME
  ========================= */

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت")

].map(c => c.toJSON());

/* =========================================================
   UPTIME
========================================================= */

let botStartedAt = null;
let lastReadyAt = null;
let lastDisconnectAt = null;

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
   READY
========================================================= */

client.once("ready", async () => {

  botStartedAt = Date.now();
  lastReadyAt = new Date();

  console.log("================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🟢 Online");
  console.log(`👑 Owner: ${OWNER_ID}`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log("================================");

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
      Routes.applicationCommands(CLIENT_ID),
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
          `✅ ${guild.name}: ${commands.length} commands`
        );

      } catch (error) {

        console.error(
          `❌ ${guild.name}:`,
          error.message
        );

      }
    }

    console.log("🚀 البوت جاهز");

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

      await getLogSettings(guild.id);

      console.log(
        `🆕 تم تجهيز ${guild.name}`
      );

    } catch (error) {

      console.error(
        "❌ GUILD CREATE:",
        error.message
      );

    }
  }
);

/* =========================================================
   AUTOCOMPLETE /log edit
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isAutocomplete()) {
      return;
    }

    if (
      interaction.commandName !== "log"
    ) {
      return;
    }

    try {

      const value =
        interaction.options
          .getString("type")
          ?.toLowerCase() || "";

      const choices =
        Object.entries(LOG_TYPES)
          .filter(
            ([key, data]) =>
              key.toLowerCase().includes(value) ||
              data.name.toLowerCase().includes(value)
          )
          .slice(0, 25)
          .map(
            ([key, data]) => ({
              name:
                `${data.emoji} ${data.name}`,
              value: key
            })
          );

      await interaction.respond(
        choices
      );

    } catch {
      await interaction.respond([]);
    }
  }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      /* ===================================================
         PERMISSION
      =================================================== */

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

      /* ===================================================
         LOG EDIT
      =================================================== */

      if (
        interaction.commandName === "log" &&
        interaction.options.getSubcommand() === "edit"
      ) {

        const type =
          interaction.options.getString(
            "type"
          );

        const enabled =
          interaction.options.getBoolean(
            "enabled"
          );

        if (!LOG_TYPES[type]) {

          return interaction.reply({
            content:
              "❌ نوع اللوق غير موجود.",
            ephemeral: true
          });

        }

        await setLogType(
          interaction.guildId,
          type,
          enabled
        );

        const data =
          LOG_TYPES[type];

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(
                enabled
                  ? 0x2ECC71
                  : 0xE74C3C
              )
              .setTitle(
                "📋 تعديل إعدادات اللوق"
              )
              .setDescription(
                `${data.emoji} **${data.name}**\n\n` +
                `الحالة: ${
                  enabled
                    ? "🟢 مفعّل"
                    : "🔴 متوقف"
                }`
              )
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      /* ===================================================
         LOG STATUS
      =================================================== */

      if (
        interaction.commandName === "log" &&
        interaction.options.getSubcommand() === "status"
      ) {

        const settings =
          await getLogSettings(
            interaction.guildId
          );

        let text = "";

        for (
          const [key, data]
          of Object.entries(LOG_TYPES)
        ) {

          text +=
            `${data.emoji} **${data.name}** — ` +
            `${
              settings[key]
                ? "🟢"
                : "🔴"
            }\n`;
        }

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle("📋 إعدادات اللوق")
              .setDescription(text)
              .setFooter({
                text:
                  "استخدم /log edit لتغيير أي نوع"
              })
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      /* ===================================================
         ENABLE ALL
      =================================================== */

      if (
        interaction.commandName === "log" &&
        interaction.options.getSubcommand() === "enableall"
      ) {

        const settings = {};

        for (
          const key
          of Object.keys(LOG_TYPES)
        ) {
          settings[key] = true;
        }

        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, settings)
          VALUES ($1, $2)

          ON CONFLICT (guild_id)
          DO UPDATE SET
            settings = EXCLUDED.settings
          `,
          [
            interaction.guildId,
            JSON.stringify(settings)
          ]
        );

        return interaction.reply({
          content:
            "✅ تم تشغيل جميع أنواع اللوق.",
          ephemeral: true
        });
      }

      /* ===================================================
         DISABLE ALL
      =================================================== */

      if (
        interaction.commandName === "log" &&
        interaction.options.getSubcommand() === "disableall"
      ) {

        const settings = {};

        for (
          const key
          of Object.keys(LOG_TYPES)
        ) {
          settings[key] = false;
        }

        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, settings)
          VALUES ($1, $2)

          ON CONFLICT (guild_id)
          DO UPDATE SET
            settings = EXCLUDED.settings
          `,
          [
            interaction.guildId,
            JSON.stringify(settings)
          ]
        );

        return interaction.reply({
          content:
            "🔴 تم إيقاف جميع أنواع اللوق.",
          ephemeral: true
        });
      }

      /* ===================================================
         LOG SETUP
      =================================================== */

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
          "server_update",
          "📋 إعداد اللوق",
          `**الروم:** ${channel}\n**بواسطة:** ${interaction.user}`,
          0x2ECC71
        );

        return;
      }

      /* ===================================================
         LOG TEST
      =================================================== */

      if (
        interaction.commandName === "logs"
      ) {

        const channel =
          await getLogChannel(
            interaction.guild
          );

        if (!channel) {

          return interaction.reply({
            content:
              "❌ لم تحدد روم اللوق.\nاستخدم `/logsetup` أولاً.",
            ephemeral: true
          });
        }

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle(
                "🧪 اختبار نظام اللوق"
              )
              .setDescription(
                `**السيرفر:** ${interaction.guild.name}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**روم اللوق:** ${channel}\n\n` +
                "✅ نظام اللوق يعمل."
              )
              .setTimestamp()
          ]
        });

        return interaction.reply({
          content:
            `✅ تم إرسال الاختبار إلى ${channel}.`,
          ephemeral: true
        });
      }

      /* ===================================================
         BOT
      =================================================== */

      if (
        interaction.commandName === "bot"
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
              .setTitle("🤖 حالة البوت")
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
                    `${client.ws.ping}ms`,
                  inline: true
                },

                {
                  name: "السيرفرات",
                  value:
                    `${client.guilds.cache.size}`,
                  inline: true
                },

                {
                  name: "مدة الاتصال",
                  value:
                    botStartedAt
                      ? formatUptime(
                          Date.now() -
                          botStartedAt
                        )
                      : "غير معروف",
                  inline: false
                },

                {
                  name:
                    "آخر Online",
                  value:
                    lastReadyAt
                      ? `<t:${Math.floor(
                          lastReadyAt.getTime() /
                          1000
                        )}:F>`
                      : "غير معروف",
                  inline: false
                },

                {
                  name:
                    "آخر Disconnect",
                  value:
                    lastDisconnectAt
                      ? `<t:${Math.floor(
                          lastDisconnectAt.getTime() /
                          1000
                        )}:F>`
                      : "لا توجد بيانات",
                  inline: false
                },

                {
                  name: "Owner",
                  value:
                    `<@${OWNER_ID}>`,
                  inline: true
                }

              )
              .setTimestamp()
          ]
        });
      }

      /* ===================================================
         ME
      =================================================== */

      if (
        interaction.commandName === "me"
      ) {

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("🤖 معلومات البوت")
              .setDescription(
                `**البوت:** ${client.user}\n` +
                `**الحالة:** 🟢 Online\n` +
                `**السيرفرات:** ${client.guilds.cache.size}\n` +
                `**Owner:** <@${OWNER_ID}>\n\n` +
                `Powered by **.v5d.**`
              )
              .setTimestamp()
          ]
        });
      }

      /* ===================================================
         BAN
      =================================================== */

      if (
        interaction.commandName === "ban"
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
              "❌ البوت لا يستطيع حظر هذا العضو.",
            ephemeral: true
          });
        }

        await member.ban({
          reason
        });

        await interaction.reply({
          content:
            `🔨 تم حظر ${user}.\n**السبب:** ${reason}`
        });

        return;
      }

      /* ===================================================
         UNBAN
      =================================================== */

      if (
        interaction.commandName === "unban"
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

        return interaction.reply(
          `🔓 تم فك الحظر عن <@${id}>.`
        );
      }

      /* ===================================================
         KICK
      =================================================== */

      if (
        interaction.commandName === "kick"
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

        return interaction.reply(
          `👢 تم طرد ${user}.\n**السبب:** ${reason}`
        );
      }

      /* ===================================================
         TIMEOUT
      =================================================== */

      if (
        interaction.commandName === "timeout"
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
          `⏳ تم إعطاء ${user} Timeout لمدة **${minutes} دقيقة**.\n**السبب:** ${reason}`
        );

        return;
      }

      /* ===================================================
         UNTIMEOUT
      =================================================== */

      if (
        interaction.commandName === "untimeout"
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

        return interaction.reply(
          `✅ تم إزالة Timeout عن ${user}.`
        );
      }

      /* ===================================================
         WARN
      =================================================== */

      if (
        interaction.commandName === "warn"
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

        const result =
          await db.query(
            `
            SELECT COUNT(*)::int AS count
            FROM warns
            WHERE guild_id = $1
            AND user_id = $2
            `,
            [
              interaction.guildId,
              user.id
            ]
          );

        const count =
          result.rows[0].count;

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("⚠️ تحذير")
              .setDescription(
                `**العضو:** ${user}\n` +
                `**السبب:** ${reason}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**إجمالي التحذيرات:** ${count}`
              )
              .setTimestamp()
          ]
        });

        await sendLog(
          interaction.guild,
          "warn",
          "⚠️ سجل الميوت",
          `**العضو:** ${user}\n` +
          `**الإداري:** ${interaction.user}\n` +
          `**السبب:** ${reason}\n` +
          `**الإجمالي:** ${count}`,
          0xF1C40F
        );

        return;
      }

      /* ===================================================
         WARNLIST
      =================================================== */

      if (
        interaction.commandName === "warnlist"
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
                WHERE guild_id = $1
                AND user_id = $2
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
                WHERE guild_id = $1
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
                `**السبب:** ${w.reason}\n` +
                `**بواسطة:** <@${w.moderator_id}>\n` +
                `**التاريخ:** <t:${Math.floor(
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
              .setTimestamp()
          ]
        });
      }

      /* ===================================================
         CLEAR
      =================================================== */

      if (
        interaction.commandName === "clear"
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
            `🧹 تم حذف **${deleted.size}** رسالة.`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          "message_bulk_delete",
          "🧹 حذف مجموعة رسائل",
          `**الروم:** ${interaction.channel}\n` +
          `**العدد:** ${deleted.size}\n` +
          `**بواسطة:** ${interaction.user}`,
          0x3498DB
        );

        return;
      }

      /* ===================================================
         LOCK / UNLOCK
      =================================================== */

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
          `**الروم:** ${interaction.channel}\n` +
          `**بواسطة:** ${interaction.user}`,
          locked
            ? 0xE74C3C
            : 0x2ECC71
        );

        return;
      }

      /* ===================================================
         SLOWMODE
      =================================================== */

      if (
        interaction.commandName === "slowmode"
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
            : `🐌 تم تفعيل Slowmode لمدة **${seconds} ثانية**.`
        );

        return;
      }

      /* ===================================================
         ROLE COMMAND
      =================================================== */

      if (
        interaction.commandName === "role"
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
          await interaction.guild.members
            .fetch(user.id);

        if (
          role.id === interaction.guild.id
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
              "❌ رتبة البوت أقل من هذه الرتبة.",
            ephemeral: true
          });
        }

        if (action === "add") {
          await member.roles.add(role);
        } else {
          await member.roles.remove(role);
        }

        await interaction.reply(
          action === "add"
            ? `✅ تم إعطاء ${user} رتبة ${role}.`
            : `✅ تم إزالة ${role} من ${user}.`
        );

        return;
      }

      /* ===================================================
         NICKNAME
      =================================================== */

      if (
        interaction.commandName === "nickname"
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
          await interaction.guild.members
            .fetch(user.id);

        await member.setNickname(name);

        await interaction.reply(
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
        );

        return;
      }

      /* ===================================================
         INFO
      =================================================== */

      if (
        interaction.commandName === "info"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) || interaction.user;

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
                  name: "العضو",
                  value: `${user}`,
                  inline: true
                },
                {
                  name: "ID",
                  value: `\`${user.id}\``,
                  inline: true
                },
                {
                  name: "تاريخ الحساب",
                  value:
                    `<t:${Math.floor(
                      user.createdTimestamp /
                      1000
                    )}:R>`,
                  inline: true
                },
                {
                  name: "دخول السيرفر",
                  value:
                    member?.joinedTimestamp
                      ? `<t:${Math.floor(
                          member.joinedTimestamp /
                          1000
                        )}:R>`
                      : "غير معروف",
                  inline: true
                }
              )
              .setTimestamp()
          ]
        });
      }

      /* ===================================================
         SERVER INFO
      =================================================== */

      if (
        interaction.commandName === "serverinfo"
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
              .setTimestamp()
          ]
        });
      }

      /* ===================================================
         AVATAR
      =================================================== */

      if (
        interaction.commandName === "avatar"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) || interaction.user;

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

      /* ===================================================
         BANNER
      =================================================== */

      if (
        interaction.commandName === "banner"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) || interaction.user;

        const fetched =
          await user.fetch();

        const banner =
          fetched.bannerURL({
            size: 1024
          });

        if (!banner) {
          return interaction.reply(
            "❌ هذا العضو لا يملك Banner."
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

      /* ===================================================
         ROLES
      =================================================== */

      if (
        interaction.commandName === "roles"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) || interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id);

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
            .map(r => `${r}`)
            .join(" ");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle(
                `🎭 رتب ${user.username}`
              )
              .setDescription(
                roles || "لا توجد رتب."
              )
          ]
        });
      }

      /* ===================================================
         AUTOREPLY
      =================================================== */

      if (
        interaction.commandName === "autoreply"
      ) {

        const sub =
          interaction.options.getSubcommand();

        const trigger =
          interaction.options
            .getString("trigger")
            .toLowerCase();

        if (sub === "add") {

          const response =
            interaction.options
              .getString("response");

          await db.query(
            `
            INSERT INTO autoreplies
            (guild_id, trigger, response)
            VALUES ($1, $2, $3)

            ON CONFLICT
            (guild_id, trigger)

            DO UPDATE SET
              response =
                EXCLUDED.response
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

          const result =
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

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف **${trigger}**.`
              : `❌ **${trigger}** غير موجود.`
          );
        }
      }

      /* ===================================================
         LIST
      =================================================== */

      if (
        interaction.commandName === "list"
      ) {

        const result =
          await db.query(
            `
            SELECT trigger, response
            FROM autoreplies
            WHERE guild_id = $1
            ORDER BY trigger
            `,
            [
              interaction.guildId
            ]
          );

        if (!result.rows.length) {
          return interaction.reply(
            "📭 لا توجد ردود تلقائية."
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

      /* ===================================================
         SHORTCUT
      =================================================== */

      if (
        interaction.commandName === "shortcut"
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
              .replace(/^\//, "");

          await db.query(
            `
            INSERT INTO shortcuts
            (guild_id, shortcut, command)
            VALUES ($1, $2, $3)

            ON CONFLICT
            (guild_id, shortcut)

            DO UPDATE SET
              command =
                EXCLUDED.command
            `,
            [
              interaction.guildId,
              shortcut,
              command
            ]
          );

          return interaction.reply(
            `✅ تم إنشاء الاختصار:\n**${shortcut}** → **/${command}**`
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
              WHERE guild_id = $1
              AND shortcut = $2
              `,
              [
                interaction.guildId,
                shortcut
              ]
            );

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف **${shortcut}**.`
              : `❌ **${shortcut}** غير موجود.`
          );
        }

        if (sub === "list") {

          const result =
            await db.query(
              `
              SELECT shortcut, command
              FROM shortcuts
              WHERE guild_id = $1
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
   AUTO REPLY + SHORTCUT
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

      if (!text) return;

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
          WHERE guild_id = $1
          AND shortcut = $2
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
        "❌ MESSAGE ERROR:",
        error.message
      );

    }
  }
);

/* =========================================================
   LOG: MESSAGE DELETE
========================================================= */

client.on(
  "messageDelete",
  async message => {

    if (!message.guild) return;

    if (message.author?.bot) return;

    await sendLog(
      message.guild,
      "message_delete",
      "🗑️ الرسائل المحذوفة",
      `**العضو:** ${message.author || "غير معروف"}\n` +
      `**الروم:** ${message.channel}\n` +
      `**الرسالة:** ${message.content || "غير متوفرة"}\n` +
      `**ID:** \`${message.id}\``,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: MESSAGE UPDATE
========================================================= */

client.on(
  "messageUpdate",
  async (
    oldMessage,
    newMessage
  ) => {

    if (!newMessage.guild) return;

    if (newMessage.author?.bot) return;

    const oldText =
      oldMessage.content || "";

    const newText =
      newMessage.content || "";

    if (oldText === newText) return;

    await sendLog(
      newMessage.guild,
      "message_edit",
      "📝 تعديل الرسائل",
      `**العضو:** ${newMessage.author || "غير معروف"}\n` +
      `**الروم:** ${newMessage.channel}\n\n` +
      `**قبل:**\n${oldText || "فارغة"}\n\n` +
      `**بعد:**\n${newText || "فارغة"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   LOG: REACTION
========================================================= */

client.on(
  "messageReactionAdd",
  async (
    reaction,
    user
  ) => {

    try {

      if (user.bot) return;

      if (reaction.partial) {
        await reaction.fetch();
      }

      const guild =
        reaction.message.guild;

      if (!guild) return;

      await sendLog(
        guild,
        "message_reaction",
        "❤️ إضافة رياكشن",
        `**العضو:** ${user}\n` +
        `**الروم:** ${reaction.message.channel}\n` +
        `**الرياكت:** ${reaction.emoji}\n` +
        `**الرسالة:** \`${reaction.message.id}\``,
        0xE91E63
      );

    } catch {}
  }
);

/* =========================================================
   LOG: MEMBER JOIN
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
   LOG: MEMBER LEAVE
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

      return;
    }

    await sendLog(
      member.guild,
      "member_leave",
      "🔴 خروج الأعضاء",
      `**العضو:** ${member.user || "غير معروف"}\n` +
      `**ID:** \`${member.id}\``,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: MEMBER UPDATE
========================================================= */

client.on(
  "guildMemberUpdate",
  async (
    oldMember,
    newMember
  ) => {

    /* ==========================
       ROLES
    ========================== */

    const oldRoles =
      oldMember.roles.cache;

    const newRoles =
      newMember.roles.cache;

    const added =
      newRoles.filter(
        r => !oldRoles.has(r.id)
      );

    const removed =
      oldRoles.filter(
        r => !newRoles.has(r.id)
      );

    for (
      const role
      of added.values()
    ) {

      await sendLog(
        newMember.guild,
        "member_roles",
        "🎭 تحديث رُتب الأعضاء",
        `**العضو:** ${newMember.user}\n` +
        `**إضافة الرتبة:** ${role}`,
        0x2ECC71
      );
    }

    for (
      const role
      of removed.values()
    ) {

      await sendLog(
        newMember.guild,
        "member_roles",
        "🎭 تحديث رُتب الأعضاء",
        `**العضو:** ${newMember.user}\n` +
        `**إزالة الرتبة:** ${role}`,
        0xE74C3C
      );
    }

    /* ==========================
       NICKNAME
    ========================== */

    if (
      oldMember.nickname !==
      newMember.nickname
    ) {

      await sendLog(
        newMember.guild,
        "member_nickname",
        "✏️ تحديث أسماء الأعضاء",
        `**العضو:** ${newMember.user}\n` +
        `**السابق:** ${
          oldMember.nickname ||
          oldMember.user.username
        }\n` +
        `**الجديد:** ${
          newMember.nickname ||
          newMember.user.username
        }`,
        0x3498DB
      );
    }

    /* ==========================
       TIMEOUT
    ========================== */

    const oldTimeout =
      oldMember.communicationDisabledUntilTimestamp;

    const newTimeout =
      newMember.communicationDisabledUntilTimestamp;

    if (
      oldTimeout !== newTimeout
    ) {

      if (newTimeout) {

        const executor =
          await getAuditExecutor(
            newMember.guild,
            AuditLogEvent.MemberUpdate,
            newMember.id
          );

        await sendLog(
          newMember.guild,
          "member_timeout",
          "⏳ إضافة تايم أوت",
          `**العضو:** ${newMember.user}\n` +
          `**الإداري:** ${executor || "غير معروف"}\n` +
          `**ينتهي:** <t:${Math.floor(
            newTimeout / 1000
          )}:F>`,
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
          "member_timeout",
          "✅ إزالة تايم أوت",
          `**العضو:** ${newMember.user}\n` +
          `**الإداري:** ${executor || "غير معروف"}`,
          0x2ECC71
        );
      }
    }
  }
);

/* =========================================================
   LOG: VOICE
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

    if (!member) return;

    /* ==========================
       JOIN VOICE
    ========================== */

    if (
      !oldState.channel &&
      newState.channel
    ) {

      await sendLog(
        member.guild,
        "member_voice",
        "🔊 دخول صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${newState.channel}`,
        0x2ECC71
      );

      return;
    }

    /* ==========================
       LEAVE VOICE
    ========================== */

    if (
      oldState.channel &&
      !newState.channel
    ) {

      await sendLog(
        member.guild,
        "member_voice",
        "🔇 خروج صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${oldState.channel}`,
        0xE74C3C
      );

      return;
    }

    /* ==========================
       MOVE
    ========================== */

    if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !==
        newState.channel.id
    ) {

      await sendLog(
        member.guild,
        "member_move",
        "↔️ تنقل/سحب الأعضاء",
        `**العضو:** ${member.user}\n` +
        `**من:** ${oldState.channel}\n` +
        `**إلى:** ${newState.channel}`,
        0x3498DB
      );

      return;
    }

    /* ==========================
       MUTE / UNMUTE
    ========================== */

    if (
      oldState.serverMute !==
      newState.serverMute
    ) {

      await sendLog(
        member.guild,
        "member_voice_permissions",
        newState.serverMute
          ? "🔇 منع التحدث"
          : "🎙️ السماح بالتحدث",
        `**العضو:** ${member.user}\n` +
        `**الحالة:** ${
          newState.serverMute
            ? "ممنوع من التحدث"
            : "مسموح له بالتحدث"
        }`,
        newState.serverMute
          ? 0xE74C3C
          : 0x2ECC71
      );
    }

    /* ==========================
       DEAF / UNDEAF
    ========================== */

    if (
      oldState.serverDeaf !==
      newState.serverDeaf
    ) {

      await sendLog(
        member.guild,
        "member_voice_permissions",
        newState.serverDeaf
          ? "🔇 منع الإستماع"
          : "🎧 السماح بالإستماع",
        `**العضو:** ${member.user}\n` +
        `**الحالة:** ${
          newState.serverDeaf
            ? "ممنوع من الإستماع"
            : "مسموح له بالإستماع"
        }`,
        newState.serverDeaf
          ? 0xE74C3C
          : 0x2ECC71
      );
    }
  }
);

/* =========================================================
   LOG: ROLE CREATE
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
      "role_create_delete",
      "🎭 إنشاء رُتبة",
      `**الرتبة:** ${role}\n` +
      `**الاسم:** ${role.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   LOG: ROLE DELETE
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
      "role_create_delete",
      "🗑️ حذف رُتبة",
      `**الرتبة:** ${role.name}\n` +
      `**ID:** \`${role.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: ROLE UPDATE
========================================================= */

client.on(
  "roleUpdate",
  async (
    oldRole,
    newRole
  ) => {

    if (
      oldRole.name === newRole.name &&
      oldRole.color === newRole.color &&
      oldRole.permissions.bitfield ===
        newRole.permissions.bitfield &&
      oldRole.hoist === newRole.hoist &&
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

    const permissionsChanged =
      oldRole.permissions.bitfield !==
      newRole.permissions.bitfield;

    await sendLog(
      newRole.guild,
      permissionsChanged
        ? "role_permissions"
        : "role_update",
      permissionsChanged
        ? "🔐 تحديث صلاحيات الرُتب"
        : "📝 تحديث الرُتب",
      `**الرتبة:** ${newRole}\n` +
      `**الاسم السابق:** ${oldRole.name}\n` +
      `**الاسم الجديد:** ${newRole.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   LOG: CHANNEL CREATE
========================================================= */

client.on(
  "channelCreate",
  async channel => {

    if (!channel.guild) return;

    const executor =
      await getAuditExecutor(
        channel.guild,
        AuditLogEvent.ChannelCreate,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      "📁 إنشاء روم",
      `**الروم:** ${channel}\n` +
      `**الاسم:** ${channel.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   LOG: CHANNEL DELETE
========================================================= */

client.on(
  "channelDelete",
  async channel => {

    if (!channel.guild) return;

    const executor =
      await getAuditExecutor(
        channel.guild,
        AuditLogEvent.ChannelDelete,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      "🗑️ حذف روم",
      `**الروم:** ${channel.name}\n` +
      `**ID:** \`${channel.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: CHANNEL UPDATE
========================================================= */

client.on(
  "channelUpdate",
  async (
    oldChannel,
    newChannel
  ) => {

    if (!newChannel.guild) return;

    const executor =
      await getAuditExecutor(
        newChannel.guild,
        AuditLogEvent.ChannelUpdate,
        newChannel.id
      );

    let permissionChanged = false;

    try {

      permissionChanged =
        oldChannel.permissionOverwrites.cache
          .map(x => x.id)
          .join(",") !==
        newChannel.permissionOverwrites.cache
          .map(x => x.id)
          .join(",");

    } catch {}

    await sendLog(
      newChannel.guild,
      permissionChanged
        ? "channel_permissions"
        : "channel_update",
      permissionChanged
        ? "🔐 تحديث صلاحيات الرومات"
        : "📝 تحديث الرومات",
      `**الروم:** ${newChannel}\n` +
      `**الاسم السابق:** ${oldChannel.name}\n` +
      `**الاسم الجديد:** ${newChannel.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   LOG: BAN
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
      "member_ban",
      "🔨 حظر الأعضاء",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**الإداري:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: UNBAN
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
      "member_ban",
      "🔓 إزالة حظر الأعضاء",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**الإداري:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   LOG: EMOJI CREATE
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
      "emoji_update",
      "😀 إضافة إيموجي",
      `**الإيموجي:** ${emoji}\n` +
      `**الاسم:** ${emoji.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   LOG: EMOJI DELETE
========================================================= */

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
      "emoji_update",
      "🗑️ حذف إيموجي",
      `**الاسم:** ${emoji.name}\n` +
      `**ID:** \`${emoji.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: EMOJI UPDATE
========================================================= */

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
      "📝 تعديل إيموجي",
      `**السابق:** ${oldEmoji.name}\n` +
      `**الجديد:** ${newEmoji.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   LOG: STICKER CREATE
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
      "sticker_update",
      "🏷️ إضافة ستيكر",
      `**الستيكر:** ${sticker.name}\n` +
      `**ID:** \`${sticker.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x2ECC71
    );
  }
);

/* =========================================================
   LOG: STICKER DELETE
========================================================= */

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
      "sticker_update",
      "🗑️ حذف ستيكر",
      `**الستيكر:** ${sticker.name}\n` +
      `**ID:** \`${sticker.id}\`\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xE74C3C
    );
  }
);

/* =========================================================
   LOG: STICKER UPDATE
========================================================= */

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
      "📝 تعديل ستيكر",
      `**السابق:** ${oldSticker.name}\n` +
      `**الجديد:** ${newSticker.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0xF1C40F
    );
  }
);

/* =========================================================
   LOG: SERVER UPDATE
========================================================= */

client.on(
  "guildUpdate",
  async (
    oldGuild,
    newGuild
  ) => {

    const executor =
      await getAuditExecutor(
        newGuild,
        AuditLogEvent.GuildUpdate,
        newGuild.id
      );

    await sendLog(
      newGuild,
      "server_update",
      "⚙️ تحديث إعدادات السيرفر",
      `**السيرفر:** ${newGuild.name}\n` +
      `**بواسطة:** ${executor || "غير معروف"}`,
      0x3498DB
    );
  }
);

/* =========================================================
   ERROR
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

client.on(
  "warn",
  warning => {

    console.warn(
      "⚠️ Discord Warning:",
      warning
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
   DISCONNECT
========================================================= */

client.on(
  "shardDisconnect",
  async () => {

    lastDisconnectAt =
      new Date();

    console.log(
      `🔴 Disconnect: ${lastDisconnectAt.toISOString()}`
    );

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
   LOGIN
========================================================= */

console.log(
  "🚀 Starting Discord Bot..."
);

client.login(TOKEN);
