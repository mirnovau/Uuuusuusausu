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

/* =====================================================
   CONFIG
===================================================== */

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

/* =====================================================
   DATABASE
===================================================== */

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL غير موجود");
  process.exit(1);
}

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/* =====================================================
   CLIENT
===================================================== */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

/* =====================================================
   COMMANDS
===================================================== */

const commands = [

  /* ================= ADMIN ================= */

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر / إعدام عضو")
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
    .setDescription("عرض تحذيرات السيرفر")
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

].map(command => command.toJSON());

/* =====================================================
   DATABASE SETUP
===================================================== */

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

/* =====================================================
   LOG SYSTEM
===================================================== */

async function sendLog(guild, title, description) {

  if (!guild) return;

  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) {
    console.log("⚠️ لم يتم العثور على روم اللوق");
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
  }).catch(console.error);
}

/* =====================================================
   READY
===================================================== */

client.once("ready", async () => {

  console.log("================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log(`🟢 Online`);
  console.log(`🏠 Servers: ${client.guilds.cache.size}`);
  console.log("================================");

  try {

    await setupDatabase();

    const rest = new REST({
      version: "10"
    }).setToken(TOKEN);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      {
        body: commands
      }
    );

    console.log(`✅ تم تسجيل ${commands.length} أمر Slash`);

    client.user.setPresence({
      activities: [
        {
          name: `${client.guilds.cache.size} سيرفر`,
          type: 3
        }
      ],
      status: "online"
    });

  } catch (error) {

    console.error("❌ خطأ أثناء التجهيز:");
    console.error(error);

  }

});

