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
  StringSelectMenuBuilder
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 👑 Owner / Developer
const OWNER_ID = "1179433017064820747";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID غير موجود في Railway Variables");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود في Railway Variables");
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
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =========================================================
   BOT STATUS
========================================================= */

let botStartedAt = null;
let lastReadyAt = null;
let lastDisconnectAt = null;

/* =========================================================
   OWNER CHECK
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

/* =========================================================
   PERMISSION CHECK
========================================================= */

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
    interaction.memberPermissions?.has(required) ?? false
  );
}

/* =========================================================
   LOG TYPES
========================================================= */

const LOG_TYPES = {

  member_join: {
    label: "إنضمام الأعضاء",
    emoji: "🟢"
  },

  member_leave: {
    label: "خروج الأعضاء",
    emoji: "🔴"
  },

  member_kick: {
    label: "طرد الأعضاء",
    emoji: "👢"
  },

  member_ban: {
    label: "حظر/إزالة حظر الأعضاء",
    emoji: "🔨"
  },

  member_timeout: {
    label: "إضافة/إزالة تايم أوت",
    emoji: "⏱️"
  },

  member_mute: {
    label: "سجل الميوت",
    emoji: "🔇"
  },

  voice: {
    label: "دخول/خروج/طرد صوتي",
    emoji: "🎙️"
  },

  voice_permissions: {
    label: "منع/سماح الإستماع/التحدث",
    emoji: "🔊"
  },

  server_update: {
    label: "تحديث إعدادات السيرفر",
    emoji: "⚙️"
  },

  bulk_delete: {
    label: "حذف مجموعة رسائل",
    emoji: "🧹"
  },

  member_move: {
    label: "تنقل/سحب الأعضاء",
    emoji: "🔄"
  },

  emoji_update: {
    label: "إضافة/تعديل/حذف إيموجي",
    emoji: "😀"
  },

  sticker_update: {
    label: "إضافة/تعديل/حذف ستيكر",
    emoji: "🏷️"
  },

  reaction_add: {
    label: "إضافة رياكشن",
    emoji: "❤️"
  },

  member_roles: {
    label: "تحديث رُتب الأعضاء",
    emoji: "🎭"
  },

  message_delete: {
    label: "الرسائل المحذوفة",
    emoji: "🗑️"
  },

  role_create_delete: {
    label: "إنشاء وحذف الرُتب",
    emoji: "➕"
  },

  role_update: {
    label: "تحديث الرُتب",
    emoji: "✏️"
  },

  role_permissions: {
    label: "تحديث صلاحيات الرُتب",
    emoji: "🔐"
  },

  channel_update: {
    label: "تحديث الرومات",
    emoji: "🏠"
  },

  channel_create_delete: {
    label: "إنشاء وحذف الرومات",
    emoji: "📁"
  },

  channel_permissions: {
    label: "تحديث صلاحيات الرومات",
    emoji: "🔒"
  },

  message_update: {
    label: "تعديل الرسائل",
    emoji: "📝"
  },

  nickname_update: {
    label: "تحديث أسماء الأعضاء",
    emoji: "✏️"
  }

};

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
      enabled_types TEXT[] NOT NULL DEFAULT '{}'
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
   UPTIME
========================================================= */

function formatUptime(ms) {

  if (!ms || ms < 0) {
    return "غير متوفر";
  }

  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  return `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${seconds} ثانية`;
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
   GET LOG SETTINGS
========================================================= */

async function getLogSettings(guildId) {

  const result = await db.query(
    `
    SELECT enabled_types
    FROM log_settings
    WHERE guild_id = $1
    `,
    [guildId]
  );

  if (!result.rows.length) {

    return Object.keys(LOG_TYPES);

  }

  return result.rows[0].enabled_types || [];
}

/* =========================================================
   CHECK LOG ENABLED
========================================================= */

async function isLogEnabled(guildId, type) {

  const settings =
    await getLogSettings(guildId);

  return settings.includes(type);
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

      console.log(
        `⚠️ لم يتم تحديد روم اللوق في: ${guild.name}`
      );

      return;
    }

    const embed =
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
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
      error
    );

  }
}

/* =========================================================
   AUDIT LOG HELPER
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

        if (
          Date.now() - entry.createdTimestamp >
          10000
        ) {
          return false;
        }

        if (
          targetId &&
          entry.target?.id &&
          entry.target.id !== targetId
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
   SLASH COMMANDS
========================================================= */

