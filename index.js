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

const commands = [
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("مين أنا؟"),

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
        .setDescription("سبب التحذير")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warnlist")
    .setDescription("قائمة التحذيرات")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName("info")
    .setDescription("معلومات العضو")
    .addUserOption(o =>
      o.setName("member")
        .setDescription("العضو")
        .setRequired(false)
    ),

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
    .setDescription("عرض الردود التلقائية")
].map(c => c.toJSON());

async function sendLog(guild, title, description) {
  const channel = guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: "Powered by .v5d." })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

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

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Slash Commands جاهزة");
  console.log("✅ PostgreSQL متصل");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
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
            .setFooter({ text: "Powered by .v5d." })
        ]
      });
    }

    if (interaction.commandName === "warn") {
      const user = interaction.options.getUser("member");
      const reason = interaction.options.getString("reason");

      await db.query(
        `INSERT INTO warns
        (guild_id, user_id, moderator_id, reason)
        VALUES ($1,$2,$3,$4)`,
        [
          interaction.guildId,
          user.id,
          interaction.user.id,
          reason
        ]
      );

      const result = await db.query(
        `SELECT COUNT(*) FROM warns
         WHERE guild_id=$1 AND user_id=$2`,
        [interaction.guildId, user.id]
      );

      const number = result.rows[0].count;

      await interaction.reply(
        `⚠️ تم تحذير ${user}\n**السبب:** ${reason}`
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
    }

    if (interaction.commandName === "warnlist") {
      const result = await db.query(
        `SELECT * FROM warns
         WHERE guild_id=$1
         ORDER BY created_at DESC`,
        [interaction.guildId]
      );

      if (!result.rows.length)
        return interaction.reply("✅ لا توجد تحذيرات.");

      const text = result.rows
        .slice(0, 20)
        .map((w, i) =>
          `**${i + 1}.** <@${w.user_id}> — ${w.reason} — بواسطة <@${w.moderator_id}>`
        )
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("⚠️ Warn List")
            .setDescription(text)
        ]
      });
    }

    if (
      interaction.commandName === "lock" ||
      interaction.commandName === "unlock"
    ) {
      const locked = interaction.commandName === "lock";

      await interaction.channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: !locked }
      );

      await interaction.reply(
        locked ? "🔒 تم قفل الروم." : "🔓 تم فتح الروم."
      );

      await sendLog(
        interaction.guild,
        locked ? "🔒 Lock" : "🔓 Unlock",
        `**الروم:** ${interaction.channel}\n` +
        `**بواسطة:** ${interaction.user}`
      );
    }

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
                joined ? `<t:${joined}:F>` : "غير معروف"
              }`
            )
        ]
      });
    }

    if (interaction.commandName === "autoreply") {
      const sub = interaction.options.getSubcommand();
      const trigger =
        interaction.options.getString("trigger").toLowerCase();

      if (sub === "add") {
        const response =
          interaction.options.getString("response");

        await db.query(
          `INSERT INTO autoreplies
          (guild_id, trigger, response)
          VALUES ($1,$2,$3)
          ON CONFLICT (guild_id, trigger)
          DO UPDATE SET response=EXCLUDED.response`,
          [interaction.guildId, trigger, response]
        );

        return interaction.reply(
          `✅ تم إضافة الرد التلقائي.\n**الكلمة:** ${trigger}\n**الرد:** ${response}`
        );
      }

      if (sub === "remove") {
        const result = await db.query(
          `DELETE FROM autoreplies
           WHERE guild_id=$1 AND trigger=$2`,
          [interaction.guildId, trigger]
        );

        return interaction.reply(
          result.rowCount
            ? `🗑️ تم حذف الرد: **${trigger}**`
            : "❌ هذا الرد غير موجود."
        );
      }
    }

    if (interaction.commandName === "list") {
      const result = await db.query(
        `SELECT trigger, response
         FROM autoreplies
         WHERE guild_id=$1
         ORDER BY trigger`,
        [interaction.guildId]
      );

      if (!result.rows.length)
        return interaction.reply("📋 لا توجد ردود تلقائية.");

      const text = result.rows
        .map(r => `**${r.trigger}** → ${r.response}`)
        .join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle("📋 الردود التلقائية")
            .setDescription(text)
        ]
      });
    }

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

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const text = message.content.toLowerCase().trim();

  const result = await db.query(
    `SELECT response FROM autoreplies
     WHERE guild_id=$1 AND trigger=$2`,
    [message.guild.id, text]
  ).catch(() => ({ rows: [] }));

  if (result.rows.length) {
    await message.reply(result.rows[0].response);
  }
});

client.on("messageDelete", async message => {
  if (!message.guild || message.author?.bot) return;

  await sendLog(
    message.guild,
    "🗑️ حذف رسالة",
    `**العضو:** ${message.author || "غير معروف"}\n` +
    `**الروم:** ${message.channel}\n` +
    `**المحتوى:** ${message.content || "غير معروف"}`
  );
});

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

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