/* =====================================================
   SLASH COMMANDS
===================================================== */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (!interaction.guild) {
    return interaction.reply({
      content: "❌ هذا الأمر يعمل داخل السيرفر فقط.",
      ephemeral: true
    });
  }

  try {

    /* ================= ME ================= */

    if (interaction.commandName === "me") {

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle("🤖 معلومات البوت")
        .addFields(
          {
            name: "الاسم",
            value: `${client.user}`,
            inline: true
          },
          {
            name: "السيرفرات",
            value: `${client.guilds.cache.size}`,
            inline: true
          },
          {
            name: "الأوامر",
            value: `${commands.length}`,
            inline: true
          }
        )
        .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* ================= LOG TEST ================= */

    if (interaction.commandName === "logs") {

      await sendLog(
        interaction.guild,
        "📋 اختبار اللوق",
        `تم اختبار نظام اللوق بواسطة ${interaction.user}`
      );

      return interaction.reply({
        content: "✅ تم إرسال الاختبار إلى روم اللوق.",
        ephemeral: true
      });
    }

    /* ================= BAN ================= */

    if (interaction.commandName === "ban") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ العضو غير موجود في السيرفر.",
          ephemeral: true
        });
      }

      if (!member.bannable) {
        return interaction.reply({
          content: "❌ لا أستطيع إعدام هذا العضو. تأكد من ترتيب الرتب والصلاحيات.",
          ephemeral: true
        });
      }

      await member.ban({
        reason: reason
      });

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

    /* ================= UNBAN ================= */

    if (interaction.commandName === "unban") {

      const id = interaction.options.getString("userid");

      try {

        await interaction.guild.members.unban(id);

      } catch {

        return interaction.reply({
          content: "❌ لم أجد هذا الـ ID ضمن قائمة المحظورين.",
          ephemeral: true
        });

      }

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
        `✅ تم إزالة Timeout عن ${user}.`
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

      const result = await db.query(
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

      const warnNumber = result.rows[0].count;

      await interaction.reply(
        `⚠️ تم إعطاء ${user} تحذير.\n` +
        `**السبب:** ${reason}`
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
        `**الإداري:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${warnNumber}`
      );

      return;
    }

    /* ================= WARN LIST ================= */

    if (interaction.commandName === "warnlist") {

      const result = await db.query(
        `
        SELECT *
        FROM warns
        WHERE guild_id = $1
        ORDER BY created_at DESC
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

      const text = result.rows
        .slice(0, 20)
        .map((w, i) =>
          `**${i + 1}.** <@${w.user_id}>\n` +
          `**السبب:** ${w.reason}\n` +
          `**بواسطة:** <@${w.moderator_id}>`
        )
        .join("\n\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ Warn List")
            .setDescription(text)
            .setTimestamp()
        ]
      });
    }

    /* ================= CLEAR ================= */

    if (interaction.commandName === "clear") {

      const amount = interaction.options.getInteger("amount");

      const deleted = await interaction.channel.bulkDelete(
        amount,
        true
      );

      await interaction.reply({
        content: `🧹 تم مسح **${deleted.size}** رسالة.`,
        ephemeral: true
      });

      await sendLog(
        interaction.guild,
        "🧹 حذف الرسائل",
        `**الروم:** ${interaction.channel}\n` +
        `**العدد:** ${deleted.size}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= LOCK ================= */

    if (interaction.commandName === "lock") {

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
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= UNLOCK ================= */

    if (interaction.commandName === "unlock") {

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      await interaction.reply(
        "🔓 تم فتح الروم."
      );

      await sendLog(
        interaction.guild,
        "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= SLOWMODE ================= */

    if (interaction.commandName === "slowmode") {

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

      await sendLog(
        interaction.guild,
        "🐌 Slowmode",
        `**الروم:** ${interaction.channel}\n` +
        `**المدة:** ${seconds} ثانية\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= ROLE ================= */

    if (interaction.commandName === "role") {

      const user =
        interaction.options.getUser("member");

      const role =
        interaction.options.getRole("role");

      const action =
        interaction.options.getString("action");

      const member =
        await interaction.guild.members.fetch(user.id);

      if (role.managed) {

        return interaction.reply({
          content: "❌ لا يمكن التحكم بهذه الرتبة.",
          ephemeral: true
        });

      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {

        return interaction.reply({
          content: "❌ رتبة البوت أقل من هذه الرتبة.",
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
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= NICKNAME ================= */

    if (interaction.commandName === "nickname") {

      const user =
        interaction.options.getUser("member");

      const name =
        interaction.options.getString("name");

      const member =
        await interaction.guild.members.fetch(user.id);

      if (!member.manageable) {

        return interaction.reply({
          content: "❌ لا أستطيع تغيير اسم هذا العضو.",
          ephemeral: true
        });

      }

      await member.setNickname(name);

      await interaction.reply(
        `✅ تم تغيير اسم ${user} إلى **${name}**.`
      );

      await sendLog(
        interaction.guild,
        "✏️ تغيير الاسم",
        `**العضو:** ${user}\n` +
        `**الاسم الجديد:** ${name}\n` +
        `**الإداري:** ${interaction.user}`
      );

      return;
    }

    /* ================= INFO ================= */

    if (interaction.commandName === "info") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle("👤 معلومات العضو")
          .setThumbnail(user.displayAvatarURL())
          .addFields(
            {
              name: "العضو",
              value: `${user}`,
              inline: true
            },
            {
              name: "Username",
              value: `\`${user.username}\``,
              inline: true
            },
            {
              name: "ID",
              value: `\`${user.id}\``,
              inline: true
            },
            {
              name: "إنشاء الحساب",
              value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
              inline: false
            }
          )
          .setTimestamp();

      if (member) {

        embed.addFields(
          {
            name: "دخول السيرفر",
            value: member.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
              : "غير معروف",
            inline: false
          },
          {
            name: "الرتبة الأعلى",
            value: `${member.roles.highest}`,
            inline: true
          }
        );

      }

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* ================= SERVER INFO ================= */

    if (interaction.commandName === "serverinfo") {

      const guild = interaction.guild;

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle("🏠 معلومات السيرفر")
          .setThumbnail(guild.iconURL())
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
              name: "القنوات",
              value: `${guild.channels.cache.size}`,
              inline: true
            },
            {
              name: "الرتب",
              value: `${guild.roles.cache.size}`,
              inline: true
            },
            {
              name: "إنشاء السيرفر",
              value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
              inline: false
            }
          )
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* ================= AVATAR ================= */

    if (interaction.commandName === "avatar") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(`🖼️ صورة ${user.username}`)
          .setImage(
            user.displayAvatarURL({
              size: 4096
            })
          )
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
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

      const banner =
        fullUser.bannerURL({
          size: 4096
        });

      if (!banner) {

        return interaction.reply(
          "❌ هذا العضو لا يملك Banner."
        );

      }

      const embed =
        new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(`🎨 Banner - ${user.username}`)
          .setImage(banner)
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
      });
    }

    /* ================= ROLES ================= */

    if (interaction.commandName === "roles") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id);

      const roles =
        member.roles.cache
          .filter(r => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map(r => `${r}`)
          .join(" ");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`🎭 رتب ${user.username}`)
            .setDescription(
              roles || "لا توجد رتب."
            )
        ]
      });
    }

    /* ================= AUTOREPLY ================= */

    if (interaction.commandName === "autoreply") {

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

        return interaction.reply(
          `✅ تم حفظ الرد التلقائي.\n**الكلمة:** ${trigger}\n**الرد:** ${response}`
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

        if (!result.rowCount) {

          return interaction.reply(
            "❌ هذا الرد غير موجود."
          );

        }

        return interaction.reply(
          `🗑️ تم حذف الرد التلقائي **${trigger}**.`
        );
      }
    }

    /* ================= AUTOREPLY LIST ================= */

    if (interaction.commandName === "list") {

      const result =
        await db.query(
          `
          SELECT *
          FROM autoreplies
          WHERE guild_id = $1
          ORDER BY id ASC
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
            .setColor(0xF1C40F)
            .setTitle("🤖 الردود التلقائية")
            .setDescription(text.slice(0, 4000))
        ]
      });
    }

    /* ================= SHORTCUT ================= */

    if (interaction.commandName === "shortcut") {

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
            command
          ]
        );

        return interaction.reply(
          `✅ تم إنشاء الاختصار:\n\n**${shortcut}** → **${command}**`
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

        if (!result.rowCount) {

          return interaction.reply(
            "❌ الاختصار غير موجود."
          );

        }

        return interaction.reply(
          `🗑️ تم حذف الاختصار **${shortcut}**.`
        );
      }

      if (sub === "list") {

        const result =
          await db.query(
            `
            SELECT *
            FROM shortcuts
            WHERE guild_id = $1
            ORDER BY id ASC
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
                `**${r.shortcut}** → **${r.command}**`
            )
            .join("\n");

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("🔗 الاختصارات")
              .setDescription(text.slice(0, 4000))
          ]
        });
      }
    }

  } catch (error) {

    console.error("❌ Interaction Error:");
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {

      await interaction.reply({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    }
  }

});

