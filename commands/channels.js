const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getChannels, setChannels } = require('../data/config');
const { log } = require('../utils/logger');

// ── /setchannels ──────────────────────────────────────────────────────────────

const setChannelsDefinition = new SlashCommandBuilder()
    .setName('setchannels')
    .setDescription('Set voice channels for teams. (Admin only)')
    .addChannelOption(o => o.setName('team1').setDescription('Voice channel for Team 1').setRequired(true).addChannelTypes(2))
    .addChannelOption(o => o.setName('team2').setDescription('Voice channel for Team 2').setRequired(true).addChannelTypes(2));

async function executeSetChannels(interaction) {
    log('info', `[/setchannels] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const ch1 = interaction.options.getChannel('team1');
    const ch2 = interaction.options.getChannel('team2');

    if (ch1.type !== 2 || ch2.type !== 2) {
        return interaction.reply({ content: 'Both channels must be voice channels.', flags: 4096 });
    }

    setChannels(interaction.guildId, ch1.id, ch2.id);
    log('success', `[/setchannels] Guild "${interaction.guild.name}" → Team 1: "${ch1.name}", Team 2: "${ch2.name}"`);
    return interaction.reply({
        content: `Channels saved.\nTeam 1: ${ch1.name}\nTeam 2: ${ch2.name}`,
        flags: 4096,
    });
}

// ── /channels ─────────────────────────────────────────────────────────────────

const channelsDefinition = new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Show currently configured team voice channels.');

async function executeChannels(interaction) {
    log('info', `[/channels] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    const cfg = getChannels(interaction.guildId);
    if (!cfg.team1 || !cfg.team2) {
        return interaction.reply({ content: 'No channels configured. Use `/setchannels` first.', flags: 4096 });
    }

    const ch1 = interaction.guild.channels.cache.get(cfg.team1);
    const ch2 = interaction.guild.channels.cache.get(cfg.team2);

    const embed = new EmbedBuilder()
        .setTitle('🔊 Configured Team Channels')
        .setColor(0x3498db)
        .addFields(
            { name: 'Team 1', value: ch1?.name ?? 'Channel not found', inline: true },
            { name: 'Team 2', value: ch2?.name ?? 'Channel not found', inline: true },
        )
        .setFooter({ text: 'by @mirozogotbanned' });

    return interaction.reply({ embeds: [embed] });
}

module.exports = {
    setchannels: { definition: setChannelsDefinition, execute: executeSetChannels },
    channels:    { definition: channelsDefinition,    execute: executeChannels },
};
