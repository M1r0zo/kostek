const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { log } = require('../utils/logger');

const VALORANT_API = 'https://valorant-api.com/v1/maps';

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const definition = new SlashCommandBuilder()
    .setName('rollvalomap')
    .setDescription('Roll a random Valorant map.');

async function execute(interaction) {
    log('info', `[/rollvalomap] ${interaction.user.tag} in guild "${interaction.guild.name}" (${interaction.guildId})`);

    // defer if reply is longer than 3s
    await interaction.deferReply();

    let maps;

    if (_cache && Date.now() - _cacheTime < CACHE_TTL_MS) {
        maps = _cache;
        log('info', '[/rollvalomap] using cached maps');
    } else {
        try {
            const res = await fetch(VALORANT_API);

            // --- API limit / error handling ---
            if (res.status === 429) {
                const retryAfter = res.headers.get('retry-after') || res.headers.get('Retry-After');
                const wait = retryAfter ? `${retryAfter}s` : 'a moment';
                log('warn', `[/rollvalomap] rate limited (429) retry-after=${wait}`);
                return interaction.editReply({
                    content: `Valorant API rate limit exceeded. Try again in ${wait}.`,
                });
            }

            if (!res.ok) {
                log('error', `[/rollvalomap] API error ${res.status} ${res.statusText}`);
                return interaction.editReply({
                    content: `Valorant API error (HTTP ${res.status}). Try again later.`,
                });
            }

            const json = await res.json();

            if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
                log('error', '[/rollvalomap] empty data from API');
                return interaction.editReply({ content: 'No maps returned from Valorant API.' });
            }

            maps = json.data.filter(m => m.displayIcon && m.splash && m.coordinates);

            if (!maps.length) {
                log('error', '[/rollvalomap] no competitive maps after filtering');
                return interaction.editReply({ content: 'No playable maps found.' });
            }

            _cache = maps;
            _cacheTime = Date.now();
            log('info', `[/rollvalomap] fetched ${json.data.length} maps, ${maps.length} competitive, cached`);

        } catch (e) {
            // network error or JSON parse error
            // if we have stale cache, fallback instead of failing
            if (_cache) {
                log('warn', `[/rollvalomap] fetch failed, falling back to stale cache: ${e.message}`);
                maps = _cache;
            } else {
                log('error', '[/rollvalomap] fetch failed:', e.message);
                return interaction.editReply({ content: 'Could not fetch Valorant maps. Try again later.' });
            }
        }
    }

    const map = maps[Math.floor(Math.random() * maps.length)];
    log('info', `[/rollvalomap] rolled ${map.displayName} for ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
        .setTitle(map.displayName)
        .setColor(0xff4655)
        .setImage(map.splash)
        .setThumbnail(map.displayIcon)
        .setFooter({ text: `Requested by ${interaction.user.tag} • by @mirozogotbanned`, iconURL: interaction.user.displayAvatarURL() });

    if (map.tacticalDescription) {
        embed.addFields({ name: 'Sites', value: map.tacticalDescription, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
}

module.exports = { definition, execute };
