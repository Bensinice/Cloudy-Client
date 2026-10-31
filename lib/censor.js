// Schimpfwort-Zensur (Chat, Lyrics): ersetzt Buchstaben durch Sterne, behaelt den ersten Buchstaben. Aus/An per Einstellung.
const W = ['scheiße', 'scheisse', 'scheiß', 'scheiss', 'arschloch', 'arsch', 'wichser', 'wichsen', 'fotze', 'hurensohn', 'hure', 'nutte', 'schlampe', 'fick', 'ficken', 'ficker', 'gefickt', 'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker', 'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'asshole', 'ass', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'bastard', 'bastarde', 'spast', 'spasti', 'behindert', 'missgeburt', 'penner', 'dumme sau', 'kacke', 'scheissegal', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'piss', 'wank', 'wanker', 'bollocks', 'schwuchtel', 'drecksau', 'verpiss', 'verfickt', 'fickdich'];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RE = new RegExp('(?<![\\p{L}\\p{N}])(' + [...new Set(W)].sort((a, b) => b.length - a.length).map(esc).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');
// "nigga"/"damn" u. ä. sind in Songtexten sehr haeufig: nur eindeutig vulgaere Woerter werden bei Lyrics mitzensiert, alles bleibt per Schalter abschaltbar
const censor = t => String(t == null ? '' : t).replace(RE, m => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
module.exports = { censor };
