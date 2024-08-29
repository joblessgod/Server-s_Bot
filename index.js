const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { Player } = require('discord-player');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const player = new Player(client, {
    ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25
    }
});

const userLevels = new Collection();
const userEconomy = new Collection(); // { userId: { money: 0, items: [] } }
let welcomeChannelId = null;

client.once('ready', () => {
    console.log('Bot is online!');
});

client.on('guildMemberAdd', member => {
    if (welcomeChannelId) {
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🎉 Welcome!')
                .setDescription(`Welcome to the server, ${member.user.tag}! We're glad to have you here!`)
                .setThumbnail(member.user.displayAvatarURL());

            welcomeChannel.send({ embeds: [welcomeEmbed] });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith('~')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!userLevels.has(message.author.id)) {
        userLevels.set(message.author.id, { level: 1, messages: 0 });
    }
    const userLevel = userLevels.get(message.author.id);
    userLevel.messages += 1;
    if (userLevel.messages >= 10) { // Example threshold for leveling up
        userLevel.level += 1;
        userLevel.messages = 0;
        const levelUpEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎉 Level Up!')
            .setDescription(`${message.author}, you've leveled up to level ${userLevel.level}! Keep it going!`);

        message.channel.send({ embeds: [levelUpEmbed] });
    }
    userLevels.set(message.author.id, userLevel);

    if (!userEconomy.has(message.author.id)) {
        userEconomy.set(message.author.id, { money: 0, items: [] });
    }
    const userEco = userEconomy.get(message.author.id);

    if (command === 'play') {
        if (!message.member.voice.channel) {
            return message.reply('🚫 You need to be in a voice channel to play music!');
        }

        const query = args.join(' ');
        if (!query) {
            return message.reply('❗ Please provide a song name or a YouTube link!');
        }

        const queue = player.nodes.create(message.guild, {
            metadata: {
                channel: message.channel
            }
        });

        try {
            await queue.connect(message.member.voice.channel);
        } catch (err) {
            console.error('Error connecting to the voice channel:', err);
            queue.delete();
            return message.reply('❌ Could not join your voice channel!');
        }

        const searchResult = await player.search(query, {
            requestedBy: message.author,
            searchEngine: 'youtube'
        });

        if (!searchResult || !searchResult.tracks.length) {
            return message.reply(`🔍 No results found for "${query}"!`);
        }

        const track = searchResult.tracks[0];
        queue.addTrack(track);

        try {
            if (!queue.node.isPlaying()) {
                await queue.node.play();
            }
        } catch (playError) {
            console.error('Error playing the track:', playError);
            queue.delete();
            return message.reply('❌ Could not play the track!');
        }
    } else if (command === 'clear') {
        if (!message.member.permissions.has('MANAGE_MESSAGES')) {
            return message.reply('❗ You do not have permission to clear messages!');
        }

        const fetched = await message.channel.messages.fetch({ limit: 100 });
        const toDelete = fetched.filter(msg => !msg.pinned);

        message.channel.bulkDelete(toDelete)
            .then(() => message.reply('✅ Messages cleared!'))
            .catch(err => message.reply('❌ Failed to clear messages.'));
    } else if (command === 'level') {
        const userLevel = userLevels.get(message.author.id);
        if (userLevel) {
            const levelEmbed = new EmbedBuilder()
                .setColor('#00BFFF')
                .setTitle('📊 Your Level')
                .setDescription(`You are currently level **${userLevel.level}** with **${userLevel.messages}** messages.`);

            message.channel.send({ embeds: [levelEmbed] });
        } else {
            message.reply('❌ No leveling data found for you.');
        }
    } else if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#1E90FF')
            .setTitle('🛠️ Bot Commands')
            .setDescription(`
**🎵 Music Commands:**
- **~play <song name or URL>**: Play a song in the voice channel.
- **~pause**: Pause the current song.
- **~resume**: Resume the paused song.
- **~stop**: Stop playback and leave the voice channel.
- **~skip**: Skip the current song.
- **~queue**: Show the current song queue.

**🔧 Moderation Commands:**
- **~kick <@user>**: Kick a user from the server (Requires Kick Members permission).
- **~ban <@user>**: Ban a user from the server (Requires Ban Members permission).
- **~unban <user ID>**: Unban a user by their ID (Requires Ban Members permission).
- **~timeout <@user> <duration in seconds>**: Timeout a user for a specified duration (Requires Manage Members permission).
- **~removetimeout <@user>**: Remove the timeout from a user (Requires Manage Members permission).

**ℹ️ Information Commands:**
- **~level**: Check your current level and message count.
- **~rules**: Display the server rules.
- **~music**: Show a list of music player commands.
- **~emoji**: Use a custom emoji.
- **~playtest**: Test playing a specific song.

**🎟️ Ticket Commands:**
- **~ticket**: Create a private ticket channel for support (Requires Manage Channels permission).

**💰 Economy Commands:**
- **~balance**: Check your current balance.
- **~grind**: Grind to earn money or rare items.
- **~sell <item>**: Sell an item to earn money.
- **~shop**: View the shop to buy items or roles.
- **~rob <@user>**: Attempt to rob another user for money.
- **~give <@user> <amount>**: Give money to another user (Requires Moderator or Owner permission).
- **~pay <@user> <amount>**: Pay a user a specified amount of money.
`);

        message.channel.send({ embeds: [helpEmbed] });
    } else if (command === 'rules') {
        const rulesEmbed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('📜 Server Rules')
            .setDescription(`
1. **Be Respectful**: Treat everyone with respect and kindness.
2. **No Spamming**: Avoid spamming messages or commands.
3. **Follow Discord Guidelines**: Adhere to Discord's Community Guidelines.
`);

        message.channel.send({ embeds: [rulesEmbed] });
    } else if (command === 'emoji') {
        const feeling = args.join(' ').toLowerCase();
        let emoji = '';

        switch (feeling) {
            case 'happy':
                emoji = '😊'; break;
            case 'sad':
                emoji = '😢'; break;
            case 'angry':
                emoji = '😡'; break;
            case 'love':
                emoji = '❤️'; break;
            case 'surprised':
                emoji = '😮'; break;
            case 'laugh':
                emoji = '😂'; break;
            case 'cry':
                emoji = '😭'; break;
            default:
                emoji = '🤔'; // Default emoji for undefined feelings
        }

        const emojiEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('😊 Emoji')
            .setDescription(`Feeling ${feeling}? Here's an emoji for you: ${emoji}`);

        message.channel.send({ embeds: [emojiEmbed] });
    } else if (command === 'playtest') {
        if (!message.member.voice.channel) {
            return message.reply('🚫 You need to be in a voice channel to play music!');
        }

        const queue = player.nodes.create(message.guild, {
            metadata: {
                channel: message.channel
            }
        });

        try {
            await queue.connect(message.member.voice.channel);
        } catch (err) {
            console.error('Error connecting to the voice channel:', err);
            queue.delete();
            return message.reply('❌ Could not join your voice channel!');
        }

        try {
            await queue.node.play('Despacito'); // Example test song
            message.reply('🎶 Test song is playing!');
        } catch (playError) {
            console.error('Error playing the test song:', playError);
            queue.delete();
            return message.reply('❌ Could not play the test song!');
        }
    } else if (command === 'welcome') {
        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❗ Please mention a valid channel to set as the welcome channel!');
        }
        welcomeChannelId = channel.id;
        message.reply(`✅ Welcome channel has been set to ${channel}!`);
    } else if (command === 'balance') {
        const balanceEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('💰 Your Balance')
            .setDescription(`You currently have **${userEco.money}** money.`);

        message.channel.send({ embeds: [balanceEmbed] });
    } else if (command === 'grind') {
        const earnings = Math.floor(Math.random() * 100) + 1;
        userEco.money += earnings;

        const grindEmbed = new EmbedBuilder()
            .setColor('#32CD32')
            .setTitle('💪 Grind Result')
            .setDescription(`You've worked hard and earned **${earnings}** money!`);

        message.channel.send({ embeds: [grindEmbed] });
    } else if (command === 'sell') {
        const item = args.join(' ');
        if (!item) {
            return message.reply('❗ Please specify an item to sell.');
        }

        const earnings = 50; // Example fixed earnings for selling an item
        userEco.money += earnings;

        const sellEmbed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('💸 Sell Item')
            .setDescription(`You've sold **${item}** and earned **${earnings}** money!`);

        message.channel.send({ embeds: [sellEmbed] });
    } else if (command === 'shop') {
        const shopItems = `
**🛒 Shop:**
- **Item 1**: $100
- **Item 2**: $200
- **Role 1**: $500
- **Role 2**: $1000
        `;

        const shopEmbed = new EmbedBuilder()
            .setColor('#FF4500')
            .setTitle('🛍️ Shop')
            .setDescription(shopItems);

        message.channel.send({ embeds: [shopEmbed] });
    } else if (command === 'rob') {
        const member = message.mentions.members.first();
        if (!member) {
            return message.reply('❗ Please mention a user to rob.');
        }

        const robberySuccess = Math.random() < 0.5;
        if (robberySuccess) {
            const robAmount = Math.floor(Math.random() * 100) + 1;
            userEco.money += robAmount;

            const robEmbed = new EmbedBuilder()
                .setColor('#FF6347')
                .setTitle('💰 Robbery Success!')
                .setDescription(`You've successfully robbed **${member.user.tag}** and earned **${robAmount}** money!`);

            message.channel.send({ embeds: [robEmbed] });
        } else {
            message.reply(`❌ Robbery failed! Better luck next time.`);
        }
    } else if (command === 'give') {
        if (!message.member.permissions.has('MANAGE_GUILD')) {
            return message.reply('🚫 You do not have permission to use this command!');
        }

        const member = message.mentions.members.first();
        const amount = parseInt(args[1]);

        if (!member || isNaN(amount)) {
            return message.reply('❗ Please mention a user and specify an amount to give.');
        }

        const targetEco = userEconomy.get(member.id);
        if (targetEco) {
            targetEco.money += amount;
            userEconomy.set(member.id, targetEco);

            const giveEmbed = new EmbedBuilder()
                .setColor('#4B0082')
                .setTitle('💸 Money Given')
                .setDescription(`You have given **${amount}** money to **${member.user.tag}**.`);

            message.channel.send({ embeds: [giveEmbed] });
        } else {
            message.reply('❌ User not found in economy records.');
        }
    } else if (command === 'pay') {
        const member = message.mentions.members.first();
        const amount = parseInt(args[1]);

        if (!member || isNaN(amount)) {
            return message.reply('❗ Please mention a user and specify an amount to pay.');
        }

        const senderEco = userEconomy.get(message.author.id);
        const receiverEco = userEconomy.get(member.id);

        if (senderEco.money < amount) {
            return message.reply('❌ You do not have enough money to make this payment.');
        }

        senderEco.money -= amount;
        receiverEco.money += amount;
        userEconomy.set(message.author.id, senderEco);
        userEconomy.set(member.id, receiverEco);

        const payEmbed = new EmbedBuilder()
            .setColor('#00FF7F')
            .setTitle('💵 Payment Sent')
            .setDescription(`You have paid **${amount}** money to **${member.user.tag}**.`);

        message.channel.send({ embeds: [payEmbed] });
    } else if (command === 'ticket') {
        const ticketChannel = await message.guild.channels.create({
            name: `ticket-${message.author.username}`,
            type: 'GUILD_TEXT',
            permissionOverwrites: [
                {
                    id: message.guild.roles.everyone,
                    deny: ['VIEW_CHANNEL'],
                },
                {
                    id: message.author.id,
                    allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
                },
                {
                    id: message.guild.roles.cache.find(role => role.name === 'Administrator').id,
                    allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
                },
            ],
        });

        const ticketEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🎫 Ticket Created')
            .setDescription(`Your support ticket has been created: ${ticketChannel}. An administrator will assist you shortly.`);

        message.channel.send({ embeds: [ticketEmbed] });
    } else {
        message.reply('❗ Unknown command. Use `~help` to see all available commands.');
    }
});

// Log in to Discord with your bot token
client.login('MTI3Nzg0ODcxMDQyODA5ODU5Mg.GSSNjt.De1wRctazdVEBNayUhbQ9fLeFIMA8JMgQE0nx0');
