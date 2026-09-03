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
  MessageFlags,
  ActivityType,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const { Pool } = require("pg");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATABASE_URL = process.env.DATABASE_URL;

const OWNER_ID = "1179433017064820747";
const SPECIAL_ID = "1523658452382126101";
const WHITE = 0xFFFFFF;

if (!TOKEN || !CLIENT_ID || !DATABASE_URL) {
  console.error("تأكد من DISCORD_TOKEN و CLIENT_ID و DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

const LOG_TYPES = {
  member_join: "إنضمام الأعضاء",
  member_leave: "خروج الأعضاء",
  member_kick: "طرد الأعضاء",
  member_ban: "حظر الأعضاء",
  member_unban: "إزالة الحظر",
  timeout: "التايم أوت",
  message_delete: "حذف الرسائل",
  message_edit: "تعديل الرسائل",
  message_bulk_delete: "حذف مجموعة رسائل",
  channel_create_delete: "إنشاء وحذف الرومات",
  channel_update: "تحديث الرومات",
  channel_permissions: "صلاحيات الرومات",
  role_create_delete: "إنشاء وحذف الرتب",
  role_update: "تحديث الرتب",
  role_permissions: "صلاحيات الرتب",
  member_roles: "رتب الأعضاء",
  voice: "دخول وخروج صوتي",
  voice_move: "سحب وتنقل صوتي",
  voice_permissions: "صلاحيات الصوت",
  guild_update: "إعدادات السيرفر",
  emoji: "الإيموجيات",
  sticker: "الستيكرات",
  reaction: "الرياكتشن",
  bot_add: "إضافة بوت",
  moderation: "أوامر الإدارة"
};

function defaultSettings() {
  return Object.fromEntries(
    Object.keys(LOG_TYPES).map(x => [x, true])
  );
}

async function setupDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_settings (
      guild_id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS warns (
      id BIGSERIAL PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS autoreplies (
      guild_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      response TEXT NOT NULL,
      PRIMARY KEY(guild_id, trigger)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shortcuts (
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      response TEXT NOT NULL,
      PRIMARY KEY(guild_id, name)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS server_guard (
      guild_id TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
}

function privileged(i) {
  return i.user.id === OWNER_ID || i.user.id === SPECIAL_ID;
}

function hasPermission(i, permission) {
  if (privileged(i)) return true;
  return i.memberPermissions?.has(permission);
}

async function deny(i, text) {
  const data = {
    content: text,
    flags: MessageFlags.Ephemeral
  };

  if (i.replied || i.deferred) {
    return i.followUp(data).catch(() => {});
  }

  return i.reply(data).catch(() => {});
}

function limit(text, max = 3800) {
  text = String(text ?? "");
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function userText(user) {
  if (!user) return "غير معروف";
  return `${user} (\`${user.id}\`)`;
}

async function getConfig(guildId) {
  const c = await pool.query(
    "SELECT channel_id FROM log_channels WHERE guild_id=$1",
    [guildId]
  );

  const s = await pool.query(
    "SELECT enabled, settings FROM log_settings WHERE guild_id=$1",
    [guildId]
  );

  if (!s.rows[0]) {
    const settings = defaultSettings();

    await pool.query(
      `INSERT INTO log_settings(guild_id,enabled,settings)
       VALUES($1,TRUE,$2::jsonb)
       ON CONFLICT(guild_id) DO NOTHING`,
      [guildId, JSON.stringify(settings)]
    );

    return {
      channelId: c.rows[0]?.channel_id || null,
      enabled: true,
      settings
    };
  }

  return {
    channelId: c.rows[0]?.channel_id || null,
    enabled: s.rows[0].enabled,
    settings: {
      ...defaultSettings(),
      ...(s.rows[0].settings || {})
    }
  };
}

async function sendLog(guild, type, title, description, fields = []) {
  try {
    if (!guild) return;

    const cfg = await getConfig(guild.id);

    if (!cfg.enabled) return;
    if (cfg.settings[type] === false) return;
    if (!cfg.channelId) return;

    const channel =
      guild.channels.cache.get(cfg.channelId) ||
      await guild.channels.fetch(cfg.channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(WHITE)
      .setTitle(title)
      .setDescription(limit(description))
      .setTimestamp()
      .setFooter({ text: ".v5d." });

    if (fields.length) embed.addFields(fields);

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {
    console.error("LOG:", e.message);
  }
}

const messageCache = new Map();

function cacheMessage(message) {
  if (!message.guild) return;

  messageCache.set(message.id, {
    guildId: message.guild.id,
    channelId: message.channel.id,
    authorId: message.author?.id,
    author: message.author,
    content: message.content || "",
    createdTimestamp: message.createdTimestamp
  });

  if (messageCache.size > 15000) {
    const first = messageCache.keys().next().value;
    if (first) messageCache.delete(first);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("مين أنا؟"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("السبب")),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("إزالة حظر")
    .addStringOption(o => o.setName("user_id").setDescription("ID العضو").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("السبب")),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("السبب")),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("تايم أوت")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutes").setDescription("الدقائق").setRequired(true).setMinValue(1).setMaxValue(40320)
    )
    .addStringOption(o => o.setName("reason").setDescription("السبب")),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("السبب").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("قائمة التحذيرات")
    .addUserOption(o => o.setName("user").setDescription("العضو")),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("حذف رسائل")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("العدد").setRequired(true).setMinValue(1).setMaxValue(100)
    ),

  new SlashCommandBuilder().setName("lock").setDescription("قفل الروم"),
  new SlashCommandBuilder().setName("unlock").setDescription("فتح الروم"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تغيير Slowmode")
    .addIntegerOption(o =>
      o.setName("seconds").setDescription("الثواني").setRequired(true).setMinValue(0).setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إدارة الرتب")
    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رتبة")
        .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
        .addRoleOption(o => o.setName("role").setDescription("الرتبة").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("إزالة رتبة")
        .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
        .addRoleOption(o => o.setName("role").setDescription("الرتبة").setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("تغيير اسم عضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("name").setDescription("الاسم").setRequired(true)),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true)),

  new SlashCommandBuilder().setName("serverinfo").setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true)),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true)),

  new SlashCommandBuilder().setName("roles").setDescription("رتب السيرفر"),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("إرسال رسالة")
    .addStringOption(o => o.setName("message").setDescription("الرسالة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("إعدادات اللوق")
    .addSubcommand(s =>
      s.setName("setup")
        .setDescription("تحديد روم اللوق")
        .addChannelOption(o =>
          o.setName("channel").setDescription("الروم").addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand(s => s.setName("status").setDescription("حالة اللوق"))
    .addSubcommand(s => s.setName("enable").setDescription("تشغيل اللوق"))
    .addSubcommand(s => s.setName("disable").setDescription("إيقاف اللوق"))
    .addSubcommand(s => s.setName("edit").setDescription("تعديل أنواع اللوق")),

  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("الردود التلقائية")
    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رد")
        .addStringOption(o => o.setName("trigger").setDescription("الكلمة").setRequired(true))
        .addStringOption(o => o.setName("response").setDescription("الرد").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف رد")
        .addStringOption(o => o.setName("trigger").setDescription("الكلمة").setRequired(true))
    )
    .addSubcommand(s => s.setName("list").setDescription("قائمة الردود")),

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("الاختصارات")
    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إضافة اختصار")
        .addStringOption(o => o.setName("name").setDescription("الاسم").setRequired(true))
        .addStringOption(o => o.setName("response").setDescription("الرد").setRequired(true))
    )
    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o => o.setName("name").setDescription("الاسم").setRequired(true))
    )
    .addSubcommand(s => s.setName("list").setDescription("قائمة الاختصارات")),

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("حالة البوت"),

  new SlashCommandBuilder()
    .setName("serverguard")
    .setDescription("حماية السيرفر")
    .addSubcommand(s =>
      s.setName("enable")
        .setDescription("تفعيل الحماية")
    )
    .addSubcommand(s =>
      s.setName("disable")
        .setDescription("تعطيل الحماية")
    )
    .addSubcommand(s =>
      s.setName("status")
        .setDescription("حالة الحماية")
    )
].map(c => c.setDMPermission(false));

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands.map(c => c.toJSON()) }
  );

  console.log(`تم تسجيل ${commands.length} أمر`);
}

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "log_edit") {
        if (!privileged(interaction) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return deny(interaction, "❌ لا تملك الصلاحية.");
        }

        const key = interaction.values[0];
        const cfg = await getConfig(interaction.guildId);

        cfg.settings[key] = !cfg.settings[key];

        await pool.query(
          `INSERT INTO log_settings(guild_id,enabled,settings)
           VALUES($1,$2,$3::jsonb)
           ON CONFLICT(guild_id)
           DO UPDATE SET enabled=EXCLUDED.enabled,settings=EXCLUDED.settings`,
          [
            interaction.guildId,
            cfg.enabled,
            JSON.stringify(cfg.settings)
          ]
        );

        return interaction.update({
          content:
            `**${LOG_TYPES[key]}**\n` +
            `الحالة: ${cfg.settings[key] ? "🟢 مفعل" : "🔴 معطل"}`,
          components: []
        });
      }
      
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return deny(interaction, "❌ استخدم الأمر داخل السيرفر.");

    const guild = interaction.guild;
    const command = interaction.commandName;

    // Defer reply for all commands except quick ones
    if (!["me", "bot", "serverinfo", "roles", "avatar", "banner", "info"].includes(command)) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }

    if (command === "me") {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(WHITE)
            .setTitle("🤖 مين أنا؟")
            .setDescription(
              "**أنا بوت خاص لـ .v5d.**\n\n" +
              "🏠 السيرفر: **MR NOVA**\n" +
              "⚙️ الخدمة: **Leon**\n" +
              "👨‍💻 Powered by **.v5d.**"
            )
        ]
      });
    }

    if (command === "log") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild)) {
        return deny(interaction, "❌ لا تملك صلاحية Manage Server.");
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "setup") {
        const channel = interaction.options.getChannel("channel");
        const me = await guild.members.fetchMe();

        if (!channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) {
          return deny(interaction, "❌ البوت لا يملك صلاحية إرسال الرسائل.");
        }

        await pool.query(
          `INSERT INTO log_channels(guild_id,channel_id)
           VALUES($1,$2)
           ON CONFLICT(guild_id)
           DO UPDATE SET channel_id=EXCLUDED.channel_id`,
          [guild.id, channel.id]
        );

        await getConfig(guild.id);

        await interaction.editReply(`✅ تم تحديد ${channel} كروم اللوق.`);

        await sendLog(
          guild,
          "moderation",
          "📋 إعداد اللوق",
          `👤 الإداري: ${interaction.user}\n📍 الروم: ${channel}`
        );

        return;
      }

      if (sub === "status") {
        const cfg = await getConfig(guild.id);
        const active = Object.values(cfg.settings).filter(Boolean).length;
        const total = Object.keys(LOG_TYPES).length;

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(WHITE)
              .setTitle("📋 حالة اللوق")
              .addFields(
                {
                  name: "الحالة",
                  value: cfg.enabled ? "🟢 مفعل" : "🔴 معطل",
                  inline: true
                },
                {
                  name: "الروم",
                  value: cfg.channelId ? `<#${cfg.channelId}>` : "❌ غير محدد",
                  inline: true
                },
                {
                  name: "الأنواع",
                  value: `${active}/${total}`,
                  inline: true
                }
              )
          ]
        });
      }

      if (sub === "enable") {
        await pool.query(
          `INSERT INTO log_settings(guild_id,enabled,settings)
           VALUES($1,TRUE,$2::jsonb)
           ON CONFLICT(guild_id)
           DO UPDATE SET enabled=TRUE`,
          [guild.id, JSON.stringify(defaultSettings())]
        );

        return interaction.editReply("🟢 تم تشغيل اللوق.");
      }

      if (sub === "disable") {
        await pool.query(
          `INSERT INTO log_settings(guild_id,enabled,settings)
           VALUES($1,FALSE,$2::jsonb)
           ON CONFLICT(guild_id)
           DO UPDATE SET enabled=FALSE`,
          [guild.id, JSON.stringify(defaultSettings())]
        );

        return interaction.editReply("🔴 تم إيقاف اللوق.");
      }

      if (sub === "edit") {
        const cfg = await getConfig(guild.id);

        const options = Object.entries(LOG_TYPES).map(([key, name]) => ({
          label: name.slice(0, 100),
          value: key,
          description: cfg.settings[key]
            ? "🟢 مفعل - اضغط لتعطيله"
            : "🔴 معطل - اضغط لتفعيله"
        }));

        const menu = new StringSelectMenuBuilder()
          .setCustomId("log_edit")
          .setPlaceholder("اختر نوع اللوق لتعديله")
          .addOptions(options.slice(0, 25));

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.editReply({
          content: "اختر نوع اللوق لتفعيله أو تعطيله:",
          components: [row]
        });
      }
    }

    if (command === "ban") {
      if (!hasPermission(interaction, PermissionFlagsBits.BanMembers))
        return deny(interaction, "❌ لا تملك صلاحية Ban Members.");

      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.bannable)
        return deny(interaction, "❌ لا أستطيع حظر هذا العضو.");

      const reason = interaction.options.getString("reason") || "بدون سبب";

      await member.ban({ reason });

      await sendLog(
        guild,
        "member_ban",
        "🔨 حظر عضو",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n📝 السبب: ${reason}`
      );

      return interaction.editReply(`✅ تم حظر ${user}.\n📝 السبب: ${reason}`);
    }

    if (command === "unban") {
      if (!hasPermission(interaction, PermissionFlagsBits.BanMembers))
        return deny(interaction, "❌ لا تملك صلاحية Ban Members.");

      const userId = interaction.options.getString("user_id");
      const reason = interaction.options.getString("reason") || "بدون سبب";

      const bans = await guild.bans.fetch();
      const bannedUser = bans.find(b => b.user.id === userId || b.user.username === userId);

      if (!bannedUser)
        return deny(interaction, "❌ هذا العضو غير محظور.");

      await guild.bans.remove(bannedUser.user, reason);

      await sendLog(
        guild,
        "member_unban",
        "🔓 إزالة حظر",
        `👤 العضو: ${userText(bannedUser.user)}\n🛡️ الإداري: ${interaction.user}\n📝 السبب: ${reason}`
      );

      return interaction.editReply(`✅ تم فك حظر ${bannedUser.user}.\n📝 السبب: ${reason}`);
    }

    if (command === "kick") {
      if (!hasPermission(interaction, PermissionFlagsBits.KickMembers))
        return deny(interaction, "❌ لا تملك صلاحية Kick Members.");

      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.kickable)
        return deny(interaction, "❌ لا أستطيع طرد هذا العضو.");

      const reason = interaction.options.getString("reason") || "بدون سبب";

      await member.kick(reason);

      await sendLog(
        guild,
        "member_kick",
        "👢 طرد عضو",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n📝 السبب: ${reason}`
      );

      return interaction.editReply(`✅ تم طرد ${user}.\n📝 السبب: ${reason}`);
    }

    if (command === "timeout") {
      if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers))
        return deny(interaction, "❌ لا تملك صلاحية Moderate Members.");

      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.moderatable)
        return deny(interaction, "❌ لا أستطيع وضع تايم أوت لهذا العضو.");

      const minutes = interaction.options.getInteger("minutes");
      const reason = interaction.options.getString("reason") || "بدون سبب";

      await member.timeout(minutes * 60 * 1000, reason);

      await sendLog(
        guild,
        "timeout",
        "⏰ تايم أوت",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n⏱️ المدة: ${minutes} دقيقة\n📝 السبب: ${reason}`
      );

      return interaction.editReply(`✅ تم وضع تايم أوت لـ ${user} لمدة ${minutes} دقيقة.\n📝 السبب: ${reason}`);
    }

    if (command === "untimeout") {
      if (!hasPermission(interaction, PermissionFlagsBits.ModerateMembers))
        return deny(interaction, "❌ لا تملك صلاحية Moderate Members.");

      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.moderatable)
        return deny(interaction, "❌ لا أستطيع إزالة التايم أوت لهذا العضو.");

      await member.timeout(null);

      await sendLog(
        guild,
        "timeout",
        "⏰ إزالة تايم أوت",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}`
      );

      return interaction.editReply(`✅ تم إزالة التايم أوت عن ${user}.`);
    }

    if (command === "warn") {
      if (!hasPermission(interaction, PermissionFlagsBits.KickMembers))
        return deny(interaction, "❌ لا تملك الصلاحية المطلوبة.");

      const user = interaction.options.getUser("user");
      const reason = interaction.options.getString("reason");

      await pool.query(
        `INSERT INTO warns(guild_id, user_id, moderator_id, reason)
         VALUES($1, $2, $3, $4)`,
        [guild.id, user.id, interaction.user.id, reason]
      );

      await sendLog(
        guild,
        "moderation",
        "⚠️ تحذير عضو",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n📝 السبب: ${reason}`
      );

      return interaction.editReply(`✅ تم تحذير ${user}.\n📝 السبب: ${reason}`);
    }

    if (command === "warnlist") {
      const user = interaction.options.getUser("user");

      if (user) {
        const result = await pool.query(
          `SELECT * FROM warns WHERE guild_id=$1 AND user_id=$2 ORDER BY created_at DESC`,
          [guild.id, user.id]
        );

        if (result.rows.length === 0)
          return interaction.editReply(`ℹ️ ${user} ليس لديه تحذيرات.`);

        const list = result.rows.map((w, i) =>
          `**#${i + 1}** - ${w.reason || "بدون سبب"} (تم بواسطة <@${w.moderator_id}>) - ${new Date(w.created_at).toLocaleString()}`
        ).join("\n");

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(WHITE)
              .setTitle(`⚠️ تحذيرات ${user.tag}`)
              .setDescription(limit(list))
          ]
        });
      } else {
        const result = await pool.query(
          `SELECT user_id, COUNT(*) as count FROM warns WHERE guild_id=$1 GROUP BY user_id ORDER BY count DESC`,
          [guild.id]
        );

        if (result.rows.length === 0)
          return interaction.editReply("ℹ️ لا توجد تحذيرات في السيرفر.");

        const list = result.rows.map((row, i) =>
          `**#${i + 1}** - <@${row.user_id}> - ${row.count} تحذيرات`
        ).join("\n");

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(WHITE)
              .setTitle("⚠️ قائمة التحذيرات")
              .setDescription(limit(list))
          ]
        });
      }
    }

    if (command === "clear") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages))
        return deny(interaction, "❌ لا تملك صلاحية Manage Messages.");

      const amount = interaction.options.getInteger("amount");
      const messages = await interaction.channel.bulkDelete(amount, true);

      await sendLog(
        guild,
        "message_delete",
        "🗑️ حذف رسائل",
        `👤 الإداري: ${interaction.user}\n📊 العدد: ${messages.size}\n📍 الروم: ${interaction.channel}`
      );

      await interaction.editReply(`✅ تم حذف ${messages.size} رسالة.`);
      
      setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    }

    if (command === "lock") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels))
        return deny(interaction, "❌ لا تملك صلاحية Manage Channels.");

      const channel = interaction.channel;

      await channel.permissionOverwrites.edit(guild.id, {
        SendMessages: false
      });

      await sendLog(
        guild,
        "moderation",
        "🔒 قفل الروم",
        `👤 الإداري: ${interaction.user}\n📍 الروم: ${channel}`
      );

      return interaction.editReply(`🔒 تم قفل ${channel}.`);
    }

    if (command === "unlock") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels))
        return deny(interaction, "❌ لا تملك صلاحية Manage Channels.");

      const channel = interaction.channel;

      await channel.permissionOverwrites.edit(guild.id, {
        SendMessages: null
      });

      await sendLog(
        guild,
        "moderation",
        "🔓 فتح الروم",
        `👤 الإداري: ${interaction.user}\n📍 الروم: ${channel}`
      );

      return interaction.editReply(`🔓 تم فتح ${channel}.`);
    }

    if (command === "slowmode") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageChannels))
        return deny(interaction, "❌ لا تملك صلاحية Manage Channels.");

      const seconds = interaction.options.getInteger("seconds");

      await interaction.channel.setRateLimitPerUser(seconds);

      await sendLog(
        guild,
        "moderation",
        "🐢 تغيير Slowmode",
        `👤 الإداري: ${interaction.user}\n⏱️ المدة: ${seconds} ثانية\n📍 الروم: ${interaction.channel}`
      );

      return interaction.editReply(`✅ تم تغيير Slowmode إلى ${seconds} ثانية.`);
    }

    if (command === "role") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageRoles))
        return deny(interaction, "❌ لا تملك صلاحية Manage Roles.");

      const sub = interaction.options.getSubcommand();
      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member)
        return deny(interaction, "❌ العضو غير موجود.");

      const role = interaction.options.getRole("role");

      if (role.position >= guild.members.me.roles.highest.position)
        return deny(interaction, "❌ الرتبة أعلى من رتبتي.");

      if (sub === "add") {
        await member.roles.add(role);
        await sendLog(
          guild,
          "member_roles",
          "➕ إضافة رتبة",
          `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n🎖️ الرتبة: ${role}`
        );
        return interaction.editReply(`✅ تم إضافة ${role} لـ ${user}.`);
      } else if (sub === "remove") {
        await member.roles.remove(role);
        await sendLog(
          guild,
          "member_roles",
          "➖ إزالة رتبة",
          `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n🎖️ الرتبة: ${role}`
        );
        return interaction.editReply(`✅ تم إزالة ${role} من ${user}.`);
      }
    }

    if (command === "nickname") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageNicknames))
        return deny(interaction, "❌ لا تملك صلاحية Manage Nicknames.");

      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member || !member.manageable)
        return deny(interaction, "❌ لا أستطيع تغيير اسم هذا العضو.");

      const name = interaction.options.getString("name");

      await member.setNickname(name);

      await sendLog(
        guild,
        "moderation",
        "✏️ تغيير اسم",
        `👤 العضو: ${userText(user)}\n🛡️ الإداري: ${interaction.user}\n📛 الاسم الجديد: ${name}`
      );

      return interaction.editReply(`✅ تم تغيير اسم ${user} إلى ${name}.`);
    }

    if (command === "info") {
      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member) return deny(interaction, "❌ العضو غير موجود.");

      const embed = new EmbedBuilder()
        .setColor(WHITE)
        .setTitle(`ℹ️ معلومات ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
          { name: "🆔 ID", value: user.id, inline: true },
          { name: "📛 اسم", value: user.username, inline: true },
          { name: "👤 اسم في السيرفر", value: member.displayName, inline: true },
                    { name: "📅 تاريخ الإنضمام", value: member.joinedAt ? member.joinedAt.toLocaleString() : "غير معروف", inline: true },
          { name: "📆 تاريخ الحساب", value: user.createdAt.toLocaleString(), inline: true },
          { name: "🎖️ أعلى رتبة", value: member.roles.highest.toString(), inline: true },
          { name: "📊 الرتب", value: member.roles.cache.size > 1 ? member.roles.cache.size - 1 : "لا يوجد", inline: true }
        );

      if (user.bannerURL) {
        embed.setImage(user.bannerURL({ dynamic: true, size: 1024 }));
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "serverinfo") {
      const embed = new EmbedBuilder()
        .setColor(WHITE)
        .setTitle(`🏠 معلومات ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
        .addFields(
          { name: "🆔 ID", value: guild.id, inline: true },
          { name: "👑 المالك", value: guild.ownerId ? `<@${guild.ownerId}>` : "غير معروف", inline: true },
          { name: "👥 الأعضاء", value: `${guild.memberCount}`, inline: true },
          { name: "📅 تاريخ الإنشاء", value: guild.createdAt.toLocaleString(), inline: true },
          { name: "📊 الرتب", value: `${guild.roles.cache.size}`, inline: true },
          { name: "📝 الرومات", value: `${guild.channels.cache.size}`, inline: true },
          { name: "🤖 البوتات", value: guild.members.cache.filter(m => m.user.bot).size.toString(), inline: true },
          { name: "👤 البشر", value: (guild.memberCount - guild.members.cache.filter(m => m.user.bot).size).toString(), inline: true }
        );

      if (guild.bannerURL) {
        embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "avatar") {
      const user = interaction.options.getUser("user");
      const member = await guild.members.fetch(user.id).catch(() => null);

      if (!member) return deny(interaction, "❌ العضو غير موجود.");

      const embed = new EmbedBuilder()
        .setColor(WHITE)
        .setTitle(`🖼️ صورة ${user.tag}`)
        .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
        .setFooter({ text: "انقر على الصورة لتكبيرها" });

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "banner") {
      const user = interaction.options.getUser("user");

      const fetchedUser = await client.users.fetch(user.id, { force: true });

      if (!fetchedUser.bannerURL()) {
        return interaction.reply(`❌ ${user} ليس لديه بنر.`);
      }

      const embed = new EmbedBuilder()
        .setColor(WHITE)
        .setTitle(`🖼️ بنر ${user.tag}`)
        .setImage(fetchedUser.bannerURL({ dynamic: true, size: 4096 }))
        .setFooter({ text: "انقر على الصورة لتكبيرها" });

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "roles") {
      const roles = guild.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.toString());

      if (roles.length === 0) {
        return interaction.reply("ℹ️ لا توجد رتب في السيرفر.");
      }

      const chunks = [];
      let current = [];

      for (const role of roles) {
        if (current.join(" ").length + role.length > 1024) {
          chunks.push(current);
          current = [];
        }
        current.push(role);
      }

      if (current.length) chunks.push(current);

      const embeds = chunks.map((chunk, i) =>
        new EmbedBuilder()
          .setColor(WHITE)
          .setTitle(`🎖️ رتب السيرفر (${chunks.length > 1 ? `صفحة ${i + 1}/${chunks.length}` : "جميع الرتب"})`)
          .setDescription(chunk.join(" "))
      );

      return interaction.reply({ embeds });
    }

    if (command === "say") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages))
        return deny(interaction, "❌ لا تملك صلاحية Manage Messages.");

      const message = interaction.options.getString("message");

      await interaction.channel.send(message);
      return interaction.reply({
        content: "✅ تم إرسال الرسالة.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (command === "autoreply") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild))
        return deny(interaction, "❌ لا تملك صلاحية Manage Server.");

      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const trigger = interaction.options.getString("trigger").toLowerCase();
        const response = interaction.options.getString("response");

        await pool.query(
          `INSERT INTO autoreplies(guild_id, trigger, response)
           VALUES($1, $2, $3)
           ON CONFLICT(guild_id, trigger)
           DO UPDATE SET response=EXCLUDED.response`,
          [guild.id, trigger, response]
        );

        return interaction.editReply(`✅ تم إضافة الرد التلقائي.\n📌 الكلمة: \`${trigger}\`\n📝 الرد: ${response}`);
      }

      if (sub === "remove") {
        const trigger = interaction.options.getString("trigger").toLowerCase();

        const result = await pool.query(
          `DELETE FROM autoreplies WHERE guild_id=$1 AND trigger=$2`,
          [guild.id, trigger]
        );

        if (result.rowCount === 0)
          return interaction.editReply(`❌ لا يوجد رد تلقائي للكلمة \`${trigger}\`.`);

        return interaction.editReply(`✅ تم حذف الرد التلقائي للكلمة \`${trigger}\`.`);
      }

      if (sub === "list") {
        const result = await pool.query(
          `SELECT * FROM autoreplies WHERE guild_id=$1 ORDER BY trigger`,
          [guild.id]
        );

        if (result.rows.length === 0)
          return interaction.editReply("ℹ️ لا توجد ردود تلقائية.");

        const list = result.rows.map((r, i) =>
          `**#${i + 1}** \`${r.trigger}\` → ${r.response}`
        ).join("\n");

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(WHITE)
              .setTitle("💬 الردود التلقائية")
              .setDescription(limit(list))
          ]
        });
      }
    }

    if (command === "shortcut") {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageGuild))
        return deny(interaction, "❌ لا تملك صلاحية Manage Server.");

      const sub = interaction.options.getSubcommand();

      if (sub === "set") {
        const name = interaction.options.getString("name").toLowerCase();
        const response = interaction.options.getString("response");

        await pool.query(
          `INSERT INTO shortcuts(guild_id, name, response)
           VALUES($1, $2, $3)
           ON CONFLICT(guild_id, name)
           DO UPDATE SET response=EXCLUDED.response`,
          [guild.id, name, response]
        );

        return interaction.editReply(`✅ تم إضافة الاختصار.\n📌 الاسم: \`${name}\`\n📝 الرد: ${response}`);
      }

      if (sub === "remove") {
        const name = interaction.options.getString("name").toLowerCase();

        const result = await pool.query(
          `DELETE FROM shortcuts WHERE guild_id=$1 AND name=$2`,
          [guild.id, name]
        );

        if (result.rowCount === 0)
          return interaction.editReply(`❌ لا يوجد اختصار باسم \`${name}\`.`);

        return interaction.editReply(`✅ تم حذف الاختصار \`${name}\`.`);
      }

      if (sub === "list") {
        const result = await pool.query(
          `SELECT * FROM shortcuts WHERE guild_id=$1 ORDER BY name`,
          [guild.id]
        );

        if (result.rows.length === 0)
          return interaction.editReply("ℹ️ لا توجد اختصارات.");

        const list = result.rows.map((r, i) =>
          `**#${i + 1}** \`${r.name}\` → ${r.response}`
        ).join("\n");

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(WHITE)
              .setTitle("⚡ الاختصارات")
              .setDescription(limit(list))
          ]
        });
      }
    }

    if (command === "bot") {
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);

      const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

      const embed = new EmbedBuilder()
        .setColor(WHITE)
        .setTitle("🤖 حالة البوت")
        .addFields(
          { name: "📊 الحالة", value: "🟢 متصل", inline: true },
          { name: "⏱️ مدة التشغيل", value: uptimeStr, inline: true },
          { name: "🏠 السيرفرات", value: `${client.guilds.cache.size}`, inline: true },
          { name: "👥 المستخدمين", value: `${client.users.cache.size}`, inline: true },
          { name: "📌 الأوامر", value: `${commands.length}`, inline: true },
          { name: "👨‍💻 المطور", value: `<@${OWNER_ID}>`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (command === "serverguard") {
      if (!hasPermission(interaction, PermissionFlagsBits.Administrator))
        return deny(interaction, "❌ لا تملك صلاحية Administrator.");

      const sub = interaction.options.getSubcommand();

      if (sub === "enable") {
        await pool.query(
          `INSERT INTO server_guard(guild_id, enabled)
           VALUES($1, TRUE)
           ON CONFLICT(guild_id)
           DO UPDATE SET enabled=TRUE`,
          [guild.id]
        );

        return interaction.editReply("🛡️ تم تفعيل حماية السيرفر.");
      }

      if (sub === "disable") {
        await pool.query(
          `INSERT INTO server_guard(guild_id, enabled)
           VALUES($1, FALSE)
           ON CONFLICT(guild_id)
           DO UPDATE SET enabled=FALSE`,
          [guild.id]
        );

        return interaction.editReply("🛡️ تم تعطيل حماية السيرفر.");
      }

      if (sub === "status") {
        const result = await pool.query(
          `SELECT enabled FROM server_guard WHERE guild_id=$1`,
          [guild.id]
        );

        const enabled = result.rows[0]?.enabled || false;

        return interaction.editReply(`🛡️ حماية السيرفر: ${enabled ? "🟢 مفعلة" : "🔴 معطلة"}`);
      }
    }

  } catch (error) {
    console.error("Error:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    } else if (interaction.deferred && !interaction.replied) {
      await interaction.editReply("❌ حدث خطأ أثناء تنفيذ الأمر.").catch(() => {});
    }
  }
});

