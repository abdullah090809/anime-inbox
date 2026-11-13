// Run with:  node tests/logic.test.js <compiled-dir> [path to Anime Watched List.txt]
const path = require('path');
const fs = require('fs');
const dir = path.resolve(process.argv[2]);
const watchedPath = process.argv[3];
const { similarity, bestNameScore, normalize } = require(path.join(dir, 'services/match.js'));
const { rankQueries } = require(path.join(dir, 'services/candidates.js'));
const { analyzeLines } = require(path.join(dir, 'services/analyze.js'));
const { parseWatchedText } = require(path.join(dir, 'services/watchedParse.js'));
const { formatEntries, DEFAULT_EXPORT } = require(path.join(dir, 'services/exporter.js'));

let failed = 0;
function check(name, cond, extra) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  -> ' + extra : ''));
  if (!cond) failed++;
}

// ---- matching ----
const princessFull = 'The Fated Magical Princess: Who Made Me a Princess';
const s1 = similarity('Shadow', 'The Eminence in Shadow');
check('"Shadow" does NOT match "The Eminence in Shadow"', s1 < 0.5, s1.toFixed(2));
const s2 = similarity('who made me a princess', princessFull);
check('partial title matches full title', s2 >= 0.85, s2.toFixed(2));
const s3 = similarity('wno maue me & princess', princessFull);
check('OCR typos still match (maybe-level)', s3 >= 0.72, s3.toFixed(2));
const s4 = similarity('Attack on titans', 'Attack on Titan');
check('plural typo matches', s4 >= 0.9, s4.toFixed(2));
const s5 = similarity('Naruto', 'Naruto: Shippuden');
check('single word does not partial-match long title', s5 < 0.72, s5.toFixed(2));
const s6 = similarity('Hunter x Hunter', 'Hunter x Hunter (2011)');
check('year suffix matches', s6 >= 0.8, s6.toFixed(2));

// ---- watched list parser ----
if (watchedPath && fs.existsSync(watchedPath)) {
  const txt = fs.readFileSync(watchedPath, 'utf8');
  const items = parseWatchedText(txt);
  const nonEmpty = txt.split(/\r?\n/).filter((l) => l.trim()).length;
  console.log('watched file: non-empty lines', nonEmpty, 'parsed', items.length, 'rated', items.filter((i) => i.rating !== null).length);
  check('parses most lines', items.length >= nonEmpty * 0.9, items.length + '/' + nonEmpty);
  console.log('first 3:', JSON.stringify(items.slice(0, 3)));
  console.log('last 2:', JSON.stringify(items.slice(-2)));
  const unrated = items.filter((i) => i.rating === null).slice(0, 8);
  console.log('unrated sample:', JSON.stringify(unrated));
} else {
  console.log('(no watched file given)');
}
check('parser handles wrapped names', (() => {
  const r = parseWatchedText('1. Some very long\n   name here (4/5)\n2. Plain (3.5/5)\n3. No rating\n4. Last (5/5)');
  return r.length === 4 && r[0].name === 'Some very long name here' && r[0].rating === 4 && r[2].rating === null && r[3].rating === 5;
})(), JSON.stringify(parseWatchedText('1. Some very long\n   name here (4/5)\n2. Plain (3.5/5)\n3. No rating\n4. Last (5/5)')));

// ---- candidates from a TikTok-style comment screenshot (709 x 1600) ----
const L = (text, x, y, w = 300, h = 34) => ({ text, x, y, w, h });
const lines = [
  L('11:12', 40, 25), L('LOVE:', 320, 265), L('Search: suddenly became a princess on_', 22, 545, 500),
  L('64 comments', 285, 612), L('wno maue me & princess', 160, 660), L('10h', 158, 705), L('Reply', 225, 705),
  L('Hide', 165, 765), L('Rica', 115, 822), L('anime name pls', 115, 855), L('3h', 115, 905), L('Reply', 175, 905),
  L('ΜΙΚΟΤΟ', 160, 975), L('who made me a princess', 160, 1005, 320), L('2h', 160, 1050), L('Alexa', 115, 1165),
  L('is new season', 115, 1200), L("out? I'm waiting for too long", 115, 1235, 540), L('best anime naruto', 115, 1345),
  L('Anime name', 115, 1380), L('13h', 115, 1425), L('Add comment', 130, 1500),
];
const ranked = rankQueries(lines, 709, 1600);
console.log('ranked queries:', ranked.map((q) => q.prior.toFixed(2) + ' ' + q.reason + ' "' + q.text + '"').join('\n  '));
check('finds the princess title among top queries', ranked.slice(0, 6).some((q) => /princess/i.test(q.text)));
check('drops "anime name pls" and UI noise', !ranked.some((q) => /pls|reply|comments|add comment/i.test(q.text)));

