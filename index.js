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
  StringSelectMenuOptionBuilder,
  ChannelType
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const OWNER_ID = "1179433017064820747";

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
  member_join: {
    name: "إنضمام الأعضاء",
    emoji: "📥"
  },

  mute: {
    name: "سجل الميوت",
    emoji: "🔇"
  },

  channel_permissions: {
    name: "تحديث صلاحيات الرومات",
    emoji: "🔐"
  },

  channel_update: {
    name: "تحديث الرومات",
    emoji: "📝"
  },

  channel_create_delete: {
    name: "إنشاء وحذف الرومات",
    emoji: "📁"
  },

  member_leave: {
    name: "خروج الأعضاء",
    emoji: "📤"
  },

  member_kick: {
    name: "طرد الأعضاء",
    emoji: "👢"
  },

  ban: {
    name: "حظر الأعضاء",
    emoji: "🔨"
  },

  unban: {
    name: "إزالة حظر الأعضاء",
    emoji: "♻️"
  },

  voice: {
    name: "دخول/خروج/طرد صوتي",
    emoji: "🎙️"
  },

  voice_permissions: {
    name: "منع/سماح الإستماع والتحدث",
    emoji: "🎧"
  },

  guild_update: {
    name: "تحديث إعدادات السيرفر",
    emoji: "⚙️"
  },

  message_bulk_delete: {
    name: "حذف مجموعة رسائل",
    emoji: "🗑️"
  },

  member_move: {
    name: "تنقل/سحب الأعضاء",
    emoji: "↔️"
  },

  emoji: {
    name: "إضافة/تعديل/حذف إيموجي",
    emoji: "😀"
  },

  sticker: {
    name: "إضافة/تعديل/حذف ستيكر",
    emoji: "🏷️"
  },

  reaction: {
    name: "إضافة رياكشن",
    emoji: "❤️"
  },

  member_roles: {
    name: "تحديث رُتب الأعضاء",
    emoji: "👤"
  },

  message_delete: {
    name: "الرسائل المحذوفة",
    emoji: "❌"
  },

  role_create_delete: {
    name: "إنشاء وحذف الرُتب",
    emoji: "➕"
  },

  role_update: {
    name: "تحديث الرُتب",
    emoji: "✏️"
  },

  role_permissions: {
    name: "تحديث صلاحيات الرُتب",
    emoji: "🛡️"
  },

  timeout: {
    name: "إضافة/إزالة تايم أوت",
    emoji: "⏱️"
  }
};

