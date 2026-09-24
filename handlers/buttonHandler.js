const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getChannels } = require('../data/config');
const { removeById } = require('../data/rulesData');
const { describeRule } = require('../commands/rules');
const { EmbedBuilder } = require('discord.js');
const teamCache = require('../data/teamCache');
const pendingDeletions = require('../data/pendingDeletions');
const { log } = require('../utils/logger');

const TIMER_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const TIMER_TICK_MS     = 30 * 1000;       // update every 30s

async function handle(interaction) {
    const id = interaction.customId;

    if (id === 'separate_teams')                    return handleSeparate(interaction);
    if (id === 'return_everyone')                   return handleReturn(interaction);
    if (id === 'removerule_select')                 return handleRemoveRuleSelect(interaction);
    if (id.startsWith('removerule_confirm_'))       return handleRemoveRuleConfirm(interaction);
    if (id.startsWith('removerule_cancel_'))        return handleRemoveRuleCancel(interaction);
}

// ── Separate teams into channels ──────────────────────────────────────────────

async function handleSeparate(interaction) {
    log('info', `[separate_teams] ${interaction.user.tag} in guild "${interaction.guild.name}" (msg: ${interaction.message.id})`);
    if (!interaction.member.permissions.has('Administrator')) {
        log('warn', `[separate_teams] Blocked — ${interaction.user.tag} lacks Administrator in "${interaction.guild.name}"`);
        return interaction.reply({
            content: `<@${interaction.user.id}> nie klikaj w guziczek bo nie możesz`,
            files: ['https://media1.tenor.com/m/wGS2q7NW0WcAAAAd/lord-of-the-rings-lotr.gif'],
            flags: 4096
        });
    }

    // Immediately swap button to "processing" state
    await interaction.update({ components: [processingRow()] });

    const cfg = getChannels(interaction.guildId);
    if (!cfg.team1 || !cfg.team2) {
        return interaction.followUp({ content: 'Kanały głosowe nie są ustawione. Użyj `/setchannels`.', flags: 4096 });
    }

    const ch1 = interaction.guild.channels.cache.get(cfg.team1);
    const ch2 = interaction.guild.channels.cache.get(cfg.team2);
    if (!ch1 || !ch2) {
        return interaction.followUp({ content: 'Jeden lub więcej kanałów nie istnieje. Użyj `/setchannels` ponownie.', flags: 4096 });
    }

    const teamData = teamCache.get(interaction.message.id);
    if (!teamData) {
        return interaction.followUp({ content: 'Nie znaleziono danych teamów (wiadomość mogła wygasnąć).', flags: 4096 });
    }
    if (teamData.processing) {
        return interaction.followUp({ content: 'Teamy są już rozdzielane.', flags: 4096 });
    }
    teamData.processing = true;

    const { moved, errors } = await moveMembers(interaction.guild, teamData.team1, ch1);
    const r2 = await moveMembers(interaction.guild, teamData.team2, ch2);
    const totalMoved = moved + r2.moved;
    const allErrors  = [...errors, ...r2.errors];

    // Mark timer start
    teamData.timerStart   = Date.now();
    teamData.timerEnabled = false;

    // Show completed + countdown buttons
    await interaction.editReply({ components: [completedRow('⏱️ 10:00')] });

    // Start countdown ticks
    startCountdown(interaction, interaction.message.id);

    // Only report errors — no success message
    if (allErrors.length) {
        log('warn', `[separate_teams] ${allErrors.length} move error(s):`, allErrors.join(' | '));
        return interaction.followUp({ content: `Błędy przy przenoszeniu:\n${allErrors.join('\n')}`, flags: 4096 });
    }
    log('success', `[separate_teams] Moved ${totalMoved} player(s) — guild "${interaction.guild.name}"`);
}

// ── Return everyone to one channel ────────────────────────────────────────────

