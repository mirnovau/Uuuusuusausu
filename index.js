const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const logs = new Map();
const warns = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("مين أنا؟"),

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("تايم أوت")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName("minutes").setDescription("الدقائق").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("reason").setDescription("السبب").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح رسائل")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("العدد").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("قفل الروم"),

  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("فتح الروم"),

  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("صورة عضو")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("معلومات عضو")
    .addUserOption(o =>
      o.setName("user").setDescription("العضو").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("إعداد اللوق")
    .addSubcommand(s =>
      s.setName("setup")
        .setDescription("تحديد روم اللوق")
        .addChannelOption(o =>
          o.setName("channel")
            .setDescription("روم اللوق")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(s =>
      s.setName("off").setDescription("إيقاف اللوق")
    )
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log("✅ الأوامر جاهزة");
})();

async function log(guild, title, text) {
  const id = logs.get(guild.id);
  if (!id) return;

  const channel = guild.channels.cache.get(id);
  if (!channel) return;

  channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setTimestamp()
    ]
  }).catch(() => {});
}

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} Online`);

  client.user.setPresence({
    activities: [{ name: "Powered by .v5d." }],
    status: "online"
  });
});

client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  try {

    // /me
    if (i.commandName === "me") {
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🤖 مين أنا؟")
            .setDescription(
              "**المترجم:** مين أنا\n\n" +
              "**الإجابة:**\n" +
              "أنا بوت خاص لـ **.v5d.**\n" +
              "ولدي سيرفر **MR NOVA**\n" +
              "وتحت خدمة **Leon** و **Alshahri**"
            )
            .setFooter({ text: "Powered by .v5d." })
        ]
      });
    }

    // /logs
    if (i.commandName === "logs") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageGuild))
        return i.reply({ content: "❌ تحتاج Manage Server.", ephemeral: true });

      if (i.options.getSubcommand() === "setup") {
        const channel = i.options.getChannel("channel");
        logs.set(i.guild.id, channel.id);

        return i.reply(`✅ تم تحديد ${channel} للـ Logs.`);
      }

      logs.delete(i.guild.id);
      return i.reply("✅ تم إيقاف الـ Logs.");
    }

    // Ban
    if (i.commandName === "ban") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
        return i.reply({ content: "❌ لا تملك صلاحية Ban.", ephemeral: true });

      const member = await i.guild.members.fetch(
        i.options.getUser("user").id
      );

      await member.ban();

      await log(
        i.guild,
        "🔨 Ban",
        `العضو: ${member.user.tag}\nبواسطة: ${i.user.tag}`
      );

      return i.reply(`🔨 تم حظر ${member.user.tag}`);
    }

    // Kick
    if (i.commandName === "kick") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.KickMembers))
        return i.reply({ content: "❌ لا تملك صلاحية Kick.", ephemeral: true });

      const member = await i.guild.members.fetch(
        i.options.getUser("user").id
      );

      await member.kick();

      await log(
        i.guild,
        "👢 Kick",
        `العضو: ${member.user.tag}\nبواسطة: ${i.user.tag}`
      );

      return i.reply(`👢 تم طرد ${member.user.tag}`);
    }

    // Timeout
    if (i.commandName === "timeout") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers))
        return i.reply({ content: "❌ لا تملك صلاحية Timeout.", ephemeral: true });

      const member = await i.guild.members.fetch(
        i.options.getUser("user").id
      );

      const minutes = i.options.getInteger("minutes");

      await member.timeout(minutes * 60000);

      await log(
        i.guild,
        "⏳ Timeout",
        `العضو: ${member.user.tag}\nالمدة: ${minutes} دقيقة`
      );

      return i.reply(`⏳ تم إعطاء ${member.user.tag} تايم أوت.`);
    }

    // Warn
    if (i.commandName === "warn") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ModerateMembers))
        return i.reply({ content: "❌ لا تملك صلاحية Warn.", ephemeral: true });

      const user = i.options.getUser("user");
      const reason = i.options.getString("reason");

      const key = `${i.guild.id}-${user.id}`;

      if (!warns.has(key)) warns.set(key, []);
      warns.get(key).push(reason);

      await log(
        i.guild,
        "⚠️ Warning",
        `العضو: ${user.tag}\nالسبب: ${reason}\nبواسطة: ${i.user.tag}`
      );

      return i.reply(`⚠️ تم تحذير ${user.tag}`);
    }

    // Clear
    if (i.commandName === "clear") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageMessages))
        return i.reply({ content: "❌ لا تملك Manage Messages.", ephemeral: true });

      const amount = i.options.getInteger("amount");

      await i.channel.bulkDelete(amount, true);

      return i.reply({
        content: `🧹 تم مسح ${amount} رسالة.`,
        ephemeral: true
      });
    }

    // Lock
    if (i.commandName === "lock") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageChannels))
        return i.reply({ content: "❌ لا تملك Manage Channels.", ephemeral: true });

      await i.channel.permissionOverwrites.edit(
        i.guild.roles.everyone,
        { SendMessages: false }
      );

      await log(i.guild, "🔒 Lock", `الروم: ${i.channel}`);

      return i.reply("🔒 تم قفل الروم.");
    }

    // Unlock
    if (i.commandName === "unlock") {
      if (!i.memberPermissions.has(PermissionsBitField.Flags.ManageChannels))
        return i.reply({ content: "❌ لا تملك Manage Channels.", ephemeral: true });

      await i.channel.permissionOverwrites.edit(
        i.guild.roles.everyone,
        { SendMessages: null }
      );

      await log(i.guild, "🔓 Unlock", `الروم: ${i.channel}`);

      return i.reply("🔓 تم فتح الروم.");
    }

    // Avatar
    if (i.commandName === "avatar") {
      const user = i.options.getUser("user");

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🖼️ Avatar — ${user.tag}`)
            .setImage(user.displayAvatarURL({ size: 1024 }))
        ]
      });
    }

    // Userinfo
    if (i.commandName === "userinfo") {
      const user = i.options.getUser("user");

      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`👤 ${user.tag}`)
            .setThumbnail(user.displayAvatarURL())
            .addFields({
              name: "ID",
              value: user.id
            })
        ]
      });
    }

  } catch (error) {
    console.error(error);

    if (!i.replied) {
      i.reply({
        content: "❌ حدث خطأ.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.on("messageDelete", message => {
  if (!message.guild) return;

  log(
    message.guild,
    "🗑️ Message Deleted",
    `الروم: ${message.channel}\nالمحتوى: ${message.content || "غير متاح"}`
  );
});

client.on("messageUpdate", (oldMessage, newMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  log(
    oldMessage.guild,
    "✏️ Message Edited",
    `قبل:\n${oldMessage.content || "فارغ"}\n\nبعد:\n${newMessage.content || "فارغ"}`
  );
});

client.login(TOKEN);