const LOG_TYPE_KEYS = Object.keys(LOG_TYPES);

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
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      UNIQUE(guild_id, name)
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
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP
    )
  `);

  console.log("✅ Database جاهز");
}

/* =========================================================
   DEFAULT LOG SETTINGS
========================================================= */

function defaultLogSettings() {
  const settings = {};

  for (const key of LOG_TYPE_KEYS) {
    settings[key] = true;
  }

  return settings;
}

async function getLogConfig(guildId) {
  const result = await db.query(
    `
    SELECT enabled, settings
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
      (guild_id, enabled, settings)
      VALUES ($1, TRUE, $2::jsonb)
      ON CONFLICT (guild_id) DO NOTHING
      `,
      [guildId, JSON.stringify(settings)]
    );

    return {
      enabled: true,
      settings
    };
  }

  const row = result.rows[0];

  return {
    enabled: row.enabled,
    settings: {
      ...defaultLogSettings(),
      ...(row.settings || {})
    }
  };
}

async function isLogEnabled(guildId, type) {
  const config = await getLogConfig(guildId);

  return config.enabled && config.settings[type] !== false;
}

/* =========================================================
   LOG CHANNEL
========================================================= */

async function getLogChannel(guild) {
  try {
    const result = await db.query(
      `
      SELECT channel_id
      FROM log_channels
      WHERE guild_id = $1
      `,
      [guild.id]
    );

    if (!result.rows.length) return null;

    const channel = await guild.channels
      .fetch(result.rows[0].channel_id)
      .catch(() => null);

    return channel || null;
  } catch {
    return null;
  }
}

/* =========================================================
   SEND LOG
========================================================= */

async function sendLog(
  guild,
  type,
  title,
  description,
  color = 0x5865f2,
  force = false
) {
  try {
    if (!force) {
      const enabled = await isLogEnabled(guild.id, type);

      if (!enabled) return;
    }

    const channel = await getLogChannel(guild);

    if (!channel) return;

    const me = guild.members.me;

    if (
      me &&
      !channel
        .permissionsFor(me)
        ?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ])
    ) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description || "لا توجد تفاصيل")
      .setTimestamp()
      .setFooter({
        text: guild.name
      });

    await channel.send({
      embeds: [embed]
    });
  } catch (error) {
    console.error("LOG ERROR:", error.message);
  }
}

/* =========================================================
   AUDIT LOG HELPER
========================================================= */

async function getAuditExecutor(
  guild,
  action,
  targetId = null
) {
  try {
    const logs = await guild.fetchAuditLogs({
      type: action,
      limit: 10
    });

    const entry = logs.entries.find((x) => {
      if (targetId && x.target?.id !== targetId) {
        return false;
      }

      return Date.now() - x.createdTimestamp < 15000;
    });

    if (!entry) return null;

    return {
      user: entry.executor,
      reason: entry.reason
    };
  } catch {
    return null;
  }
}

/* =========================================================
   PERMISSION HELPER
========================================================= */

function isOwner(interaction) {
  return interaction.user.id === OWNER_ID;
}

function hasPermission(interaction, permission) {
  if (isOwner(interaction)) return true;

  return interaction.memberPermissions?.has(permission);
}

async function requirePermission(
  interaction,
  permission
) {
  if (isOwner(interaction)) return true;

  if (!interaction.memberPermissions?.has(permission)) {
    await interaction.reply({
      content: "❌ ما عندك صلاحية لاستخدام هذا الأمر.",
      ephemeral: true
    });

    return false;
  }

  return true;
}

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  /* BAN */
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
        .setDescription("سبب الحظر")
        .setRequired(false)
    ),

  /* UNBAN */
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إزالة حظر عضو")
    .addStringOption(o =>
      o
        .setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    ),

  /* KICK */
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
        .setDescription("سبب الطرد")
        .setRequired(false)
    ),

  /* TIMEOUT */
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء تايم أوت")
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
        .setRequired(false)
    ),

  /* UNTIMEOUT */
  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  /* WARN */
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

  /* WARNLIST */
  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض تحذيرات عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* CLEAR */
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("حذف مجموعة رسائل")
    .addIntegerOption(o =>
      o
        .setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  /* LOCK */
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  /* UNLOCK */
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  /* SLOWMODE */
  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تعديل السلو مود")
    .addIntegerOption(o =>
      o
        .setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  /* ROLE */
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة")
    .addSubcommand(s =>
      s
        .setName("add")
        .setDescription("إضافة رتبة")
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
    )
    .addSubcommand(s =>
      s
        .setName("remove")
        .setDescription("إزالة رتبة")
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
    ),

  /* NICKNAME */
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

  /* INFO */
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* SERVERINFO */
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  /* AVATAR */
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("عرض افتار عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* BANNER */
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("عرض بنر عضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* ROLES */
  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("عرض رتب السيرفر"),

  /* AUTOREPLY */
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

  /* LIST */
  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* SHORTCUT */
  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")
    .addSubcommand(s =>
      s
        .setName("set")
        .setDescription("إضافة اختصار")
        .addStringOption(o =>
          o
            .setName("name")
            .setDescription("اسم الاختصار")
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
            .setName("name")
            .setDescription("اسم الاختصار")
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s
        .setName("list")
        .setDescription("عرض الاختصارات")
    ),

  /* LOG */
  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إدارة نظام اللوق")
    .addSubcommand(s =>
      s
        .setName("setup")
        .setDescription("تحديد روم اللوق")
        .addChannelOption(o =>
          o
            .setName("channel")
            .setDescription("روم اللوق")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s
        .setName("status")
        .setDescription("عرض حالة اللوق")
    )
    .addSubcommand(s =>
      s
        .setName("enable")
        .setDescription("تشغيل اللوق")
    )
    .addSubcommand(s =>
      s
        .setName("disable")
        .setDescription("إيقاف اللوق")
    )
    .addSubcommand(s =>
      s
        .setName("edit")
        .setDescription("تحديد أنواع اللوق")
    ),

  /* LOGS TEST */
  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار روم اللوق"),

  /* BOT */
  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("معلومات البوت"),

  /* ME */
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("من أنا")
].map(c => c.toJSON());

/* =========================================================
   REGISTER COMMANDS
========================================================= */

async function registerCommands(guildId) {
  try {
    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        guildId
      ),
      {
        body: commands
      }
    );

    console.log(`✅ تم تسجيل الأوامر في ${guildId}`);
  } catch (error) {
    console.error(
      "COMMAND REGISTER ERROR:",
      error.message
    );
  }
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log(
    `✅ Logged in as ${client.user.tag}`
  );

  try {
    await setupDatabase();

    await db.query(
      `
      INSERT INTO bot_sessions (started_at)
      VALUES (CURRENT_TIMESTAMP)
      `
    );
  } catch (error) {
    console.error("Database startup error:", error);
  }

  for (const guild of client.guilds.cache.values()) {
    await registerCommands(guild.id);
  }

  client.user.setPresence({
    activities: [
      {
        name: `${client.guilds.cache.size} سيرفر`,
        type: 3
      }
    ],
    status: "online"
  });
});

/* =========================================================
   NEW GUILD
========================================================= */

client.on("guildCreate", async guild => {
  await registerCommands(guild.id);
});

/* =========================================================
   MESSAGE DELETE
========================================================= */

client.on("messageDelete", async message => {
  if (!message.guild) return;

  const content =
    message.content?.trim() ||
    "محتوى الرسالة غير متوفر";

  const author =
    message.author
      ? `<@${message.author.id}>`
      : "غير معروف";

  await sendLog(
    message.guild,
    "message_delete",
    "🗑️ رسالة محذوفة",
    [
      `👤 المرسل: ${author}`,
      `📍 الروم: <#${message.channelId}>`,
      `💬 المحتوى: ${content.slice(0, 1000)}`
    ].join("\n"),
    0xed4245
  );
});

/* =========================================================
   BULK MESSAGE DELETE
========================================================= */

client.on("messageDeleteBulk", async messages => {
  if (!messages.size) return;

  const guild = messages.first()?.guild;

  if (!guild) return;

  await sendLog(
    guild,
    "message_bulk_delete",
    "🗑️ حذف مجموعة رسائل",
    `تم حذف **${messages.size}** رسالة.`,
    0xed4245
  );
});

/* =========================================================
   MESSAGE UPDATE
========================================================= */

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!newMessage.guild) return;

  if (
    oldMessage.content === newMessage.content
  ) {
    return;
  }

  await sendLog(
    newMessage.guild,
    "message_delete",
    "✏️ تعديل رسالة",
    [
      `👤 العضو: ${
        newMessage.author
          ? `<@${newMessage.author.id}>`
          : "غير معروف"
      }`,
      `📍 الروم: <#${newMessage.channelId}>`,
      `قبل: ${
        oldMessage.content?.slice(0, 500) ||
        "غير متوفر"
      }`,
      `بعد: ${
        newMessage.content?.slice(0, 500) ||
        "غير متوفر"
      }`
    ].join("\n"),
    0xfee75c
  );
});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {
  await sendLog(
    member.guild,
    "member_join",
    "📥 إنضمام عضو",
    [
      `👤 العضو: <@${member.id}>`,
      `🆔 ID: \`${member.id}\``,
      `📅 إنشاء الحساب: <t:${Math.floor(
        member.user.createdTimestamp / 1000
      )}:F>`
    ].join("\n"),
    0x57f287
  );
});

/* =========================================================
   MEMBER LEAVE / KICK
========================================================= */

client.on("guildMemberRemove", async member => {
  const audit = await getAuditExecutor(
    member.guild,
    AuditLogEvent.MemberKick,
    member.id
  );

  if (audit) {
    await sendLog(
      member.guild,
      "member_kick",
      "👢 طرد عضو",
      [
        `👤 العضو: <@${member.id}>`,
        `🆔 ID: \`${member.id}\``,
        `👮 المنفذ: ${
          audit.user
            ? `<@${audit.user.id}>`
            : "غير معروف"
        }`,
        `📝 السبب: ${
          audit.reason || "بدون سبب"
        }`
      ].join("\n"),
      0xed4245
    );

    return;
  }

  await sendLog(
    member.guild,
    "member_leave",
    "📤 خروج عضو",
    [
      `👤 العضو: <@${member.id}>`,
      `🆔 ID: \`${member.id}\``
    ].join("\n"),
    0xed4245
  );
});

