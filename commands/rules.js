const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { getAll, add, removeById, isDuplicate, clear } = require('../data/rulesData');
const { getDisplayName } = require('../utils/display');
const { log } = require('../utils/logger');

// ── /addrule ────────────────────────────────────────────────────────────────

const addRuleDefinition = new SlashCommandBuilder()
    .setName('addrule')
    .setDescription('Add a team split rule. (Admin only)')
    .addUserOption(o => o.setName('player').setDescription('Player').setRequired(true))
    .addStringOption(o =>
        o.setName('constraint').setDescription('Rule type').setRequired(true)
            .addChoices(
                { name: 'Cannot be at position',          value: 'not_position' },
                { name: 'Must be at position',            value: 'must_position' },
                { name: 'Cannot share position with',     value: 'not_same_position' },
                { name: 'Must share position with',       value: 'same_position' },
                { name: 'Cannot be on the same team as',  value: 'not_same_team' },
                { name: 'Must be on the same team as',    value: 'same_team' },
            ))
    .addIntegerOption(o => o.setName('position').setDescription('Position (1–5)').setMinValue(1).setMaxValue(5))
    .addUserOption(o => o.setName('other_player').setDescription('Second player (for two-player rules)'));

async function executeAddRule(interaction) {
    log('info', `[/addrule] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const player     = interaction.options.getUser('player');
    const constraint = interaction.options.getString('constraint');
    const position   = interaction.options.getInteger('position');
    const other      = interaction.options.getUser('other_player');

    if ((constraint === 'not_position' || constraint === 'must_position') && !position) {
        return interaction.reply({ content: 'A position (1–5) is required for this rule type.', flags: 4096 });
    }
    if (['not_same_position','same_position','not_same_team','same_team'].includes(constraint) && !other) {
        return interaction.reply({ content: 'A second player is required for this rule type.', flags: 4096 });
    }

    const rule = { playerId: player.id, type: constraint };
    if (position) rule.position = position;
    if (other)    rule.otherId  = other.id;

    if (isDuplicate(rule)) {
        return interaction.reply({ content: 'This rule already exists.', flags: 4096 });
    }

    add(rule);
    log('success', `[/addrule] Rule added by ${interaction.user.tag}:`, JSON.stringify(rule));
    return interaction.reply({ content: 'Rule added successfully.', flags: 4096 });
}

// ── /removerule ─────────────────────────────────────────────────────────────

const removeRuleDefinition = new SlashCommandBuilder()
    .setName('removerule')
    .setDescription('Remove one or more team split rules. (Admin only)');

async function executeRemoveRule(interaction) {
    log('info', `[/removerule] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const rules = getAll();
    if (!rules.length) {
        return interaction.reply({ content: 'No rules to remove.', flags: 4096 });
    }

    const descriptions = await Promise.all(rules.map(r => describeRule(r, null, interaction.guild)));

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Remove rules')
        .setColor(0xe74c3c)
        .setDescription(descriptions.join('\n'))
        .setFooter({ text: 'Select one or more rules, then confirm • by @mirozogotbanned' });

    const options = await Promise.all(
        rules.slice(0, 25).map(async (rule, i) => {
            const label = await describeRuleShort(rule, interaction.guild);
            return new StringSelectMenuOptionBuilder()
                .setLabel(label.slice(0, 100))
                .setValue(rule.id)
                .setDescription(`Rule ${i + 1}`);
        })
    );

    const menu = new StringSelectMenuBuilder()
        .setCustomId('removerule_select')
        .setPlaceholder('Select rules to remove…')
        .setMinValues(1)
        .setMaxValues(Math.min(rules.length, 25))
        .addOptions(options);

    return interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
        flags: 4096,
    });
}

// ── /rules ───────────────────────────────────────────────────────────────────

const rulesDefinition = new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Show current team split rules. (Admin only)');

async function executeRules(interaction) {
    log('info', `[/rules] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const rules = getAll();
    if (!rules.length) {
        return interaction.reply({ content: 'No rules configured.', flags: 4096 });
    }

    const descriptions = await Promise.all(rules.map((r, i) => describeRule(r, i, interaction.guild)));

    const embed = new EmbedBuilder()
        .setTitle('Current Team Split Rules')
        .setColor(0x2ecc71)
        .setDescription(descriptions.join('\n'))
        .setFooter({ text: 'by @mirozogotbanned' });

    return interaction.reply({ embeds: [embed], flags: 4096 });
}

// ── /clearrules ───────────────────────────────────────────────────────────────

const clearRulesDefinition = new SlashCommandBuilder()
    .setName('clearrules')
    .setDescription('Remove all team split rules at once. (Admin only)');

async function executeClearRules(interaction) {
    log('info', `[/clearrules] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const count = clear();
    if (count === 0) {
        return interaction.reply({ content: 'No rules to clear.', flags: 4096 });
    }
    log('success', `[/clearrules] ${count} rule(s) cleared by ${interaction.user.tag}`);
    return interaction.reply({ content: `Cleared ${count} rule${count !== 1 ? 's' : ''}.`, flags: 4096 });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Full description used in embeds. index=null omits the numbering prefix.
 */
async function describeRule(rule, index, guild) {
    const p = await getDisplayName(rule.playerId, guild);
    const prefix = index !== null && index !== undefined ? `**${index + 1}.** ` : '- ';
    switch (rule.type) {
        case 'not_position':      return `${prefix}${p} cannot be at position ${rule.position}`;
        case 'must_position':     return `${prefix}${p} must be at position ${rule.position}`;
        case 'not_same_position': { const o = await getDisplayName(rule.otherId, guild); return `${prefix}${p} cannot share a position with ${o}`; }
        case 'same_position':     { const o = await getDisplayName(rule.otherId, guild); return `${prefix}${p} must share a position with ${o}`; }
        case 'not_same_team':     { const o = await getDisplayName(rule.otherId, guild); return `${prefix}${p} cannot be on the same team as ${o}`; }
        case 'same_team':         { const o = await getDisplayName(rule.otherId, guild); return `${prefix}${p} must be on the same team as ${o}`; }
        default: return `${prefix}Unknown rule`;
    }
}

/**
 * Short plain-text version for select menu option labels (no markdown, no prefix).
 */
async function describeRuleShort(rule, guild) {
    const p = await getDisplayName(rule.playerId, guild);
    switch (rule.type) {
        case 'not_position':      return `${p} not at pos ${rule.position}`;
        case 'must_position':     return `${p} must be at pos ${rule.position}`;
        case 'not_same_position': { const o = await getDisplayName(rule.otherId, guild); return `${p} ≠ pos of ${o}`; }
        case 'same_position':     { const o = await getDisplayName(rule.otherId, guild); return `${p} = pos of ${o}`; }
        case 'not_same_team':     { const o = await getDisplayName(rule.otherId, guild); return `${p} ≠ team of ${o}`; }
        case 'same_team':         { const o = await getDisplayName(rule.otherId, guild); return `${p} = team of ${o}`; }
        default: return 'Unknown rule';
    }
}

module.exports = {
    addrule:    { definition: addRuleDefinition,    execute: executeAddRule },
    removerule: { definition: removeRuleDefinition, execute: executeRemoveRule },
    rules:      { definition: rulesDefinition,      execute: executeRules },
    clearrules: { definition: clearRulesDefinition, execute: executeClearRules },
    describeRule,
};
