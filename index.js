const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { Pool } = require("pg");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// روم اللوق
const LOG_CHANNEL_ID = "1523668413505863762";

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ تأكد من DISCORD_TOKEN و CLIENT_ID في Railway");
  process.exit(1);
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================
   الأوامر
========================= */

const commands = [

  // BAN
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("إعدام / حظر عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // UNBAN
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // KICK
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  // TIMEOUT
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء Timeout")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName("minutes")
        .setDescription("المدة بالدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // UNTIMEOUT
  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // WARN
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("إعطاء تحذير")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // WARN LIST
  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // CLEAR
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // LOCK
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // UNLOCK
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // SLOWMODE
  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تفعيل Slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // ROLE
  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إعطاء أو إزالة رتبة")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addRoleOption(o =>
      o.setName("role")
        .setDescription("الرتبة")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("action")
        .setDescription("الإجراء")
        .setRequired(true)
        .addChoices(
          { name: "إعطاء", value: "add" },
          { name: "إزالة", value: "remove" }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // NICKNAME
  new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("تغيير اسم عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .addStringOption(o =>
      o.setName("name")
        .setDescription("الاسم الجديد")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  // INFO
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)),

  // SERVERINFO
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  // AVATAR
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)),

  // BANNER
  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)),

  // ROLES
  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("عرض رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)),

  // AUTOREPLY
  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")

    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رد")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true))
        .addStringOption(o =>
          o.setName("response")
            .setDescription("الرد")
            .setRequired(true)))

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف رد")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)))

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // LIST
  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  // SHORTCUT SET
  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")

    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إنشاء اختصار")
        .addStringOption(o =>
          o.setName("shortcut")
            .setDescription("مثال: قفل")
            .setRequired(true))
        .addStringOption(o =>
          o.setName("command")
            .setDescription("مثال: lock")
            .setRequired(true)))

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o =>
          o.setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)))

    .addSubcommand(s =>
      s.setName("list")
        .setDescription("عرض الاختصارات"))

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

].map(x => x.toJSON());


/* =========================
   LOG SYSTEM
========================= */

async function sendLog(guild, title, description) {

  const channel =
    guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Powered by .v5d."
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(() => {});
}


/* =========================
   DATABASE
========================= */

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

}


/* =========================
   READY
========================= */

client.once("ready", async () => {

  console.log(`✅ ${client.user.tag} Online`);

  try {

    await setupDatabase();

    const rest =
      new REST({ version: "10" })
        .setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log("✅ تم تسجيل جميع الأوامر");
    console.log("✅ PostgreSQL متصل");

  } catch (error) {

    console.error(
      "❌ خطأ:",
      error
    );

  }

});


/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // سيتم وضع تنفيذ الأوامر هنا في الجزء الثاني

  } catch (error) {

    console.error(error);

    if (!interaction.replied) {

      await interaction.reply({
        content: "❌ حدث خطأ.",
        ephemeral: true
      }).catch(() => {});

    }

  }

});


/* =========================
   AUTO REPLIES
========================= */

client.on("messageCreate", async message => {

  if (!message.guild || message.author.bot)
    return;

  const text =
    message.content
      .trim()
      .toLowerCase();

  if (!text) return;

  const result = await db.query(
    `
    SELECT response
    FROM autoreplies
    WHERE guild_id=$1
    AND LOWER(trigger)=LOWER($2)
    `,
    [
      message.guild.id,
      text
    ]
  ).catch(() => ({ rows: [] }));

  if (result.rows.length) {

    await message.reply(
      result.rows[0].response
    ).catch(() => {});

  }

});


/* =========================
   MESSAGE LOGS
========================= */

client.on("messageDelete", async message => {

  if (!message.guild) return;
  if (message.author?.bot) return;

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${message.author || "غير معروف"}\n` +
    `**الروم:** ${message.channel}\n` +
    `**المحتوى:** ${message.content || "غير معروف"}`
  );

});


client.on("messageUpdate", async (oldMessage, newMessage) => {

  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;

  if (
    oldMessage.content ===
    newMessage.content
  ) return;

  await sendLog(
    oldMessage.guild,
    "✏️ تعديل رسالة",
    `**العضو:** ${oldMessage.author}\n` +
    `**الروم:** ${oldMessage.channel}\n\n` +
    `**قبل:** ${oldMessage.content || "فارغة"}\n` +
    `**بعد:** ${newMessage.content || "فارغة"}`
  );

});


/* =========================
   MEMBER LOGS
========================= */

client.on("guildMemberAdd", async member => {

  await sendLog(
    member.guild,
    "📥 دخول عضو",
    `**العضو:** ${member}\n` +
    `**ID:** \`${member.id}\``
  );

});