/* =========================================================
   MEMBER UPDATE
========================================================= */

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  /* TIMEOUT */
  const oldTimeout =
    oldMember.communicationDisabledUntilTimestamp;

  const newTimeout =
    newMember.communicationDisabledUntilTimestamp;

  if (!oldTimeout && newTimeout) {
    await sendLog(
      newMember.guild,
      "timeout",
      "⏱️ إضافة تايم أوت",
      [
        `👤 العضو: <@${newMember.id}>`,
        `⏰ ينتهي: <t:${Math.floor(
          newTimeout / 1000
        )}:F>`
      ].join("\n"),
      0xfee75c
    );
  }

  if (oldTimeout && !newTimeout) {
    await sendLog(
      newMember.guild,
      "timeout",
      "♻️ إزالة تايم أوت",
      `👤 العضو: <@${newMember.id}>`,
      0x57f287
    );
  }

  /* NICKNAME */
  if (oldMember.nickname !== newMember.nickname) {
    await sendLog(
      newMember.guild,
      "member_update",
      "✏️ تغيير اسم عضو",
      [
        `👤 العضو: <@${newMember.id}>`,
        `قبل: ${oldMember.nickname || "بدون اسم"}`,
        `بعد: ${newMember.nickname || "بدون اسم"}`
      ].join("\n"),
      0x5865f2
    );
  }

  /* ROLES */
  const oldRoles = new Set(
    oldMember.roles.cache.keys()
  );

  const newRoles = new Set(
    newMember.roles.cache.keys()
  );

  const addedRoles = [...newRoles].filter(
    id => !oldRoles.has(id)
  );

  const removedRoles = [...oldRoles].filter(
    id => !newRoles.has(id)
  );

  if (addedRoles.length || removedRoles.length) {
    let text = `👤 العضو: <@${newMember.id}>\n`;

    if (addedRoles.length) {
      text +=
        `➕ تمت إضافة: ` +
        addedRoles
          .map(id => `<@&${id}>`)
          .join(", ") +
        "\n";
    }

    if (removedRoles.length) {
      text +=
        `➖ تمت إزالة: ` +
        removedRoles
          .map(id => `<@&${id}>`)
          .join(", ");
    }

    await sendLog(
      newMember.guild,
      "member_roles",
      "👤 تحديث رُتب عضو",
      text,
      0x5865f2
    );
  }
});

/* =========================================================
   BAN
========================================================= */

client.on("guildBanAdd", async ban => {
  const audit = await getAuditExecutor(
    ban.guild,
    AuditLogEvent.MemberBanAdd,
    ban.user.id
  );

  await sendLog(
    ban.guild,
    "ban",
    "🔨 حظر عضو",
    [
      `👤 العضو: <@${ban.user.id}>`,
      `🆔 ID: \`${ban.user.id}\``,
      `👮 المنفذ: ${
        audit?.user
          ? `<@${audit.user.id}>`
          : "غير معروف"
      }`,
      `📝 السبب: ${
        audit?.reason || "بدون سبب"
      }`
    ].join("\n"),
    0xed4245
  );
});

/* =========================================================
   UNBAN
========================================================= */

client.on("guildBanRemove", async ban => {
  const audit = await getAuditExecutor(
    ban.guild,
    AuditLogEvent.MemberBanRemove,
    ban.user.id
  );

  await sendLog(
    ban.guild,
    "unban",
    "♻️ إزالة حظر عضو",
    [
      `👤 العضو: <@${ban.user.id}>`,
      `🆔 ID: \`${ban.user.id}\``,
      `👮 المنفذ: ${
        audit?.user
          ? `<@${audit.user.id}>`
          : "غير معروف"
      }`
    ].join("\n"),
    0x57f287
  );
});

/* =========================================================
   VOICE STATE
========================================================= */

client.on("voiceStateUpdate", async (oldState, newState) => {
  const member =
    newState.member ||
    oldState.member;

  if (!member) return;

  /* SERVER MUTE */
  if (oldState.serverMute !== newState.serverMute) {
    await sendLog(
      member.guild,
      "mute",
      newState.serverMute
        ? "🔇 تم عمل ميوت صوتي"
        : "🔊 تم إزالة الميوت الصوتي",
      [
        `👤 العضو: <@${member.id}>`,
        `🎙️ الروم: ${
          newState.channel
            ? `<#${newState.channel.id}>`
            : oldState.channel
              ? `<#${oldState.channel.id}>`
              : "غير معروف"
        }`
      ].join("\n"),
      newState.serverMute
        ? 0xed4245
        : 0x57f287
    );
  }

  /* SERVER DEAF */
  if (oldState.serverDeaf !== newState.serverDeaf) {
    await sendLog(
      member.guild,
      "voice_permissions",
      newState.serverDeaf
        ? "🔇 منع الإستماع"
        : "🔊 السماح بالإستماع",
      `👤 العضو: <@${member.id}>`,
      newState.serverDeaf
        ? 0xed4245
        : 0x57f287
    );
  }

  /* JOIN */
  if (!oldState.channel && newState.channel) {
    await sendLog(
      member.guild,
      "voice",
      "🎙️ دخول صوتي",
      [
        `👤 العضو: <@${member.id}>`,
        `📍 الروم: <#${newState.channel.id}>`
      ].join("\n"),
      0x57f287
    );

    return;
  }

  /* LEAVE */
  if (oldState.channel && !newState.channel) {
    await sendLog(
      member.guild,
      "voice",
      "📤 خروج صوتي",
      [
        `👤 العضو: <@${member.id}>`,
        `📍 الروم: <#${oldState.channel.id}>`
      ].join("\n"),
      0xed4245
    );

    return;
  }

  /* MOVE */
  if (
    oldState.channel &&
    newState.channel &&
    oldState.channel.id !== newState.channel.id
  ) {
    await sendLog(
      member.guild,
      "member_move",
      "↔️ تنقل صوتي",
      [
        `👤 العضو: <@${member.id}>`,
        `من: <#${oldState.channel.id}>`,
        `إلى: <#${newState.channel.id}>`
      ].join("\n"),
      0x5865f2
    );
  }
});