async function handleReturn(interaction) {
    log('info', `[return_everyone] ${interaction.user.tag} in guild "${interaction.guild.name}" (msg: ${interaction.message.id})`);
    if (!interaction.member.permissions.has('Administrator')) {
        log('warn', `[return_everyone] Blocked — ${interaction.user.tag} lacks Administrator in "${interaction.guild.name}"`);
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    // Validate everything before deferring — once deferred we can only followUp
    const cfg = getChannels(interaction.guildId);
    if (!cfg.team1 || !cfg.team2) {
        return interaction.reply({ content: 'Kanały głosowe nie są ustawione. Użyj `/setchannels`.', flags: 4096 });
    }

    const ch1 = interaction.guild.channels.cache.get(cfg.team1);
    const ch2 = interaction.guild.channels.cache.get(cfg.team2);
    if (!ch1 || !ch2) {
        return interaction.reply({ content: 'Jeden lub więcej kanałów nie istnieje. Użyj `/setchannels` ponownie.', flags: 4096 });
    }

    const teamData = teamCache.get(interaction.message.id);
    if (!teamData) {
        return interaction.reply({ content: 'Nie znaleziono danych teamów.', flags: 4096 });
    }

    // All checks passed — safe to defer now
    await interaction.deferUpdate();

    // Move everyone to whichever team channel currently has more people
    const target = ch1.members.size >= ch2.members.size ? ch1 : ch2;
    const allIds = [...teamData.team1, ...teamData.team2];
    const { moved, errors } = await moveMembers(interaction.guild, allIds, target);

    // Reset to original separate button
    const separateBtn = new ButtonBuilder()
        .setCustomId('separate_teams')
        .setLabel('🔊 Rozdziel teamy')
        .setStyle(ButtonStyle.Primary);
    await interaction.editReply({ components: [new ActionRowBuilder().addComponents(separateBtn)] });

    teamCache.del(interaction.message.id);

    // Only report errors — no success message
    if (errors.length) {
        log('warn', `[return_everyone] ${errors.length} move error(s):`, errors.join(' | '));
        return interaction.followUp({ content: `Błędy przy przenoszeniu:\n${errors.join('\n')}`, flags: 4096 });
    }
    log('success', `[return_everyone] Moved ${moved} player(s) to "${target.name}" — guild "${interaction.guild.name}"`);
}

// ── Remove rule — step 1: selection ──────────────────────────────────────────

async function handleRemoveRuleSelect(interaction) {
    log('info', `[removerule_select] ${interaction.user.tag} selected ${interaction.values.length} rule(s) in guild "${interaction.guild.name}"`);
    const selectedIds = interaction.values;

    // Store the selection keyed by this interaction's ID
    pendingDeletions.set(interaction.id, {
        ruleIds: selectedIds,
        guildId: interaction.guildId,
    });

    const count = selectedIds.length;
    const label = count === 1 ? '1 rule' : `${count} rules`;

    // Encode the interaction ID into button customIds so the handler can retrieve the pending selection
    const confirmBtn = new ButtonBuilder()
        .setCustomId(`removerule_confirm_${interaction.id}`)
        .setLabel(`🗑️ Remove ${label}`)
        .setStyle(ButtonStyle.Danger);

    const cancelBtn = new ButtonBuilder()
        .setCustomId(`removerule_cancel_${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    return interaction.update({
        components: [new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)],
    });
}

// ── Remove rule — step 2: confirm ────────────────────────────────────────────

async function handleRemoveRuleConfirm(interaction) {
    log('info', `[removerule_confirm] ${interaction.user.tag} in guild "${interaction.guild.name}"`);
    const pendingId = interaction.customId.replace('removerule_confirm_', '');
    const pending   = pendingDeletions.get(pendingId);

    if (!pending) {
        // TTL expired (5 min) or already actioned
        const embed = new EmbedBuilder()
            .setTitle('🗑️ Selection expired')
            .setColor(0xe74c3c)
            .setDescription('The selection timed out. Please run `/removerule` again.')
            .setFooter({ text: 'by @mirozogotbanned' });
        return interaction.update({ embeds: [embed], components: [] });
    }

    pendingDeletions.del(pendingId);

    const removed  = [];
    const notFound = [];

    for (const id of pending.ruleIds) {
        const rule = removeById(id);
        if (rule) removed.push(rule);
        else notFound.push(id);
    }

    // Build a readable list of what was actually removed
    const lines = await Promise.all(
        removed.map(r => describeRule(r, null, interaction.guild))
    );
    const struckLines = lines.map(l => `~~${l.replace(/^- /, '')}~~`);

    if (notFound.length) {
        struckLines.push(`_${notFound.length} rule(s) were already gone._`);
    }

    const embed = new EmbedBuilder()
        .setTitle(`🗑️ ${removed.length} rule${removed.length !== 1 ? 's' : ''} removed`)
        .setColor(0xe74c3c)
        .setDescription(struckLines.join('\n'))
        .setFooter({ text: 'by @mirozogotbanned' });

    log('success', `[removerule_confirm] ${removed.length} rule(s) removed by ${interaction.user.tag}, ${notFound.length} already gone`);
    return interaction.update({ embeds: [embed], components: [] });
}

// ── Remove rule — step 2: cancel ─────────────────────────────────────────────

async function handleRemoveRuleCancel(interaction) {
    log('info', `[removerule_cancel] ${interaction.user.tag} cancelled rule removal in guild "${interaction.guild.name}"`);
    const pendingId = interaction.customId.replace('removerule_cancel_', '');
    pendingDeletions.del(pendingId);

    const embed = new EmbedBuilder()
        .setTitle('🗑️ Cancelled')
        .setColor(0x95a5a6)
        .setDescription('No rules were removed.')
        .setFooter({ text: 'by @mirozogotbanned' });

    return interaction.update({ embeds: [embed], components: [] });
}

// ── Countdown timer ───────────────────────────────────────────────────────────

function startCountdown(interaction, messageId) {
    const tick = async () => {
        const data = teamCache.get(messageId);
        if (!data || data.timerEnabled) return;

        const remaining = TIMER_DURATION_MS - (Date.now() - data.timerStart);

        if (remaining <= 0) {
            data.timerEnabled = true;
            const returnBtn = new ButtonBuilder()
                .setCustomId('return_everyone')
                .setLabel('🔴 Wróć wszystkich')
                .setStyle(ButtonStyle.Danger);
            const doneBtn = new ButtonBuilder()
                .setCustomId('separate_teams_completed')
                .setLabel('✅ Rozdzielono')
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);
            try {
                await interaction.editReply({ components: [new ActionRowBuilder().addComponents(doneBtn, returnBtn)] });
            } catch (e) {
                log('error', '[TIMER] Failed to enable return button:', e.message);
            }
            return;
        }

        const totalSec    = Math.ceil(remaining / 1000);
        const roundedSec  = Math.ceil(totalSec / 30) * 30;
        const label       = `⏱️ ${Math.floor(roundedSec / 60)}:${String(roundedSec % 60).padStart(2, '0')}`;

        try {
            await interaction.editReply({ components: [completedRow(label)] });
        } catch (e) {
            log('error', '[TIMER] Failed to update countdown:', e.message);
            return; // stop ticking if message is gone
        }

        setTimeout(tick, TIMER_TICK_MS);
    };

    setTimeout(tick, TIMER_TICK_MS);
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function processingRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('separate_teams_processing').setLabel('⏳ Rozdzielanie...').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
}

function completedRow(timerLabel) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('separate_teams_completed').setLabel('✅ Rozdzielono').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('return_timer').setLabel(timerLabel).setStyle(ButtonStyle.Secondary).setDisabled(true),
    );
}

// ── Move helper ───────────────────────────────────────────────────────────────

async function moveMembers(guild, userIds, targetChannel) {
    let moved = 0;
    const errors = [];
    for (const id of userIds) {
        const member = guild.members.cache.get(id);
        if (!member?.voice.channel) continue;
        if (member.voice.channel.id === targetChannel.id) continue;
        try {
            await member.voice.setChannel(targetChannel);
            moved++;
        } catch (e) {
            errors.push(`Could not move ${member.user.username}: ${e.message}`);
        }
    }
    return { moved, errors };
}

module.exports = { handle };
