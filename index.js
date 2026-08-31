const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType
} = require("discord.js");

const { Pool } = require("pg");

/* =========================================================
   CONFIG
========================================================= */

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const LOG_CHANNEL_ID = "1523668413505863762";

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
    GatewayIntentBits.MessageContent
  ]
});

/* =========================================================
   COMMANDS
========================================================= */

const commands = [

  /* =========================
     🛡️ الإدارة
  ========================= */

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
    .addUserOption(o =>
      o.setName("member")
        .setDescription("عضو محدد")
        .setRequired(false)
    )
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
          {
            name: "إضافة",
            value: "add"
          },
          {
            name: "إزالة",
            value: "remove"
          }
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

  /* =========================
     👤 المعلومات
  ========================= */

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
    .setDescription("صورة العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =========================
     🤖 AutoReply
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
    )

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* =========================
     🔗 Shortcuts
  ========================= */

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

  /* =========================
     إضافية
  ========================= */

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("فحص سرعة البوت"),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("عرض أوامر البوت"),

  new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("مدة تشغيل البوت"),

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت"),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

].map(command => command.toJSON());

console.log(`📦 عدد أوامر Slash: ${commands.length}`);

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
   LOG
========================================================= */

async function sendLog(guild, title, description, color = 0xF1C40F) {

  if (!guild) return;

  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) {
    console.log(
      `⚠️ لم أجد روم اللوق في: ${guild.name}`
    );
    return;
  }

  if (!channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: ".v5d."
    })
    .setTimestamp();

  await channel.send({
    embeds: [embed]
  }).catch(error => {
    console.error("❌ فشل إرسال اللوق:", error.message);
  });
}

/* =========================================================
   REGISTER COMMANDS
========================================================= */

async function registerCommands() {

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  console.log("🧹 حذف Global Commands القديمة...");

  try {

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: []
      }
    );

    console.log("✅ تم حذف Global Commands القديمة");

  } catch (error) {

    console.error(
      "⚠️ تعذر حذف Global Commands:",
      error.message
    );

  }

  console.log(
    `📡 عدد السيرفرات التي دخلها البوت: ${client.guilds.cache.size}`
  );

  for (const guild of client.guilds.cache.values()) {

    try {

      await guild.commands.set(commands);

      console.log(
        `✅ ${guild.name} | ${commands.length} أمر`
      );

    } catch (error) {

      console.error(
        `❌ فشل تسجيل الأوامر في ${guild.name}:`,
        error.message
      );

    }

  }

}

/* =========================================================
   GUILD CREATE
========================================================= */

client.on("guildCreate", async guild => {

  console.log(
    `➕ دخلت سيرفر جديد: ${guild.name}`
  );

  try {

    await guild.commands.set(commands);

    console.log(
      `✅ تم تسجيل ${commands.length} أمر في ${guild.name}`
    );

  } catch (error) {

    console.error(
      "❌ فشل تسجيل أوامر السيرفر الجديد:",
      error
    );

  }

});

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {

  console.log("======================================");
  console.log(`🤖 البوت: ${client.user.tag}`);
  console.log("🟢 الحالة: Online");
  console.log(`🏠 السيرفرات: ${client.guilds.cache.size}`);
  console.log(`📦 الأوامر: ${commands.length}`);
  console.log("======================================");

  try {

    await setupDatabase();

    await registerCommands();

    console.log("🚀 البوت جاهز بالكامل");

  } catch (error) {

    console.error(
      "❌ خطأ أثناء تشغيل البوت:",
      error
    );

  }

});