// أحداث اللوقات
client.on("guildMemberAdd", async member => {
  await sendLog(
    member.guild,
    "member_join",
    "👋 عضو جديد",
    `👤 العضو: ${userText(member.user)}\n📅 تاريخ الإنضمام: ${new Date().toLocaleString()}`
  );
});

client.on("guildMemberRemove", async member => {
  await sendLog(
    member.guild,
    "member_leave",
    "👋 خروج عضو",
    `👤 العضو: ${userText(member.user)}`
  );
});

client.on("messageDelete", async message => {
  if (message.partial) return;
  if (!message.guild) return;

  const cached = messageCache.get(message.id);

  await sendLog(
    message.guild,
    "message_delete",
    "🗑️ حذف رسالة",
    `👤 المرسل: ${cached?.author || message.author || "غير معروف"}\n📍 الروم: ${message.channel}\n📝 المحتوى: ${limit(message.content || "بدون محتوى", 1000)}`
  );

  messageCache.delete(message.id);
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (oldMessage.partial || newMessage.partial) return;
  if (!oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    oldMessage.guild,
    "message_edit",
    "✏️ تعديل رسالة",
    `👤 المرسل: ${oldMessage.author || "غير معروف"}\n📍 الروم: ${oldMessage.channel}\n📝 قبل: ${limit(oldMessage.content || "بدون محتوى", 1000)}\n📝 بعد: ${limit(newMessage.content || "بدون محتوى", 1000)}`
  );
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.guild) return;

  cacheMessage(message);

  // التحقق من الاختصارات
  const shortcutResult = await pool.query(
    `SELECT response FROM shortcuts WHERE guild_id=$1 AND name=$2`,
    [message.guild.id, message.content.toLowerCase()]
  );

  if (shortcutResult.rows[0]) {
    await message.channel.send(shortcutResult.rows[0].response);
    return;
  }

  // التحقق من الردود التلقائية
  const autoResult = await pool.query(
    `SELECT response FROM autoreplies WHERE guild_id=$1 AND trigger=$2`,
    [message.guild.id, message.content.toLowerCase()]
  );

  if (autoResult.rows[0]) {
    await message.reply(autoResult.rows[0].response);
  }
});

client.on("ready", async () => {
  console.log(`✅ ${client.user.tag} جاهز!`);

  await setupDatabase();
  await registerCommands();

  client.user.setActivity(".v5d.", { type: ActivityType.Watching });
});

client.login(TOKEN);
