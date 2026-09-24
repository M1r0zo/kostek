require('dotenv').config();
const { Client, GatewayIntentBits, PresenceUpdateStatus } = require('discord.js');
const { log }          = require('./utils/logger');
const configData       = require('./data/config');
const rulesData        = require('./data/rulesData');
const { getDefinitions, dispatch } = require('./commands/index');
const { handle: handleButton }     = require('./handlers/buttonHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,      // required for guild.members.fetch() to work
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// ── Startup ───────────────────────────────────────────────────────────────────

client.once('clientReady', async () => {
    client.user.setStatus(PresenceUpdateStatus.Invisible);

    // Load persisted data into memory once at boot
    configData.load();
    rulesData.load();

    try {
        await client.application.commands.set(getDefinitions());
        log('success', `Bot ready — logged in as ${client.user.tag}`);
    } catch (e) {
        log('error', 'Failed to register slash commands:', e);
    }
});

// ── Interaction router ────────────────────────────────────────────────────────

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            await dispatch(interaction);
        } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
            await handleButton(interaction);
        }
    } catch (e) {
        log('error', '[INTERACTION]', e);
        const reply = { content: 'Something went wrong. Please try again.', flags: 4096 };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply).catch(() => {});
        } else {
            await interaction.reply(reply).catch(() => {});
        }
    }
});

// ── Login ─────────────────────────────────────────────────────────────────────

client.login(process.env.DISCORD_TOKEN);
