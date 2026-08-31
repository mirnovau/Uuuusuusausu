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

let databaseReady = false;

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
    .setDescription("عرض تحذيرات عضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
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
        .setDescription("عدد الثواني")
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
     🤖 إضافية
  ========================= */

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت"),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار اللوق")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

].map(c => c.toJSON());

/* =========================================================
   DATABASE
========================================================= */

async function setupDatabase() {

  try {

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

    databaseReady = true;

    console.log("✅ PostgreSQL جاهز");

  } catch (error) {

    console.error("❌ PostgreSQL Error:", error.message);
    databaseReady = false;

  }
}

/* =========================================================
   LOG
========================================================= */

async function sendLog(guild, title, description, color = 0xF1C40F) {

  try {

    if (!guild) return;

    const channel =
      guild.channels.cache.get(LOG_CHANNEL_ID);

    if (!channel) {
      console.log(
        `⚠️ لم أجد روم اللوق: ${LOG_CHANNEL_ID}`
      );
      return;
    }

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
    });

  } catch (error) {

    console.error("❌ Log Error:", error.message);

  }
}

/* =========================================================
   READY + REGISTER
========================================================= */

client.once("ready", async () => {

  console.log("");
  console.log("====================================");
  console.log(`🤖 Bot: ${client.user.tag}`);
  console.log(`🟢 Online`);
  console.log(`🏠 Guild ID: ${GUILD_ID}`);
  console.log(`📋 Commands: ${commands.length}`);
  console.log("====================================");

  try {

    await setupDatabase();

    const guild =
      await client.guilds.fetch(GUILD_ID).catch(() => null);

    if (!guild) {

      console.error(
        "❌ البوت غير موجود في السيرفر الموجود في GUILD_ID"
      );

      return;

    }

    console.log(
      `✅ السيرفر موجود: ${guild.name}`
    );

    const rest =
      new REST({ version: "10" }).setToken(TOKEN);

    /* حذف Global */

    console.log("🧹 حذف Global Commands...");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: []
      }
    );

    console.log("✅ تم حذف Global Commands");

    /* تسجيل Guild */

    console.log("📥 تسجيل أوامر السيرفر...");

    const registered =
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
      `✅ تم تسجيل ${registered.length} أمر`
    );

    console.log("🚀 البوت جاهز");

  } catch (error) {

    console.error("❌ Registration Error:");
    console.error(error);

  }

});