/* =====================================================
   AUTO REPLY + SHORTCUTS
===================================================== */

client.on("messageCreate", async message => {

  if (message.author.bot) return;
  if (!message.guild) return;

  try {

    const text =
      message.content.trim();

    if (!text) return;

    const trigger =
      text.toLowerCase();

    /* ================= AUTOREPLY ================= */

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
          trigger
        ]
      );

    if (auto.rows.length) {

      await message.reply(
        auto.rows[0].response
      );

      return;
    }

    /* ================= SHORTCUT ================= */

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
          trigger
        ]
      );

    if (!shortcut.rows.length) return;

    const command =
      shortcut.rows[0].command;

    const simpleCommands = [
      "lock",
      "unlock",
      "slowmode"
    ];

    if (!simpleCommands.includes(command)) {

      await message.reply(
        `🔗 الاختصار مربوط بالأمر **/${command}**.\n` +
        `استخدم الأمر Slash لتنفيذ الأمر مع خياراته.`
      );

      return;
    }

    /* ================= LOCK ================= */

    if (command === "lock") {

      if (!message.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )) return;

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: false
        }
      );

      await message.reply("🔒 تم قفل الروم.");

      await sendLog(
        message.guild,
        "🔒 Lock بواسطة اختصار",
        `**الروم:** ${message.channel}\n` +
        `**الإداري:** ${message.author}`
      );

      return;
    }

    /* ================= UNLOCK ================= */

    if (command === "unlock") {

      if (!message.member.permissions.has(
        PermissionFlagsBits.ManageChannels
      )) return;

      await message.channel.permissionOverwrites.edit(
        message.guild.roles.everyone,
        {
          SendMessages: null
        }
      );

      await message.reply("🔓 تم فتح الروم.");

      await sendLog(
        message.guild,
        "🔓 Unlock بواسطة اختصار",
        `**الروم:** ${message.channel}\n` +
        `**الإداري:** ${message.author}`
      );

      return;
    }

  } catch (error) {

    console.error("❌ Message Error:");
    console.error(error);

  }

});