/* =========================================================
   CHANNEL CREATE
========================================================= */

client.on("channelCreate", async channel => {
  if (!channel.guild) return;

  await sendLog(
    channel.guild,
    "channel_create_delete",
    "📁 إنشاء روم",
    [
      `📌 الروم: <#${channel.id}>`,
      `📝 الاسم: \`${channel.name}\``,
      `🔖 النوع: \`${channel.type}\``
    ].join("\n"),
    0x57f287
  );
});

/* =========================================================
   CHANNEL DELETE
========================================================= */

client.on("channelDelete", async channel => {
  if (!channel.guild) return;

  await sendLog(
    channel.guild,
    "channel_create_delete",
    "🗑️ حذف روم",
    [
      `📝 الاسم: \`${channel.name}\``,
      `🆔 ID: \`${channel.id}\``
    ].join("\n"),
    0xed4245
  );
});

/* =========================================================
   CHANNEL UPDATE
========================================================= */

client.on("channelUpdate", async (oldChannel, newChannel) => {
  if (!newChannel.guild) return;

  let changed = [];

  if (oldChannel.name !== newChannel.name) {
    changed.push(
      `📝 الاسم: \`${oldChannel.name}\` → \`${newChannel.name}\``
    );
  }

  if (
    oldChannel.topic !== newChannel.topic
  ) {
    changed.push("📄 تم تحديث وصف الروم");
  }

  if (
    oldChannel.parentId !== newChannel.parentId
  ) {
    changed.push("📂 تم تغيير تصنيف الروم");
  }

  if (
    oldChannel.rateLimitPerUser !==
    newChannel.rateLimitPerUser
  ) {
    changed.push(
      `🐌 السلو مود: \`${oldChannel.rateLimitPerUser || 0}\` → \`${newChannel.rateLimitPerUser || 0}\``
    );
  }

  if (
    oldChannel.nsfw !== newChannel.nsfw
  ) {
    changed.push("🔞 تم تغيير إعداد NSFW");
  }

  const oldOverwrites =
    oldChannel.permissionOverwrites?.cache;

  const newOverwrites =
    newChannel.permissionOverwrites?.cache;

  if (
    oldOverwrites &&
    newOverwrites
  ) {
    const oldMap = new Map(
      oldOverwrites.map(x => [
        x.id,
        `${x.allow.bitfield}-${x.deny.bitfield}`
      ])
    );

    const newMap = new Map(
      newOverwrites.map(x => [
        x.id,
        `${x.allow.bitfield}-${x.deny.bitfield}`
      ])
    );

    let permissionsChanged = false;

    for (const [id, value] of newMap) {
      if (oldMap.get(id) !== value) {
        permissionsChanged = true;
        break;
      }
    }

    if (!permissionsChanged) {
      for (const id of oldMap.keys()) {
        if (!newMap.has(id)) {
          permissionsChanged = true;
          break;
        }
      }
    }

    if (permissionsChanged) {
      await sendLog(
        newChannel.guild,
        "channel_permissions",
        "🔐 تحديث صلاحيات روم",
        `📍 الروم: <#${newChannel.id}>\nتم تعديل صلاحيات التحدث/الإستماع أو الصلاحيات الخاصة بالروم.`,
        0xfee75c
      );
    }
  }

  if (changed.length) {
    await sendLog(
      newChannel.guild,
      "channel_update",
      "📝 تحديث روم",
      [
        `📍 الروم: <#${newChannel.id}>`,
        ...changed
      ].join("\n"),
      0x5865f2
    );
  }
});

/* =========================================================
   ROLE CREATE
========================================================= */

client.on("roleCreate", async role => {
  await sendLog(
    role.guild,
    "role_create_delete",
    "➕ إنشاء رتبة",
    [
      `🎭 الرتبة: <@&${role.id}>`,
      `📝 الاسم: \`${role.name}\``,
      `🆔 ID: \`${role.id}\``
    ].join("\n"),
    0x57f287
  );
});

/* =========================================================
   ROLE DELETE
========================================================= */

client.on("roleDelete", async role => {
  await sendLog(
    role.guild,
    "role_create_delete",
    "🗑️ حذف رتبة",
    [
      `📝 الاسم: \`${role.name}\``,
      `🆔 ID: \`${role.id}\``
    ].join("\n"),
    0xed4245
  );
});

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on("roleUpdate", async (oldRole, newRole) => {

  const permissionChanged =
    oldRole.permissions.bitfield !==
    newRole.permissions.bitfield;

  if (permissionChanged) {
    await sendLog(
      newRole.guild,
      "role_permissions",
      "🛡️ تحديث صلاحيات رتبة",
      [
        `🎭 الرتبة: <@&${newRole.id}>`,
        `📝 الاسم: \`${newRole.name}\``
      ].join("\n"),
      0xfee75c
    );
  }

  const changes = [];

  if (oldRole.name !== newRole.name) {
    changes.push(
      `الاسم: \`${oldRole.name}\` → \`${newRole.name}\``
    );
  }

  if (oldRole.color !== newRole.color) {
    changes.push("تم تغيير لون الرتبة");
  }

  if (oldRole.hoist !== newRole.hoist) {
    changes.push("تم تغيير ظهور الرتبة منفصلة");
  }

  if (
    oldRole.mentionable !==
    newRole.mentionable
  ) {
    changes.push("تم تغيير قابلية منشن الرتبة");
  }

  if (changes.length) {
    await sendLog(
      newRole.guild,
      "role_update",
      "✏️ تحديث رتبة",
      [
        `🎭 الرتبة: <@&${newRole.id}>`,
        ...changes
      ].join("\n"),
      0x5865f2
    );
  }
});

/* =========================================================
   EMOJI
========================================================= */

client.on("emojiCreate", async emoji => {
  await sendLog(
    emoji.guild,
    "emoji",
    "😀 إضافة إيموجي",
    [
      `😀 الاسم: \`${emoji.name}\``,
      `🆔 ID: \`${emoji.id}\``
    ].join("\n"),
    0x57f287
  );
});

