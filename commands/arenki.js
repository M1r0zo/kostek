const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { log } = require('../utils/logger');

const definition = new SlashCommandBuilder()
    .setName('arenki')
    .setDescription('Split players into 2-person arena teams.');

async function execute(interaction) {
    log('info', `[/arenki] ${interaction.user.tag} in guild "${interaction.guild.name}" (${interaction.guildId})`);
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: 'Musisz być na kanale głosowym!', flags: 4096 });
    }

    const members = Array.from(voiceChannel.members.values());
    if (members.length < 2) {
        return interaction.reply({ content: 'Za mało graczy na arenki.', flags: 4096 });
    }

    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const teams = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        teams.push(shuffled.slice(i, i + 2));
    }

    const fields = teams.map((team, idx) => ({
        name: `Team ${idx + 1}`,
        value: team.map(m => m.nickname ? `${m.user.username} (${m.nickname})` : m.user.username).join('\n'),
        inline: true,
    }));

    const embed = new EmbedBuilder()
        .setTitle('Teamy na arenki')
        .setColor(0xf1c40f)
        .addFields(fields)
        .setFooter({ text: 'by @mirozogotbanned' });

    log('info', `[/arenki] ${teams.length} team(s) created for ${members.length} player(s)`);
    await interaction.reply({ embeds: [embed] });
}

module.exports = { definition, execute };
