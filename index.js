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

// 👑 Owner / Developer
const OWNER_ID = "1179433017064820747";

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
   BOT STATUS
========================================================= */

let botStartedAt = null;
let lastReadyAt = null;
let lastDisconnectAt = null;

/* =========================================================
   OWNER CHECK
========================================================= */

function isOwner(interaction) {
  return interaction.user.id === OWNER_ID;
}

/* =========================================================
   COMMAND PERMISSIONS
========================================================= */

const commandPermissions = {
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  untimeout: PermissionFlagsBits.ModerateMembers,
  warn: PermissionFlagsBits.ModerateMembers,
  warnlist: PermissionFlagsBits.ModerateMembers,

  clear: PermissionFlagsBits.ManageMessages,

  lock: PermissionFlagsBits.ManageChannels,
  unlock: PermissionFlagsBits.ManageChannels,
  slowmode: PermissionFlagsBits.ManageChannels,

  role: PermissionFlagsBits.ManageRoles,
  nickname: PermissionFlagsBits.ManageNicknames,

  autoreply: PermissionFlagsBits.ManageGuild,
  shortcut: PermissionFlagsBits.ManageGuild,

  logsetup: PermissionFlagsBits.ManageGuild,
  logs: PermissionFlagsBits.ManageGuild
};

/* =========================================================
   PERMISSION CHECK
========================================================= */

function checkCommandPermission(interaction) {

  // 👑 Owner يتجاوز صلاحيات أوامر البوت
  if (isOwner(interaction)) {
    return true;
  }

  const required =
    commandPermissions[interaction.commandName];

  if (!required) {
    return true;
  }

  return (
    interaction.memberPermissions?.has(required) ?? false
  );
}

/* =========================================================
   SLASH COMMANDS
========================================================= */

