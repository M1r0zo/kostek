const { log } = require('./logger');

/**
 * Resolves a display name for a guild member.
 * Format: "username (nickname)" if nickname exists, otherwise just "username".
 *
 * Resolution order:
 *   1. Guild member cache (instant, no API call)
 *   2. guild.members.fetch() — requires GuildMembers intent
 *   3. client.users.fetch() — fallback, returns username only (no nickname)
 *   4. "Unknown User (id)" — last resort if all API calls fail
 *
 * "Unknown User" in /rules output means either:
 *   - GuildMembers privileged intent is not enabled in the Developer Portal, OR
 *   - The user has left the server entirely
 */
async function getDisplayName(userId, guild) {
    // 1. Try cache first — free and instant
    const cached = guild.members.cache.get(userId);
    if (cached) return formatMember(cached);

    // 2. Try fetching the full guild member (needs GuildMembers intent)
    try {
        const member = await guild.members.fetch({ user: userId, force: true });
        return formatMember(member);
    } catch (e) {
        log('warn', `[DISPLAY] guild.members.fetch failed for ${userId}: ${e.message}`);
    }

    // 3. Fall back to bare user fetch (no nickname, but at least a real username)
    try {
        const user = await guild.client.users.fetch(userId);
        log('warn', `[DISPLAY] Resolved ${userId} via users.fetch (no nickname available)`);
        return user.username;
    } catch (e) {
        log('error', `[DISPLAY] users.fetch also failed for ${userId}: ${e.message}`);
    }

    // 4. Nothing worked — user likely left the server
    return `Unknown User (${userId})`;
}

/**
 * Synchronous version — only works if member is already in cache.
 * Safe to use when members are guaranteed cached (e.g. voice channel members).
 */
function getDisplayNameSync(userId, guild) {
    const member = guild.members.cache.get(userId);
    if (!member) return `Unknown User (${userId})`;
    return formatMember(member);
}

function formatMember(member) {
    return member.nickname
        ? `${member.user.username} (${member.nickname})`
        : member.user.username;
}

module.exports = { getDisplayName, getDisplayNameSync };