const commands = [

  /* =====================================================
     BAN
  ===================================================== */

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("إعدام / حظر عضو")
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

  /* =====================================================
     UNBAN
  ===================================================== */

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o
        .setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    ),

  /* =====================================================
     KICK
  ===================================================== */

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

  /* =====================================================
     TIMEOUT
  ===================================================== */

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
        .setDescription("المدة بالدقائق")
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

  /* =====================================================
     UNTIMEOUT
  ===================================================== */

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  /* =====================================================
     WARN
  ===================================================== */

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("إعطاء تحذير")
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

  /* =====================================================
     WARNLIST
  ===================================================== */

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو - اختياري")
        .setRequired(false)
    ),

  /* =====================================================
     CLEAR
  ===================================================== */

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(o =>
      o
        .setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  /* =====================================================
     LOCK
  ===================================================== */

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  /* =====================================================
     UNLOCK
  ===================================================== */

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  /* =====================================================
     SLOWMODE
  ===================================================== */

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

  /* =====================================================
     ROLE
  ===================================================== */

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

  /* =====================================================
     NICKNAME
  ===================================================== */

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

  /* =====================================================
     INFO
  ===================================================== */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =====================================================
     SERVERINFO
  ===================================================== */

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  /* =====================================================
     AVATAR
  ===================================================== */

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =====================================================
     BANNER
  ===================================================== */

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =====================================================
     ROLES
  ===================================================== */

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =====================================================
     AUTOREPLY
  ===================================================== */

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
    ),

  /* =====================================================
     LIST
  ===================================================== */

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* =====================================================
     SHORTCUT
  ===================================================== */

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
            .setDescription("مثال: قفل")
            .setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("command")
            .setDescription("مثال: lock")
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

  /* =====================================================
     LOG SETUP
  ===================================================== */

  new SlashCommandBuilder()
    .setName("logsetup")
    .setDescription("تحديد روم اللوق")
    .addChannelOption(o =>
      o
        .setName("channel")
        .setDescription("روم اللوق")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  /* =====================================================
     LOG EDIT
  ===================================================== */

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إدارة نظام اللوق")
    .addSubcommand(s =>
      s
        .setName("edit")
        .setDescription("اختيار اللوقات التي تريدها")
    ),

  /* =====================================================
     LOG TEST
  ===================================================== */

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار نظام اللوق"),

  /* =====================================================
     BOT
  ===================================================== */

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("معلومات وحالة البوت"),

  /* =====================================================
     ME
  ===================================================== */

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت")

].map(command => command.toJSON());

/* =========================================================
   LOG EDIT MENU
========================================================= */

function createLogMenus(enabled) {

  const entries =
    Object.entries(LOG_TYPES);

  const first =
    entries.slice(0, 12);

  const second =
    entries.slice(12, 24);

  const third =
    entries.slice(24);

  const menus = [];

  function makeMenu(
    list,
    number
  ) {

    if (!list.length) {
      return;
    }

    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          `log_edit_${number}`
        )
        .setPlaceholder(
          "اختر اللوقات التي تريد تفعيلها..."
        )
        .setMinValues(0)
        .setMaxValues(list.length)
        .addOptions(
          list.map(
            ([key, data]) => ({
              label: data.label,
              value: key,
              emoji: data.emoji,
              default:
                enabled.includes(key)
            })
          )
        );

    menus.push(
      new ActionRowBuilder()
        .addComponents(menu)
    );

  }

  makeMenu(first, 1);
  makeMenu(second, 2);
  makeMenu(third, 3);

  return menus;

}

/* =========================================================
   LOG SETTINGS TEXT
========================================================= */

function formatLogSettings(enabled) {

  const entries =
    Object.entries(LOG_TYPES);

  const active =
    entries.filter(
      ([key]) =>
        enabled.includes(key)
    );

  if (!active.length) {
    return "❌ لا يوجد أي لوق مفعّل حالياً.";
  }

  return active
    .map(
      ([key, data]) =>
        `${data.emoji} **${data.label}**`
    )
    .join("\n");

}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {

  botStartedAt = Date.now();
  lastReadyAt = new Date();

  console.log("====================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🟢 البوت Online");
  console.log(`👑 Owner ID: ${OWNER_ID}`);
  console.log(`🏠 السيرفرات: ${client.guilds.cache.size}`);
  console.log(`📋 الأوامر: ${commands.length}`);
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

    try {

      await rest.put(
        Routes.applicationCommands(
          CLIENT_ID
        ),
        {
          body: []
        }
      );

      console.log(
        "🧹 تم حذف Global Commands القديمة"
      );

    } catch (error) {

      console.log(
        "⚠️ لم يتم حذف Global Commands:",
        error.message
      );

    }

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
          `❌ فشل تسجيل الأوامر في ${guild.name}:`,
          error.message
        );

      }

    }

    console.log(
      "🚀 البوت جاهز بالكامل"
    );

  } catch (error) {

    console.error(
      "❌ خطأ READY:",
      error
    );

  }

});

/* =========================================================
   DISCONNECT
========================================================= */