const commands = [

  /* =====================================================
     🛡️ الإدارة
  ===================================================== */

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("إعدام / حظر عضو")
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

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("فك حظر عضو")
    .addStringOption(o =>
      o
        .setName("userid")
        .setDescription("ID العضو")
        .setRequired(true)
    ),

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
        .setDescription("السبب")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("إعطاء Timeout")
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
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("إزالة Timeout")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("إعطاء تحذير")
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

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("عرض التحذيرات")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو - اختياري")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح الرسائل")
    .addIntegerOption(o =>
      o
        .setName("amount")
        .setDescription("عدد الرسائل")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("تفعيل Slowmode")
    .addIntegerOption(o =>
      o
        .setName("seconds")
        .setDescription("الثواني")
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  new SlashCommandBuilder()
    .setName("role")
    .setDescription("إضافة أو إزالة رتبة")
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
    .addStringOption(o =>
      o
        .setName("action")
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
    ),

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

  /* =====================================================
     👤 المعلومات
  ===================================================== */

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o
        .setName("member")
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
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("banner")
    .setDescription("بنر العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("roles")
    .setDescription("رتب العضو")
    .addUserOption(o =>
      o
        .setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

  /* =====================================================
     🤖 AUTOREPLY
  ===================================================== */

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

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("عرض الردود التلقائية"),

  /* =====================================================
     🔗 SHORTCUT
  ===================================================== */

  new SlashCommandBuilder()
    .setName("shortcut")
    .setDescription("إدارة الاختصارات")

    .addSubcommand(s =>
      s
        .setName("set")
        .setDescription("إنشاء اختصار")
        .addStringOption(o =>
          o
            .setName("shortcut")
            .setDescription("مثال: قفل")
            .setRequired(true)
        )
        .addStringOption(o =>
          o
            .setName("command")
            .setDescription("مثال: lock")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("remove")
        .setDescription("حذف اختصار")
        .addStringOption(o =>
          o
            .setName("shortcut")
            .setDescription("الاختصار")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s
        .setName("list")
        .setDescription("عرض الاختصارات")
    ),

  /* =====================================================
     📋 LOGS
  ===================================================== */

  new SlashCommandBuilder()
    .setName("logsetup")
    .setDescription("تحديد روم اللوق")
    .addChannelOption(o =>
      o
        .setName("channel")
        .setDescription("روم اللوق")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("اختبار نظام اللوق"),

  /* =====================================================
     🤖 BOT
  ===================================================== */

  new SlashCommandBuilder()
    .setName("bot")
    .setDescription("معلومات وحالة البوت"),

  new SlashCommandBuilder()
    .setName("me")
    .setDescription("معلومات البوت")

].map(command => command.toJSON());

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

  await db.query(`
    CREATE TABLE IF NOT EXISTS log_channels (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS bot_sessions (
      id SERIAL PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL,
      disconnected_at TIMESTAMPTZ
    )
  `);

  console.log("✅ PostgreSQL جاهز");
}

/* =========================================================
   UPTIME
========================================================= */

function formatUptime(ms) {

  if (!ms || ms < 0) {
    return "غير متوفر";
  }

  let seconds = Math.floor(ms / 1000);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  return `${days} يوم، ${hours} ساعة، ${minutes} دقيقة، ${seconds} ثانية`;
}

/* =========================================================
   GET LOG CHANNEL
========================================================= */

async function getLogChannel(guild) {

  if (!guild) {
    return null;
  }

  const result = await db.query(
    `
    SELECT channel_id
    FROM log_channels
    WHERE guild_id = $1
    `,
    [guild.id]
  );

  if (!result.rows.length) {
    return null;
  }

  const channelId =
    result.rows[0].channel_id;

  return guild.channels.cache.get(channelId) || null;
}

/* =========================================================
   SEND LOG
========================================================= */

async function sendLog(
  guild,
  title,
  description,
  color = 0xF1C40F
) {

  if (!guild) {
    return;
  }

  try {

    const channel =
      await getLogChannel(guild);

    if (!channel) {

      console.log(
        `⚠️ لم يتم تحديد روم اللوق في: ${guild.name}`
      );

      return;
    }

    const embed =
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({
          text: ".v5d. • Logs"
        })
        .setTimestamp();

    await channel.send({
      embeds: [embed]
    });

  } catch (error) {

    console.error(
      "❌ خطأ إرسال اللوق:",
      error
    );

  }
}

/* =========================================================
   READY
========================================================= */

client.once("ready", async () => {

  botStartedAt = Date.now();
  lastReadyAt = new Date();

  console.log("====================================");
  console.log(`🤖 ${client.user.tag}`);
  console.log("🟢 البوت Online");
  console.log(`👑 Owner ID: ${OWNER_ID}`);
  console.log(`🏠 السيرفرات: ${client.guilds.cache.size}`);
  console.log(`📋 الأوامر: ${commands.length}`);
  console.log("====================================");

  try {

    await setupDatabase();

    await db.query(`
      UPDATE bot_sessions
      SET disconnected_at = NOW()
      WHERE disconnected_at IS NULL
    `);

    await db.query(
      `
      INSERT INTO bot_sessions
      (started_at)
      VALUES ($1)
      `,
      [lastReadyAt]
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    /* ================================================
       حذف Global Commands
    ================================================= */

    try {

      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        {
          body: []
        }
      );

      console.log(
        "🧹 تم حذف Global Commands القديمة"
      );

    } catch (error) {

      console.log(
        "⚠️ لم يتم حذف Global Commands:",
        error.message
      );

    }

    /* ================================================
       تسجيل الأوامر في كل السيرفرات
    ================================================= */

    for (
      const guild
      of client.guilds.cache.values()
    ) {

      try {

        await rest.put(
          Routes.applicationGuildCommands(
            CLIENT_ID,
            guild.id
          ),
          {
            body: commands
          }
        );

        console.log(
          `✅ ${guild.name}: ${commands.length} أمر`
        );

      } catch (error) {

        console.error(
          `❌ فشل تسجيل الأوامر في ${guild.name}:`,
          error.message
        );

      }

    }

    console.log(
      "🚀 البوت جاهز بالكامل"
    );

  } catch (error) {

    console.error(
      "❌ خطأ READY:",
      error
    );

  }

});

/* =========================================================
   DISCONNECT
========================================================= */

client.on(
  "shardDisconnect",
  async () => {

    lastDisconnectAt =
      new Date();

    console.log(
      `🔴 انقطع البوت: ${lastDisconnectAt.toISOString()}`
    );

    try {

      await db.query(`
        UPDATE bot_sessions
        SET disconnected_at = NOW()
        WHERE disconnected_at IS NULL
      `);

    } catch (error) {

      console.error(
        "❌ خطأ حفظ الانفصال:",
        error
      );

    }

  }
);

/* =========================================================
   GUILD CREATE
========================================================= */

client.on(
  "guildCreate",
  async guild => {

    try {

      const rest =
        new REST({
          version: "10"
        }).setToken(TOKEN);

      await rest.put(
        Routes.applicationGuildCommands(
          CLIENT_ID,
          guild.id
        ),
        {
          body: commands
        }
      );

      console.log(
        `🆕 ${guild.name}: تم تسجيل ${commands.length} أمر`
      );

    } catch (error) {

      console.error(
        "❌ فشل تسجيل أوامر السيرفر الجديد:",
        error
      );

    }

  }
);

/* =========================================================
   INTERACTIONS
========================================================= */

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      /* ================================================
         PERMISSION CHECK
      ================================================= */

      if (!checkCommandPermission(interaction)) {

        return interaction.reply({
          content:
            "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });

      }

      /* ================================================
         BOT
      ================================================= */

      if (
        interaction.commandName === "bot"
      ) {

        const online =
          client.isReady();

        let lastSession = null;

        try {

          const result =
            await db.query(`
              SELECT
                started_at,
                disconnected_at
              FROM bot_sessions
              ORDER BY id DESC
              LIMIT 2
            `);

          if (
            result.rows.length > 1
          ) {

            lastSession =
              result.rows[1];

          }

        } catch {}

        const embed =
          new EmbedBuilder()
            .setColor(
              online
                ? 0x2ECC71
                : 0xE74C3C
            )
            .setTitle(
              "🤖 حالة البوت"
            )
            .addFields(

              {
                name: "الحالة",
                value:
                  online
                    ? "🟢 Online"
                    : "🔴 Offline",
                inline: true
              },

              {
                name: "Ping",
                value:
                  online
                    ? `${client.ws.ping}ms`
                    : "غير متوفر",
                inline: true
              },

              {
                name: "السيرفرات",
                value:
                  `${client.guilds.cache.size}`,
                inline: true
              },

              {
                name:
                  "مدة الاتصال الحالية",

                value:
                  online && botStartedAt
                    ? formatUptime(
                        Date.now() -
                        botStartedAt
                      )
                    : "غير متصل",

                inline: false
              },

              {
                name:
                  "آخر مرة أصبح Online",

                value:
                  lastReadyAt
                    ? `<t:${Math.floor(
                        lastReadyAt.getTime() /
                        1000
                      )}:F>`
                    : "غير معروف",

                inline: false
              },

              {
                name:
                  "آخر مرة انقطع فيها",

                value:
                  lastDisconnectAt
                    ? `<t:${Math.floor(
                        lastDisconnectAt.getTime() /
                        1000
                      )}:F>`
                    : lastSession?.disconnected_at
                      ? `<t:${Math.floor(
                          new Date(
                            lastSession.disconnected_at
                          ).getTime() /
                          1000
                        )}:F>`
                      : "لا توجد بيانات",

                inline: false
              },

              {
                name: "الأوامر",
                value:
                  `${commands.length}`,
                inline: true
              },

              {
                name:
                  "Owner / Developer",

                value:
                  `<@${OWNER_ID}>`,

                inline: true
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

      /* ================================================
         ME
      ================================================= */

      if (
        interaction.commandName === "me"
      ) {

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle(
                "🤖 معلومات البوت"
              )
              .setDescription(
                `**البوت:** ${client.user}\n` +
                `**الحالة:** 🟢 Online\n` +
                `**الأوامر:** ${commands.length}\n` +
                `**السيرفرات:** ${client.guilds.cache.size}\n` +
                `**Owner:** <@${OWNER_ID}>\n\n` +
                `Powered by **.v5d.**`
              )
              .setTimestamp()

          ]

        });

      }

      /* ================================================
         LOG SETUP
      ================================================= */

      if (
        interaction.commandName ===
        "logsetup"
      ) {

        const channel =
          interaction.options.getChannel(
            "channel"
          );

        await db.query(
          `
          INSERT INTO log_channels
          (guild_id, channel_id)
          VALUES ($1, $2)

          ON CONFLICT (guild_id)
          DO UPDATE SET
            channel_id =
              EXCLUDED.channel_id
          `,
          [
            interaction.guildId,
            channel.id
          ]
        );

        await interaction.reply({
          content:
            `✅ تم تحديد ${channel} كروم اللوق.`,
          ephemeral: true
        });

        await sendLog(
          interaction.guild,
          "📋 Log Setup",
          `تم تحديد هذا الروم كروم اللوق بواسطة ${interaction.user}`,
          0x2ECC71
        );

        return;
      }

      /* ================================================
         LOG TEST
      ================================================= */

      if (
        interaction.commandName ===
        "logs"
      ) {

        const channel =
          await getLogChannel(
            interaction.guild
          );

        if (!channel) {

          return interaction.reply({
            content:
              "❌ لم يتم تحديد روم اللوق.\nاستخدم `/logsetup` أولاً.",
            ephemeral: true
          });

        }

        const embed =
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("🧪 اختبار نظام اللوق")
            .setDescription(
              "✅ هذا اختبار لنظام اللوق.\n\n" +
              `**بواسطة:** ${interaction.user}\n` +
              `**السيرفر:** ${interaction.guild.name}\n` +
              `**الروم:** ${channel}`
            )
            .setFooter({
              text: ".v5d. • Logs Test"
            })
            .setTimestamp();

        await channel.send({
          embeds: [embed]
        });

        return interaction.reply({
          content:
            `✅ تم إرسال رسالة الاختبار إلى ${channel}.`,
          ephemeral: true
        });

      }

      /* ================================================
         BAN
      ================================================= */

      if (
        interaction.commandName === "ban"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {

          return interaction.reply({
            content:
              "❌ العضو غير موجود.",
            ephemeral: true
          });

        }

        if (!member.bannable) {

          return interaction.reply({
            content:
              "❌ البوت لا يستطيع حظر هذا العضو. تأكد من صلاحية Ban Members وترتيب الرتب.",
            ephemeral: true
          });

        }

        await member.ban({
          reason
        });

        await interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle("🔨 تم الحظر")
              .setDescription(
                `**العضو:** ${user}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**السبب:** ${reason}`
              )
              .setThumbnail(
                user.displayAvatarURL({
                  size: 256
                })
              )
              .setTimestamp()

          ]
        });

        await sendLog(
          interaction.guild,
          "🔨 Ban",
          `**العضو:** ${user}\n` +
          `**الإداري:** ${interaction.user}\n` +
          `**السبب:** ${reason}`,
          0xE74C3C
        );

        return;
      }

      /* ================================================
         UNBAN
      ================================================= */

      if (
        interaction.commandName ===
        "unban"
      ) {

        const id =
          interaction.options.getString(
            "userid"
          );

        try {

          await interaction.guild.members.unban(
            id
          );

        } catch {

          return interaction.reply({
            content:
              "❌ لم أستطع فك الحظر. تأكد من ID.",
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

      /* ================================================
         KICK
      ================================================= */

      if (
        interaction.commandName === "kick"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (
          !member ||
          !member.kickable
        ) {

          return interaction.reply({
            content:
              "❌ لا أستطيع طرد هذا العضو.",
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

      /* ================================================
         TIMEOUT
      ================================================= */

      if (
        interaction.commandName ===
        "timeout"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const minutes =
          interaction.options.getInteger(
            "minutes"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (
          !member ||
          !member.moderatable
        ) {

          return interaction.reply({
            content:
              "❌ لا أستطيع إعطاء Timeout لهذا العضو.",
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
          `**السبب:** ${reason}`,
          0x9B59B6
        );

        return;
      }

      /* ================================================
         UNTIMEOUT
      ================================================= */

      if (
        interaction.commandName ===
        "untimeout"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        if (!member) {

          return interaction.reply({
            content:
              "❌ العضو غير موجود.",
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

      /* ================================================
         WARN
      ================================================= */

      if (
        interaction.commandName === "warn"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const reason =
          interaction.options.getString(
            "reason"
          );

        await db.query(
          `
          INSERT INTO warns
          (
            guild_id,
            user_id,
            moderator_id,
            reason
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            interaction.guildId,
            user.id,
            interaction.user.id,
            reason
          ]
        );

        const count =
          await db.query(
            `
            SELECT COUNT(*)::int AS count
            FROM warns
            WHERE guild_id = $1
            AND user_id = $2
            `,
            [
              interaction.guildId,
              user.id
            ]
          );

        const total =
          count.rows[0].count;

        await interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle("⚠️ تحذير")
              .setDescription(
                `**العضو:** ${user}\n` +
                `**السبب:** ${reason}\n` +
                `**بواسطة:** ${interaction.user}\n` +
                `**إجمالي التحذيرات:** ${total}`
              )
              .setThumbnail(
                user.displayAvatarURL({
                  size: 256
                })
              )
              .setTimestamp()

          ]
        });

        await sendLog(
          interaction.guild,
          "⚠️ Warn",
          `**العضو:** ${user}\n` +
          `**بواسطة:** ${interaction.user}\n` +
          `**السبب:** ${reason}\n` +
          `**الإجمالي:** ${total}`,
          0xF1C40F
        );

        return;
      }

      /* ================================================
         WARNLIST
      ================================================= */

      if (
        interaction.commandName ===
        "warnlist"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        let result;

        if (user) {

          result =
            await db.query(
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
            "✅ لا توجد تحذيرات."
          );

        }

        const text =
          result.rows
            .map(
              (w, i) =>
                `**${i + 1}.** <@${w.user_id}>\n` +
                `**السبب:** ${w.reason}\n` +
                `**بواسطة:** <@${w.moderator_id}>\n` +
                `**التاريخ:** <t:${Math.floor(
                  new Date(
                    w.created_at
                  ).getTime() / 1000
                )}:R>`
            )
            .join("\n\n");

        return interaction.reply({
          embeds: [

            new EmbedBuilder()
              .setColor(0xF1C40F)
              .setTitle(
                user
                  ? `⚠️ تحذيرات ${user.username}`
                  : "⚠️ قائمة التحذيرات"
              )
              .setDescription(text)
              .setTimestamp()

          ]
        });

      }

      /* ================================================
         CLEAR
      ================================================= */

      if (
        interaction.commandName ===
        "clear"
      ) {

        const amount =
          interaction.options.getInteger(
            "amount"
          );

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

      /* ================================================
         LOCK / UNLOCK
      ================================================= */

      if (
        interaction.commandName === "lock" ||
        interaction.commandName === "unlock"
      ) {

        const locked =
          interaction.commandName === "lock";

        await interaction.channel
          .permissionOverwrites
          .edit(
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
          locked
            ? "🔒 Lock"
            : "🔓 Unlock",
          `**الروم:** ${interaction.channel}\n` +
          `**بواسطة:** ${interaction.user}`,
          locked
            ? 0xE74C3C
            : 0x2ECC71
        );

        return;
      }

      /* ================================================
         SLOWMODE
      ================================================= */

      if (
        interaction.commandName ===
        "slowmode"
      ) {

        const seconds =
          interaction.options.getInteger(
            "seconds"
          );

        await interaction.channel
          .setRateLimitPerUser(
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
          `**بواسطة:** ${interaction.user}`,
          0x9B59B6
        );

        return;
      }

      /* ================================================
         ROLE
      ================================================= */

      if (
        interaction.commandName === "role"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const role =
          interaction.options.getRole(
            "role"
          );

        const action =
          interaction.options.getString(
            "action"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id);

        if (
          role.id ===
          interaction.guild.id
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكن استخدام رتبة @everyone.",
            ephemeral: true
          });

        }

        if (
          role.position >=
          interaction.guild.members.me.roles.highest.position
        ) {

          return interaction.reply({
            content:
              "❌ رتبة البوت أقل من هذه الرتبة.",
            ephemeral: true
          });

        }

        if (action === "add") {

          await member.roles.add(
            role
          );

          await interaction.reply(
            `✅ تم إعطاء ${user} رتبة ${role}.`
          );

        } else {

          await member.roles.remove(
            role
          );

          await interaction.reply(
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
          `**بواسطة:** ${interaction.user}`,
          0x9B59B6
        );

        return;
      }

      /* ================================================
         NICKNAME
      ================================================= */

      if (
        interaction.commandName ===
        "nickname"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          );

        const name =
          interaction.options.getString(
            "name"
          );

        const member =
          await interaction.guild.members
            .fetch(user.id);

        const oldName =
          member.nickname ||
          member.user.username;

        await member.setNickname(
          name
        );

        await interaction.reply(
          `✅ تم تغيير اسم ${user} إلى **${name}**.`
        );

        await sendLog(
          interaction.guild,
          "✏️ تغيير الاسم",
          `**العضو:** ${user}\n` +
          `**الاسم السابق:** ${oldName}\n` +
          `**الاسم الجديد:** ${name}\n` +
          `**بواسطة:** ${interaction.user}`,
          0x3498DB
        );

        return;
      }

      /* ================================================
         INFO
      ================================================= */

      if (
        interaction.commandName ===
        "info"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);

        const embed =
          new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(
              `👤 معلومات ${user.username}`
            )
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
                value:
                  `<t:${Math.floor(
                    user.createdTimestamp /
                    1000
                  )}:R>`,
                inline: true
              },

              {
                name: "دخل السيرفر",
                value:
                  member?.joinedTimestamp
                    ? `<t:${Math.floor(
                        member.joinedTimestamp /
                        1000
                      )}:R>`
                    : "غير معروف",
                inline: true
              }

            )
            .setTimestamp();

        return interaction.reply({
          embeds: [embed]
        });

      }

      /* ================================================
         SERVERINFO
      ================================================= */

      if (
        interaction.commandName ===
        "serverinfo"
      ) {

        const guild =
          interaction.guild;

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🏠 ${guild.name}`
              )
              .addFields(

                {
                  name: "الأعضاء",
                  value:
                    `${guild.memberCount}`,
                  inline: true
                },

                {
                  name: "الرومات",
                  value:
                    `${guild.channels.cache.size}`,
                  inline: true
                },

                {
                  name: "الرتب",
                  value:
                    `${guild.roles.cache.size}`,
                  inline: true
                },

                {
                  name: "ID",
                  value:
                    `\`${guild.id}\``,
                  inline: false
                }

              )
              .setTimestamp()

          ]

        });

      }

      /* ================================================
         AVATAR
      ================================================= */

      if (
        interaction.commandName ===
        "avatar"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🖼️ Avatar - ${user.username}`
              )
              .setImage(
                user.displayAvatarURL({
                  size: 1024
                })
              )

          ]

        });

      }

      /* ================================================
         BANNER
      ================================================= */

      if (
        interaction.commandName ===
        "banner"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const fetched =
          await user.fetch();

        const banner =
          fetched.bannerURL({
            size: 1024
          });

        if (!banner) {

          return interaction.reply(
            "❌ هذا العضو لا يملك Banner."
          );

        }

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(
                `🎨 Banner - ${user.username}`
              )
              .setImage(
                banner
              )

          ]

        });

      }

      /* ================================================
         ROLES
      ================================================= */

      if (
        interaction.commandName ===
        "roles"
      ) {

        const user =
          interaction.options.getUser(
            "member"
          ) ||
          interaction.user;

        const member =
          await interaction.guild.members
            .fetch(user.id);

        const roles =
          member.roles.cache
            .filter(
              r =>
                r.id !==
                interaction.guild.id
            )
            .sort(
              (a, b) =>
                b.position -
                a.position
            )
            .map(
              r => `${r}`
            )
            .join(" ");

        return interaction.reply({

          embeds: [

            new EmbedBuilder()
              .setColor(0x9B59B6)
              .setTitle(
                `🎭 رتب ${user.username}`
              )
              .setDescription(
                roles ||
                "لا توجد رتب."
              )

          ]

        });

      }

      /* ================================================
         AUTOREPLY
      ================================================= */

      if (
        interaction.commandName ===
        "autoreply"
      ) {

        const sub =
          interaction.options
            .getSubcommand();

        const trigger =
          interaction.options
            .getString("trigger")
            .toLowerCase();

        if (
          sub === "add"
        ) {

          const response =
            interaction.options
              .getString(
                "response"
              );

          await db.query(
            `
            INSERT INTO autoreplies
            (guild_id, trigger, response)
            VALUES ($1, $2, $3)

            ON CONFLICT
            (guild_id, trigger)

            DO UPDATE SET
              response =
                EXCLUDED.response
            `,
            [
              interaction.guildId,
              trigger,
              response
            ]
          );

          return interaction.reply(
            `✅ تم إضافة الرد التلقائي:\n**${trigger}** → ${response}`
          );

        }

        if (
          sub === "remove"
        ) {

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

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف الرد التلقائي **${trigger}**.`
              : `❌ الرد **${trigger}** غير موجود.`
          );

        }

      }

      /* ================================================
         LIST
      ================================================= */

      if (
        interaction.commandName ===
        "list"
      ) {

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

        if (
          !result.rows.length
        ) {

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
              .setColor(0x3498DB)
              .setTitle(
                "🤖 الردود التلقائية"
              )
              .setDescription(
                text
              )

          ]

        });

      }

      /* ================================================
         SHORTCUT
      ================================================= */

      if (
        interaction.commandName ===
        "shortcut"
      ) {

        const sub =
          interaction.options
            .getSubcommand();

        if (
          sub === "set"
        ) {

          const shortcut =
            interaction.options
              .getString(
                "shortcut"
              )
              .toLowerCase();

          const command =
            interaction.options
              .getString(
                "command"
              )
              .toLowerCase()
              .replace(
                /^\//,
                ""
              );

          await db.query(
            `
            INSERT INTO shortcuts
            (guild_id, shortcut, command)
            VALUES ($1, $2, $3)

            ON CONFLICT
            (guild_id, shortcut)

            DO UPDATE SET
              command =
                EXCLUDED.command
            `,
            [
              interaction.guildId,
              shortcut,
              command
            ]
          );

          return interaction.reply(
            `✅ تم إنشاء الاختصار:\n**${shortcut}** → **/${command}**`
          );

        }

        if (
          sub === "remove"
        ) {

          const shortcut =
            interaction.options
              .getString(
                "shortcut"
              )
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

          return interaction.reply(
            result.rowCount
              ? `🗑️ تم حذف الاختصار **${shortcut}**.`
              : `❌ الاختصار **${shortcut}** غير موجود.`
          );

        }

        if (
          sub === "list"
        ) {

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

          if (
            !result.rows.length
          ) {

            return interaction.reply(
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

          return interaction.reply({

            embeds: [

              new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle(
                  "🔗 الاختصارات"
                )
                .setDescription(
                  text
                )

            ]

          });

        }

      }

    } catch (error) {

      console.error(
        "❌ Interaction Error:",
        error
      );

      if (
        interaction.replied ||
        interaction.deferred
      ) {

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

  }
);

/* =========================================================
   AUTO REPLY + SHORTCUTS
========================================================= */

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) {
      return;
    }

    if (!message.guild) {
      return;
    }

    try {

      const text =
        message.content
          .trim()
          .toLowerCase();

      if (!text) {
        return;
      }

      /* ================================================
         AUTOREPLY
      ================================================= */

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
            text
          ]
        );

      if (
        auto.rows.length
      ) {

        await message.reply(
          auto.rows[0].response
        );

        return;
      }

      /* ================================================
         SHORTCUT
      ================================================= */

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
            text
          ]
        );

      if (
        shortcut.rows.length
      ) {

        await message.reply(
          `🔗 الاختصار **${text}** مرتبط بالأمر \`/${shortcut.rows[0].command}\``
        );

      }

    } catch (error) {

      console.error(
        "❌ Message Handler Error:",
        error
      );

    }

  }
);

/* =========================================================
   LOG: MESSAGE DELETE
========================================================= */

client.on(
  "messageDelete",
  async message => {

    if (!message.guild) {
      return;
    }

    if (message.author?.bot) {
      return;
    }

    await sendLog(
      message.guild,
      "🗑️ حذف رسالة",
      `**العضو:** ${message.author || "غير معروف"}\n` +
      `**الروم:** ${message.channel}\n` +
      `**الرسالة:** ${
        message.content ||
        "غير متوفرة"
      }\n` +
      `**ID:** \`${message.id}\``,
      0xE74C3C
    );

  }
);

/* =========================================================
   LOG: MESSAGE UPDATE
========================================================= */

client.on(
  "messageUpdate",
  async (
    oldMessage,
    newMessage
  ) => {

    if (!newMessage.guild) {
      return;
    }

    if (newMessage.author?.bot) {
      return;
    }

    const oldContent =
      oldMessage.content ||
      "غير متوفر";

    const newContent =
      newMessage.content ||
      "غير متوفر";

    if (
      oldContent ===
      newContent
    ) {
      return;
    }

    await sendLog(
      newMessage.guild,
      "✏️ تعديل رسالة",
      `**العضو:** ${newMessage.author || "غير معروف"}\n` +
      `**الروم:** ${newMessage.channel}\n\n` +
      `**قبل:**\n${oldContent}\n\n` +
      `**بعد:**\n${newContent}`,
      0xF1C40F
    );

  }
);

/* =========================================================
   LOG: MEMBER JOIN
========================================================= */

client.on(
  "guildMemberAdd",
  async member => {

    await sendLog(
      member.guild,
      "🟢 دخول عضو",
      `**العضو:** ${member.user}\n` +
      `**الاسم:** ${member.user.username}\n` +
      `**ID:** \`${member.id}\``,
      0x2ECC71
    );

  }
);

/* =========================================================
   LOG: MEMBER LEAVE
========================================================= */

client.on(
  "guildMemberRemove",
  async member => {

    await sendLog(
      member.guild,
      "🔴 خروج عضو",
      `**العضو:** ${member.user || "غير معروف"}\n` +
      `**ID:** \`${member.id}\``,
      0xE74C3C
    );

  }
);

/* =========================================================
   LOG: MEMBER UPDATE
========================================================= */

client.on(
  "guildMemberUpdate",
  async (
    oldMember,
    newMember
  ) => {

    const oldRoles =
      oldMember.roles.cache.map(
        r => r.id
      );

    const newRoles =
      newMember.roles.cache.map(
        r => r.id
      );

    const added =
      newMember.roles.cache.filter(
        r =>
          !oldRoles.includes(
            r.id
          )
      );

    const removed =
      oldMember.roles.cache.filter(
        r =>
          !newRoles.includes(
            r.id
          )
      );

    if (added.size) {

      for (
        const role
        of added.values()
      ) {

        await sendLog(
          newMember.guild,
          "🎭 إضافة رتبة",
          `**العضو:** ${newMember.user}\n` +
          `**الرتبة:** ${role}`,
          0x2ECC71
        );

      }

    }

    if (removed.size) {

      for (
        const role
        of removed.values()
      ) {

        await sendLog(
          newMember.guild,
          "🎭 إزالة رتبة",
          `**العضو:** ${newMember.user}\n` +
          `**الرتبة:** ${role}`,
          0xE74C3C
        );

      }

    }

    if (
      oldMember.nickname !==
      newMember.nickname
    ) {

      await sendLog(
        newMember.guild,
        "✏️ تغيير Nickname",
        `**العضو:** ${newMember.user}\n` +
        `**السابق:** ${
          oldMember.nickname ||
          oldMember.user.username
        }\n` +
        `**الجديد:** ${
          newMember.nickname ||
          newMember.user.username
        }`,
        0x3498DB
      );

    }

  }
);

/* =========================================================
   LOG: ROLE CREATE
========================================================= */

client.on(
  "roleCreate",
  async role => {

    await sendLog(
      role.guild,
      "🎭 إنشاء رتبة",
      `**الرتبة:** ${role}\n` +
      `**ID:** \`${role.id}\``,
      0x2ECC71
    );

  }
);

/* =========================================================
   LOG: ROLE DELETE
========================================================= */

client.on(
  "roleDelete",
  async role => {

    await sendLog(
      role.guild,
      "🗑️ حذف رتبة",
      `**الرتبة:** ${role.name}\n` +
      `**ID:** \`${role.id}\``,
      0xE74C3C
    );

  }
);

/* =========================================================
   LOG: ROLE UPDATE
========================================================= */

client.on(
  "roleUpdate",
  async (
    oldRole,
    newRole
  ) => {

    if (
      oldRole.name ===
        newRole.name &&
      oldRole.color ===
        newRole.color &&
      oldRole.permissions.bitfield ===
        newRole.permissions.bitfield
    ) {
      return;
    }

    await sendLog(
      newRole.guild,
      "✏️ تعديل رتبة",
      `**الرتبة:** ${newRole}\n` +
      `**الاسم السابق:** ${oldRole.name}\n` +
      `**الاسم الجديد:** ${newRole.name}`,
      0xF1C40F
    );

  }
);

/* =========================================================
   LOG: BAN
========================================================= */

client.on(
  "guildBanAdd",
  async ban => {

    await sendLog(
      ban.guild,
      "🔨 Ban",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\``,
      0xE74C3C
    );

  }
);

/* =========================================================
   LOG: UNBAN
========================================================= */

client.on(
  "guildBanRemove",
  async ban => {

    await sendLog(
      ban.guild,
      "🔓 Unban",
      `**العضو:** ${ban.user}\n` +
      `**ID:** \`${ban.user.id}\``,
      0x2ECC71
    );

  }
);

/* =========================================================
   ERROR HANDLING
========================================================= */

client.on(
  "error",
  error => {

    console.error(
      "❌ Discord Client Error:",
      error
    );

  }
);

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "❌ Unhandled Rejection:",
      error
    );

  }
);

process.on(
  "uncaughtException",
  error => {

    console.error(
      "❌ Uncaught Exception:",
      error
    );

  }
);

/* =========================================================
   LOGIN
========================================================= */

console.log(
  "🚀 Starting Discord Bot..."
);

client.login(TOKEN);