client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user.username}\n` +
    `**ID:** \`${member.id}\``
  );

});


/* =========================
   SHORTCUTS
========================= */

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const text = message.content.trim().toLowerCase();

  if (!text) return;

  const result = await db.query(
    `SELECT command FROM shortcuts
     WHERE guild_id=$1 AND LOWER(shortcut)=LOWER($2)`,
    [message.guild.id, text]
  ).catch(() => ({ rows: [] }));

  if (!result.rows.length) return;

  const command = result.rows[0].command;

  /*
    الاختصارات هنا ترسل رسالة للبوت.
    مثال:
    قفل -> lock
    فتح -> unlock
    طرد -> kick
    حظر -> ban
    تحذير -> warn
  */

  const allowed = [
    "lock",
    "unlock",
    "kick",
    "ban",
    "warn",
    "clear",
    "slowmode",
    "unban",
    "untimeout"
  ];

  if (!allowed.includes(command)) return;

  /*
    ملاحظة:
    Discord لا يسمح بتحويل رسالة عادية مباشرة إلى Slash Command
    باسم المستخدم، لذلك نستخدم نظام اختصارات داخلي.
  */

  if (command === "lock") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )
    ) return;

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false }
    );

    await message.channel.send("🔒 تم قفل الروم.");

    await sendLog(
      message.guild,
      "🔒 Lock",
      `**الروم:** ${message.channel}\n` +
      `**بواسطة:** ${message.author}`
    );

    return;
  }

  if (command === "unlock") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )
    ) return;

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: true }
    );

    await message.channel.send("🔓 تم فتح الروم.");

    await sendLog(
      message.guild,
      "🔓 Unlock",
      `**الروم:** ${message.channel}\n` +
      `**بواسطة:** ${message.author}`
    );

    return;
  }

  if (command === "kick") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.KickMembers
      )
    ) return;

    await message.channel.send(
      "❌ لا يمكن استخدام Kick بالاختصار بدون تحديد العضو.\n" +
      "استخدم `/kick`."
    );

    return;
  }

  if (command === "ban") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.BanMembers
      )
    ) return;

    await message.channel.send(
      "❌ لا يمكن استخدام Ban بالاختصار بدون تحديد العضو والسبب.\n" +
      "استخدم `/ban`."
    );

    return;
  }

  if (command === "warn") {
    if (
      !message.member.permissions.has(
        PermissionFlagsBits.ModerateMembers
      )
    ) return;

    await message.channel.send(
      "❌ لا يمكن استخدام Warn بالاختصار بدون تحديد العضو والسبب.\n" +
      "استخدم `/warn`."
    );

    return;
  }

});


/* =========================
   ROLE UPDATE LOG
========================= */

client.on(
  "guildMemberUpdate",
  async (oldMember, newMember) => {

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(
      role => !oldRoles.has(role.id)
    );

    const removedRoles = oldRoles.filter(
      role => !newRoles.has(role.id)
    );

    for (const role of addedRoles.values()) {

      await sendLog(
        newMember.guild,
        "🎭 إضافة رتبة",
        `**العضو:** ${newMember}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID العضو:** \`${newMember.id}\``
      );

    }

    for (const role of removedRoles.values()) {

      await sendLog(
        newMember.guild,
        "🎭 إزالة رتبة",
        `**العضو:** ${newMember}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID العضو:** \`${newMember.id}\``
      );

    }

  }
);


/* =========================
   CHANNEL LOCK LOG
========================= */

client.on(
  "channelUpdate",
  async (oldChannel, newChannel) => {

    if (!newChannel.guild) return;

    if (
      oldChannel.rateLimitPerUser !==
      newChannel.rateLimitPerUser
    ) {

      await sendLog(
        newChannel.guild,
        "🐌 تغيير Slowmode",
        `**الروم:** ${newChannel}\n` +
        `**قبل:** ${oldChannel.rateLimitPerUser || 0} ثانية\n` +
        `**بعد:** ${newChannel.rateLimitPerUser || 0} ثانية`
      );

    }

  }
);


/* =========================
   BOT ERROR HANDLING
========================= */

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});


console.log("🚀 Starting bot...");