/* =========================================================
   MESSAGE CREATE
   AutoReply + Shortcuts
========================================================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;

  if (message.author.bot) return;

  const content = message.content.trim();

  if (!content) return;

  /* =========================
     AutoReply
  ========================= */

  try {

    const result = await db.query(
      `
      SELECT response
      FROM autoreplies
      WHERE guild_id = $1
      AND LOWER(trigger) = LOWER($2)
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

      return;
    }

  } catch (error) {

    console.error(
      "❌ AutoReply DB Error:",
      error.message
    );

  }

  /* =========================
     Shortcuts
  ========================= */

  try {

    const result = await db.query(
      `
      SELECT command
      FROM shortcuts
      WHERE guild_id = $1
      AND LOWER(shortcut) = LOWER($2)
      LIMIT 1
      `,
      [
        message.guild.id,
        content
      ]
    );

    if (!result.rows.length) return;

    const command = result.rows[0].command.toLowerCase();

    /* =========================
       LOCK
    ========================= */

    if (command === "lock") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels
        )
      ) return;

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      await message.reply("🔒 تم قفل الروم.");

      await sendLog(
        message.guild,
        "🔒 Lock",
        `**الروم:** ${message.channel}\n` +
        `**بواسطة:** ${message.author}`,
        0xE74C3C
      );

      return;
    }

    /* =========================
       UNLOCK
    ========================= */

    if (command === "unlock") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels
        )
      ) return;

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: true
        }
      );

      await message.reply("🔓 تم فتح الروم.");

      await sendLog(
        message.guild,
        "🔓 Unlock",
        `**الروم:** ${message.channel}\n` +
        `**بواسطة:** ${message.author}`,
        0x2ECC71
      );

      return;
    }

    /* =========================
       COMMANDS WITHOUT ARGUMENTS
    ========================= */

    if (
      command === "serverinfo" ||
      command === "help" ||
      command === "ping"
    ) {

      await message.reply(
        `🔗 الاختصار مربوط بالأمر: \`/${command}\``
      );

      return;
    }

    /* =========================
       COMMANDS NEED ARGUMENTS
    ========================= */

    await message.reply(
      `ℹ️ الاختصار مربوط بـ \`/${command}\`، لكن هذا الأمر يحتاج خيارات مثل العضو أو السبب. استخدم الأمر من قائمة Slash.`
    );

  } catch (error) {

    console.error(
      "❌ Shortcut Error:",
      error.message
    );

  }

});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    const command = interaction.commandName;

    /* =====================================================
       PING
    ===================================================== */

    if (command === "ping") {

      return interaction.reply(
        `🏓 Pong!\nLatency: **${client.ws.ping}ms**`
      );

    }

    /* =====================================================
       HELP
    ===================================================== */

    if (command === "help") {

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("📚 قائمة أوامر البوت")
        .addFields(

          {
            name: "🛡️ الإدارة",
            value:
              "`/ban` `/unban` `/kick`\n" +
              "`/timeout` `/untimeout` `/warn`\n" +
              "`/warnlist` `/clear` `/lock`\n" +
              "`/unlock` `/slowmode` `/role` `/nickname`"
          },

          {
            name: "👤 المعلومات",
            value:
              "`/info` `/serverinfo` `/avatar`\n" +
              "`/banner` `/roles`"
          },

          {
            name: "🤖 الردود",
            value:
              "`/autoreply add`\n" +
              "`/autoreply remove`\n" +
              "`/list`"
          },

          {
            name: "🔗 الاختصارات",
            value:
              "`/shortcut set`\n" +
              "`/shortcut remove`\n" +
              "`/shortcut list`"
          },

          {
            name: "⚙️ أخرى",
            value:
              "`/ping` `/uptime` `/me` `/logs`"
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

    /* =====================================================
       UPTIME
    ===================================================== */

    if (command === "uptime") {

      const totalSeconds =
        Math.floor(process.uptime());

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

      return interaction.reply(
        `⏱️ مدة تشغيل البوت:\n` +
        `**${days} يوم / ${hours} ساعة / ${minutes} دقيقة / ${seconds} ثانية**`
      );

    }

    /* =====================================================
       ME
    ===================================================== */

    if (command === "me") {

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🤖 معلومات البوت")
            .setDescription(
              `**البوت:** ${client.user}\n` +
              `**السيرفر:** ${interaction.guild.name}\n` +
              `**عدد الأوامر:** ${commands.length}\n` +
              `**السيرفرات:** ${client.guilds.cache.size}\n\n` +
              `Powered by **.v5d.**`
            )
            .setTimestamp()

        ]

      });

    }

    /* =====================================================
       LOG TEST
    ===================================================== */

    if (command === "logs") {

      await sendLog(
        interaction.guild,
        "📋 اختبار اللوق",
        `تم اختبار نظام اللوق بواسطة ${interaction.user}`,
        0xF1C40F
      );

      return interaction.reply({
        content: "✅ تم إرسال اختبار اللوق.",
        ephemeral: true
      });

    }

    /* =====================================================
       BAN
    ===================================================== */

    if (command === "ban") {

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
          content: "❌ العضو غير موجود.",
          ephemeral: true
        });

      }

      if (!member.bannable) {

        return interaction.reply({
          content:
            "❌ لا أستطيع إعدام هذا العضو. تأكد أن رتبة البوت أعلى من رتبة العضو وأن لديه Ban Members.",
          ephemeral: true
        });

      }

      await member.ban({
        reason
      });

      const embed =
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("🔨 تم الإعدام")
          .setDescription(
            `تم إعدام المعدوم ${user}\n\n` +
            `من قبل ${interaction.user}\n\n` +
            `**السبب:** ${reason}`
          )
          .setThumbnail(
            user.displayAvatarURL({
              size: 256
            })
          )
          .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

      await sendLog(
        interaction.guild,
        "🔨 إعدام / Ban",
        `**المعدوم:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}`,
        0xFF0000
      );

      return;
    }

    /* =====================================================
       UNBAN
    ===================================================== */

    if (command === "unban") {

      const id =
        interaction.options.getString("userid");

      try {

        await interaction.guild.members.unban(id);

      } catch {

        return interaction.reply({
          content: "❌ لم أجد هذا الـ ID ضمن المحظورين.",
          ephemeral: true
        });

      }

      await interaction.reply(
        `🔓 تم فك الحظر عن <@${id}>.`
      );

      await sendLog(
        interaction.guild,
        "🔓 Unban",
        `**ID:** \`${id}\`\n` +
        `**بواسطة:** ${interaction.user}`,
        0x2ECC71
      );

      return;
    }

    /* =====================================================
       KICK
    ===================================================== */

    if (command === "kick") {

      const user =
        interaction.options.getUser("member");

      const reason =
        interaction.options.getString("reason");

      const member =
        await interaction.guild.members
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
        `**السبب:** ${reason}`,
        0xE67E22
      );

      return;
    }

    /* =====================================================
       TIMEOUT
    ===================================================== */

    if (command === "timeout") {

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

      if (!member || !member.moderatable) {

        return interaction.reply({
          content: "❌ لا أستطيع إعطاء Timeout لهذا العضو.",
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
        `**بواسطة:** ${interaction.user}\n` +
        `**المدة:** ${minutes} دقيقة\n` +
        `**السبب:** ${reason}`,
        0x9B59B6
      );

      return;
    }

    /* =====================================================
       UNTIMEOUT
    ===================================================== */

    if (command === "untimeout") {

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

      await interaction.reply(
        `✅ تم إزالة Timeout عن ${user}.`
      );

      await sendLog(
        interaction.guild,
        "✅ Untimeout",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}`,
        0x2ECC71
      );

      return;
    }

    /* =====================================================
       WARN
    ===================================================== */

    if (command === "warn") {

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

      const result =
        await db.query(
          `
          SELECT COUNT(*) AS count
          FROM warns
          WHERE guild_id = $1
          AND user_id = $2
          `,
          [
            interaction.guildId,
            user.id
          ]
        );

      const warnNumber =
        Number(result.rows[0].count);

      await interaction.reply(
        `⚠️ تم إعطاء ${user} تحذير.\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${warnNumber}`
      );

      await user.send(
        `⚠️ **تم إعطاؤك تحذير**\n\n` +
        `**السيرفر:** ${interaction.guild.name}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${warnNumber}`
      ).catch(() => {});

      await sendLog(
        interaction.guild,
        "⚠️ Warn",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${warnNumber}`,
        0xF1C40F
      );

      return;
    }

    /* =====================================================
       WARN LIST
    ===================================================== */

    if (command === "warnlist") {

      const selectedUser =
        interaction.options.getUser("member");

      let result;

      if (selectedUser) {

        result =
          await db.query(
            `
            SELECT *
            FROM warns
            WHERE guild_id = $1
            AND user_id = $2
            ORDER BY created_at DESC
            LIMIT 25
            `,
            [
              interaction.guildId,
              selectedUser.id
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
          selectedUser
            ? `✅ لا توجد تحذيرات على ${selectedUser}.`
            : "✅ لا توجد تحذيرات في السيرفر."
        );

      }

      const text =
        result.rows.map((warn, index) => {

          const date =
            new Date(
              warn.created_at
            ).toLocaleString("ar");

          return (
            `**${index + 1}.** <@${warn.user_id}>\n` +
            `**السبب:** ${warn.reason}\n` +
            `**بواسطة:** <@${warn.moderator_id}>\n` +
            `**التاريخ:** ${date}`
          );

        }).join("\n\n");

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(
            selectedUser
              ? `⚠️ تحذيرات ${selectedUser.username}`
              : "⚠️ قائمة التحذيرات"
          )
          .setDescription(text)
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       CLEAR
    ===================================================== */

    if (command === "clear") {

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
        "🧹 حذف رسائل",
        `**الروم:** ${interaction.channel}\n` +
        `**العدد:** ${deleted.size}\n` +
        `**بواسطة:** ${interaction.user}`,
        0x3498DB
      );

      return;
    }

    /* =====================================================
       LOCK
    ===================================================== */

    if (command === "lock") {

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      await interaction.reply(
        "🔒 تم قفل الروم."
      );

      await sendLog(
        interaction.guild,
        "🔒 Lock",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`,
        0xE74C3C
      );

      return;
    }

    /* =====================================================
       UNLOCK
    ===================================================== */

    if (command === "unlock") {

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: true
        }
      );

      await interaction.reply(
        "🔓 تم فتح الروم."
      );

      await sendLog(
        interaction.guild,
        "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`,
        0x2ECC71
      );

      return;
    }

    /* =====================================================
       SLOWMODE
    ===================================================== */

    if (command === "slowmode") {

      const seconds =
        interaction.options.getInteger("seconds");

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

    /* =====================================================
       ROLE
    ===================================================== */

    if (command === "role") {

      const user =
        interaction.options.getUser("member");

      const role =
        interaction.options.getRole("role");

      const action =
        interaction.options.getString("action");

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      if (role.managed) {

        return interaction.reply({
          content: "❌ لا يمكن التحكم بهذه الرتبة.",
          ephemeral: true
        });

      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {

        return interaction.reply({
          content:
            "❌ رتبة البوت يجب أن تكون أعلى من الرتبة التي تريد التحكم بها.",
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
        "🎭 تغيير رتبة",
        `**العضو:** ${user}\n` +
        `**الرتبة:** ${role}\n` +
        `**الإجراء:** ${action === "add" ? "إضافة" : "إزالة"}\n` +
        `**بواسطة:** ${interaction.user}`,
        0x9B59B6
      );

      return;
    }

    /* =====================================================
       NICKNAME
    ===================================================== */

    if (command === "nickname") {

      const user =
        interaction.options.getUser("member");

      const name =
        interaction.options.getString("name");

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      if (!member.manageable) {

        return interaction.reply({
          content:
            "❌ لا أستطيع تغيير اسم هذا العضو.",
          ephemeral: true
        });

      }

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

    if (command === "info") {

      const user =
        interaction.options.getUser("member")
        || interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      const embed =
        new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(`👤 معلومات ${user.username}`)
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
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
              inline: true
            }
          )
          .setTimestamp();

      if (member) {

        embed.addFields({
          name: "دخل السيرفر",
          value:
            member.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
              : "غير معروف",
          inline: true
        });

      }

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       SERVER INFO
    ===================================================== */

    if (command === "serverinfo") {

      const guild =
        interaction.guild;

      const embed =
        new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(`🏠 ${guild.name}`)
          .setThumbnail(
            guild.iconURL({
              size: 256
            })
          )
          .addFields(
            {
              name: "المالك",
              value: `<@${guild.ownerId}>`,
              inline: true
            },
            {
              name: "الأعضاء",
              value: `${guild.memberCount}`,
              inline: true
            },
            {
              name: "الرومات",
              value: `${guild.channels.cache.size}`,
              inline: true
            },
            {
              name: "الرتب",
              value: `${guild.roles.cache.size}`,
              inline: true
            },
            {
              name: "ID",
              value: `\`${guild.id}\``,
              inline: true
            }
          )
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       AVATAR
    ===================================================== */

    if (command === "avatar") {

      const user =
        interaction.options.getUser("member")
        || interaction.user;

      const url =
        user.displayAvatarURL({
          size: 4096,
          extension: "png"
        });

      const embed =
        new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(`🖼️ صورة ${user.username}`)
          .setImage(url)
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       BANNER
    ===================================================== */

    if (command === "banner") {

      const user =
        interaction.options.getUser("member")
        || interaction.user;

      const fetched =
        await user.fetch();

      const banner =
        fetched.bannerURL({
          size: 4096,
          extension: "png"
        });

      if (!banner) {

        return interaction.reply({
          content:
            "❌ هذا العضو لا يملك Banner.",
          ephemeral: true
        });

      }

      const embed =
        new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle(`🎨 Banner - ${user.username}`)
          .setImage(banner)
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       ROLES
    ===================================================== */

    if (command === "roles") {

      const user =
        interaction.options.getUser("member")
        || interaction.user;

      const member =
        await interaction.guild.members.fetch(
          user.id
        );

      const roles =
        member.roles.cache
          .filter(role =>
            role.id !== interaction.guild.id
          )
          .sort(
            (a, b) =>
              b.position - a.position
          )
          .map(role => role.toString());

      const text =
        roles.length
          ? roles.join(" ")
          : "لا توجد رتب.";

      const embed =
        new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`🎭 رتب ${user.username}`)
          .setDescription(text)
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });

    }

    /* =====================================================
       AUTOREPLY
    ===================================================== */

    if (command === "autoreply") {

      const sub =
        interaction.options.getSubcommand();

      /* ADD */

      if (sub === "add") {

        const trigger =
          interaction.options.getString("trigger")
            .trim();

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

        await interaction.reply(
          `✅ تم حفظ الرد التلقائي.\n\n` +
          `**الكلمة:** \`${trigger}\`\n` +
          `**الرد:** ${response}`
        );

        return;
      }

      /* REMOVE */

      if (sub === "remove") {

        const trigger =
          interaction.options.getString("trigger")
            .trim();

        const result =
          await db.query(
            `
            DELETE FROM autoreplies
            WHERE guild_id = $1
            AND LOWER(trigger) = LOWER($2)
            `,
            [
              interaction.guildId,
              trigger
            ]
          );

        if (!result.rowCount) {

          return interaction.reply(
            "❌ هذا الرد غير موجود."
          );

        }

        return interaction.reply(
          `✅ تم حذف الرد التلقائي \`${trigger}\`.`
        );

      }

    }

    /* =====================================================
       LIST AUTOREPLIES
    ===================================================== */

    if (command === "list") {

      const result =
        await db.query(
          `
          SELECT trigger, response
          FROM autoreplies
          WHERE guild_id = $1
          ORDER BY trigger ASC
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
          .slice(0, 25)
          .map(
            (row, index) =>
              `**${index + 1}.** \`${row.trigger}\` → ${row.response}`
          )
          .join("\n");

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("🤖 الردود التلقائية")
            .setDescription(text)
            .setTimestamp()

        ]

      });

    }

    /* =====================================================
       SHORTCUT
    ===================================================== */

    if (command === "shortcut") {

      const sub =
        interaction.options.getSubcommand();

      /* SET */

      if (sub === "set") {

        const shortcut =
          interaction.options
            .getString("shortcut")
            .trim();

        const targetCommand =
          interaction.options
            .getString("command")
            .trim()
            .toLowerCase();

        await db.query(
          `
          INSERT INTO shortcuts
          (guild_id, shortcut, command)
          VALUES ($1, $2, $3)
          ON CONFLICT (guild_id, shortcut)
          DO UPDATE SET command = EXCLUDED.command
          `,
          [
            interaction.guildId,
            shortcut,
            targetCommand
          ]
        );

        return interaction.reply(
          `✅ تم إنشاء الاختصار:\n\n` +
          `\`${shortcut}\` → \`/${targetCommand}\``
        );

      }

      /* REMOVE */

      if (sub === "remove") {

        const shortcut =
          interaction.options
            .getString("shortcut")
            .trim();

        const result =
          await db.query(
            `
            DELETE FROM shortcuts
            WHERE guild_id = $1
            AND LOWER(shortcut) = LOWER($2)
            `,
            [
              interaction.guildId,
              shortcut
            ]
          );

        if (!result.rowCount) {

          return interaction.reply(
            "❌ هذا الاختصار غير موجود."
          );

        }

        return interaction.reply(
          `✅ تم حذف الاختصار \`${shortcut}\`.`
        );

      }

      /* LIST */

      if (sub === "list") {

        const result =
          await db.query(
            `
            SELECT shortcut, command
            FROM shortcuts
            WHERE guild_id = $1
            ORDER BY shortcut ASC
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
            .slice(0, 25)
            .map(
              (row, index) =>
                `**${index + 1}.** \`${row.shortcut}\` → \`/${row.command}\``
            )
            .join("\n");

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle("🔗 الاختصارات")
              .setDescription(text)
              .setTimestamp()

          ]

        });

      }

    }

  } catch (error) {

    console.error(
      "❌ Interaction Error:",
      error
    );

    if (interaction.replied || interaction.deferred) {

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
   MESSAGE DELETE LOG
========================================================= */

client.on("messageDelete", async message => {

  if (!message.guild) return;

  if (message.author?.bot) return;

  const content =
    message.content
      ? message.content.slice(0, 1000)
      : "لا يمكن قراءة محتوى الرسالة.";

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${message.author || "غير معروف"}\n` +
    `**الروم:** ${message.channel}\n` +
    `**المحتوى:** ${content}`,
    0xE74C3C
  );

});

/* =========================================================
   MESSAGE UPDATE LOG
========================================================= */

client.on("messageUpdate", async (oldMessage, newMessage) => {

  if (!newMessage.guild) return;

  if (newMessage.author?.bot) return;

  if (
    oldMessage.content === newMessage.content
  ) return;

  const oldContent =
    oldMessage.content || "غير معروف";

  const newContent =
    newMessage.content || "غير معروف";

  await sendLog(
    newMessage.guild,
    "✏️ تعديل رسالة",
    `**العضو:** ${newMessage.author || "غير معروف"}\n` +
    `**الروم:** ${newMessage.channel}\n\n` +
    `**قبل:** ${oldContent.slice(0, 500)}\n` +
    `**بعد:** ${newContent.slice(0, 500)}`,
    0xF1C40F
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
    `**ID:** \`${member.id}\``,
    0x2ECC71
  );

});

/* =========================================================
   MEMBER LEAVE
========================================================= */

client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user || "غير معروف"}\n` +
    `**ID:** \`${member.id}\``,
    0xE67E22
  );

});

