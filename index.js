/* =========================================================
   DISCORD ADMIN BOT - FULL VERSION
   discord.js v14 + PostgreSQL
   Owner / Developer:
   1179433017064820747
========================================================= */

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
   DATABASE SETUP + MIGRATION
========================================================= */

async function setupDatabase() {
  console.log("🔄 فحص قاعدة البيانات...");

  /* WARNS */
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

  /* AUTOREPLIES */
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

  /* SHORTCUTS */
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

  /* IMPORTANT:
     إصلاح أي جدول قديم */
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

  /* IMPORTANT:
     إضافة الأعمدة الناقصة تلقائياً */
  await db.query(`
    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);

  await db.query(`
    ALTER TABLE log_settings
    ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  /* BOT SESSIONS */
  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `);

  /* إضافة جلسة جديدة */
  await db.query(`
    INSERT INTO bot_sessions (started_at)
    VALUES (NOW())
  `);

  console.log("✅ قاعدة البيانات جاهزة");
}

/* =========================================================
   LOG DATABASE HELPERS
========================================================= */

async function ensureLogSettings(guildId) {
  await db.query(
    `
    INSERT INTO log_settings (guild_id, enabled, settings)
    VALUES ($1, TRUE, $2::jsonb)
    ON CONFLICT (guild_id)
    DO NOTHING
    `,
    [guildId, JSON.stringify(defaultLogSettings())]
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

  /* إضافة أي نوع جديد إذا كان ناقصًا */
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

  if (!data.enabled) return false;

  if (!Object.prototype.hasOwnProperty.call(data.settings, type)) {
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

    const enabled = await isLogEnabled(guild.id, type);

    if (!enabled) return;

    const result = await db.query(
      `
      SELECT channel_id
      FROM log_channels
      WHERE guild_id = $1
      `,
      [guild.id]
    );

    if (!result.rows[0]?.channel_id) return;

    const channel = await guild.channels
      .fetch(result.rows[0].channel_id)
      .catch(() => null);

    if (!channel) return;

    if (!channel.isTextBased()) return;

    await channel.send({
      embeds: [embed]
    });

  } catch (error) {
    console.error("❌ خطأ إرسال اللوق:", error.message);
  }
}

/* =========================================================
   EMBED HELPERS
========================================================= */

function baseEmbed(title) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x5865f2)
    .setTimestamp();
}

function userText(user) {
  if (!user) return "غير معروف";

  return `${user} \`${user.id}\``;
}

/* =========================================================
   AUDIT LOG HELPER
========================================================= */

async function getAuditExecutor(guild, type, targetId = null) {
  try {
    const logs = await guild.fetchAuditLogs({
      type,
      limit: 5
    });

    const entry = logs.entries.find(e => {
      if (!targetId) return true;

      return e.target?.id === targetId;
    });

    return entry?.executor || null;
  } catch {
    return null;
  }
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
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  /* UNBAN */
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إزالة حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  /* KICK */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  /* TIMEOUT */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  /* UNTIMEOUT */
  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  /* WARN */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  /* WARNLIST */
  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض تحذيرات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  /* CLEAR */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  /* LOCK */
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /* UNLOCK */
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /* SLOWMODE */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /* ROLE */
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
        .setDescription("العملية")
        .setRequired(true)
        .addChoices(
          { name: "إضافة", value: "add" },
          { name: "إزالة", value: "remove" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  /* NICKNAME */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  /* INFO */
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
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
    .setDescription("عرض صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* BANNER */
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("عرض بانر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* ROLES */
  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("عرض رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* AUTOREPLY */
  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")
    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رد تلقائي")
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
        .setDescription("حذف رد تلقائي")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /* LIST */
  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* SHORTCUT */
  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")
    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إنشاء اختصار")
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
        .setDescription("عرض الاختصارات")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /* LOG */
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /* LOGS */
  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /* BOT */
  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("معلومات البوت"),

  /* ME */
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("من أنا؟")
];

/* =========================================================
   REGISTER COMMANDS
========================================================= */

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log("🔄 تسجيل أوامر البوت...");

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    {
      body: commands.map(command => command.toJSON())
    }
  );

  console.log("✅ تم تسجيل الأوامر");
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {
  console.log("=================================");
  console.log(`✅ البوت يعمل: ${client.user.tag}`);
  console.log(`🆔 ID: ${client.user.id}`);
  console.log(`🏠 السيرفرات: ${client.guilds.cache.size}`);
  console.log("=================================");

  client.user.setPresence({
    activities: [
      {
        name: `/help | إدارة السيرفر`,
        type: 3
      }
    ],
    status: "online"
  });
});

/* =========================================================
   INTERACTION HANDLER
========================================================= */

client.on("interactionCreate", async interaction => {

  try {

    /* =====================================================
       BUTTON / SELECT MENU
    ===================================================== */

    if (interaction.isStringSelectMenu()) {

      if (!interaction.customId.startsWith("log_edit_")) {
        return;
      }

      if (!interaction.guild) return;

      if (
        interaction.user.id !== OWNER_ID &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: "❌ تحتاج صلاحية إدارة السيرفر.",
          ephemeral: true
        });
      }

      const type = interaction.values[0];

      if (!LOG_TYPES[type]) {
        return interaction.reply({
          content: "❌ نوع اللوق غير معروف.",
          ephemeral: true
        });
      }

      const current = await getLogSettings(interaction.guildId);

      current.settings[type] = !current.settings[type];

      await db.query(
        `
        UPDATE log_settings
        SET settings = $1::jsonb
        WHERE guild_id = $2
        `,
        [
          JSON.stringify(current.settings),
          interaction.guildId
        ]
      );

      const status = current.settings[type]
        ? "🟢 مفعّل"
        : "🔴 متوقف";

      return interaction.update({
        content:
          `✅ تم تحديث **${LOG_TYPES[type]}**\n` +
          `الحالة الآن: **${status}**`,
        components: []
      });
    }

    /* =====================================================
       SLASH COMMANDS
    ===================================================== */

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ هذا الأمر يعمل داخل السيرفر فقط.",
        ephemeral: true
      });
    }

    const isOwner = interaction.user.id === OWNER_ID;

    /* =====================================================
       BAN
    ===================================================== */

    if (interaction.commandName === "ban") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية حظر الأعضاء.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("member");
      const reason =
        interaction.options.getString("reason") || "بدون سبب";

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (member && !member.bannable && !isOwner) {
        return interaction.reply({
          content: "❌ لا أستطيع حظر هذا العضو.",
          ephemeral: true
        });
      }

      await interaction.guild.members.ban(user.id, {
        reason
      });

      await interaction.reply({
        content: `🔨 تم حظر ${user}.\n**السبب:** ${reason}`
      });

      const embed = baseEmbed("🔨 حظر عضو")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "المشرف", value: userText(interaction.user) },
          { name: "السبب", value: reason }
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية إزالة الحظر.",
          ephemeral: true
        });
      }

      const id = interaction.options.getString("userid");

      await interaction.guild.members.unban(id);

      await interaction.reply({
        content: `✅ تم إزالة الحظر عن \`${id}\`.`
      });

      const embed = baseEmbed("🔓 إزالة حظر")
        .addFields(
          { name: "العضو", value: `\`${id}\`` },
          { name: "المشرف", value: userText(interaction.user) }
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية طرد الأعضاء.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("member");
      const reason =
        interaction.options.getString("reason") || "بدون سبب";

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود في السيرفر.",
          ephemeral: true
        });
      }

      await member.kick(reason);

      await interaction.reply({
        content: `👢 تم طرد ${user}.\n**السبب:** ${reason}`
      });

      const embed = baseEmbed("👢 طرد عضو")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "المشرف", value: userText(interaction.user) },
          { name: "السبب", value: reason }
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية التايم أوت.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("member");
      const minutes = interaction.options.getInteger("minutes");
      const reason =
        interaction.options.getString("reason") || "بدون سبب";

      const member = await interaction.guild.members
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
          `🔇 تم إعطاء ${user} تايم أوت لمدة **${minutes} دقيقة**.\n` +
          `**السبب:** ${reason}`
      });

      const embed = baseEmbed("🔇 إضافة تايم أوت")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "المدة", value: `${minutes} دقيقة` },
          { name: "المشرف", value: userText(interaction.user) },
          { name: "السبب", value: reason }
        );

      await sendLog(
        interaction.guild,
        "timeout",
        embed
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية إزالة التايم أوت.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("member");

      const member = await interaction.guild.members
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
        content: `🔊 تم إزالة التايم أوت عن ${user}.`
      });

      const embed = baseEmbed("🔊 إزالة تايم أوت")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "المشرف", value: userText(interaction.user) }
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية التحذير.",
          ephemeral: true
        });
      }

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

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
          `⚠️ تم تحذير ${user}.\n` +
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية عرض التحذيرات.",
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

      const lines = result.rows.map((row, i) => {
        return (
          `**${i + 1}.** <@${row.user_id}>\n` +
          `السبب: ${row.reason || "بدون سبب"}\n` +
          `المشرف: <@${row.moderator_id}>\n` +
          `التاريخ: <t:${Math.floor(new Date(row.created_at).getTime() / 1000)}:R>`
        );
      });

      return interaction.reply({
        embeds: [
          baseEmbed("⚠️ سجل التحذيرات")
            .setDescription(lines.join("\n\n"))
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية حذف الرسائل.",
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
        content: `🧹 تم حذف **${messages.size}** رسالة.`,
        ephemeral: true
      });

      const embed = baseEmbed("🧹 حذف مجموعة رسائل")
        .addFields(
          {
            name: "عدد الرسائل",
            value: `${messages.size}`
          },
          {
            name: "الروم",
            value: `${interaction.channel}`
          },
          {
            name: "المشرف",
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
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
            : `🐌 تم تفعيل السلو مود: **${seconds} ثانية**.`
      });

      return;
    }

    /* =====================================================
       ROLE
    ===================================================== */

    if (interaction.commandName === "role") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية إدارة الرتب.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const role =
        interaction.options.getRole("role");

      const action =
        interaction.options.getString("action");

      const member =
        await interaction.guild.members.fetch(user.id);

      if (action === "add") {
        await member.roles.add(role);
      } else {
        await member.roles.remove(role);
      }

      await interaction.reply({
        content:
          action === "add"
            ? `✅ تمت إضافة ${role} إلى ${user}.`
            : `✅ تمت إزالة ${role} من ${user}.`
      });

      const embed = baseEmbed("🎭 تحديث رتب عضو")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "الرتبة", value: `${role}` },
          {
            name: "العملية",
            value: action === "add" ? "إضافة" : "إزالة"
          },
          { name: "المشرف", value: userText(interaction.user) }
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageNicknames)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية تغيير الأسماء.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser("member");

      const name =
        interaction.options.getString("name");

      const member =
        await interaction.guild.members.fetch(user.id);

      const oldName =
        member.nickname || member.user.username;

      await member.setNickname(name);

      await interaction.reply({
        content:
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
      });

      const embed = baseEmbed("✏️ تغيير اسم عضو")
        .addFields(
          { name: "العضو", value: userText(user) },
          { name: "الاسم السابق", value: oldName },
          { name: "الاسم الجديد", value: name },
          { name: "المشرف", value: userText(interaction.user) }
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
        await interaction.guild.members.fetch(user.id)
          .catch(() => null);

      const embed = baseEmbed("👤 معلومات العضو")
        .setThumbnail(user.displayAvatarURL())
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
            name: "البوت",
            value: user.bot ? "نعم" : "لا"
          }
        );

      if (member) {
        embed.addFields(
          {
            name: "دخل السيرفر",
            value: member.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
              : "غير معروف"
          },
          {
            name: "الرتب",
            value:
              member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .map(r => `${r}`)
                .join(" ") || "لا توجد"
          }
        );
      }

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* =====================================================
       SERVERINFO
    ===================================================== */

    if (interaction.commandName === "serverinfo") {

      const guild = interaction.guild;

      const embed = baseEmbed("🏠 معلومات السيرفر")
        .setThumbnail(guild.iconURL())
        .addFields(
          {
            name: "اسم السيرفر",
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
          },
          {
            name: "الإيموجيات",
            value: `${guild.emojis.cache.size}`
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

      const embed = baseEmbed("🖼️ صورة العضو")
        .setDescription(
          `[فتح الصورة الأصلية](${user.displayAvatarURL({
            size: 4096,
            extension: "png"
          })})`
        )
        .setImage(
          user.displayAvatarURL({
            size: 4096,
            extension: "png"
          })
        );

      return interaction.reply({
        embeds: [embed]
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
        await client.users.fetch(user.id, {
          force: true
        });

      if (!fullUser.banner) {
        return interaction.reply({
          content: "❌ هذا العضو لا يملك بانر.",
          ephemeral: true
        });
      }

      const banner =
        fullUser.bannerURL({
          size: 4096,
          extension: "png"
        });

      const embed = baseEmbed("🎨 بانر العضو")
        .setImage(banner);

      return interaction.reply({
        embeds: [embed]
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
        await interaction.guild.members.fetch(user.id)
          .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });
      }

      const roles =
        member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => `${r}`)
          .join(" ");

      return interaction.reply({
        embeds: [
          baseEmbed("🎭 رتب العضو")
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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
          interaction.options.getString("trigger")
            .toLowerCase();

        const response =
          interaction.options.getString("response");

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
            `✅ تم حفظ الرد التلقائي.\n` +
            `الكلمة: **${trigger}**\n` +
            `الرد: **${response}**`
        });
      }

      if (sub === "remove") {

        const trigger =
          interaction.options.getString("trigger")
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
            `🗑️ تم حذف الرد التلقائي: **${trigger}**`
        });
      }
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
          content: "📭 لا توجد ردود تلقائية."
        });
      }

      const text =
        result.rows
          .map(
            x =>
              `**${x.trigger}** → ${x.response}`
          )
          .join("\n");

      return interaction.reply({
        embeds: [
          baseEmbed("🤖 الردود التلقائية")
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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

        const result = await db.query(
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
            content: "📭 لا توجد اختصارات."
          });
        }

        const text =
          result.rows
            .map(
              x =>
                `**${x.name}** → ${x.response}`
            )
            .join("\n");

        return interaction.reply({
          embeds: [
            baseEmbed("⚡ الاختصارات")
              .setDescription(text)
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية إدارة اللوق.",
          ephemeral: true
        });
      }

      const channel =
        interaction.channel;

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: "❌ هذا الروم غير صالح للوق.",
          ephemeral: true
        });
      }

      /* مهم جدًا:
         جلب البوت نفسه بالطريقة الصحيحة */
      const me =
        await interaction.guild.members.fetchMe();

      const permissions =
        channel.permissionsFor(me);

      if (
        !permissions?.has(PermissionFlagsBits.ViewChannel) ||
        !permissions?.has(PermissionFlagsBits.SendMessages) ||
        !permissions?.has(PermissionFlagsBits.EmbedLinks)
      ) {
        return interaction.reply({
          content:
            "❌ البوت يحتاج صلاحيات:\n" +
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

      await interaction.reply({
        embeds: [
          baseEmbed("✅ تم إعداد اللوق")
            .setDescription(
              `روم اللوق الآن هو ${channel}\n\n` +
              `جميع أنواع اللوق مفعلة بشكل افتراضي.`
            )
        ]
      });

      return;
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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

      const channel =
        channelId
          ? `<#${channelId}>`
          : "❌ غير محدد";

      const enabledCount =
        Object.values(data.settings)
          .filter(Boolean)
          .length;

      const total =
        Object.keys(LOG_TYPES).length;

      const description =
        `**حالة النظام:** ${
          data.enabled ? "🟢 مفعّل" : "🔴 متوقف"
        }\n` +
        `**روم اللوق:** ${channel}\n` +
        `**اللوقات المفعلة:** ${enabledCount}/${total}\n\n` +
        Object.entries(LOG_TYPES)
          .map(
            ([key, name]) =>
              `${data.settings[key] ? "🟢" : "🔴"} ${name}`
          )
          .join("\n");

      return interaction.reply({
        embeds: [
          baseEmbed("📋 حالة نظام اللوق")
            .setDescription(description)
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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
        content: "🟢 تم تشغيل نظام اللوق بالكامل."
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
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
        content: "🔴 تم إيقاف نظام اللوق بالكامل."
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
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      await ensureLogSettings(
        interaction.guildId
      );

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
            "اختر نوع اللوق لتشغيله أو إيقافه"
          )
          .setMinValues(1)
          .setMaxValues(1);

      for (const [key, name] of Object.entries(LOG_TYPES)) {

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
          "⚙️ اختر نوع اللوق الذي تريد تغييره:\n" +
          "عند الضغط عليه سيتم **تبديل حالته**.",
        components: [row],
        ephemeral: true
      });
    }

    /* =====================================================
       LOGS TEST
    ===================================================== */

    if (interaction.commandName === "logs") {

      if (
        !isOwner &&
        !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      ) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const embed = baseEmbed("🧪 اختبار اللوق")
        .setDescription(
          "إذا ظهر هذا الإمبد في روم اللوق، فالنظام يعمل بشكل صحيح."
        )
        .addFields(
          {
            name: "المشرف",
            value: userText(interaction.user)
          },
          {
            name: "السيرفر",
            value: interaction.guild.name
          }
        );

      await sendLog(
        interaction.guild,
        "guild_update",
        embed
      );

      return interaction.reply({
        content:
          "✅ تم إرسال اختبار اللوق إلى روم اللوق."
      });
    }

    /* =====================================================
       BOT
    ===================================================== */

    if (interaction.commandName === "bot") {

      const uptime =
        client.uptime || 0;

      const seconds =
        Math.floor(uptime / 1000);

      const days =
        Math.floor(seconds / 86400);

      const hours =
        Math.floor((seconds % 86400) / 3600);

      const minutes =
        Math.floor((seconds % 3600) / 60);

      const secs =
        seconds % 60;

      const embed =
        baseEmbed("🤖 معلومات البوت")
          .setThumbnail(
            client.user.displayAvatarURL()
          )
          .addFields(
            {
              name: "الحالة",
              value: "🟢 متصل"
            },
            {
              name: "اسم البوت",
              value: client.user.username
            },
            {
              name: "ID",
              value: client.user.id
            },
            {
              name: "السيرفرات",
              value: `${client.guilds.cache.size}`
            },
            {
              name: "مدة الاتصال الحالية",
              value:
                `${days} يوم، ${hours} ساعة، ` +
                `${minutes} دقيقة، ${secs} ثانية`
            },
            {
              name: "Ping",
              value: `${client.ws.ping}ms`
            }
          );

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* =====================================================
       ME
    ===================================================== */

    if (interaction.commandName === "me") {

      const embed =
        baseEmbed("🤖 مين أنا؟")
          .setDescription(
            "أنا بوت خاص لـ **.v5d.**\n\n" +
            "ولدي سيرفر **Mr Nova**.\n\n" +
            "مهمتي إدارة السيرفر، الحماية، " +
            "اللوقات، والأوامر الإدارية."
          );

      return interaction.reply({
        embeds: [embed]
      });
    }

  } catch (error) {

    console.error("=================================");
    console.error("❌ INTERACTION ERROR:");
    console.error(error);
    console.error("=================================");

    const message =
      "❌ حدث خطأ أثناء تنفيذ الأمر.";

    if (interaction.replied || interaction.deferred) {

      await interaction.followUp({
        content: message,
        ephemeral: true
      }).catch(() => {});

    } else {

      await interaction.reply({
        content: message,
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
    baseEmbed("📥 إنضمام عضو")
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
    baseEmbed("📤 خروج عضو")
      .addFields(
        {
          name: "العضو",
          value: userText(member.user)
        }
      );

  await sendLog(
    member.guild,
    "member_leave",
    embed
  );
});

/* =========================================================
   MEMBER UPDATE
========================================================= */

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  /* Roles */
  const oldRoles =
    oldMember.roles.cache.map(r => r.id);

  const newRoles =
    newMember.roles.cache.map(r => r.id);

  const added =
    newMember.roles.cache.filter(
      r => !oldMember.roles.cache.has(r.id)
    );

  const removed =
    oldMember.roles.cache.filter(
      r => !newMember.roles.cache.has(r.id)
    );

  if (added.size || removed.size) {

    const embed =
      baseEmbed("🎭 تحديث رتب عضو")
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

  /* Timeout */
  const oldTimeout =
    oldMember.communicationDisabledUntilTimestamp;

  const newTimeout =
    newMember.communicationDisabledUntilTimestamp;

  if (oldTimeout !== newTimeout) {

    const embed =
      baseEmbed("🔇 تحديث التايم أوت")
        .addFields(
          {
            name: "العضو",
            value: userText(newMember.user)
          },
          {
            name: "الحالة",
            value:
              newTimeout
                ? `🔴 حتى <t:${Math.floor(newTimeout / 1000)}:F>`
                : "🟢 تمت إزالة التايم أوت"
          }
        );

    await sendLog(
      newMember.guild,
      "timeout_update",
      embed
    );

    await sendLog(
      newMember.guild,
      "timeout",
      embed
    );
  }

  /* Nickname */
  if (oldMember.nickname !== newMember.nickname) {

    const embed =
      baseEmbed("✏️ تغيير اسم عضو")
        .addFields(
          {
            name: "العضو",
            value: userText(newMember.user)
          },
          {
            name: "الاسم السابق",
            value:
              oldMember.nickname ||
              oldMember.user.username
          },
          {
            name: "الاسم الجديد",
            value:
              newMember.nickname ||
              newMember.user.username
          }
        );

    await sendLog(
      newMember.guild,
      "member_roles",
      embed
    );
  }
});

/* =========================================================
   VOICE STATE UPDATE
========================================================= */

client.on("voiceStateUpdate", async (oldState, newState) => {

  const guild =
    newState.guild || oldState.guild;

  const member =
    newState.member || oldState.member;

  if (!member) return;

  /* Join */
  if (!oldState.channelId && newState.channelId) {

    const embed =
      baseEmbed("🔊 دخول صوتي")
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

  /* Leave */
  if (oldState.channelId && !newState.channelId) {

    const embed =
      baseEmbed("🔇 خروج صوتي")
        .addFields(
          {
            name: "العضو",
            value: userText(member.user)
          },
          {
            name: "الروم السابق",
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

  /* Move */
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {

    const embed =
      baseEmbed("🔀 تنقل صوتي")
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

  /* Server mute */
  if (
    oldState.serverMute !== newState.serverMute ||
    oldState.serverDeaf !== newState.serverDeaf
  ) {

    const embed =
      baseEmbed("🎙️ تحديث صلاحيات الصوت")
        .addFields(
          {
            name: "العضو",
            value: userText(member.user)
          },
          {
            name: "Server Mute",
            value:
              newState.serverMute
                ? "🔴 ممنوع من التحدث"
                : "🟢 مسموح بالتحدث"
          },
          {
            name: "Server Deaf",
            value:
              newState.serverDeaf
                ? "🔴 ممنوع من الإستماع"
                : "🟢 مسموح بالإستماع"
          }
        );

    await sendLog(
      guild,
      "voice_permissions",
      embed
    );
  }
});

/* =========================================================
   CHANNEL CREATE
========================================================= */

client.on("channelCreate", async channel => {

  if (!channel.guild) return;

  const embed =
    baseEmbed("📁 إنشاء روم")
      .addFields(
        {
          name: "الروم",
          value: `${channel}`
        },
        {
          name: "الاسم",
          value: channel.name
        },
        {
          name: "النوع",
          value: channel.type.toString()
        }
      );

  await sendLog(
    channel.guild,
    "channel_create_delete",
    embed
  );
});

/* =========================================================
   CHANNEL DELETE
========================================================= */

client.on("channelDelete", async channel => {

  if (!channel.guild) return;

  const embed =
    baseEmbed("🗑️ حذف روم")
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
});

/* =========================================================
   CHANNEL UPDATE
========================================================= */

client.on("channelUpdate", async (oldChannel, newChannel) => {

  if (!newChannel.guild) return;

  if (
    oldChannel.name !== newChannel.name ||
    oldChannel.topic !== newChannel.topic ||
    oldChannel.parentId !== newChannel.parentId ||
    oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
  ) {

    const embed =
      baseEmbed("✏️ تحديث روم")
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

  if (
    oldChannel.permissionOverwrites.cache.size !==
    newChannel.permissionOverwrites.cache.size
  ) {

    const embed =
      baseEmbed("🔐 تحديث صلاحيات روم")
        .addFields(
          {
            name: "الروم",
            value: `${newChannel}`
          }
        );

    await sendLog(
      newChannel.guild,
      "channel_permissions",
      embed
    );
  }
});

/* =========================================================
   ROLE CREATE
========================================================= */

client.on("roleCreate", async role => {

  const embed =
    baseEmbed("🎭 إنشاء رتبة")
      .addFields(
        {
          name: "الرتبة",
          value: `${role}`
        },
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
});

/* =========================================================
   ROLE DELETE
========================================================= */

client.on("roleDelete", async role => {

  const embed =
    baseEmbed("🗑️ حذف رتبة")
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
});

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on("roleUpdate", async (oldRole, newRole) => {

  if (
    oldRole.name !== newRole.name ||
    oldRole.color !== newRole.color ||
    oldRole.hoist !== newRole.hoist ||
    oldRole.mentionable !== newRole.mentionable
  ) {

    const embed =
      baseEmbed("✏️ تحديث رتبة")
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
      baseEmbed("🔐 تحديث صلاحيات رتبة")
        .addFields(
          {
            name: "الرتبة",
            value: `${newRole}`
          },
          {
            name: "الاسم",
            value: newRole.name
          }
        );

    await sendLog(
      newRole.guild,
      "role_permissions",
      embed
    );
  }
});

/* =========================================================
   GUILD UPDATE
========================================================= */

client.on("guildUpdate", async (oldGuild, newGuild) => {

  if (
    oldGuild.name !== newGuild.name ||
    oldGuild.icon !== newGuild.icon ||
    oldGuild.banner !== newGuild.banner ||
    oldGuild.description !== newGuild.description ||
    oldGuild.verificationLevel !== newGuild.verificationLevel
  ) {

    const embed =
      baseEmbed("⚙️ تحديث إعدادات السيرفر")
        .addFields(
          {
            name: "السيرفر",
            value: newGuild.name
          },
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
});

/* =========================================================
   MESSAGE DELETE
========================================================= */

client.on("messageDelete", async message => {

  if (!message.guild) return;

  if (message.author?.bot) return;

  const embed =
    baseEmbed("🗑️ حذف رسالة")
      .addFields(
        {
          name: "العضو",
          value: message.author
            ? userText(message.author)
            : "غير معروف"
        },
        {
          name: "الروم",
          value: `${message.channel}`
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
});

/* =========================================================
   MESSAGE BULK DELETE
========================================================= */

client.on("messageDeleteBulk", async messages => {

  const first =
    messages.first();

  if (!first?.guild) return;

  const embed =
    baseEmbed("🧹 حذف مجموعة رسائل")
      .addFields(
        {
          name: "عدد الرسائل",
          value: `${messages.size}`
        },
        {
          name: "الروم",
          value: `${first.channel}`
        }
      );

  await sendLog(
    first.guild,
    "bulk_delete",
    embed
  );
});

/* =========================================================
   REACTION ADD
========================================================= */

client.on("messageReactionAdd", async (reaction, user) => {

  if (user.bot) return;

  if (!reaction.message.guild) return;

  const embed =
    baseEmbed("😀 إضافة رياكشن")
      .addFields(
        {
          name: "العضو",
          value: userText(user)
        },
        {
          name: "الرياكشن",
          value: reaction.emoji.toString()
        },
        {
          name: "الروم",
          value: `${reaction.message.channel}`
        }
      );

  await sendLog(
    reaction.message.guild,
    "reaction",
    embed
  );
});

/* =========================================================
   EMOJI CREATE
========================================================= */

client.on("emojiCreate", async emoji => {

  const embed =
    baseEmbed("😀 إضافة إيموجي")
      .addFields(
        {
          name: "الإيموجي",
          value: `${emoji}`
        },
        {
          name: "الاسم",
          value: emoji.name || "غير معروف"
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
});

/* =========================================================
   EMOJI DELETE
========================================================= */

client.on("emojiDelete", async emoji => {

  const embed =
    baseEmbed("🗑️ حذف إيموجي")
      .addFields(
        {
          name: "الاسم",
          value: emoji.name || "غير معروف"
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
});

/* =========================================================
   EMOJI UPDATE
========================================================= */

client.on("emojiUpdate", async (oldEmoji, newEmoji) => {

  const embed =
    baseEmbed("✏️ تحديث إيموجي")
      .addFields(
        {
          name: "الإيموجي",
          value: `${newEmoji}`
        },
        {
          name: "الاسم السابق",
          value: oldEmoji.name || "غير معروف"
        },
        {
          name: "الاسم الجديد",
          value: newEmoji.name || "غير معروف"
        }
      );

  await sendLog(
    newEmoji.guild,
    "emoji",
    embed
  );
});

/* =========================================================
   STICKER CREATE
========================================================= */

client.on("stickerCreate", async sticker => {

  const embed =
    baseEmbed("🏷️ إضافة ستيكر")
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
});

/* =========================================================
   STICKER DELETE
========================================================= */

client.on("stickerDelete", async sticker => {

  const embed =
    baseEmbed("🗑️ حذف ستيكر")
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
});

/* =========================================================
   STICKER UPDATE
========================================================= */

client.on("stickerUpdate", async (oldSticker, newSticker) => {

  const embed =
    baseEmbed("✏️ تحديث ستيكر")
      .addFields(
        {
          name: "الاسم السابق",
          value: oldSticker.name
        },
        {
          name: "الاسم الجديد",
          value: newSticker.name
        },
        {
          name: "ID",
          value: newSticker.id
        }
      );

  await sendLog(
    newSticker.guild,
    "sticker",
    embed
  );
});

/* =========================================================
   AUTO REPLIES + SHORTCUTS
========================================================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;
  if (message.author.bot) return;

  try {

    const content =
      message.content.trim().toLowerCase();

    /* AUTO REPLY */

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

    /* SHORTCUT */

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
      "❌ Message handler error:",
      error.message
    );
  }
});

/* =========================================================
   PROCESS ERRORS
========================================================= */

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

/* =========================================================
   START
========================================================= */

(async () => {

  try {

    await setupDatabase();

    await registerCommands();

    await client.login(TOKEN);

  } catch (error) {

    console.error("=================================");
    console.error("❌ BOT START ERROR");
    console.error(error);
    console.error("=================================");

    process.exit(1);
  }

})();
