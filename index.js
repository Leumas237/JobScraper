#!/usr/bin/env node
const path = require('path');
const { extractCvText, extractKeywords } = require('./src/cvParser');
const { matchJobs } = require('./src/matcher');
const { SeenStore } = require('./src/store');
const arbeitnow = require('./src/sources/arbeitnow');
const weworkremotely = require('./src/sources/weworkremotely');

function parseArgs(argv) {
  const args = { interval: 15, top: 10, once: false, minScore: 1 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cv') args.cv = argv[i += 1];
    else if (arg === '--interval') args.interval = Number(argv[i += 1]);
    else if (arg === '--top') args.top = Number(argv[i += 1]);
    else if (arg === '--min-score') args.minScore = Number(argv[i += 1]);
    else if (arg === '--once') args.once = true;
  }
  return args;
}

async function fetchAllJobs() {
  const results = await Promise.allSettled([
    arbeitnow.fetchJobs(),
    weworkremotely.fetchJobs(),
  ]);

  const jobs = [];
  for (const result of results) {
    if (result.status === 'fulfilled') jobs.push(...result.value);
    else console.error(`[warn] source indisponible: ${result.reason.message}`);
  }
  return jobs;
}

function printMatches(matches) {
  if (matches.length === 0) {
    console.log('Aucune nouvelle offre correspondante.');
    return;
  }
  console.log(`\n${matches.length} offre(s) correspondante(s) :\n`);
  for (const job of matches) {
    console.log(`[score ${job.score}] ${job.title} @ ${job.company} (${job.source})`);
    console.log(`  ${job.location} - ${job.url}`);
    console.log(`  mots-cles: ${job.matchedKeywords.slice(0, 8).join(', ')}\n`);
  }
}

async function runOnce({ keywords, top, minScore, seenStore, onlyNew }) {
  const jobs = await fetchAllJobs();
  const matches = matchJobs(jobs, keywords, { minScore });
  const toShow = (onlyNew ? matches.filter((job) => !seenStore.has(job.id)) : matches).slice(0, top);

  printMatches(toShow);

  for (const job of matches) seenStore.add(job.id);
  seenStore.save();

  return matches;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.cv) {
    console.error('Usage: node index.js --cv <chemin_du_cv.pdf|.txt> [--interval 15] [--top 10] [--once] [--min-score 1]');
    process.exit(1);
  }

  const cvPath = path.resolve(args.cv);
  const text = await extractCvText(cvPath);
  const keywords = extractKeywords(text);
  console.log(`CV analyse : ${keywords.length} mots-cles detectes.`);
  console.log(keywords.join(', '));

  const seenStore = new SeenStore(path.join(__dirname, '.seen.json'));

  if (args.once) {
    await runOnce({ keywords, top: args.top, minScore: args.minScore, seenStore, onlyNew: false });
    return;
  }

  console.log(`\nMode temps reel : verification toutes les ${args.interval} minute(s). Ctrl+C pour arreter.\n`);
  await runOnce({ keywords, top: args.top, minScore: args.minScore, seenStore, onlyNew: false });

  setInterval(async () => {
    try {
      await runOnce({ keywords, top: args.top, minScore: args.minScore, seenStore, onlyNew: true });
    } catch (err) {
      console.error('[erreur poll]', err.message);
    }
  }, args.interval * 60 * 1000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
