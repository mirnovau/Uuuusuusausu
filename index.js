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

/* =========================
   CONFIG
========================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// روم اللوق الذي أعطيتني إياه
const LOG_CHANNEL_ID = "1523668413505863762";

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ أضف DISCORD_TOKEN و CLIENT_ID في Railway Variables");
  process.exit(1);
}

/* =========================
   DATABASE
========================= */

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =========================
   CLIENT
========================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =========================
   SLASH COMMANDS
========================= */

const commands = [

  /* ===== الإدارة ===== */

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

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o.setName("userid")
        .setDescription("ID العضو")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

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

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء تايم أوت")
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

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض جميع التحذيرات")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
    .setDescription("تفعيل السلو مود")
    .addIntegerOption(o =>
      o.setName("seconds")
        .setDescription("عدد الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة")
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
          { name: "إضافة", value: "add" },
          { name: "إزالة", value: "remove" }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

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

  /* ===== المعلومات ===== */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")),

  /* ===== الردود ===== */

  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")
    .addSubcommand(s =>
      s.setName("add")
        .setDescription("إضافة رد تلقائي")
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
        .setDescription("حذف رد تلقائي")
        .addStringOption(o =>
          o.setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* ===== الاختصارات ===== */

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

  /* ===== إضافية ===== */

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات عن البوت"),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار نظام اللوق")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

].map(command => command.toJSON());

/* =========================
   DATABASE SETUP
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

  console.log("✅ PostgreSQL جاهز");
}

/* =========================
   LOG FUNCTION
========================= */

async function sendLog(guild, title, description) {

  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) {
    console.log("⚠️ روم اللوق غير موجود");
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: ".v5d." })
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(console.error);
}

/* =========================
   READY
========================= */

client.once("ready", async () => {

  console.log(`✅ ${client.user.tag} Online`);

  try {

    await setupDatabase();

    const rest = new REST({ version: "10" })
      .setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(`✅ تم تسجيل ${commands.length} أمر`);
    console.log("🚀 البوت يعمل");

  } catch (error) {

    console.error("❌ خطأ أثناء التشغيل:", error);

  }

});

/* =========================
   INTERACTIONS
========================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    /* ===== ME ===== */

    if (interaction.commandName === "me") {

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🤖 معلومات البوت")
            .setDescription(
              "بوت إدارة متكامل\n\n" +
              "السيرفر: **MR NOVA**\n" +
              "Powered by **.v5d.**"
            )
        ]
      });

    }

    /* ===== LOGS ===== */

    if (interaction.commandName === "logs") {

      await sendLog(
        interaction.guild,
        "📋 اختبار اللوق",
        `تم اختبار نظام اللوق بواسطة ${interaction.user}`
      );

      return interaction.reply({
        content: "✅ تم إرسال اختبار اللوق.",
        ephemeral: true
      });

    }

    /* ===== BAN ===== */

    if (interaction.commandName === "ban") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member || !member.bannable) {
        return interaction.reply({
          content: "❌ لا أستطيع إعدام هذا العضو.",
          ephemeral: true
        });
      }

      await member.ban({ reason });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔨 تم الإعدام")
        .setDescription(
          `تم اعدام المعدوم ${user}\n\n` +
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
        "🔨 إعدام / Ban",
        `**المعدوم:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ===== UNBAN ===== */

    if (interaction.commandName === "unban") {

      const id = interaction.options.getString("userid");

      await interaction.guild.members.unban(id);

      await interaction.reply(
        `🔓 تم فك الحظر عن <@${id}>.`
      );

      await sendLog(
        interaction.guild,
        "🔓 Unban",
        `**ID:** \`${id}\`\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ===== KICK ===== */

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
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ===== TIMEOUT ===== */

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

      await member.timeout(minutes * 60 * 1000, reason);

      await interaction.reply(
        `⏳ تم إعطاء ${user} Timeout لمدة **${minutes} دقيقة**.\n` +
        `**السبب:** ${reason}`
      );

      await sendLog(
        interaction.guild,
        "⏳ Timeout",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**المدة:** ${minutes} دقيقة\n` +
        `**السبب:** ${reason}`
      );

      return;
    }

    /* ===== UNTIMEOUT ===== */

    if (interaction.commandName === "untimeout") {

      const user = interaction.options.getUser("member");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        return interaction.reply("❌ العضو غير موجود.");
      }

      await member.timeout(null);

      await interaction.reply(
        `✅ تم إزالة Timeout عن ${user}.`
      );

      await sendLog(
        interaction.guild,
        "✅ Untimeout",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ===== WARN ===== */

    if (interaction.commandName === "warn") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      await db.query(
        `INSERT INTO warns
        (guild_id,user_id,moderator_id,reason)
        VALUES ($1,$2,$3,$4)`,
        [
          interaction.guildId,
          user.id,
          interaction.user.id,
          reason
        ]
      );

      const count = await db.query(
        `SELECT COUNT(*) FROM warns
         WHERE guild_id=$1 AND user_id=$2`,
        [
          interaction.guildId,
          user.id
        ]
      );

      const warnNumber = count.rows[0].count;

      await interaction.reply(
        `⚠️ تم إعطاء ${user} تحذير.\n**السبب:** ${reason}`
      );

      await user.send(
        `⚠️ **لقد تم إعطاءك تحذير**\n\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**السيرفر:** ${interaction.guild.name}\n` +
        `**رقم التحذير:** #${warnNumber}`
      ).catch(() => {});

      await sendLog(
        interaction.guild,
        "⚠️ Warn",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${warnNumber}`
      );

      return;
    }

    /* ===== WARNLIST ===== */

    if (interaction.commandName === "warnlist") {

      const result = await db.query(
        `SELECT * FROM warns
         WHERE guild_id=$1
         ORDER BY created_at DESC`,
        [interaction.guildId]
      );

      if (!result.rows.length) {
        return interaction.reply("✅ لا توجد تحذيرات.");
      }

      const text = result.rows
        .slice(0, 25)
        .map((w, i) =>
          `**${i + 1}.** <@${w.user_id}>\n` +
          `السبب: ${w.reason}\n` +
          `بواسطة: <@${w.moderator_id}>`
        )
        .join("\n\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ Warn List")
            .setDescription(text)
        ]
      });

    }

    /* ===== CLEAR ===== */

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
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ===== LOCK / UNLOCK ===== */

    if (
      interaction.commandName === "lock" ||
      interaction.commandName === "unlock"
    ) {

      const locked = interaction.commandName === "lock";

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
        locked ? "🔒 Lock" : "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ===== SLOWMODE ===== */

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

    /* ===== ROLE ===== */

    if (interaction.commandName === "role") {

      const user = interaction.options.getUser("member");
      const role = interaction.options.getRole("role");
      const action = interaction.options.getString("action");

      const member =
        await interaction.guild.members.fetch(user.id);

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
        "🎭 تغيير رتبة",
        `**العضو:** ${user}\n` +
        `**الرتبة:** ${role}\n` +
        `**الإجراء:** ${action === "add" ? "إضافة" : "إزالة"}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }

    /* ===== NICKNAME ===== */

    if (interaction.commandName === "nickname") {

      const user = interaction.options.getUser("member")
