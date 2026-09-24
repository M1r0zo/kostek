/**
 * Temporary store for pending rule deletions.
 * Keyed by the select-menu interaction ID.
 * Entries expire after 5 minutes — if the confirm button is never clicked, no leak.
 *
 * Shape: { ruleIds: string[], guild: Guild }
 */
const TTL_MS = 5 * 60 * 1000;
const _pending = new Map();

function set(interactionId, data) {
    _pending.set(interactionId, data);
    setTimeout(() => _pending.delete(interactionId), TTL_MS);
}

function get(interactionId) {
    return _pending.get(interactionId) ?? null;
}

function del(interactionId) {
    _pending.delete(interactionId);
}

module.exports = { set, get, del };