/* =========================================================
   INTERACTIONS
========================================================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  /*
   * نرد بسرعة على Discord حتى لا تظهر
   * The application did not respond
   */

  try {

    await interaction.deferReply();

  } catch (error) {

    console.error("❌ Defer Error:", error);
    return;

  }

  try {

    const command = interaction.commandName;

    /* =====================================================
       ME
    ===================================================== */

    if (command === "me") {

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🤖 معلومات البوت")
            .setDescription(
              `**البوت:** ${client.user}\n` +
              `**السيرفر:** ${interaction.guild.name}\n` +
              `**الأوامر:** ${commands.length}\n\n` +
              `🟢 Online\n` +
              `Powered by **.v5d.**`
            )
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       LOGS TEST
    ===================================================== */

    if (command === "logs") {

      await sendLog(
        interaction.guild,
        "📋 اختبار نظام اللوق",
        `تم اختبار اللوق بنجاح.\n\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**الروم:** ${interaction.channel}\n` +
        `**السيرفر:** ${interaction.guild.name}`,
        0x2ECC71
      );

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("📋 تم اختبار اللوق")
            .setDescription(
              "تم إرسال رسالة اختبار إلى روم اللوق بنجاح ✅"
            )
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       BAN / إعدام
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

        return interaction.editReply(
          "❌ العضو غير موجود في السيرفر."
        );

      }

      if (!member.bannable) {

        return interaction.editReply(
          "❌ لا أستطيع إعدام هذا العضو. تأكد أن رتبة البوت أعلى من رتبته."
        );

      }

      await member.ban({
        reason: `${reason} | بواسطة ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔨 تم إعدام العضو")
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

      await interaction.editReply({
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

        return interaction.editReply(
          "❌ لم أجد هذا الـ ID ضمن قائمة المحظورين."
        );

      }

      await interaction.editReply(
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

        return interaction.editReply(
          "❌ لا أستطيع طرد هذا العضو."
        );

      }

      await member.kick(reason);

      await interaction.editReply(
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

        return interaction.editReply(
          "❌ لا أستطيع إعطاء Timeout لهذا العضو."
        );

      }

      await member.timeout(
        minutes * 60 * 1000,
        reason
      );

      await interaction.editReply(
        `⏳ تم إعطاء ${user} Timeout لمدة **${minutes} دقيقة**.\n` +
        `**السبب:** ${reason}`
      );

      await sendLog(
        interaction.guild,
        "⏳ Timeout",
        `**العضو:** ${user}\n` +
        `**الإداري:** ${interaction.user}\n` +
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

        return interaction.editReply(
          "❌ العضو غير موجود."
        );

      }

      await member.timeout(null);

      await interaction.editReply(
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

      if (!databaseReady) {

        return interaction.editReply(
          "❌ PostgreSQL غير متصل حاليًا."
        );

      }

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

      const countResult =
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
        countResult.rows[0].count;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ تم إعطاء تحذير")
            .setDescription(
              `**العضو:** ${user}\n` +
              `**الإداري:** ${interaction.user}\n` +
              `**السبب:** ${reason}\n` +
              `**رقم التحذير:** #${warnNumber}`
            )
            .setTimestamp()
        ]
      });

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
       WARNLIST
    ===================================================== */

    if (command === "warnlist") {

      if (!databaseReady) {

        return interaction.editReply(
          "❌ PostgreSQL غير متصل حاليًا."
        );

      }

      const selectedUser =
        interaction.options.getUser("member");

      let result;

      if (selectedUser) {

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
            selectedUser.id
          ]
        );

      } else {

        result = await db.query(
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

        return interaction.editReply(
          "✅ لا توجد تحذيرات."
        );

      }

      const text =
        result.rows
          .map((w, i) =>
            `**#${i + 1}** <@${w.user_id}>\n` +
            `**السبب:** ${w.reason}\n` +
            `**الإداري:** <@${w.moderator_id}>\n` +
            `**التاريخ:** <t:${Math.floor(
              new Date(w.created_at).getTime() / 1000
            )}:R>`
          )
          .join("\n\n");

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(
              selectedUser
                ? `⚠️ تحذيرات ${selectedUser.username}`
                : "⚠️ قائمة التحذيرات"
            )
            .setDescription(text)
            .setTimestamp()
        ]
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

      await interaction.editReply(
        `🧹 تم مسح **${deleted.size}** رسالة.`
      );

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
       LOCK / UNLOCK
    ===================================================== */

    if (
      command === "lock" ||
      command === "unlock"
    ) {

      const locked =
        command === "lock";

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: !locked
        }
      );

      await interaction.editReply(
        locked
          ? "🔒 تم قفل الروم."
          : "🔓 تم فتح الروم."
      );

      await sendLog(
        interaction.guild,
        locked
          ? "🔒 Lock"
          : "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`,
        locked ? 0xE74C3C : 0x2ECC71
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

      await interaction.editReply(
        seconds === 0
          ? "✅ تم إلغاء Slowmode."
          : `🐌 تم تفعيل Slowmode لمدة **${seconds} ثانية**.`
      );

      await sendLog(
        interaction.guild,
        "🐌 Slowmode",
        `**الروم:** ${interaction.channel}\n` +
        `**المدة:** ${seconds} ثانية\n` +
        `**بواسطة:** ${interaction.user}`
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
        await interaction.guild.members.fetch(user.id);

      if (action === "add") {

        if (role.managed) {
          return interaction.editReply(
            "❌ لا يمكن إعطاء رتبة Managed."
          );
        }

        await member.roles.add(role);

        await interaction.editReply(
          `✅ تم إعطاء ${user} رتبة ${role}.`
        );

      } else {

        await member.roles.remove(role);

        await interaction.editReply(
          `✅ تم إزالة رتبة ${role} من ${user}.`
        );

      }

      await sendLog(
        interaction.guild,
        "🎭 تغيير رتبة",
        `**العضو:** ${user}\n` +
        `**الرتبة:** ${role}\n` +
        `**الإجراء:** ${
          action === "add"
            ? "إضافة"
            : "إزالة"
        }\n` +
        `**بواسطة:** ${interaction.user}`
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
        await interaction.guild.members.fetch(user.id);

      if (!member.manageable) {

        return interaction.editReply(
          "❌ لا أستطيع تغيير اسم هذا العضو."
        );

      }

      await member.setNickname(name);

      await interaction.editReply(
        `✅ تم تغيير اسم ${user} إلى **${name}**.`
      );

      await sendLog(
        interaction.guild,
        "✏️ تغيير الاسم",
        `**العضو:** ${user}\n` +
        `**الاسم الجديد:** ${name}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;

    }

    /* =====================================================
       INFO
    ===================================================== */

    if (command === "info") {

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
          .setTitle("👤 معلومات العضو")
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
              name: "Username",
              value: user.username,
              inline: true
            },
            {
              name: "ID",
              value: `\`${user.id}\``,
              inline: true
            },
            {
              name: "تاريخ إنشاء الحساب",
              value: `<t:${Math.floor(
                user.createdTimestamp / 1000
              )}:F>`,
              inline: false
            }
          )
          .setTimestamp();

      if (member) {

        embed.addFields({
          name: "دخل السيرفر",
          value: `<t:${Math.floor(
            member.joinedTimestamp / 1000
          )}:F>`,
          inline: false
        });

      }

      return interaction.editReply({
        embeds: [embed]
      });

    }

    /* =====================================================
       SERVERINFO
    ===================================================== */

    if (command === "serverinfo") {

      const guild =
        interaction.guild;

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("🏠 معلومات السيرفر")
            .setThumbnail(
              guild.iconURL({
                size: 256
              })
            )
            .addFields(
              {
                name: "اسم السيرفر",
                value: guild.name,
                inline: true
              },
              {
                name: "ID",
                value: `\`${guild.id}\``,
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
              }
            )
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       AVATAR
    ===================================================== */

    if (command === "avatar") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🖼️ Avatar - ${user.username}`)
            .setImage(
              user.displayAvatarURL({
                size: 1024
              })
            )
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       BANNER
    ===================================================== */

    if (command === "banner") {

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

        return interaction.editReply(
          "❌ هذا العضو لا يملك Banner."
        );

      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🎨 Banner - ${user.username}`)
            .setImage(banner)
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       ROLES
    ===================================================== */

    if (command === "roles") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      if (!member) {

        return interaction.editReply(
          "❌ العضو غير موجود."
        );

      }

      const roles =
        member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.toString());

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🎭 رتب ${user.username}`)
            .setDescription(
              roles.length
                ? roles.join(" ")
                : "لا توجد رتب."
            )
            .setTimestamp()
        ]
      });

    }

    /* =====================================================
       AUTOREPLY
    ===================================================== */

    if (command === "autoreply") {

      if (!databaseReady) {

        return interaction.editReply(
          "❌ PostgreSQL غير متصل."
        );

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

        return interaction.editReply(
          `✅ تم حفظ الرد التلقائي.\n\n` +
          `**الكلمة:** \`${trigger}\`\n` +
          `**الرد:** ${response}`
        );

      }

      if (sub === "remove") {

        const trigger =
          interaction.options.getString("trigger")
            .toLowerCase();

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

        return interaction.editReply(
          result.rowCount
            ? `🗑️ تم حذف الرد \`${trigger}\`.`
            : `❌ لا يوجد رد باسم \`${trigger}\`.`
        );

      }

    }

    /* =====================================================
       LIST AUTOREPLIES
    ===================================================== */

    if (command === "list") {

      if (!databaseReady) {

        return interaction.editReply(
          "❌ PostgreSQL غير متصل."
        );

      }

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

        return interaction.editReply(
          "📭 لا توجد ردود تلقائية."
        );

      }

      const text =
        result.rows
          .slice(0, 25)
          .map(
            r =>
              `**${r.trigger}** → ${r.response}`
          )
          .join("\n");

      return interaction.editReply({
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

      if (!databaseReady) {

        return interaction.editReply(
          "❌ PostgreSQL غير متصل."
        );

      }

      const sub =
        interaction.options.getSubcommand();

      if (sub === "set") {

        const shortcut =
          interaction.options
            .getString("shortcut")
            .toLowerCase();

        const commandName =
          interaction.options
            .getString("command")
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
            commandName
          ]
        );

        return interaction.editReply(
          `✅ تم إنشاء الاختصار.\n\n` +
          `\`${shortcut}\` → \`/${commandName}\``
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

        return interaction.editReply(
          result.rowCount
            ? `🗑️ تم حذف الاختصار \`${shortcut}\`.`
            : `❌ الاختصار غير موجود.`
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

          return interaction.editReply(
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

        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle("🔗 الاختصارات")
              .setDescription(text)
              .setTimestamp()
          ]
        });

      }

    }

    /* =====================================================
       UNKNOWN
    ===================================================== */

    return interaction.editReply(
      "❌ هذا الأمر غير معروف."
    );

  } catch (error) {

    console.error(
      `❌ Error in /${interaction.commandName}:`,
      error
    );

    try {

      if (interaction.deferred) {

        await interaction.editReply(
          "❌ حدث خطأ أثناء تنفيذ الأمر. راجع Logs في Railway."
        );

      } else if (!interaction.replied) {

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
   MESSAGE EVENTS
   AutoReply + Shortcuts
========================================================= */

client.on("messageCreate", async message => {

  try {

    if (message.author.bot) return;

    if (!message.guild) return;

    if (!databaseReady) return;

    const content =
      message.content.trim();

    if (!content) return;

    /* =========================
       AUTOREPLY
    ========================= */

    const replyResult =
      await db.query(
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

    if (replyResult.rows.length) {

      await message.reply(
        replyResult.rows[0].response
      );

      return;

    }

    /* =========================
       SHORTCUT
    ========================= */

    const shortcutResult =
      await db.query(
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

    if (!shortcutResult.rows.length) return;

    const command =
      shortcutResult.rows[0].command;

    /* =========================
       SHORTCUT ACTIONS
    ========================= */

    if (
      command === "lock" ||
      command === "unlock"
    ) {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels
        )
      ) return;

      const locked =
        command === "lock";

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: !locked
        }
      );

      await message.reply(
        locked
          ? "🔒 تم قفل الروم."
          : "🔓 تم فتح الروم."
      );

      await sendLog(
        message.guild,
        locked ? "🔒 Lock" : "🔓 Unlock",
        `**الروم:** ${message.channel}\n` +
        `**بواسطة:** ${message.author}`
      );

      return;

    }

    if (command === "clear") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageMessages
        )
      ) return;

      await message.reply(
        "ℹ️ استخدم `/clear` وحدد عدد الرسائل."
      );

      return;

    }

    if (command === "kick") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.KickMembers
        )
      ) return;

      await message.reply(
        "ℹ️ استخدم `/kick` لتحديد العضو والسبب."
      );

      return;

    }

    if (command === "ban") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.BanMembers
        )
      ) return;

      await message.reply(
        "ℹ️ استخدم `/ban` لتحديد العضو والسبب."
      );

      return;

    }

    if (command === "warn") {

      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers
        )
      ) return;

      await message.reply(
        "ℹ️ استخدم `/warn` لتحديد العضو والسبب."
      );

      return;

    }

  } catch (error) {

    console.error(
      "❌ messageCreate error:",
      error.message
    );

  }

});