/* =====================================================
   MESSAGE DELETE LOG
===================================================== */

client.on("messageDelete", async message => {

  if (!message.guild) return;
  if (message.author?.bot) return;

  const content =
    message.content || "لا يوجد نص";

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${message.author || "غير معروف"}\n` +
    `**الروم:** ${message.channel}\n` +
    `**الرسالة:** ${content.slice(0, 1000)}`
  );

});

/* =====================================================
   MESSAGE UPDATE LOG
===================================================== */

client.on("messageUpdate", async (oldMessage, newMessage) => {

  if (!newMessage.guild) return;
  if (newMessage.author?.bot) return;

  if (oldMessage.content === newMessage.content) return;

  await sendLog(
    newMessage.guild,
    "✏️ تعديل رسالة",
    `**العضو:** ${newMessage.author}\n` +
    `**الروم:** ${newMessage.channel}\n\n` +
    `**قبل:** ${oldMessage.content || "فارغ"}\n` +
    `**بعد:** ${newMessage.content || "فارغ"}`
  );

});

/* =====================================================
   MEMBER JOIN
===================================================== */

client.on("guildMemberAdd", async member => {

  await sendLog(
    member.guild,
    "📥 دخول عضو",
    `**العضو:** ${member.user}\n` +
    `**ID:** \`${member.id}\`\n` +
    `**تاريخ إنشاء الحساب:** <t:${Math.floor(
      member.user.createdTimestamp / 1000
    )}:F>`
  );

});

/* =====================================================
   MEMBER LEAVE
===================================================== */

client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user}\n` +
    `**ID:** \`${member.id}\``
  );

});

/* =====================================================
   ROLE UPDATE LOG
===================================================== */

client.on("guildMemberUpdate", async (oldMember, newMember) => {

  const oldRoles =
    oldMember.roles.cache;

  const newRoles =
    newMember.roles.cache;

  const added =
    newRoles.filter(
      role => !oldRoles.has(role.id)
    );

  const removed =
    oldRoles.filter(
      role => !newRoles.has(role.id)
    );

  if (added.size) {

    for (const role of added.values()) {

      await sendLog(
        newMember.guild,
        "➕ إضافة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}`
      );

    }

  }

  if (removed.size) {

    for (const role of removed.values()) {

      await sendLog(
        newMember.guild,
        "➖ إزالة رتبة",
        `**العضو:** ${newMember.user}\n` +
        `**الرتبة:** ${role}`
      );

    }

  }

});

/* =====================================================
   CHANNEL UPDATE LOG
===================================================== */

client.on("channelUpdate", async (oldChannel, newChannel) => {

  if (!newChannel.guild) return;

  await sendLog(
    newChannel.guild,
    "📝 تغيير قناة",
    `**القناة:** ${newChannel}\n` +
    `تم تعديل إعدادات القناة.`
  );

});

/* =====================================================
   ERROR HANDLING
===================================================== */

client.on("error", error => {
  console.error("❌ Discord Client Error:");
  console.error(error);
});

process.on("unhandledRejection", error => {
  console.error("❌ Unhandled Rejection:");
  console.error(error);
});

process.on("uncaughtException", error => {
  console.error("❌ Uncaught Exception:");
  console.error(error);
});

/* =====================================================
   LOGIN
===================================================== */

console.log("🚀 جاري تشغيل البوت...");

client.login(TOKEN)
  .then(() => {
    console.log("🔐 تم تسجيل الدخول إلى Discord");
  })
  .catch(error => {
    console.error("❌ فشل تسجيل الدخول:");
    console.error(error);
  });
