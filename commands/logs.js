const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs   = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

const LOG_DIR   = path.join(__dirname, '../logs');
const MAX_LINES = 20;

const definition = new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Show the last 20 log entries from today. (Admin only)');

async function execute(interaction) {
    log('info', `[/logs] ${interaction.user.tag} in guild "${interaction.guild.name}"`);

    if (!interaction.member.permissions.has('Administrator')) {
        log('warn', `[/logs] Blocked — ${interaction.user.tag} lacks Administrator in "${interaction.guild.name}"`);
        return interaction.reply({ content: 'Administrator permission required.', flags: 4096 });
    }

    const date    = new Date().toISOString().slice(0, 10);
    const logPath = path.join(LOG_DIR, `${date}.log`);

    if (!fs.existsSync(logPath)) {
        return interaction.reply({ content: `No log file found for today (${date}).`, flags: 4096 });
    }

    const raw   = fs.readFileSync(logPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim() !== '');
    const last  = lines.slice(-MAX_LINES);

    if (!last.length) {
        return interaction.reply({ content: 'Log file is empty.', flags: 4096 });
    }

    // Discord code block max is 2000 chars per message — truncate from the top if needed
    let block = last.join('\n');
    if (block.length > 1900) {
        block = block.slice(block.length - 1900);
        // Don't cut mid-line
        const firstNewline = block.indexOf('\n');
        if (firstNewline !== -1) block = block.slice(firstNewline + 1);
    }

    const embed = new EmbedBuilder()
        .setTitle(`Logs — ${date}`)
        .setColor(0x2c2f33)
        .setDescription(`\`\`\`\n${block}\n\`\`\``)
        .setFooter({ text: `Last ${last.length} line(s) • by @mirozogotbanned` });

    return interaction.reply({ embeds: [embed], flags: 4096 });
}

module.exports = { definition, execute };