client.on("emojiDelete", async emoji => {
  await sendLog(
    emoji.guild,
    "emoji",
    "🗑️ حذف إيموجي",
    [
      `😀 الاسم: \`${emoji.name}\``,
      `🆔 ID: \`${emoji.id}\``
    ].join("\n"),
    0xed4245
  );
});

client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
  await sendLog(
    newEmoji.guild,
    "emoji",
    "✏️ تحديث إيموجي",
    [
      `قبل: \`${oldEmoji.name}\``,
      `بعد: \`${newEmoji.name}\``,
      `🆔 ID: \`${newEmoji.id}\``
    ].join("\n"),
    0x5865f2
  );
});

/* =========================================================
   STICKERS
========================================================= */

client.on("stickerCreate", async sticker => {
  await sendLog(
    sticker.guild,
    "sticker",
    "🏷️ إضافة ستيكر",
    [
      `🏷️ الاسم: \`${sticker.name}\``,
      `🆔 ID: \`${sticker.id}\``
    ].join("\n"),
    0x57f287
  );
});

client.on("stickerDelete", async sticker => {
  await sendLog(
    sticker.guild,
    "sticker",
    "🗑️ حذف ستيكر",
    [
      `🏷️ الاسم: \`${sticker.name}\``,
      `🆔 ID: \`${sticker.id}\``
    ].join("\n"),
    0xed4245
  );
});

client.on("stickerUpdate", async (oldSticker, newSticker) => {
  await sendLog(
    newSticker.guild,
    "sticker",
    "✏️ تحديث ستيكر",
    [
      `قبل: \`${oldSticker.name}\``,
      `بعد: \`${newSticker.name}\``,
      `🆔 ID: \`${newSticker.id}\``
    ].join("\n"),
    0x5865f2
  );
});

/* =========================================================
   REACTION ADD
========================================================= */

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) {
      await reaction.fetch();
    }

    const guild = reaction.message.guild;

    if (!guild) return;

    await sendLog(
      guild,
      "reaction",
      "❤️ إضافة رياكشن",
      [
        `👤 العضو: <@${user.id}>`,
        `📍 الروم: <#${reaction.message.channelId}>`,
        `😀 الرياكشن: ${reaction.emoji}`,
        `🔗 الرسالة: [فتح الرسالة](${reaction.message.url})`
      ].join("\n"),
      0x5865f2
    );
  } catch (error) {
    console.error(
      "REACTION ERROR:",
      error.message
    );
  }
});

/* =========================================================
   GUILD UPDATE
========================================================= */