/* =========================================================
   LOG: MESSAGE DELETE
========================================================= */

client.on("messageDelete", async message => {

  if (!message.guild) return;

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${
      message.author || "غير معروف"
    }\n` +
    `**الروم:** ${message.channel}\n` +
    `**المحتوى:** ${
      message.content
        ? message.content.slice(0, 1000)
        : "غير متوفر"
    }`,
    0xE74C3C
  );

});

/* =========================================================
   LOG: MESSAGE UPDATE
========================================================= */

client.on(
  "messageUpdate",
  async (oldMessage, newMessage) => {

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
      `**قبل:** ${
        oldMessage.content
          ? oldMessage.content.slice(0, 500)
          : "غير متوفر"
      }\n\n` +
      `**بعد:** ${
        newMessage.content
          ? newMessage.content.slice(0, 500)
          : "غير متوفر"
      }`,
      0xF1C40F
    );

  }
);

/* =========================================================
   LOG: MEMBER JOIN
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
   LOG: MEMBER LEAVE
========================================================= */

client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user}\n` +
    `**ID:** \`${member.id}\``,
    0xE74C3C
  );

});

/* =========================================================
   LOG: ROLE UPDATE
========================================================= */

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  const oldRoles =
    oldMember.roles.cache;

  const newRoles =
    newMember.roles.cache;

  const added =
    newRoles.filter(
      role =>
        !oldRoles.has(role.id)
    );

  const removed =
    oldRoles.filter(
      role =>
        !newRoles.has(role.id)
    );

  if (added.size) {

    for (const [, role] of added) {

      await sendLog(
        newMember.guild,
        "🎭 إضافة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID:** \`${role.id}\``,
        0x2ECC71
      );

    }

  }

  if (removed.size) {

    for (const [, role] of removed) {

      await sendLog(
        newMember.guild,
        "🎭 إزالة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}\n` +
        `**ID:** \`${role.id}\``,
        0xE74C3C
      );

    }

  }

});

/* =========================================================
   ERROR HANDLERS
========================================================= */

client.on("error", error => {
  console.error("❌ Discord Client Error:", error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:", error);
});

/* =========================================================
   LOGIN
========================================================= */

console.log("🔄 Starting Discord bot...");

client.login(TOKEN);