client.on(
  "shardDisconnect",
  async () => {

    lastDisconnectAt =
      new Date();

    console.log(
      `🔴 انقطع البوت: ${lastDisconnectAt.toISOString()}`
    );

    try {

      await db.query(`
        UPDATE bot_sessions
        SET disconnected_at = NOW()
        WHERE disconnected_at IS NULL
      `);

    } catch (error) {

      console.error(
        "❌ خطأ حفظ الانفصال:",
        error
      );

    }

  }
);

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
        `🆕 ${guild.name}: تم تسجيل ${commands.length} أمر`
      );

    } catch (error) {

      console.error(
        "❌ فشل تسجيل أوامر السيرفر الجديد:",
        error
      );

    }

  }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    try {

      /* ===================================================
         LOG SELECT MENUS
      =================================================== */

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith("log_edit_")
      ) {

        if (!interaction.guild) {
          return;
        }

        if (!isOwner(interaction)) {

          const allowed =
            interaction.memberPermissions?.has(
              PermissionFlagsBits.ManageGuild
            );

          if (!allowed) {

            return interaction.reply({
              content:
                "❌ ما عندك صلاحية تعديل إعدادات اللوق.",
              ephemeral: true
            });

          }

        }

        const current =
          await getLogSettings(
            interaction.guildId
          );

        const selected =
          interaction.values;

        const menuNumber =
          interaction.customId
            .replace("log_edit_", "");

        const entries =
          Object.entries(LOG_TYPES);

        let start = 0;

        if (menuNumber === "2") {
          start = 12;
        }

        if (menuNumber === "3") {
          start = 24;
        }

        const menuKeys =
          entries
            .slice(
              start,
              start +
                (
                  menuNumber === "3"
                    ? 100
                    : 12
                )
            )
            .map(
              ([key]) => key
            );

        const newSettings =
          current.filter(
            key =>
              !menuKeys.includes(key)
          );

        for (
          const key
          of selected
        ) {

          if (
            !newSettings.includes(key)
          ) {

            newSettings.push(key);

          }

        }

        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, enabled_types)
          VALUES ($1, $2)

          ON CONFLICT (guild_id)
          DO UPDATE SET
            enabled_types =
              EXCLUDED.enabled_types
          `,
          [
            interaction.guildId,
            newSettings
          ]
        );

        const menus =
          createLogMenus(
            newSettings
          );

        await interaction.update({
          content:
            "📋 **إعدادات اللوق**\n\n" +
            "اختر اللوقات التي تريد أن يسجلها البوت.\n" +
            "أي لوق غير محدد لن يتم إرساله.\n\n" +
            `**المفعّل حالياً:**\n${formatLogSettings(
              newSettings
            )}`,
          components: menus
        });

        return;
      }

      /* ===================================================
         CHAT INPUT
      =================================================== */

      if (!interaction.isChatInputCommand()) {
        return;
      }

      /* ===================================================
         PERMISSION CHECK
      =================================================== */

      if (!checkCommandPermission(interaction)) {

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
        interaction.commandName === "log"
      ) {

        const sub =
          interaction.options.getSubcommand();

        if (sub === "edit") {

          const enabled =
            await getLogSettings(
              interaction.guildId
            );

          const menus =
            createLogMenus(
              enabled
            );

          return interaction.reply({
            content:
              "📋 **تعديل اللوق**\n\n" +
              "حدد الأشياء التي تريد من البوت تسجيلها.\n" +
              "يمكنك اختيار أكثر من نوع.\n\n" +
              `**المفعّل حالياً:**\n${formatLogSettings(
                enabled
              )}`,
            components: menus,
            ephemeral: true
          });

        }

      }

      /* ===================================================
         BOT
      =================================================== */

      if (
        interaction.commandName === "bot"
      ) {

        const online =
          client.isReady();

        let lastSession = null;

        try {

          const result =
            await db.query(`
              SELECT
                started_at,
                disconnected_at
              FROM bot_sessions
              ORDER BY id DESC
              LIMIT 2
            `);

          if (
            result.rows.length > 1
          ) {

            lastSession =
              result.rows[1];

          }

        } catch {}

        const embed =
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
                name: "مدة الاتصال الحالية",
                value:
                  online && botStartedAt
                    ? formatUptime(
                        Date.now() -
                        botStartedAt
                      )
                    : "غير متصل",
                inline: false
              },

              {
                name: "آخر مرة أصبح Online",
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
                name: "آخر مرة انقطع فيها",
                value:
                  lastDisconnectAt
                    ? `<t:${Math.floor(
                        lastDisconnectAt.getTime() /
                        1000
                      )}:F>`
                    : lastSession?.disconnected_at
                      ? `<t:${Math.floor(
                          new Date(
                            lastSession.disconnected_at
                          ).getTime() /
                          1000
                        )}:F>`
                      : "لا توجد بيانات",
                inline: false
              },

              {
                name: "الأوامر",
                value:
                  `${commands.length}`,
                inline: true
              },

              {
                name: "Owner / Developer",
                value:
                  `<@${OWNER_ID}>`,
                inline: true
              }

            )
            .setFooter({
              text: ".v5d."
            })
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
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

      /* ===================================================
         LOG SETUP
      =================================================== */

      if (
        interaction.commandName === "logsetup"
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
            channel_id =
              EXCLUDED.channel_id
          `,
          [
            interaction.guildId,
            channel.id
          ]
        );

        await interaction.reply({
          content:
            `✅ تم تحديد ${channel} كروم اللوق.`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          "server_update",
          "📋 Log Setup",
          `تم تحديد هذا الروم كروم اللوق بواسطة ${interaction.user}`,
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
              "❌ لم يتم تحديد روم اللوق.\nاستخدم `/logsetup` أولاً.",
            ephemeral: true
          });

        }

        const embed =
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("🧪 اختبار نظام اللوق")
            .setDescription(
              "✅ هذا اختبار لنظام اللوق.\n\n" +
              `**بواسطة:** ${interaction.user}\n` +
              `**السيرفر:** ${interaction.guild.name}\n` +
              `**الروم:** ${channel}`
            )
            .setFooter({
              text: ".v5d. • Logs Test"
            })
            .setTimestamp();

        await channel.send({
          embeds: [embed]
        });

        return interaction.reply({
          content:
            `✅ تم إرسال رسالة الاختبار إلى ${channel}.`,
          ephemeral: true
        });

      }

      /* ===================================================
         BAN
      =================================================== */

      if (
        interaction.commandName === "ban"
      ) {

        const user =
          interaction.options.getUser("member");

        const reason =
          interaction.options.getString("reason");

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

        if (!member.bannable) {

          return interaction.reply({
            content:
              "❌ البوت لا يستطيع حظر هذا العضو. تأكد من صلاحية Ban Members وترتيب الرتب.",
            ephemeral: true
          });

        }

        await member.ban({
          reason
        });

        await interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle("🔨 تم الحظر")
              .setDescription(
                `**العضو:** ${user}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**السبب:** ${reason}`
              )
              .setThumbnail(
                user.displayAvatarURL({
                  size: 256
                })
              )
              .setTimestamp()

          ]
        });

        await sendLog(
          interaction.guild,
          "member_ban",
          "🔨 Ban",
          `**العضو:** ${user}\n` +
          `**الإداري:** ${interaction.user}\n` +
          `**السبب:** ${reason}`,
          0xE74C3C
        );

        return;
      }

      /* ===================================================
         UNBAN
      =================================================== */

      if (
        interaction.commandName === "unban"
      ) {

        const id =
          interaction.options.getString("userid");

        try {

          await interaction.guild.members.unban(
            id
          );

        } catch {

          return interaction.reply({
            content:
              "❌ لم أستطع فك الحظر. تأكد من ID.",
            ephemeral: true
          });

        }

        await interaction.reply(
          `🔓 تم فك الحظر عن <@${id}>.`
        );

        await sendLog(
          interaction.guild,
          "member_ban",
          "🔓 Unban",
          `**ID:** \`${id}\`\n` +
          `**بواسطة:** ${interaction.user}`,
          0x2ECC71
        );

        return;
      }

      /* ===================================================
         KICK
      =================================================== */

      if (
        interaction.commandName === "kick"
      ) {

        const user =
          interaction.options.getUser("member");

        const reason =
          interaction.options.getString("reason");

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

        await sendLog(
          interaction.guild,
          "member_kick",
          "👢 Kick",
          `**العضو:** ${user}\n` +
          `**بواسطة:** ${interaction.user}\n` +
          `**السبب:** ${reason}`,
          0xE67E22
        );

        return;
      }

      /* ===================================================
         TIMEOUT
      =================================================== */

      if (
        interaction.commandName === "timeout"
      ) {

        const user =
          interaction.options.getUser("member");

        const minutes =
          interaction.options.getInteger("minutes");

        const reason =
          interaction.options.getString("reason");

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
              "❌ لا أستطيع إعطاء Timeout لهذا العضو.",
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

        await sendLog(
          interaction.guild,
          "member_timeout",
          "⏳ Timeout",
          `**العضو:** ${user}\n` +
          `**بواسطة:** ${interaction.user}\n` +
          `**المدة:** ${minutes} دقيقة\n` +
          `**السبب:** ${reason}`,
          0x9B59B6
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
          interaction.options.getUser("member");

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

        await sendLog(
          interaction.guild,
          "member_timeout",
          "✅ Untimeout",
          `**العضو:** ${user}\n` +
          `**بواسطة:** ${interaction.user}`,
          0x2ECC71
        );

        return;
      }

      /* ===================================================
         WARN
      =================================================== */

      if (
        interaction.commandName === "warn"
      ) {

        const user =
          interaction.options.getUser("member");

        const reason =
          interaction.options.getString("reason");

        await db.query(
          `
          INSERT INTO warns
          (
            guild_id,
            user_id,
            moderator_id,
            reason
          )
          VALUES ($1, $2, $3, $4)
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
            WHERE guild_id = $1
            AND user_id = $2
            `,
            [
              interaction.guildId,
              user.id
            ]
          );

        const total =
          count.rows[0].count;

        await interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("⚠️ تحذير")
              .setDescription(
                `**العضو:** ${user}\n` +
                `**السبب:** ${reason}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**إجمالي التحذيرات:** ${total}`
              )
              .setThumbnail(
                user.displayAvatarURL({
                  size: 256
                })
              )
              .setTimestamp()

          ]
        });

        await sendLog(
          interaction.guild,
          "member_mute",
          "⚠️ Warn",
          `**العضو:** ${user}\n` +
          `**بواسطة:** ${interaction.user}\n` +
          `**السبب:** ${reason}\n` +
          `**الإجمالي:** ${total}`,
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
          interaction.options.getUser("member");

        let result;

        if (user) {

          result =
            await db.query(
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

          result =
            await db.query(
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

        }

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
          interaction.options.getInteger("amount");

        const deleted =
          await interaction.channel.bulkDelete(
            amount,
            true
          );

        await interaction.reply({
          content:
            `🧹 تم مسح **${deleted.size}** رسالة.`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          "bulk_delete",
          "🧹 حذف رسائل",
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

        await interaction.channel
          .permissionOverwrites
          .edit(
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
            ? "🔒 Lock"
            : "🔓 Unlock",
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
          interaction.options.getInteger("seconds");

        await interaction.channel
          .setRateLimitPerUser(seconds);

        await interaction.reply(
          seconds === 0
            ? "✅ تم إلغاء Slowmode."
            : `🐌 تم تفعيل Slowmode لمدة **${seconds} ثانية**.`
        );

        await sendLog(
          interaction.guild,
          "channel_update",
          "🐌 Slowmode",
          `**الروم:** ${interaction.channel}\n` +
          `**المدة:** ${seconds} ثانية\n` +
          `**بواسطة:** ${interaction.user}`,
          0x9B59B6
        );

        return;
      }

      /* ===================================================
         ROLE
      =================================================== */

      if (
        interaction.commandName === "role"
      ) {

        const user =
          interaction.options.getUser("member");

        const role =
          interaction.options.getRole("role");

        const action =
          interaction.options.getString("action");

        const member =
          await interaction.guild.members
            .fetch(user.id);

        if (
          role.id ===
          interaction.guild.id
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكن استخدام رتبة @everyone.",
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

          await interaction.reply(
            `✅ تم إعطاء ${user} رتبة ${role}.`
          );

        } else {

          await member.roles.remove(role);

          await interaction.reply(
            `✅ تم إزالة رتبة ${role} من ${user}.`
          );

        }

        await sendLog(
          interaction.guild,
          "member_roles",
          "🎭 تغيير رتبة",
          `**العضو:** ${user}\n` +
          `**الرتبة:** ${role}\n` +
          `**الإجراء:** ${
            action === "add"
              ? "إضافة"
              : "إزالة"
          }\n` +
          `**بواسطة:** ${interaction.user}`,
          0x9B59B6
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
          interaction.options.getUser("member");

        const name =
          interaction.options.getString("name");

        const member =
          await interaction.guild.members
            .fetch(user.id);

        const oldName =
          member.nickname ||
          member.user.username;

        await member.setNickname(name);

        await interaction.reply(
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
        );

        await sendLog(
          interaction.guild,
          "nickname_update",
          "✏️ تغيير الاسم",
          `**العضو:** ${user}\n` +
          `**الاسم السابق:** ${oldName}\n` +
          `**الاسم الجديد:** ${name}\n` +
          `**بواسطة:** ${interaction.user}`,
          0x3498DB
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
          interaction.options.getUser("member") ||
          interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        const embed =
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
                    : "غير معروف",
                inline: true
              }

            )
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });

      }

      /* ===================================================
         SERVERINFO
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
                    `\`${guild.id}\``,
                  inline: false
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
          interaction.options.getUser("member") ||
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

      /* ===================================================
         BANNER
      =================================================== */

      if (
        interaction.commandName === "banner"
      ) {

        const user =
          interaction.options.getUser("member") ||
          interaction.user;

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
          interaction.options.getUser("member") ||
          interaction.user;

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
            `✅ تم إضافة الرد التلقائي:\n**${trigger}** → ${response}`
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
              ? `🗑️ تم حذف الرد التلقائي **${trigger}**.`
              : `❌ الرد **${trigger}** غير موجود.`
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

        const text =
          result.rows
            .map(
              r =>
                `**${r.trigger}** → ${r.response}`
            )
            .join("\n");

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                "🤖 الردود التلقائية"
              )
              .setDescription(text)

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
          interaction.options
            .getSubcommand();

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
              ? `🗑️ تم حذف الاختصار **${shortcut}**.`
              : `❌ الاختصار **${shortcut}** غير موجود.`
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

          const text =
            result.rows
              .map(
                r =>
                  `**${r.shortcut}** → \`/${r.command}\``
              )
              .join("\n");

          return interaction.reply({

            embeds: [

              new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(
                  "🔗 الاختصارات"
                )
                .setDescription(text)

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
          `🔗 الاختصار **${text}** مرتبط بالأمر \`/${shortcut.rows[0].command}\``
        );

      }

    } catch (error) {

      console.error(
        "❌ Message Handler Error:",
        error
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
      `**الرسالة:** ${
        message.content ||
        "غير متوفرة"
      }\n` +
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

    if (
      !newMessage.guild ||
      newMessage.author?.bot
    ) {
      return;
    }

    const oldContent =
      oldMessage.content ||
      "غير متوفر";

    const newContent =
      newMessage.content ||
      "غير متوفر";

    if (
      oldContent === newContent
    ) {
      return;
    }

    await sendLog(
      newMessage.guild,
      "message_update",
      "✏️ تعديل رسالة",
      `**العضو:** ${newMessage.author || "غير معروف"}\n` +
      `**الروم:** ${newMessage.channel}\n\n` +
      `**قبل:**\n${oldContent}\n\n` +
      `**بعد:**\n${newContent}`,
      0xF1C40F
    );

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
      "🟢 دخول عضو",
      `**العضو:** ${member.user}\n` +
      `**الاسم:** ${member.user.username}\n` +
      `**ID:** \`${member.id}\``,
      0x2ECC71
    );

  }
);

/* =========================================================
   LOG: MEMBER LEAVE / KICK
========================================================= */

client.on(
  "guildMemberRemove",
  async member => {

    const executor =
      await getAuditExecutor(
        member.guild,
        20,
        member.id
      );

    if (
      executor &&
      executor.id !== member.id
    ) {

      await sendLog(
        member.guild,
        "member_kick",
        "👢 طرد عضو",
        `**العضو:** ${member.user || `<@${member.id}>`}\n` +
        `**بواسطة:** ${executor}\n` +
        `**ID:** \`${member.id}\``,
        0xE67E22
      );

      return;
    }

    await sendLog(
      member.guild,
      "member_leave",
      "🔴 خروج عضو",
      `**العضو:** ${member.user || `<@${member.id}>`}\n` +
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

    /* ================================================
       ROLES
    ================================================= */

    const oldRoles =
      oldMember.roles.cache.map(
        r => r.id
      );

    const newRoles =
      newMember.roles.cache.map(
        r => r.id
      );

    const added =
      newMember.roles.cache.filter(
        r =>
          !oldRoles.includes(r.id)
      );

    const removed =
      oldMember.roles.cache.filter(
        r =>
          !newRoles.includes(r.id)
      );

    if (added.size) {

      for (
        const role
        of added.values()
      ) {

        await sendLog(
          newMember.guild,
          "member_roles",
          "🎭 إضافة رتبة",
          `**العضو:** ${newMember.user}\n` +
          `**الرتبة:** ${role}`,
          0x2ECC71
        );

      }

    }

    if (removed.size) {

      for (
        const role
        of removed.values()
      ) {

        await sendLog(
          newMember.guild,
          "member_roles",
          "🎭 إزالة رتبة",
          `**العضو:** ${newMember.user}\n` +
          `**الرتبة:** ${role}`,
          0xE74C3C
        );

      }

    }

    /* ================================================
       NICKNAME
    ================================================= */

    if (
      oldMember.nickname !==
      newMember.nickname
    ) {

      await sendLog(
        newMember.guild,
        "nickname_update",
        "✏️ تغيير Nickname",
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

    /* ================================================
       TIMEOUT / MUTE
    ================================================= */

    const oldTimeout =
      oldMember.communicationDisabledUntilTimestamp;

    const newTimeout =
      newMember.communicationDisabledUntilTimestamp;

    if (
      oldTimeout !== newTimeout
    ) {

      if (newTimeout) {

        await sendLog(
          newMember.guild,
          "member_timeout",
          "⏱️ إضافة تايم أوت",
          `**العضو:** ${newMember.user}\n` +
          `**ينتهي:** <t:${Math.floor(
            newTimeout / 1000
          )}:F>`,
          0x9B59B6
        );

      } else {

        await sendLog(
          newMember.guild,
          "member_timeout",
          "✅ إزالة تايم أوت",
          `**العضو:** ${newMember.user}`,
          0x2ECC71
        );

      }

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
        30,
        role.id
      );

    await sendLog(
      role.guild,
      "role_create_delete",
      "🎭 إنشاء رتبة",
      `**الرتبة:** ${role}\n` +
      `**ID:** \`${role.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        32,
        role.id
      );

    await sendLog(
      role.guild,
      "role_create_delete",
      "🗑️ حذف رتبة",
      `**الرتبة:** ${role.name}\n` +
      `**ID:** \`${role.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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

    const nameChanged =
      oldRole.name !==
      newRole.name;

    const colorChanged =
      oldRole.color !==
      newRole.color;

    const permissionChanged =
      oldRole.permissions.bitfield !==
      newRole.permissions.bitfield;

    if (
      !nameChanged &&
      !colorChanged &&
      !permissionChanged
    ) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newRole.guild,
        31,
        newRole.id
      );

    if (permissionChanged) {

      await sendLog(
        newRole.guild,
        "role_permissions",
        "🔐 تحديث صلاحيات رتبة",
        `**الرتبة:** ${newRole}\n` +
        `**بواسطة:** ${
          executor || "غير معروف"
        }`,
        0x9B59B6
      );

    }

    if (
      nameChanged ||
      colorChanged
    ) {

      await sendLog(
        newRole.guild,
        "role_update",
        "✏️ تحديث رتبة",
        `**الرتبة:** ${newRole}\n` +
        `**الاسم السابق:** ${oldRole.name}\n` +
        `**الاسم الجديد:** ${newRole.name}\n` +
        `**بواسطة:** ${
          executor || "غير معروف"
        }`,
        0xF1C40F
      );

    }

  }
);

/* =========================================================
   LOG: CHANNEL CREATE
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
        10,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      "📁 إنشاء روم",
      `**الروم:** ${channel}\n` +
      `**الاسم:** ${channel.name}\n` +
      `**ID:** \`${channel.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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

    if (!channel.guild) {
      return;
    }

    const executor =
      await getAuditExecutor(
        channel.guild,
        12,
        channel.id
      );

    await sendLog(
      channel.guild,
      "channel_create_delete",
      "🗑️ حذف روم",
      `**الروم:** ${channel.name}\n` +
      `**ID:** \`${channel.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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

    if (!newChannel.guild) {
      return;
    }

    const nameChanged =
      oldChannel.name !==
      newChannel.name;

    const topicChanged =
      oldChannel.topic !==
      newChannel.topic;

    const parentChanged =
      oldChannel.parentId !==
      newChannel.parentId;

    const slowmodeChanged =
      oldChannel.rateLimitPerUser !==
      newChannel.rateLimitPerUser;

    const permissionsChanged =
      oldChannel.permissionOverwrites.cache.size !==
      newChannel.permissionOverwrites.cache.size ||
      oldChannel.permissionOverwrites.cache.some(
        (oldOverwrite) => {

          const current =
            newChannel.permissionOverwrites.cache.get(
              oldOverwrite.id
            );

          if (!current) {
            return true;
          }

          return (
            current.allow.bitfield !==
              oldOverwrite.allow.bitfield ||
            current.deny.bitfield !==
              oldOverwrite.deny.bitfield
          );

        }
      );

    const executor =
      await getAuditExecutor(
        newChannel.guild,
        11,
        newChannel.id
      );

    if (permissionsChanged) {

      await sendLog(
        newChannel.guild,
        "channel_permissions",
        "🔐 تحديث صلاحيات الروم",
        `**الروم:** ${newChannel}\n` +
        `**بواسطة:** ${
          executor || "غير معروف"
        }`,
        0x9B59B6
      );

    }

    if (
      nameChanged ||
      topicChanged ||
      parentChanged ||
      slowmodeChanged
    ) {

      await sendLog(
        newChannel.guild,
        "channel_update",
        "🏠 تحديث روم",
        `**الروم:** ${newChannel}\n` +
        `**الاسم السابق:** ${oldChannel.name}\n` +
        `**الاسم الجديد:** ${newChannel.name}\n` +
        `**بواسطة:** ${
          executor || "غير معروف"
        }`,
        0xF1C40F
      );

    }

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

    const changes = [];

    if (
      oldGuild.name !==
      newGuild.name
    ) {
      changes.push(
        `**الاسم:** ${oldGuild.name} → ${newGuild.name}`
      );
    }

    if (
      oldGuild.iconURL() !==
      newGuild.iconURL()
    ) {
      changes.push(
        "**الأيقونة:** تم تحديثها"
      );
    }

    if (
      oldGuild.bannerURL() !==
      newGuild.bannerURL()
    ) {
      changes.push(
        "**البنر:** تم تحديثه"
      );
    }

    if (
      oldGuild.description !==
      newGuild.description
    ) {
      changes.push(
        "**الوصف:** تم تحديثه"
      );
    }

    if (!changes.length) {
      return;
    }

    const executor =
      await getAuditExecutor(
        newGuild,
        1
      );

    await sendLog(
      newGuild,
      "server_update",
      "⚙️ تحديث إعدادات السيرفر",
      `${changes.join("\n")}\n\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
      0x3498DB
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
        22,
        ban.user.id
      );

    await sendLog(
      ban.guild,
      "member_ban",
      "🔨 حظر عضو",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        23,
        ban.user.id
      );

    await sendLog(
      ban.guild,
      "member_ban",
      "🔓 إزالة حظر",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
      0x2ECC71
    );

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

    if (!member) {
      return;
    }

    /* ================================================
       JOIN VOICE
    ================================================= */

    if (
      !oldState.channelId &&
      newState.channelId
    ) {

      await sendLog(
        member.guild,
        "voice",
        "🎙️ دخول صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${newState.channel}\n`,
        0x2ECC71
      );

      return;
    }

    /* ================================================
       LEAVE VOICE
    ================================================= */

    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      await sendLog(
        member.guild,
        "voice",
        "🎙️ خروج صوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${oldState.channel}`,
        0xE74C3C
      );

      return;
    }

    /* ================================================
       MOVE VOICE
    ================================================= */

    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
      newState.channelId
    ) {

      await sendLog(
        member.guild,
        "member_move",
        "🔄 تنقل صوتي",
        `**العضو:** ${member.user}\n` +
        `**من:** ${oldState.channel}\n` +
        `**إلى:** ${newState.channel}`,
        0x3498DB
      );

    }

    /* ================================================
       SERVER MUTE
    ================================================= */

    if (
      oldState.serverMute !==
      newState.serverMute
    ) {

      await sendLog(
        member.guild,
        "member_mute",
        newState.serverMute
          ? "🔇 ميوت صوتي"
          : "🔊 إزالة الميوت الصوتي",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${newState.channel || oldState.channel}`,
        newState.serverMute
          ? 0xE74C3C
          : 0x2ECC71
      );

    }

    /* ================================================
       SERVER DEAFEN
    ================================================= */

    if (
      oldState.serverDeaf !==
      newState.serverDeaf
    ) {

      await sendLog(
        member.guild,
        "voice_permissions",
        newState.serverDeaf
          ? "🔇 منع الاستماع"
          : "🔊 السماح بالاستماع",
        `**العضو:** ${member.user}\n` +
        `**الروم:** ${newState.channel || oldState.channel}`,
        newState.serverDeaf
          ? 0xE74C3C
          : 0x2ECC71
      );

    }

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
        60,
        emoji.id
      );

    await sendLog(
      emoji.guild,
      "emoji_update",
      "😀 إضافة إيموجي",
      `**الإيموجي:** ${emoji}\n` +
      `**الاسم:** ${emoji.name}\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        61,
        emoji.id
      );

    await sendLog(
      emoji.guild,
      "emoji_update",
      "🗑️ حذف إيموجي",
      `**الاسم:** ${emoji.name}\n` +
      `**ID:** \`${emoji.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        62,
        newEmoji.id
      );

    await sendLog(
      newEmoji.guild,
      "emoji_update",
      "✏️ تعديل إيموجي",
      `**قبل:** ${oldEmoji.name}\n` +
      `**بعد:** ${newEmoji.name}\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        90,
        sticker.id
      );

    await sendLog(
      sticker.guild,
      "sticker_update",
      "🏷️ إضافة ستيكر",
      `**الستيكر:** ${sticker.name}\n` +
      `**ID:** \`${sticker.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        91,
        sticker.id
      );

    await sendLog(
      sticker.guild,
      "sticker_update",
      "🗑️ حذف ستيكر",
      `**الستيكر:** ${sticker.name}\n` +
      `**ID:** \`${sticker.id}\`\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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
        92,
        newSticker.id
      );

    await sendLog(
      newSticker.guild,
      "sticker_update",
      "✏️ تعديل ستيكر",
      `**قبل:** ${oldSticker.name}\n` +
      `**بعد:** ${newSticker.name}\n` +
      `**بواسطة:** ${
        executor || "غير معروف"
      }`,
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

    if (user.bot) {
      return;
    }

    if (
      !reaction.message.guild
    ) {
      return;
    }

    await sendLog(
      reaction.message.guild,
      "reaction_add",
      "❤️ إضافة رياكشن",
      `**العضو:** ${user}\n` +
      `**الرياكشن:** ${reaction.emoji}\n` +
      `**الروم:** ${reaction.message.channel}\n` +
      `**الرسالة:** [${reaction.message.id}]`,
      0xE91E63
    );

  }
);

/* =========================================================
   LOG: MEMBER MOVE / KICK VOICE
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

    if (
      oldState.channelId &&
      !newState.channelId
    ) {

      const executor =
        await getAuditExecutor(
          member.guild,
          26,
          member.id
        );

      if (
        executor &&
        executor.id !== member.id
      ) {

        await sendLog(
          member.guild,
          "member_move",
          "👢 طرد من الروم الصوتي",
          `**العضو:** ${member.user}\n` +
          `**الروم:** ${oldState.channel}\n` +
          `**بواسطة:** ${executor}`,
          0xE67E22
        );

      }

    }

    if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !==
      newState.channelId
    ) {

      const executor =
        await getAuditExecutor(
          member.guild,
          26,
          member.id
        );

      if (
        executor &&
        executor.id !== member.id
      ) {

        await sendLog(
          member.guild,
          "member_move",
          "🔄 سحب عضو صوتي",
          `**العضو:** ${member.user}\n` +
          `**من:** ${oldState.channel}\n` +
          `**إلى:** ${newState.channel}\n` +
          `**بواسطة:** ${executor}`,
          0x3498DB
        );

      }

    }

  }
);

/* =========================================================
   ERROR HANDLING
========================================================= */

client.on(
  "error",
  error => {

    console.error(
      "❌ Discord Client Error:",
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
