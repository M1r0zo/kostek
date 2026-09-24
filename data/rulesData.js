const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { log } = require('../utils/logger');

const RULES_PATH = path.join(__dirname, '../rules.json');

// In-memory store — loaded once at startup
let _rules = [];

function load() {
    try {
        _rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
        // Migrate any existing rules that pre-date stable IDs
        let migrated = false;
        for (const rule of _rules) {
            if (!rule.id) {
                rule.id = randomUUID();
                migrated = true;
            }
        }
        if (migrated) flush();
        log('info', `[RULES] Loaded ${_rules.length} rule(s) from disk`);
    } catch {
        _rules = [];
        log('warn', '[RULES] No rules.json found — starting with empty rules');
    }
}

function flush() {
    try {
        fs.writeFileSync(RULES_PATH, JSON.stringify(_rules, null, 2));
    } catch (e) {
        log('error', '[RULES] Failed to flush rules.json:', e.message);
    }
}

function getAll() {
    return _rules;
}

function add(rule) {
    rule.id = randomUUID();
    _rules.push(rule);
    flush();
}

/**
 * Removes a rule by its stable UUID. Returns the removed rule or null if not found.
 * Safe against race conditions — index shifts don't matter.
 */
function removeById(id) {
    const index = _rules.findIndex(r => r.id === id);
    if (index === -1) return null;
    const [removed] = _rules.splice(index, 1);
    flush();
    return removed;
}

/**
 * Returns true if an identical rule already exists.
 * Compares all meaningful fields so exact duplicates are rejected.
 */
function isDuplicate(rule) {
    return _rules.some(r =>
        r.type     === rule.type     &&
        r.playerId === rule.playerId &&
        (r.otherId   ?? null) === (rule.otherId   ?? null) &&
        (r.position  ?? null) === (rule.position  ?? null)
    );
}

/**
 * Removes all rules. Returns the count of rules that were cleared.
 */
function clear() {
    const count = _rules.length;
    _rules = [];
    flush();
    return count;
}

module.exports = { load, getAll, add, removeById, isDuplicate, clear };