client.on("guildUpdate", async (oldGuild, newGuild) => {
  const changes = [];

  if (oldGuild.name !== newGuild.name) {
    changes.push(
      `📝 الاسم: \`${oldGuild.name}\` → \`${newGuild.name}\``
    );
  }

  if (oldGuild.icon !== newGuild.icon) {
    changes.push("🖼️ تم تغيير صورة السيرفر");
  }

  if (oldGuild.banner !== newGuild.banner) {
    changes.push("🎨 تم تغيير بنر السيرفر");
  }

  if (
    oldGuild.verificationLevel !==
    newGuild.verificationLevel
  ) {
    changes.push("🛡️ تم تغيير مستوى التحقق");
  }

  if (
    oldGuild.afkChannelId !==
    newGuild.afkChannelId
  ) {
    changes.push("💤 تم تغيير روم AFK");
  }

  if (
    oldGuild.afkTimeout !==
    newGuild.afkTimeout
  ) {
    changes.push("⏱️ تم تغيير مدة AFK");
  }

  if (changes.length) {
    await sendLog(
      newGuild,
      "guild_update",
      "⚙️ تحديث إعدادات السيرفر",
      changes.join("\n"),
      0x5865f2
    );
  }
});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {

  /* =======================================================
     SELECT MENU - LOG EDIT
  ======================================================= */

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "log_edit_select"
  ) {
    if (
      !isOwner(interaction) &&
      !interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {
      return interaction.reply({
        content: "❌ ما عندك صلاحية إدارة اللوق.",
        ephemeral: true
      });
    }

    try {
      const config = await getLogConfig(
        interaction.guildId
      );

      for (const type of interaction.values) {
        config.settings[type] =
          !config.settings[type];
      }

      await db.query(
        `
        UPDATE log_settings
        SET settings = $2::jsonb
        WHERE guild_id = $1
        `,
        [
          interaction.guildId,
          JSON.stringify(config.settings)
        ]
      );

      const changed = interaction.values
        .map(type => {
          const status =
            config.settings[type]
              ? "🟢 مفعّل"
              : "🔴 معطّل";

          return `${LOG_TYPES[type].emoji} ${LOG_TYPES[type].name} — ${status}`;
        })
        .join("\n");

      await interaction.update({
        content:
          `✅ تم تحديث إعدادات اللوق:\n\n${changed}`,
        components: []
      });
    } catch (error) {
      console.error(error);

      if (!interaction.replied) {
        await interaction.reply({
          content:
            "❌ حدث خطأ أثناء تحديث إعدادات اللوق.",
          ephemeral: true
        });
      }
    }

    return;
  }

  /* =======================================================
     SLASH COMMANDS
  ======================================================= */

  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {

    /* =====================================================
       BAN
    ===================================================== */

    if (interaction.commandName === "ban") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.BanMembers
        ))
      ) return;

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (
        member &&
        !isOwner(interaction) &&
        !member.bannable
      ) {
        return interaction.reply({
          content:
            "❌ لا أستطيع حظر هذا العضو.",
          ephemeral: true
        });
      }

      await interaction.guild.members.ban(
        user,
        {
          reason
        }
      );

      await interaction.reply({
        content:
          `🔨 تم حظر ${user}.`
      });

      return;
    }

    /* =====================================================
       UNBAN
    ===================================================== */

    if (interaction.commandName === "unban") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.BanMembers
        ))
      ) return;

      const id =
        interaction.options.getString("userid");

      await interaction.guild.members.unban(id);

      await interaction.reply({
        content:
          `♻️ تم إزالة حظر \`${id}\`.`
      });

      return;
    }

    /* =====================================================
       KICK
    ===================================================== */

    if (interaction.commandName === "kick") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.KickMembers
        ))
      ) return;

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content:
            "❌ العضو غير موجود في السيرفر.",
          ephemeral: true
        });
      }

      if (
        !isOwner(interaction) &&
        !member.kickable
      ) {
        return interaction.reply({
          content:
            "❌ لا أستطيع طرد هذا العضو.",
          ephemeral: true
        });
      }

      await member.kick(reason);

      await interaction.reply({
        content:
          `👢 تم طرد ${user}.`
      });

      return;
    }

    /* =====================================================
       TIMEOUT
    ===================================================== */

    if (interaction.commandName === "timeout") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ModerateMembers
        ))
      ) return;

      const user =
        interaction.options.getUser("member");

      const minutes =
        interaction.options.getInteger("minutes");

      const reason =
        interaction.options.getString("reason") ||
        "بدون سبب";

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });
      }

      await member.timeout(
        minutes * 60 * 1000,
        reason
      );

      await interaction.reply({
        content:
          `⏱️ تم إعطاء ${user} تايم أوت لمدة ${minutes} دقيقة.`
      });

      return;
    }

    /* =====================================================
       UNTIMEOUT
    ===================================================== */

    if (interaction.commandName === "untimeout") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ModerateMembers
        ))
      ) return;

      const user =
        interaction.options.getUser("member");

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });
      }

      await member.timeout(null);

      await interaction.reply({
        content:
          `♻️ تم إزالة التايم أوت من ${user}.`
      });

      return;
    }

    /* =====================================================
       WARN
    ===================================================== */

    if (interaction.commandName === "warn") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ModerateMembers
        ))
      ) return;

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
          `⚠️ تم تحذير ${user}\n📝 السبب: ${reason}`
      });

      return;
    }

    /* =====================================================
       WARNLIST
    ===================================================== */

    if (interaction.commandName === "warnlist") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ModerateMembers
        ))
      ) return;

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
          [
            interaction.guildId
          ]
        );
      }

      if (!result.rows.length) {
        return interaction.reply({
          content: "✅ لا توجد تحذيرات.",
          ephemeral: true
        });
      }

      const lines = result.rows
        .map((row, i) =>
          `**${i + 1}.** <@${row.user_id}> — ${row.reason || "بدون سبب"}\n` +
          `👮 <@${row.moderator_id}> • <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
        )
        .join("\n\n");

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("⚠️ قائمة التحذيرات")
        .setDescription(lines.slice(0, 4000));

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       CLEAR
    ===================================================== */

    if (interaction.commandName === "clear") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageMessages
        ))
      ) return;

      const amount =
        interaction.options.getInteger("amount");

      const deleted =
        await interaction.channel.bulkDelete(
          amount,
          true
        );

      await interaction.reply({
        content:
          `🗑️ تم حذف ${deleted.size} رسالة.`,
        ephemeral: true
      });

      await sendLog(
        interaction.guild,
        "message_bulk_delete",
        "🗑️ حذف مجموعة رسائل",
        [
          `👮 المنفذ: <@${interaction.user.id}>`,
          `📍 الروم: <#${interaction.channelId}>`,
          `🔢 العدد: ${deleted.size}`
        ].join("\n"),
        0xed4245
      );

      return;
    }

    /* =====================================================
       LOCK
    ===================================================== */

    if (interaction.commandName === "lock") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageChannels
        ))
      ) return;

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
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageChannels
        ))
      ) return;

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
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageChannels
        ))
      ) return;

      const seconds =
        interaction.options.getInteger("seconds");

      await interaction.channel.setRateLimitPerUser(
        seconds
      );

      await interaction.reply({
        content:
          `🐌 تم ضبط السلو مود على ${seconds} ثانية.`
      });

      return;
    }

    /* =====================================================
       ROLE
    ===================================================== */

    if (interaction.commandName === "role") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageRoles
        ))
      ) return;

      const sub =
        interaction.options.getSubcommand();

      const member =
        interaction.options.getMember("member");

      const role =
        interaction.options.getRole("role");

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });
      }

      if (sub === "add") {
        await member.roles.add(role);

        await interaction.reply({
          content:
            `✅ تمت إضافة ${role} إلى ${member}.`
        });
      }

      if (sub === "remove") {
        await member.roles.remove(role);

        await interaction.reply({
          content:
            `✅ تمت إزالة ${role} من ${member}.`
        });
      }

      return;
    }

    /* =====================================================
       NICKNAME
    ===================================================== */

    if (interaction.commandName === "nickname") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageNicknames
        ))
      ) return;

      const member =
        interaction.options.getMember("member");

      const name =
        interaction.options.getString("name");

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });
      }

      await member.setNickname(name);

      await interaction.reply({
        content:
          `✅ تم تغيير اسم ${member} إلى **${name}**.`
      });

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

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("👤 معلومات العضو")
        .setThumbnail(user.displayAvatarURL())
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
            name: "تاريخ الحساب",
            value:
              `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
            inline: false
          }
        );

      if (member) {
        embed.addFields({
          name: "دخل السيرفر",
          value:
            `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
          inline: false
        });
      }

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       SERVERINFO
    ===================================================== */

    if (interaction.commandName === "serverinfo") {
      const guild = interaction.guild;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🌐 ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          {
            name: "👥 الأعضاء",
            value: `${guild.memberCount}`,
            inline: true
          },
          {
            name: "💬 الرومات",
            value: `${guild.channels.cache.size}`,
            inline: true
          },
          {
            name: "🎭 الرتب",
            value: `${guild.roles.cache.size}`,
            inline: true
          },
          {
            name: "🆔 ID",
            value: `\`${guild.id}\``,
            inline: false
          }
        );

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       AVATAR
    ===================================================== */

    if (interaction.commandName === "avatar") {
      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🖼️ افتار ${user.username}`)
        .setImage(
          user.displayAvatarURL({
            size: 4096,
            extension: "png"
          })
        );

      await interaction.reply({
        embeds: [embed]
      });

      return;
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
          {
            force: true
          }
        );

      if (!fullUser.banner) {
        return interaction.reply({
          content:
            "❌ هذا العضو لا يملك بنر.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🎨 بنر ${fullUser.username}`)
        .setImage(
          fullUser.bannerURL({
            size: 4096
          })
        );

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       ROLES
    ===================================================== */

    if (interaction.commandName === "roles") {
      const roles =
        interaction.guild.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .sort(
            (a, b) => b.position - a.position
          );

      const text =
        roles
          .map(r => `${r} — \`${r.name}\``)
          .join("\n")
          .slice(0, 4000);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎭 رتب السيرفر")
        .setDescription(
          text || "لا توجد رتب."
        );

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       AUTOREPLY
    ===================================================== */

    if (interaction.commandName === "autoreply") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageGuild
        ))
      ) return;

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

        await interaction.reply({
          content:
            `✅ تم حفظ الرد التلقائي للكلمة **${trigger}**.`
        });
      }

      if (sub === "remove") {
        const trigger =
          interaction.options
            .getString("trigger")
            .toLowerCase();

        const result = await db.query(
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

        await interaction.reply({
          content:
            result.rowCount
              ? `🗑️ تم حذف **${trigger}**.`
              : "❌ الرد غير موجود."
        });
      }

      return;
    }

    /* =====================================================
       LIST
    ===================================================== */

    if (interaction.commandName === "list") {
      const result = await db.query(
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
            "❌ لا توجد ردود تلقائية."
        });
      }

      const text = result.rows
        .map(
          row =>
            `**${row.trigger}** → ${row.response}`
        )
        .join("\n")
        .slice(0, 4000);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("🤖 الردود التلقائية")
            .setDescription(text)
        ]
      });

      return;
    }

    /* =====================================================
       SHORTCUT
    ===================================================== */

    if (interaction.commandName === "shortcut") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageGuild
        ))
      ) return;

      const sub =
        interaction.options.getSubcommand();

      if (sub === "set") {
        const name =
          interaction.options
            .getString("name")
            .toLowerCase();

        const command =
          interaction.options
            .getString("command");

        await db.query(
          `
          INSERT INTO shortcuts
          (guild_id, name, command)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id, name)
          DO UPDATE SET command = EXCLUDED.command
          `,
          [
            interaction.guildId,
            name,
            command
          ]
        );

        await interaction.reply({
          content:
            `✅ تم حفظ الاختصار **${name}**.`
        });
      }

      if (sub === "remove") {
        const name =
          interaction.options
            .getString("name")
            .toLowerCase();

        const result = await db.query(
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

        await interaction.reply({
          content:
            result.rowCount
              ? `🗑️ تم حذف الاختصار **${name}**.`
              : "❌ الاختصار غير موجود."
        });
      }

      if (sub === "list") {
        const result = await db.query(
          `
          SELECT name, command
          FROM shortcuts
          WHERE guild_id = $1
          ORDER BY name
          `,
          [interaction.guildId]
        );

        if (!result.rows.length) {
          return interaction.reply({
            content:
              "❌ لا توجد اختصارات."
          });
        }

        const text = result.rows
          .map(
            row =>
              `**${row.name}** → \`${row.command}\``
          )
          .join("\n");

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865f2)
              .setTitle("⚡ الاختصارات")
              .setDescription(text.slice(0, 4000))
          ]
        });
      }

      return;
    }

    /* =====================================================
       LOG
    ===================================================== */

    if (interaction.commandName === "log") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageGuild
        ))
      ) return;

      const sub =
        interaction.options.getSubcommand();

      /* ---------------------------------------------------
         SETUP
      --------------------------------------------------- */

      if (sub === "setup") {
        const channel =
          interaction.options.getChannel("channel");

        if (!channel) {
          return interaction.reply({
            content:
              "❌ الروم غير موجود.",
            ephemeral: true
          });
        }

        const me =
          interaction.guild.members.me;

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
              "❌ البوت يحتاج صلاحيات View Channel و Send Messages و Embed Links في روم اللوق.",
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

        await getLogConfig(
          interaction.guildId
        );

        await interaction.reply({
          content:
            `✅ تم تحديد <#${channel.id}> كروم اللوق.`
        });

        await sendLog(
          interaction.guild,
          "guild_update",
          "✅ تم إعداد نظام اللوق",
          [
            `👮 بواسطة: <@${interaction.user.id}>`,
            `📍 روم اللوق: <#${channel.id}>`
          ].join("\n"),
          0x57f287,
          true
        );

        return;
      }

      /* ---------------------------------------------------
         STATUS
      --------------------------------------------------- */

      if (sub === "status") {
        const config =
          await getLogConfig(
            interaction.guildId
          );

        const channel =
          await getLogChannel(
            interaction.guild
          );

        const enabledCount =
          LOG_TYPE_KEYS.filter(
            key => config.settings[key]
          ).length;

        const disabledCount =
          LOG_TYPE_KEYS.length -
          enabledCount;

        const embed =
          new EmbedBuilder()
            .setColor(
              config.enabled
                ? 0x57f287
                : 0xed4245
            )
            .setTitle("📋 حالة نظام اللوق")
            .addFields(
              {
                name: "الحالة العامة",
                value:
                  config.enabled
                    ? "🟢 مفعّل"
                    : "🔴 معطّل",
                inline: true
              },
              {
                name: "روم اللوق",
                value:
                  channel
                    ? `<#${channel.id}>`
                    : "❌ غير محدد",
                inline: true
              },
              {
                name: "الأنواع المفعلة",
                value:
                  `${enabledCount}`,
                inline: true
              },
              {
                name: "الأنواع المعطلة",
                value:
                  `${disabledCount}`,
                inline: true
              }
            );

        let list = "";

        for (const key of LOG_TYPE_KEYS) {
          list +=
            `${config.settings[key] ? "🟢" : "🔴"} ${LOG_TYPES[key].emoji} ${LOG_TYPES[key].name}\n`;
        }

        embed.setDescription(
          list.slice(0, 4000)
        );

        await interaction.reply({
          embeds: [embed],
          ephemeral: true
        });

        return;
      }

      /* ---------------------------------------------------
         ENABLE
      --------------------------------------------------- */

      if (sub === "enable") {
        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, enabled, settings)
          VALUES ($1, TRUE, $2::jsonb)
          ON CONFLICT (guild_id)
          DO UPDATE SET enabled = TRUE
          `,
          [
            interaction.guildId,
            JSON.stringify(
              defaultLogSettings()
            )
          ]
        );

        await interaction.reply({
          content:
            "🟢 تم تشغيل نظام اللوق بالكامل."
        });

        return;
      }

      /* ---------------------------------------------------
         DISABLE
      --------------------------------------------------- */

      if (sub === "disable") {
        await db.query(
          `
          INSERT INTO log_settings
          (guild_id, enabled, settings)
          VALUES ($1, FALSE, $2::jsonb)
          ON CONFLICT (guild_id)
          DO UPDATE SET enabled = FALSE
          `,
          [
            interaction.guildId,
            JSON.stringify(
              defaultLogSettings()
            )
          ]
        );

        await interaction.reply({
          content:
            "🔴 تم إيقاف نظام اللوق بالكامل."
        });

        return;
      }

      /* ---------------------------------------------------
         EDIT
      --------------------------------------------------- */

      if (sub === "edit") {
        const config =
          await getLogConfig(
            interaction.guildId
          );

        const menu =
          new StringSelectMenuBuilder()
            .setCustomId(
              "log_edit_select"
            )
            .setPlaceholder(
              "اختر نوع أو أكثر لتغيير حالته"
            )
            .setMinValues(1)
            .setMaxValues(
              LOG_TYPE_KEYS.length
            );

        for (const key of LOG_TYPE_KEYS) {
          menu.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(
                LOG_TYPES[key].name
              )
              .setValue(key)
              .setEmoji(
                LOG_TYPES[key].emoji
              )
              .setDescription(
                config.settings[key]
                  ? "🟢 مفعّل — اضغط لتعطيله"
                  : "🔴 معطّل — اضغط لتفعيله"
              )
          );
        }

        const row =
          new ActionRowBuilder()
            .addComponents(menu);

        await interaction.reply({
          content:
            "⚙️ اختر أنواع اللوق التي تريد تغيير حالتها.\n\n🟢 = مفعّل\n🔴 = معطّل\n\n**الاختيار سيقوم بتبديل الحالة مباشرة.**",
          components: [row],
          ephemeral: true
        });

        return;
      }
    }

    /* =====================================================
       LOGS TEST
    ===================================================== */

    if (interaction.commandName === "logs") {
      if (
        !(await requirePermission(
          interaction,
          PermissionFlagsBits.ManageGuild
        ))
      ) return;

      const channel =
        await getLogChannel(
          interaction.guild
        );

      if (!channel) {
        return interaction.reply({
          content:
            "❌ لم يتم تحديد روم اللوق. استخدم `/log setup` أولاً.",
          ephemeral: true
        });
      }

      await interaction.reply({
        content:
          `✅ تم إرسال اختبار إلى <#${channel.id}>.`,
        ephemeral: true
      });

      await sendLog(
        interaction.guild,
        "guild_update",
        "🧪 اختبار نظام اللوق",
        [
          `👤 بواسطة: <@${interaction.user.id}>`,
          "✅ نظام اللوق يعمل بشكل صحيح."
        ].join("\n"),
        0x5865f2,
        true
      );

      return;
    }

    /* =====================================================
       BOT
    ===================================================== */

    if (interaction.commandName === "bot") {
      const session =
        await db.query(
          `
          SELECT started_at
          FROM bot_sessions
          ORDER BY id DESC
          LIMIT 1
          `
        );

      const startedAt =
        session.rows[0]?.started_at;

      const uptime =
        client.uptime || 0;

      const seconds =
        Math.floor(uptime / 1000);

      const days =
        Math.floor(seconds / 86400);

      const hours =
        Math.floor(
          (seconds % 86400) / 3600
        );

      const minutes =
        Math.floor(
          (seconds % 3600) / 60
        );

      const secs =
        seconds % 60;

      const embed =
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("🤖 معلومات البوت")
          .setThumbnail(
            client.user.displayAvatarURL()
          )
          .addFields(
            {
              name: "📡 الحالة",
              value: "🟢 متصل",
              inline: true
            },
            {
              name: "🏠 السيرفرات",
              value:
                `${client.guilds.cache.size}`,
              inline: true
            },
            {
              name: "⏱️ مدة التشغيل",
              value:
                `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${secs} ثانية`,
              inline: false
            },
            {
              name: "🚀 آخر تشغيل",
              value:
                startedAt
                  ? `<t:${Math.floor(new Date(startedAt).getTime() / 1000)}:F>`
                  : "غير معروف",
              inline: false
            }
          );

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

    /* =====================================================
       ME
    ===================================================== */

    if (interaction.commandName === "me") {
      const embed =
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("🤖 مين أنا؟")
          .setDescription(
            "أنا بوت خاص لـ **.v5d.**\n\n" +
            "ولدي سيرفر **Mr Nova**.\n\n" +
            "أعمل على الإدارة، الحماية، اللوق، والتحكم بالسيرفر."
          );

      await interaction.reply({
        embeds: [embed]
      });

      return;
    }

  } catch (error) {
    console.error(
      "INTERACTION ERROR:",
      error
    );

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        });
      }
    } catch {}
  }
});

