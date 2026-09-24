const { getDisplayNameSync } = require('./display');

/**
 * Validates a team assignment against all active rules.
 * teams[0] = team1 array, teams[1] = team2 array.
 * Returns true if valid, false if any rule is violated.
 */
function checkRules(teams, rules, guild) {
    for (const rule of rules) {
        switch (rule.type) {
            case 'not_position': {
                for (let t = 0; t < 2; t++) {
                    const team = teams[t];
                    for (let i = 0; i < team.length; i++) {
                        if (team[i]?.user.id === rule.playerId && i + 1 === rule.position) {
                            return false;
                        }
                    }
                }
                break;
            }
            case 'must_position': {
                let found = false;
                outer: for (let t = 0; t < 2; t++) {
                    for (let i = 0; i < teams[t].length; i++) {
                        if (teams[t][i]?.user.id === rule.playerId && i + 1 === rule.position) {
                            found = true;
                            break outer;
                        }
                    }
                }
                if (!found) return false;
                break;
            }
            case 'not_same_position': {
                const maxLen = Math.max(teams[0].length, teams[1].length);
                for (let i = 0; i < maxLen; i++) {
                    const row = [teams[0][i], teams[1][i]];
                    if (row.some(m => m?.user.id === rule.playerId) &&
                        row.some(m => m?.user.id === rule.otherId)) return false;
                }
                break;
            }
            case 'same_position': {
                const maxLen = Math.max(teams[0].length, teams[1].length);
                let found = false;
                for (let i = 0; i < maxLen; i++) {
                    const row = [teams[0][i], teams[1][i]];
                    if (row.some(m => m?.user.id === rule.playerId) &&
                        row.some(m => m?.user.id === rule.otherId)) { found = true; break; }
                }
                if (!found) return false;
                break;
            }
            case 'not_same_team': {
                const p0 = teams[0].some(m => m?.user.id === rule.playerId);
                const p1 = teams[1].some(m => m?.user.id === rule.playerId);
                const o0 = teams[0].some(m => m?.user.id === rule.otherId);
                const o1 = teams[1].some(m => m?.user.id === rule.otherId);
                if ((p0 && o0) || (p1 && o1)) return false;
                break;
            }
            case 'same_team': {
                const p0 = teams[0].some(m => m?.user.id === rule.playerId);
                const p1 = teams[1].some(m => m?.user.id === rule.playerId);
                const o0 = teams[0].some(m => m?.user.id === rule.otherId);
                const o1 = teams[1].some(m => m?.user.id === rule.otherId);
                if ((p0 && !o0) || (p1 && !o1)) return false;
                break;
            }
        }
    }
    return true;
}

/**
 * Randomly shuffles members into two teams, retrying until all rules pass.
 * Throws if no valid arrangement is found within maxTries.
 */
function assignTeamsWithRules(members, rules, guild, maxTries = 10000) {
    const teamSize = Math.ceil(members.length / 2);
    for (let attempt = 0; attempt < maxTries; attempt++) {
        const shuffled = [...members].sort(() => Math.random() - 0.5);
        const team1 = shuffled.slice(0, teamSize);
        const team2 = shuffled.slice(teamSize);
        // Pad shorter team with undefined so positions align
        while (team1.length < team2.length) team1.push(undefined);
        while (team2.length < team1.length) team2.push(undefined);
        if (checkRules([team1, team2], rules, guild)) return [team1, team2];
    }
    throw new Error('Could not find a valid team split within the current rules. Try relaxing some rules.');
}

/**
 * Simple shuffle into two teams with no rule checks.
 */
function assignTeamsSimple(members) {
    const shuffled = [...members].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    return [shuffled.slice(0, half), shuffled.slice(half)];
}

module.exports = { checkRules, assignTeamsWithRules, assignTeamsSimple };
