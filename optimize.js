#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { extractCvText } = require('./src/cvParser');
const { scoreAts } = require('./src/cvOptimizer');
const { compareToJobOffer } = require('./src/jobMatch');
const { getAiSuggestions, isEnabled } = require('./src/aiSuggestions');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--cv') args.cv = argv[i += 1];
    else if (arg === '--job') args.job = argv[i += 1];
    else if (arg === '--no-ai') args.noAi = true;
  }
  return args;
}

function printAtsReport(report) {
  console.log(`\nScore ATS : ${report.score}/100 (${report.wordCount} mots)\n`);
  for (const check of report.checks) {
    console.log(`  [${check.passed ? 'OK' : '--'}] ${check.label}`);
  }
}

function printComparison(comparison) {
  console.log(`\nCorrespondance avec l'offre : ${comparison.matchPercent}%`);
  console.log(`Mots-cles presents : ${comparison.matched.join(', ') || 'aucun'}`);
  console.log(`Mots-cles manquants : ${comparison.missing.join(', ') || 'aucun'}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.cv) {
    console.error('Usage: node optimize.js --cv <cv.pdf|.txt> [--job <offre.txt>] [--no-ai]');
    process.exit(1);
  }

  const cvText = await extractCvText(path.resolve(args.cv));
  const report = scoreAts(cvText);
  printAtsReport(report);

  let jobText = null;
  let comparison = null;
  if (args.job) {
    jobText = fs.readFileSync(path.resolve(args.job), 'utf8');
    comparison = compareToJobOffer(cvText, jobText);
    printComparison(comparison);
  }

  if (!args.noAi) {
    if (!isEnabled()) {
      console.log('\n(Suggestions IA desactivees : definissez DEEPSEEK_API_KEY pour les activer.)');
    } else {
      console.log('\nGeneration des suggestions IA...\n');
      const suggestions = await getAiSuggestions({
        cvText,
        jobText,
        missingKeywords: comparison ? comparison.missing : [],
      });
      console.log(suggestions || 'Aucune suggestion generee.');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
