const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { assignTeamsWithRules, assignTeamsSimple } = require('../utils/teams');
const { getAll: getRules } = require('../data/rulesData');
const teamCache = require('../data/teamCache');
const { log } = require('../utils/logger');

const emojis = {
    loltop:  '<:LOLtop:1328789500540878948>',
    loljg:   '<:LOLjg:1328789395779879012>',
    lolmid:  '<:LOLmid:1328789552302919753>',
    lolbot:  '<:LOLbot:1328789475467460712>',
    lolsup:  '<:LOLsupp:1328789523085262919>',
    lolfill: '<:LOLfill:1328789586599608430>',
};
const LANE_ORDER = ['loltop', 'loljg', 'lolmid', 'lolbot', 'lolsup'];

const definition = new SlashCommandBuilder()
    .setName('custom')
    .setDescription("Roll teams for a custom game.")
    .addStringOption(o =>
        o.setName('exclude')
            .setDescription('Players to exclude, e.g. @user1,@user2'))
    .addStringOption(o =>
        o.setName('lanes')
            .setDescription('Assign LoL roles to players.')
            .addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }))
    .addStringOption(o =>
        o.setName('rules')
            .setDescription('Apply team split rules.')
            .addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }));

async function execute(interaction) {
    log('info', `[/custom] ${interaction.user.tag} in guild "${interaction.guild.name}" (${interaction.guildId})`);
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
        return interaction.reply({ content: 'Musisz być na kanale głosowym!', flags: 4096 });
    }

    const excludeRaw = interaction.options.getString('exclude') ?? '';
    const excluded = (excludeRaw.match(/<@!?(\d+)>/g) ?? []).map(m => m.replace(/[<@!>]/g, ''));
    const members = Array.from(voiceChannel.members.values()).filter(m => !excluded.includes(m.user.id));

    if (members.length < 2) {
        return interaction.reply({ content: 'Nie wystarczająco graczy na customa.', flags: 4096 });
    }

    const assignLanes = interaction.options.getString('lanes') === 'on';
    const applyRules  = interaction.options.getString('rules') === 'on';

    let teams;
    try {
        teams = applyRules
            ? assignTeamsWithRules(members, getRules(), interaction.guild)
            : assignTeamsSimple(members);
    } catch (err) {
        log('error', `[/custom] Rule assignment failed for ${interaction.user.tag}:`, err.message);
        return interaction.reply({ content: err.message, flags: 4096 });
    }

    log('info', `[/custom] Teams assigned — ${teams[0].filter(Boolean).length}v${teams[1].filter(Boolean).length}, lanes=${assignLanes}, rules=${applyRules}`);

    const formatTeam = (team) => team
        .map((member, i) => {
            if (!member) return null;
            const emoji = assignLanes ? (emojis[LANE_ORDER[i]] ?? emojis.lolfill) : emojis.lolfill;
            const name = member.nickname
                ? `${member.user.username} (${member.nickname})`
                : member.user.username;
            return `${emoji} ${name}`;
        })
        .filter(Boolean)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle('Teamy na customa')
        .setColor(0x3498db)
        .setDescription(assignLanes ? 'Teamy z rolami League of Legends:' : 'Gracze podzieleni na następujące teamy:')
        .addFields(
            { name: 'Team 1', value: formatTeam(teams[0]) || 'Brak graczy', inline: true },
            { name: 'Team 2', value: formatTeam(teams[1]) || 'Brak graczy', inline: true },
        )
        .setFooter({ text: `Zrequestowane przez ${interaction.user.tag} • by @mirozogotbanned`, iconURL: interaction.user.displayAvatarURL() });

    const separateBtn = new ButtonBuilder()
        .setCustomId('separate_teams')
        .setLabel('🔊 Rozdziel teamy')
        .setStyle(ButtonStyle.Primary);

    await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(separateBtn)] });

    const message = await interaction.fetchReply();
    teamCache.set(message.id, {
        team1: teams[0].filter(Boolean).map(m => m.user.id),
        team2: teams[1].filter(Boolean).map(m => m.user.id),
        timerStart: null,
        timerEnabled: false,
        processing: false,
    });
}

module.exports = { definition, execute };
