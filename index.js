const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const LOG_CHANNEL_ID = "1523668413505863762";

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN غير موجود");
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error("❌ CLIENT_ID غير موجود");
  process.exit(1);
}

if (!GUILD_ID) {
  console.error("❌ GUILD_ID غير موجود");
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
    GatewayIntentBits.MessageContent
  ]
});

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  /* ================= ADMIN ================= */

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("إعدام / حظر عضو")
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
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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
        .setDescription("المدة بالدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(o =>
      o.setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(o =>
      o.setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تفعيل Slowmode")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

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
          { name: "إضافة", value: "add" },
          { name: "إزالة", value: "remove" }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

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

  /* ================= INFO ================= */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
    ),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
    ),

  /* ================= AUTOREPLY ================= */

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* ================= SHORTCUT ================= */

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")
    .addSubcommand(s =>
      s.setName("set")
        .setDescription("إنشاء اختصار")
        .addStringOption(o =>
          o.setName("shortcut")
            .setDescription("مثال: قفل")
            .setRequired(true)
        )
        .addStringOption(o =>
          o.setName("command")
            .setDescription("مثال: lock")
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
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  /* ================= EXTRA ================= */

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت"),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

].map(c => c.toJSON());

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

  console.log("✅ PostgreSQL جاهز");
}

/* =========================================================
   LOG SYSTEM
========================================================= */

async function sendLog(guild, title, description) {

  if (!guild) return;

  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) {
    console.log("❌ روم اللوق غير موجود:", LOG_CHANNEL_ID);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: ".v5d. • Logs"
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(error => {
    console.error("❌ فشل إرسال اللوق:", error);
  });
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {

  console.log("=================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🟢 BOT ONLINE");
  console.log(`🏠 GUILD: ${GUILD_ID}`);
  console.log(`📋 COMMANDS: ${commands.length}`);
  console.log("=================================");

  try {

    await setupDatabase();

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    /* حذف Global القديمة */

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: []
      }
    );

    console.log("🧹 Global commands deleted");

    /* تسجيل أوامر السيرفر */

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      `✅ تم تسجيل ${commands.length} أمر داخل السيرفر`
    );

    console.log("🚀 البوت جاهز");

  } catch (error) {

    console.error("❌ خطأ:");
    console.error(error);

  }

});

/* =========================================================
   MESSAGE LOGS
========================================================= */

client.on("messageDelete", async message => {

  if (!message.guild) return;

  if (message.author?.bot) return;

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${message.author || "غير معروف"}\n` +
    `**الروم:** ${message.channel}\n` +
    `**الرسالة:** ${message.content || "لا يوجد محتوى"}`
  );

});

client.on("messageUpdate", async (oldMessage, newMessage) => {

  if (!oldMessage.guild) return;

  if (oldMessage.author?.bot) return;

  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    oldMessage.guild,
    "✏️ تعديل رسالة",
    `**العضو:** ${oldMessage.author || "غير معروف"}\n` +
    `**الروم:** ${oldMessage.channel}\n\n` +
    `**قبل:** ${oldMessage.content || "فارغ"}\n` +
    `**بعد:** ${newMessage.content || "فارغ"}`
  );

});

/* =========================================================
   MEMBER JOIN
========================================================= */

client.on("guildMemberAdd", async member => {

  await sendLog(
    member.guild,
    "📥 دخول عضو",
    `**العضو:** ${member.user}\n` +
    `**ID:** \`${member.id}\``
  );

});

/* =========================================================
   MEMBER LEAVE
========================================================= */

