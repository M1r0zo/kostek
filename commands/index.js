/**
 * Central command registry.
 * To add a new command: create a file in /commands that exports { definition, execute }
 * (or a named map like rules.js / channels.js), then register it here.
 * The interaction router in index.js never needs to change.
 */
const custom   = require('./custom');
const arenki   = require('./arenki');
const rules    = require('./rules');
const channels = require('./channels');
const logs     = require('./logs');

const commands = new Map([
    ['custom',      custom],
    ['arenki',      arenki],
    ['addrule',     rules.addrule],
    ['removerule',  rules.removerule],
    ['rules',       rules.rules],
    ['clearrules',  rules.clearrules],
    ['setchannels', channels.setchannels],
    ['channels',    channels.channels],
    ['logs',        logs],
]);

/** Returns all SlashCommandBuilder definitions for registration. */
function getDefinitions() {
    return [...commands.values()].map(c => c.definition);
}

/** Dispatches an incoming slash command interaction to the correct handler. */
async function dispatch(interaction) {
    const cmd = commands.get(interaction.commandName);
    if (!cmd) return;
    await cmd.execute(interaction);
}

module.exports = { getDefinitions, dispatch };