/* =========================================================
   AUTOREPLY MESSAGE HANDLER
========================================================= */

client.on("messageCreate", async message => {
  if (
    !message.guild ||
    message.author.bot
  ) return;

  try {
    const content =
      message.content
        .trim()
        .toLowerCase();

    if (!content) return;

    const result =
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

    if (result.rows.length) {
      await message.reply(
        result.rows[0].response
      );
    }

    /* SHORTCUTS */

    if (content.startsWith("!")) {
      const name =
        content.slice(1).trim();

      const shortcut =
        await db.query(
          `
          SELECT command
          FROM shortcuts
          WHERE guild_id = $1
          AND name = $2
          LIMIT 1
          `,
          [
            message.guild.id,
            name
          ]
        );

      if (shortcut.rows.length) {
        await message.reply({
          content:
            shortcut.rows[0].command
        });
      }
    }
  } catch (error) {
    console.error(
      "MESSAGE HANDLER ERROR:",
      error.message
    );
  }
});

/* =========================================================
   ERRORS
========================================================= */

client.on("error", error => {
  console.error(
    "DISCORD CLIENT ERROR:",
    error
  );
});

process.on("unhandledRejection", error => {
  console.error(
    "UNHANDLED REJECTION:",
    error
  );
});

process.on("uncaughtException", error => {
  console.error(
    "UNCAUGHT EXCEPTION:",
    error
  );
});

/* =========================================================
   LOGIN
========================================================= */

(async () => {
  try {
    await setupDatabase();
    await client.login(TOKEN);
  } catch (error) {
    console.error(
      "❌ فشل تشغيل البوت:",
      error
    );
    process.exit(1);
  }
})();