/* =========================================================
   ROLE CHANGES
========================================================= */

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  const oldRoles =
    oldMember.roles.cache;

  const newRoles =
    newMember.roles.cache;

  const addedRoles =
    newRoles.filter(
      role =>
        !oldRoles.has(role.id)
    );

  const removedRoles =
    oldRoles.filter(
      role =>
        !newRoles.has(role.id)
    );

  if (addedRoles.size) {

    for (const role of addedRoles.values()) {

      await sendLog(
        newMember.guild,
        "➕ إضافة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID:** \`${role.id}\``,
        0x2ECC71
      );

    }

  }

  if (removedRoles.size) {

    for (const role of removedRoles.values()) {

      await sendLog(
        newMember.guild,
        "➖ إزالة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID:** \`${role.id}\``,
        0xE74C3C
      );

    }

  }

});

/* =========================================================
   ROLE CREATE
========================================================= */

client.on("roleCreate", async role => {

  await sendLog(
    role.guild,
    "🎭 إنشاء رتبة",
    `**الرتبة:** ${role}\n` +
    `**ID:** \`${role.id}\``,
    0x2ECC71
  );

});

/* =========================================================
   ROLE DELETE
========================================================= */

client.on("roleDelete", async role => {

  await sendLog(
    role.guild,
    "🗑️ حذف رتبة",
    `**الرتبة:** ${role.name}\n` +
    `**ID:** \`${role.id}\``,
    0xE74C3C
  );

});

/* =========================================================
   ROLE UPDATE
========================================================= */

client.on("roleUpdate", async (oldRole, newRole) => {

  if (
    oldRole.name === newRole.name &&
    oldRole.permissions.bitfield ===
      newRole.permissions.bitfield
  ) {
    return;
  }

  await sendLog(
    newRole.guild,
    "✏️ تعديل رتبة",
    `**قبل:** ${oldRole.name}\n` +
    `**بعد:** ${newRole.name}\n` +
    `**ID:** \`${newRole.id}\``,
    0xF1C40F
  );

});

/* =========================================================
   ERROR HANDLING
========================================================= */

client.on("error", error => {

  console.error(
    "❌ Discord Client Error:",
    error
  );

});

process.on("unhandledRejection", error => {

  console.error(
    "❌ Unhandled Rejection:",
    error
  );

});

process.on("uncaughtException", error => {

  console.error(
    "❌ Uncaught Exception:",
    error
  );

});

/* =========================================================
   DATABASE ERROR
========================================================= */

db.on("error", error => {

  console.error(
    "❌ PostgreSQL Error:",
    error
  );

});

/* =========================================================
   LOGIN
========================================================= */

console.log("🚀 Starting bot...");

client.login(TOKEN);
