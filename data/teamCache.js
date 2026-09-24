/**
 * In-memory cache for active team data keyed by message ID.
 * Each entry: { team1: string[], team2: string[], timerStart, timerEnabled, processing }
 *
 * Auto-expires after 3 hours to avoid unbounded growth.
 */
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const _cache = new Map();

function set(messageId, data) {
    _cache.set(messageId, data);
    // Auto-cleanup after TTL
    setTimeout(() => _cache.delete(messageId), CACHE_TTL_MS);
}

function get(messageId) {
    return _cache.get(messageId) ?? null;
}

function del(messageId) {
    _cache.delete(messageId);
}

module.exports = { set, get, del };
