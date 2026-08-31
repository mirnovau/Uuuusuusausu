const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { Pool } = require("pg");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const LOG_CHANNEL_ID = "1523668413505863762";

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ DISCORD_TOKEN أو CLIENT_ID غير موجود");
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

  // ME
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات عن البوت"),

  // الإعدام = Ban
  new SlashCommandBuilder()
    .setName("edam")
    .setDescription("إعدام / حظر عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("الشخص المراد إعدامه")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("سبب الإعدام")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // Unban
  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(option =>
      option
        .setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  // Kick
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  // Warn
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("إعطاء تحذير")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("سبب التحذير")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Warn List
  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض قائمة التحذيرات")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Timeout
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء تايم أوت")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("minutes")
        .setDescription("المدة بالدقائق")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("السبب")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // إزالة Timeout
  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة التايم أوت")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // Lock
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // Unlock
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  // Clear
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  // Info
  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  // Server Info
  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("معلومات السيرفر"),

  // Avatar
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة العضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  // Auto Reply
  new SlashCommandBuilder()
    .setName("autoreply")
    .setDescription("إدارة الردود التلقائية")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("إضافة رد تلقائي")
        .addStringOption(option =>
          option
            .setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName("response")
            .setDescription("الرد")
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("حذف رد تلقائي")
        .addStringOption(option =>
          option
            .setName("trigger")
            .setDescription("الكلمة")
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  // List
  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية")

].map(command => command.toJSON());


/* =========================
   LOGS
========================= */

async function sendLog(guild, title, description) {

  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Powered by .v5d."
    })
    .setTimestamp();

  await channel
    .send({
      embeds: [embed]
    })
    .catch(() => {});
}


/* =========================
   تشغيل البوت
========================= */

client.once("ready", async () => {

  console.log(`✅ ${client.user.tag} Online`);

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

  const rest = new REST({
    version: "10"
  }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    {
      body: commands
    }
  );

  console.log("✅ الأوامر جاهزة");
  console.log("✅ PostgreSQL متصل");
});


/* =========================
   Slash Commands
========================= */

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    /* ME */

    if (interaction.commandName === "me") {

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("🤖 مين أنا؟")
            .setDescription(
              "أنا بوت خاص لـ **.v5d.**\n\n" +
              "ولدي سيرفر **MR NOVA**\n" +
              "وتحت خدمة **Leon** و **Monthly**."
            )
            .setFooter({
              text: "Powered by .v5d."
            })
        ]
      });

    }


    /* =========================
       الإعدام / BAN
    ========================= */

    if (interaction.commandName === "edam") {

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
          content: "❌ لا أستطيع إعدام هذا العضو. تأكد أن رتبة البوت أعلى من رتبته.",
          ephemeral: true
        });

      }

      await member.ban({
        reason: `${reason} | بواسطة ${interaction.user.tag}`
      });

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🔨 تم الإعدام")
        .setDescription(
          `تم إعدام المعدوم ${user}\n\n` +
          `من قبل ${interaction.user}\n\n` +
          `**السبب:** ${reason}`
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({
          text: "Powered by .v5d."
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed]
      });

      await sendLog(
        interaction.guild,
        "🔨 إعدام عضو",
        `**المعدوم:** ${user}\n` +
        `**من قبل:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }


    /* UNBAN */

    if (interaction.commandName === "unban") {

      const userId = interaction.options.getString("userid");

      await interaction.guild.members.unban(
        userId,
        `بواسطة ${interaction.user.tag}`
      );

      await interaction.reply(
        `✅ تم فك الحظر عن \`${userId}\``
      );

      await sendLog(
        interaction.guild,
        "🔓 فك حظر",
        `**العضو:** \`${userId}\`\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }


    /* KICK */

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
        "👢 طرد عضو",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}`
      );

      return;
    }


    /* WARN */

    if (interaction.commandName === "warn") {

      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      await db.query(
        `
        INSERT INTO warns
        (guild_id, user_id, moderator_id, reason)
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
        SELECT COUNT(*) 
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
        `⚠️ تم إعطاء ${user} تحذيرًا.\n**السبب:** ${reason}`
      );

      await user.send(
        `⚠️ **لقد تم إعطاءك تحذير**\n\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**السيرفر:** ${interaction.guild.name}\n` +
        `**رقم التحذير:** #${number}`
      ).catch(() => {});

      await sendLog(
        interaction.guild,
        "⚠️ تحذير جديد",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**السبب:** ${reason}\n` +
        `**رقم التحذير:** #${number}`
      );

      return;
    }


    /* WARN LIST */

    if (interaction.commandName === "warnlist") {

      const result = await db.query(
        `
        SELECT *
        FROM warns
        WHERE guild_id=$1
        ORDER BY created_at DESC
        `,
        [interaction.guildId]
      );

      if (!result.rows.length) {

        return interaction.reply(
          "✅ لا توجد تحذيرات."
        );

      }

      const text = result.rows
        .slice(0, 25)
        .map((warn, index) =>
          `**${index + 1}.** <@${warn.user_id}> — ${warn.reason} — بواسطة <@${warn.moderator_id}>`
        )
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ قائمة التحذيرات")
            .setDescription(text)
            .setFooter({
              text: "Powered by .v5d."
            })
        ]
      });

    }


    /* TIMEOUT */

    if (interaction.commandName === "timeout") {

      const user = interaction.options.getUser("member");
      const minutes = interaction.options.getInteger("minutes");
      const reason = interaction.options.getString("reason");

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member || !member.moderatable) {

        return interaction.reply({
          content: "❌ لا أستطيع إعطاء هذا العضو Timeout.",
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
        "⏳ Timeout",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}\n` +
        `**المدة:** ${minutes} دقيقة\n` +
        `**السبب:** ${reason}`
      );

      return;
    }


    /* UNTIMEOUT */

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
        `✅ تم إزالة الـTimeout عن ${user}`
      );

      await sendLog(
        interaction.guild,
        "✅ إزالة Timeout",
        `**العضو:** ${user}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }


    /* LOCK / UNLOCK */

    if (
      interaction.commandName === "lock" ||
      interaction.commandName === "unlock"
    ) {

      const locked =
        interaction.commandName === "lock";

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
        locked ? "🔒 قفل روم" : "🔓 فتح روم",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }


    /* CLEAR */

    if (interaction.commandName === "clear") {

      const amount =
        interaction.options.getInteger("amount");

      await interaction.channel.bulkDelete(
        amount,
        true
      );

      await interaction.reply({
        content: `🧹 تم مسح **${amount}** رسالة.`,
        ephemeral: true
      });

      await sendLog(
        interaction.guild,
        "🧹 مسح رسائل",
        `**الروم:** ${interaction.channel}\n` +
        `**العدد:** ${amount}\n` +
        `**بواسطة:** ${interaction.user}`
      );

      return;
    }


    /* INFO */

    if (interaction.commandName === "info") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      const member =
        await interaction.guild.members
          .fetch(user.id)
          .catch(() => null);

      const created =
        Math.floor(user.createdTimestamp / 1000);

      const joined =
        member?.joinedTimestamp
          ? Math.floor(member.joinedTimestamp / 1000)
          : null;

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`👤 معلومات ${user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
              `**العضو:** ${user}\n` +
              `**ID:** \`${user.id}\`\n` +
              `**إنشاء الحساب:** <t:${created}:F>\n` +
              `**دخول السيرفر:** ${
                joined
                  ? `<t:${joined}:F>`
                  : "غير معروف"
              }\n` +
              `**Bot:** ${user.bot ? "نعم" : "لا"}`
            )
            .setFooter({
              text: "Powered by .v5d."
            })

        ]

      });

    }


    /* SERVER INFO */

    if (interaction.commandName === "serverinfo") {

      const guild = interaction.guild;

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`📊 ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .setDescription(
              `**المالك:** <@${guild.ownerId}>\n` +
              `**الأعضاء:** ${guild.memberCount}\n` +
              `**الرومات:** ${guild.channels.cache.size}\n` +
              `**الرتب:** ${guild.roles.cache.size}\n` +
              `**ID:** \`${guild.id}\``
            )
            .setFooter({
              text: "Powered by .v5d."
            })

        ]

      });

    }


    /* AVATAR */

    if (interaction.commandName === "avatar") {

      const user =
        interaction.options.getUser("member") ||
        interaction.user;

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`🖼️ صورة ${user.username}`)
            .setImage(
              user.displayAvatarURL({
                size: 4096
              })
            )
            .setFooter({
              text: "Powered by .v5d."
            })

        ]

      });

    }


    /* AUTOREPLY */

    if (interaction.commandName === "autoreply") {

      const sub =
        interaction.options.getSubcommand();

      const trigger =
        interaction.options
          .getString("trigger")
          .toLowerCase()
          .trim();

      if (sub === "add") {

        const response =
          interaction.options.getString("response");

        await db.query(
          `
          INSERT INTO autoreplies
          (guild_id, trigger, response)
          VALUES ($1,$2,$3)
          ON CONFLICT (guild_id, trigger)
          DO UPDATE SET response=EXCLUDED.response
          `,
          [
            interaction.guildId,
            trigger,
            response
          ]
        );

        return interaction.reply(
          `✅ تم إضافة الرد التلقائي.\n\n` +
          `**الكلمة:** ${trigger}\n` +
          `**الرد:** ${response}`
        );
      }

      if (sub === "remove") {

        const result = await db.query(
          `
          DELETE FROM autoreplies
          WHERE guild_id=$1 AND trigger=$2
          `,
          [
            interaction.guildId,
            trigger
          ]
        );

        return interaction.reply(
          result.rowCount
            ? `🗑️ تم حذف الرد التلقائي **${trigger}**`
            : "❌ الرد غير موجود."
        );
      }

    }


    /* LIST */

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
          "📋 لا توجد ردود تلقائية."
        );

      }

      const text = result.rows
        .map(
          r =>
            `**${r.trigger}** → ${r.response}`
        )
        .join("\n");

      return interaction.reply({

        embeds: [

          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("📋 الردود التلقائية")
            .setDescription(text)
            .setFooter({
              text: "Powered by .v5d."
            })

        ]

      });

    }

  } catch (error) {

    console.error("❌ ERROR:", error);

    if (!interaction.replied) {

      await interaction.reply({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    }

  }

});


/* =========================
   الردود التلقائية
========================= */

client.on("messageCreate", async message => {

  if (!message.guild) return;
  if (message.author.bot) return;

  const text =
    message.content
      .toLowerCase()
      .trim();

  if (!text) return;

  const result = await db.query(
    `
    SELECT response
    FROM autoreplies
    WHERE guild_id=$1 AND trigger=$2
    `,
    [
      message.guild.id,
      text
    ]
  ).catch(() => ({
    rows: []
  }));

  if (result.rows.length) {

    await message
      .reply(result.rows[0].response)
      .catch(() => {});

  }

});


/* =========================
   Logs
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


client.on("guildMemberAdd", async member => {

  await sendLog(
    member.guild,
    "📥 دخول عضو",
    `**العضو:** ${member}\n` +
    `**ID:** ${member.id}`
  );

});


client.on("guildMemberRemove", async member => {

  await sendLog(
    member.guild,
    "📤 خروج عضو",
    `**العضو:** ${member.user.username}\n` +
    `**ID:** ${member.id}`
  );

});


client.login(TOKEN);