client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user.tag}\n` +
    `**ID:** \`${member.id}\``
  );

});

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on("roleUpdate", async (oldRole, newRole) => {

  if (oldRole.name === newRole.name &&
      oldRole.permissions.bitfield === newRole.permissions.bitfield) {
    return;
  }

  await sendLog(
    newRole.guild,
    "🎭 تغيير رتبة",
    `**الرتبة:** ${newRole}\n` +
    `**الاسم السابق:** ${oldRole.name}\n` +
    `**الاسم الجديد:** ${newRole.name}`
  );

});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    /* ================= LOG TEST ================= */

    if (interaction.commandName === "logs") {

      await sendLog(
        interaction.guild,
        "📋 اختبار اللوق",
        `تم اختبار نظام اللوق بنجاح.\n\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**الروم:** ${interaction.channel}\n` +
        `**السيرفر:** ${interaction.guild.name}`
      );

      return interaction.reply({
        content: "✅ تم إرسال رسالة اختبار إلى روم اللوق.",
        ephemeral: true
      });

    }

    /* ================= ME ================= */

    if (interaction.commandName === "me") {

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🤖 معلومات البوت")
            .setDescription(
              `**البوت:** ${client.user}\n` +
              `**الأوامر:** ${commands.length}\n` +
              `**الحالة:** 🟢 Online`
            )
        ]
      });

    }

    /* ================= BAN ================= */

    if (interaction.commandName === "ban") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member || !member.bannable) {
        return interaction.reply({
          content: "❌ لا أستطيع حظر هذا العضو.",
          ephemeral: true
        });
      }

      await member.ban({ reason });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔨 تم الإعدام")
        .setDescription(
          `تم إعدام المعدوم ${user}\n\n` +
          `من قبل ${interaction.user}\n\n` +
          `**السبب:** ${reason}`
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

      await sendLog(
        interaction.guild,
        "🔨 Ban / إعدام",
        `**المعدوم:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ================= UNBAN ================= */

    if (interaction.commandName === "unban") {

      const id = interaction.options.getString("userid");

      await interaction.guild.members.unban(id);

      await interaction.reply(
        `🔓 تم فك الحظر عن <@${id}>`
      );

      await sendLog(
        interaction.guild,
        "🔓 Unban",
        `**ID:** \`${id}\`\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ================= KICK ================= */

    if (interaction.commandName === "kick") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member || !member.kickable) {
        return interaction.reply({
          content: "❌ لا أستطيع طرد هذا العضو.",
          ephemeral: true
        });
      }

      await member.kick(reason);

      await interaction.reply(
        `👢 تم طرد ${user}\n**السبب:** ${reason}`
      );

      await sendLog(
        interaction.guild,
        "👢 Kick",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ================= TIMEOUT ================= */

    if (interaction.commandName === "timeout") {

      const user = interaction.options.getUser("member");
      const minutes = interaction.options.getInteger("minutes");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member || !member.moderatable) {
        return interaction.reply({
          content: "❌ لا أستطيع إعطاء Timeout.",
          ephemeral: true
        });
      }

      await member.timeout(
        minutes * 60 * 1000,
        reason
      );

      await interaction.reply(
        `⏳ تم إعطاء ${user} Timeout لمدة **${minutes} دقيقة**.\n` +
        `**السبب:** ${reason}`
      );

      await sendLog(
        interaction.guild,
        "⏳ Timeout",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**المدة:** ${minutes} دقيقة\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ================= UNTIMEOUT ================= */

    if (interaction.commandName === "untimeout") {

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

      await interaction.reply(
        `✅ تم إزالة Timeout عن ${user}`
      );

      await sendLog(
        interaction.guild,
        "✅ Untimeout",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= WARN ================= */

    if (interaction.commandName === "warn") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

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

      const result = await db.query(
        `
        SELECT COUNT(*) AS count
        FROM warns
        WHERE guild_id=$1 AND user_id=$2
        `,
        [
          interaction.guildId,
          user.id
        ]
      );

      const number = result.rows[0].count;

      await interaction.reply(
        `⚠️ تم تحذير ${user}\n**السبب:** ${reason}\n**رقم التحذير:** #${number}`
      );

      await sendLog(
        interaction.guild,
        "⚠️ Warn",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${number}`
      );

      return;
    }

    /* ================= WARNLIST ================= */

    if (interaction.commandName === "warnlist") {

      const result = await db.query(
        `
        SELECT *
        FROM warns
        WHERE guild_id=$1
        ORDER BY created_at DESC
        LIMIT 25
        `,
        [interaction.guildId]
      );

      if (!result.rows.length) {
        return interaction.reply("✅ لا توجد تحذيرات.");
      }

      const text = result.rows.map((w, i) =>
        `**${i + 1}.** <@${w.user_id}>\n` +
        `السبب: ${w.reason}\n` +
        `بواسطة: <@${w.moderator_id}>`
      ).join("\n\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ Warn List")
            .setDescription(text)
        ]
      });

    }

    /* ================= CLEAR ================= */

    if (interaction.commandName === "clear") {

      const amount = interaction.options.getInteger("amount");

      await interaction.channel.bulkDelete(amount, true);

      await interaction.reply({
        content: `🧹 تم مسح **${amount}** رسالة.`,
        ephemeral: true
      });

      await sendLog(
        interaction.guild,
        "🧹 حذف رسائل",
        `**الروم:** ${interaction.channel}\n` +
        `**العدد:** ${amount}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= LOCK / UNLOCK ================= */

    if (
      interaction.commandName === "lock" ||
      interaction.commandName === "unlock"
    ) {

      const lock = interaction.commandName === "lock";

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: !lock
        }
      );

      await interaction.reply(
        lock
          ? "🔒 تم قفل الروم."
          : "🔓 تم فتح الروم."
      );

      await sendLog(
        interaction.guild,
        lock ? "🔒 Lock" : "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= SLOWMODE ================= */

    if (interaction.commandName === "slowmode") {

      const seconds =
        interaction.options.getInteger("seconds");

      await interaction.channel.setRateLimitPerUser(seconds);

      await interaction.reply(
        seconds === 0
          ? "✅ تم إلغاء Slowmode."
          : `🐌 تم تفعيل Slowmode لمدة **${seconds} ثانية**.`
      );

      return;
    }

    /* ================= ROLE ================= */

    if (interaction.commandName === "role") {

      const user = interaction.options.getUser("member");
      const role = interaction.options.getRole("role");
      const action = interaction.options.getString("action");

      const member =
        await interaction.guild.members.fetch(user.id);

      if (action === "add") {
        await member.roles.add(role);
      } else {
        await member.roles.remove(role);
      }

      await interaction.reply(
        action === "add"
          ? `✅ تم إعطاء ${user} رتبة ${role}.`
          : `✅ تم إزالة رتبة ${role} من ${user}.`
      );

      await sendLog(
        interaction.guild,
        "🎭 تغيير رتبة",
        `**العضو:** ${user}\n` +
        `**الرتبة:** ${role}\n` +
        `**الإجراء:** ${action === "add" ? "إضافة" : "إزالة"}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= NICKNAME ================= */

    if (interaction.commandName === "nickname") {

      const user = interaction.options.getUser("member");
      const name = interaction.options.getString("name");

      const member =
        await interaction.guild.members.fetch(user.id);

      await member.setNickname(name);

      await interaction.reply(
        `✏️ تم تغيير اسم ${user} إلى **${name}**.`
      );

      return;
    }

    /* ================= INFO ================= */

    if (interaction.commandName === "info") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("👤 معلومات العضو")
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
              `**العضو:** ${user}\n` +
              `**ID:** \`${user.id}\`\n` +
              `**الحساب:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>`
            )
        ]
      });

    }

    /* ================= SERVERINFO ================= */

    if (interaction.commandName === "serverinfo") {

      const guild = interaction.guild;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("🏠 معلومات السيرفر")
            .setDescription(
              `**الاسم:** ${guild.name}\n` +
              `**ID:** \`${guild.id}\`\n` +
              `**الأعضاء:** ${guild.memberCount}\n` +
              `**الرومات:** ${guild.channels.cache.size}\n` +
              `**الرتب:** ${guild.roles.cache.size}`
            )
        ]
      });

    }

    /* ================= AVATAR ================= */

    if (interaction.commandName === "avatar") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🖼️ Avatar - ${user.username}`)
            .setImage(
              user.displayAvatarURL({
                size: 1024
              })
            )
        ]
      });

    }

    /* ================= BANNER ================= */

    if (interaction.commandName === "banner") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const fullUser =
        await client.users.fetch(user.id, {
          force: true
        });

      if (!fullUser.banner) {
        return interaction.reply(
          "❌ هذا العضو ليس لديه Banner."
        );
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🎨 Banner - ${user.username}`)
            .setImage(
              fullUser.bannerURL({
                size: 1024
              })
            )
        ]
      });

    }

    /* ================= ROLES ================= */

    if (interaction.commandName === "roles") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members.fetch(user.id);

      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guild.id)
        .map(r => r.toString())
        .join(" ");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🎭 رتب ${user.username}`)
            .setDescription(
              roles || "لا توجد رتب."
            )
        ]
      });

    }

    /* ================= AUTOREPLY ================= */

    if (interaction.commandName === "autoreply") {

      const sub = interaction.options.getSubcommand();

      if (sub === "add") {

        const trigger =
          interaction.options.getString("trigger");

        const response =
          interaction.options.getString("response");

        await db.query(
          `
          INSERT INTO autoreplies
          (guild_id,trigger,response)
          VALUES ($1,$2,$3)
          ON CONFLICT (guild_id,trigger)
          DO UPDATE SET response=EXCLUDED.response
          `,
          [
            interaction.guildId,
            trigger.toLowerCase(),
            response
          ]
        );

        return interaction.reply(
          `✅ تم إضافة الرد التلقائي:\n**${trigger}** → ${response}`
        );
      }

      if (sub === "remove") {

        const trigger =
          interaction.options.getString("trigger");

        await db.query(
          `
          DELETE FROM autoreplies
          WHERE guild_id=$1 AND trigger=$2
          `,
          [
            interaction.guildId,
            trigger.toLowerCase()
          ]
        );

        return interaction.reply(
          `🗑️ تم حذف الرد التلقائي **${trigger}**.`
        );
      }

    }

    /* ================= LIST ================= */

    if (interaction.commandName === "list") {

      const result = await db.query(
        `
        SELECT trigger,response
        FROM autoreplies
        WHERE guild_id=$1
        ORDER BY trigger
        `,
        [interaction.guildId]
      );

      if (!result.rows.length) {
        return interaction.reply(
          "📭 لا توجد ردود تلقائية."
        );
      }

      const text = result.rows.map(
        r => `**${r.trigger}** → ${r.response}`
      ).join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("🤖 الردود التلقائية")
            .setDescription(text)
        ]
      });

    }

    /* ================= SHORTCUT ================= */

    if (interaction.commandName === "shortcut") {

      const sub = interaction.options.getSubcommand();

      if (sub === "set") {

        const shortcut =
          interaction.options.getString("shortcut");

        const command =
          interaction.options.getString("command");

        await db.query(
          `
          INSERT INTO shortcuts
          (guild_id,shortcut,command)
          VALUES ($1,$2,$3)
          ON CONFLICT (guild_id,shortcut)
          DO UPDATE SET command=EXCLUDED.command
          `,
          [
            interaction.guildId,
            shortcut.toLowerCase(),
            command.toLowerCase()
          ]
        );

        return interaction.reply(
          `✅ تم إنشاء الاختصار:\n**${shortcut}** → \`/${command}\``
        );
      }

      if (sub === "remove") {

        const shortcut =
          interaction.options.getString("shortcut");

        await db.query(
          `
          DELETE FROM shortcuts
          WHERE guild_id=$1 AND shortcut=$2
          `,
          [
            interaction.guildId,
            shortcut.toLowerCase()
          ]
        );

        return interaction.reply(
          `🗑️ تم حذف الاختصار **${shortcut}**.`
        );
      }

      if (sub === "list") {

        const result = await db.query(
          `
          SELECT shortcut,command
          FROM shortcuts
          WHERE guild_id=$1
          ORDER BY shortcut
          `,
          [interaction.guildId]
        );

        if (!result.rows.length) {
          return interaction.reply(
            "📭 لا توجد اختصارات."
          );
        }

        const text = result.rows.map(
          r => `**${r.shortcut}** → \`/${r.command}\``
        ).join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle("🔗 الاختصارات")
              .setDescription(text)
          ]
        });
      }

    }

  } catch (error) {

    console.error("❌ Interaction Error:", error);

    if (interaction.replied || interaction.deferred) {

      await interaction.followUp({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    } else {

      await interaction.reply({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    }

  }

});

/* =========================================================
   AUTO REPLY + SHORTCUTS
========================================================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();

  /* ================= AUTOREPLY ================= */

  const auto = await db.query(
    `
    SELECT response
    FROM autoreplies
    WHERE guild_id=$1 AND trigger=$2
    LIMIT 1
    `,
    [
      message.guild.id,
      content
    ]
  ).catch(() => null);

  if (auto && auto.rows.length) {

    await message.reply(
      auto.rows[0].response
    ).catch(() => {});

    return;
  }

  /* ================= SHORTCUT ================= */

  const shortcut = await db.query(
    `
    SELECT command
    FROM shortcuts
    WHERE guild_id=$1 AND shortcut=$2
    LIMIT 1
    `,
    [
      message.guild.id,
      content
    ]
  ).catch(() => null);

  if (!shortcut || !shortcut.rows.length) return;

  const command = shortcut.rows[0].command;

  const fake = {
    lock: "🔒 الاختصار يشير إلى /lock",
    unlock: "🔓 الاختصار يشير إلى /unlock",
    kick: "👢 الاختصار يشير إلى /kick",
    ban: "🔨 الاختصار يشير إلى /ban",
    warn: "⚠️ الاختصار يشير إلى /warn"
  };

  if (fake[command]) {

    await message.reply(
      fake[command]
    ).catch(() => {});

  }

});

/* =========================================================
   LOGIN
========================================================= */

client.login(TOKEN)
  .then(() => {
    console.log("🔐 تسجيل الدخول إلى Discord...");
  })
  .catch(error => {
    console.error("❌ فشل تسجيل الدخول:", error);
  });
