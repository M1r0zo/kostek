const fs = require('fs');
const path = require('path');
const { log } = require('../utils/logger');

const CONFIG_PATH = path.join(__dirname, '../server_config.json');

// In-memory store — loaded once at startup
let _store = { servers: {} };

function load() {
    try {
        _store = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        log('info', '[CONFIG] Loaded server config from disk');
    } catch {
        _store = { servers: {} };
        log('warn', '[CONFIG] No server_config.json found — starting fresh');
    }
}

function flush() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(_store, null, 2));
    } catch (e) {
        log('error', '[CONFIG] Failed to flush server_config.json:', e.message);
    }
}

function getChannels(guildId) {
    return _store.servers[guildId] ?? { team1: null, team2: null };
}

function setChannels(guildId, team1Id, team2Id) {
    if (!_store.servers[guildId]) _store.servers[guildId] = {};
    _store.servers[guildId].team1 = team1Id;
    _store.servers[guildId].team2 = team2Id;
    flush();
}

module.exports = { load, getChannels, setChannels };