// fake MAL search
const DB = [
  { malId: 57353, title: 'Mahou Koushaku no Tenka', titleEnglish: 'The Fated Magical Princess: Who Made Me a Princess', titleJapanese: 'x', synonyms: [], score: 7.78, genres: ['Drama', 'Fantasy'], posterUrl: null, year: 2024, episodes: 12 },
  { malId: 1, title: 'Naruto', titleEnglish: 'Naruto', titleJapanese: 'NARUTO', synonyms: [], score: 8.0, genres: ['Action'], posterUrl: null, year: 2002, episodes: 220 },
  { malId: 2, title: 'Naruto: Shippuuden', titleEnglish: 'Naruto Shippuden', titleJapanese: null, synonyms: [], score: 8.2, genres: ['Action'], posterUrl: null, year: 2007, episodes: 500 },
  { malId: 3, title: 'Home!', titleEnglish: 'Home!', titleJapanese: 'HOME!', synonyms: [], score: 6.8, genres: ['Sci-Fi'], posterUrl: null, year: 2020, episodes: 1 },
  { malId: 4, title: 'Tensei shitara Slime Datta Ken', titleEnglish: 'That Time I Got Reincarnated as a Slime', titleJapanese: null, synonyms: [], score: 8.1, genres: ['Fantasy'], posterUrl: null, year: 2018, episodes: 24 },
];
let searchCalls = 0;
async function fakeSearch(q) {
  searchCalls++;
  const toks = normalize(q).split(' ').filter((t) => t.length > 3);
  return DB.filter((a) => toks.some((t) => normalize([a.title, a.titleEnglish].join(' ')).includes(t)));
}
(async () => {
  const cands = await analyzeLines(lines, 709, 1600, fakeSearch);
  console.log('searches made:', searchCalls);
  console.log('candidates:', cands.map((c) => (c.selected ? '[x] ' : '[ ] ') + c.confidence.toFixed(2) + ' ' + c.anime.titleEnglish + '  <= "' + c.matchedText + '"').join('\n  '));
  check('princess anime found', cands.some((c) => c.malId === 57353));
  check('princess anime is ranked first', cands[0] && cands[0].malId === 57353);
  check('princess anime is pre-selected or at least offered', cands.some((c) => c.malId === 57353));
  check('did not make too many searches', searchCalls <= 6, searchCalls);

  // sequels are not all pre-ticked
  const nlines = [L('Naruto', 100, 600, 200), L('Naruto Shippuden', 100, 700, 300)];
  const nc = await analyzeLines(nlines, 709, 1600, fakeSearch);
  console.log('naruto candidates:', nc.map((c) => (c.selected ? '[x] ' : '[ ] ') + c.confidence.toFixed(2) + ' ' + c.anime.titleEnglish).join(' | '));

  // ---- export ----
  const baka = { malId: 6347, title: 'Baka to Test to Shoukanjuu', titleEnglish: 'Baka & Test: Summon the Beasts', titleJapanese: 'バカとテストと召喚獣', synonyms: [], score: 7.5, genres: ['Comedy', 'Romance'], posterUrl: null, year: 2010, episodes: 13 };
  const items = [{ anime: baka, userRating: null }, { anime: baka, userRating: 4.5 }];
  const o = DEFAULT_EXPORT;
  const out1 = formatEntries(items, { ...o, genres: false });
  const out2 = formatEntries([items[0]], o);
  const out3 = formatEntries([items[0]], { ...o, japanese: true });
  const out4 = formatEntries([items[1]], o);
  console.log(out1 + '\n' + out2 + '\n' + out3 + '\n' + out4);
  check('export: names + MAL score', out1.split('\n')[0] === '1. Baka & Test: Summon the Beasts (MAL 7.5/10)');
  check('export: genres', out2 === '1. Baka & Test: Summon the Beasts (MAL 7.5/10) – Comedy, Romance');
  check('export: japanese', out3 === '1. Baka & Test: Summon the Beasts / バカとテストと召喚獣 (MAL 7.5/10) – Comedy, Romance');
  check('export: own rating replaces MAL', out4 === '1. Baka & Test: Summon the Beasts (4.5/5) – Comedy, Romance');
  check('export: numbering starts at 1 and counts up', out1.split('\n')[1].startsWith('2. '));
  check('export: start at 301', formatEntries([items[0]], { ...o, startAt: 301 }).startsWith('301. '));
  check('export: maxGenres', formatEntries([items[0]], { ...o, maxGenres: 1 }).endsWith('Comedy'));
  check('export: not numbered', formatEntries([items[0]], { ...o, numbered: false }).startsWith('Baka'));

  console.log(failed ? '\n' + failed + ' FAILED' : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
})();
