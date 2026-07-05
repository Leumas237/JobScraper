#!/usr/bin/env node
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const http = require('http');
const { TelegramBot } = require('node-telegram-bot-api');
const axios = require('axios');

const { extractCvText, extractKeywords } = require('./src/cvParser');
const { matchJobs } = require('./src/matcher');
const { SeenStore } = require('./src/store');
const { SubscriptionStore } = require('./src/subscriptions');
const { scoreAts } = require('./src/cvOptimizer');
const { compareToJobOffer } = require('./src/jobMatch');
const { getAiSuggestions, isEnabled: aiEnabled } = require('./src/aiSuggestions');
const arbeitnow = require('./src/sources/arbeitnow');
const weworkremotely = require('./src/sources/weworkremotely');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN manquant. Definissez-le en variable d'environnement.");
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const bot = new TelegramBot(TOKEN, { polling: true });
const subs = new SubscriptionStore(path.join(DATA_DIR, 'subscriptions.json'));
const watchers = new Map();

async function fetchAllJobs() {
  const results = await Promise.allSettled([arbeitnow.fetchJobs(), weworkremotely.fetchJobs()]);
  const jobs = [];
  for (const result of results) {
    if (result.status === 'fulfilled') jobs.push(...result.value);
    else console.error('[warn] source indisponible:', result.reason.message);
  }
  return jobs;
}

function formatJob(job) {
  return `*[${job.score}]* ${job.title} — ${job.company}\n${job.location} (${job.source})\n${job.url}`;
}

async function sendMatches(chatId, matches, emptyMessage) {
  if (matches.length === 0) {
    if (emptyMessage) await bot.sendMessage(chatId, emptyMessage);
    return;
  }
  for (const job of matches) {
    await bot.sendMessage(chatId, formatJob(job), {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
  }
}

async function checkForChat(chatId, { onlyNew, top = 8 }) {
  const sub = subs.get(chatId);
  if (!sub || !sub.keywords || sub.keywords.length === 0) return [];

  const jobs = await fetchAllJobs();
  const matches = matchJobs(jobs, sub.keywords, { minScore: 1 });
  const seenStore = new SeenStore(path.join(DATA_DIR, `seen_${chatId}.json`));

  const toSend = (onlyNew ? matches.filter((job) => !seenStore.has(job.id)) : matches).slice(0, top);

  for (const job of matches) seenStore.add(job.id);
  seenStore.save();

  return toSend;
}

function stopWatching(chatId) {
  if (watchers.has(chatId)) {
    clearInterval(watchers.get(chatId));
    watchers.delete(chatId);
  }
}

function startWatching(chatId, intervalMinutes) {
  stopWatching(chatId);
  const handle = setInterval(async () => {
    try {
      const matches = await checkForChat(chatId, { onlyNew: true });
      if (matches.length > 0) await sendMatches(chatId, matches);
    } catch (err) {
      console.error(`[erreur watch ${chatId}]`, err.message);
    }
  }, intervalMinutes * 60 * 1000);
  watchers.set(chatId, handle);
  subs.update(chatId, { watching: true, interval: intervalMinutes });
}

bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Bonjour ! Envoyez-moi votre CV (.pdf ou .txt) et je vous trouverai des offres d'emploi adaptees.\n\n" +
      'Commandes :\n' +
      '/jobs - chercher maintenant\n' +
      '/watch [minutes] - suivi automatique (defaut 15 min)\n' +
      '/stop - arreter le suivi\n' +
      "/status - voir l'etat actuel\n" +
      '/score - score ATS de votre CV\n' +
      "/compare - comparer votre CV a une offre d'emploi\n" +
      '/optimize - suggestions IA pour ameliorer votre CV',
  );
});

bot.onText(/^\/status$/, (msg) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.keywords) {
    bot.sendMessage(chatId, 'Aucun CV enregistre pour le moment. Envoyez-moi un CV pour commencer.');
    return;
  }
  const watching = watchers.has(chatId);
  bot.sendMessage(
    chatId,
    `CV enregistre : ${sub.keywords.length} mots-cles.\n` +
      `Suivi automatique : ${watching ? `actif (toutes les ${sub.interval} min)` : 'inactif'}`,
  );
});

bot.onText(/^\/jobs$/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.keywords) {
    bot.sendMessage(chatId, "Envoyez-moi d'abord votre CV (.pdf ou .txt).");
    return;
  }
  await bot.sendMessage(chatId, 'Recherche en cours...');
  const matches = await checkForChat(chatId, { onlyNew: false, top: 8 });
  await sendMatches(chatId, matches, 'Aucune offre correspondante trouvee pour le moment.');
});

bot.onText(/^\/watch(?:\s+(\d+))?$/, (msg, match) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.keywords) {
    bot.sendMessage(chatId, "Envoyez-moi d'abord votre CV (.pdf ou .txt).");
    return;
  }
  const minutes = match[1] ? Math.max(5, Number(match[1])) : 15;
  startWatching(chatId, minutes);
  bot.sendMessage(chatId, `Suivi automatique active : verification toutes les ${minutes} minutes. /stop pour arreter.`);
});

bot.onText(/^\/stop$/, (msg) => {
  const chatId = msg.chat.id;
  stopWatching(chatId);
  subs.update(chatId, { watching: false });
  bot.sendMessage(chatId, 'Suivi automatique arrete.');
});

bot.onText(/^\/score$/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.cvText) {
    bot.sendMessage(chatId, "Envoyez-moi d'abord votre CV (.pdf ou .txt).");
    return;
  }
  const report = scoreAts(sub.cvText);
  const lines = report.checks.map((c) => `${c.passed ? '✅' : '❌'} ${c.label}`);
  await bot.sendMessage(
    chatId,
    `Score ATS : *${report.score}/100* (${report.wordCount} mots)\n\n${lines.join('\n')}`,
    { parse_mode: 'Markdown' },
  );
});

bot.onText(/^\/compare$/, (msg) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.cvText) {
    bot.sendMessage(chatId, "Envoyez-moi d'abord votre CV (.pdf ou .txt).");
    return;
  }
  subs.update(chatId, { awaitingJobText: true });
  bot.sendMessage(chatId, "Collez le texte de l'offre d'emploi dans votre prochain message.");
});

bot.onText(/^\/optimize$/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subs.get(chatId);
  if (!sub || !sub.cvText) {
    bot.sendMessage(chatId, "Envoyez-moi d'abord votre CV (.pdf ou .txt).");
    return;
  }
  if (!aiEnabled()) {
    bot.sendMessage(chatId, 'Les suggestions IA ne sont pas activees sur ce bot (DEEPSEEK_API_KEY manquant).');
    return;
  }
  await bot.sendMessage(chatId, 'Generation des suggestions IA en cours...');
  try {
    const comparison = sub.lastJobText ? compareToJobOffer(sub.cvText, sub.lastJobText) : null;
    const suggestions = await getAiSuggestions({
      cvText: sub.cvText,
      jobText: sub.lastJobText || null,
      missingKeywords: comparison ? comparison.missing : [],
    });
    await bot.sendMessage(chatId, suggestions || 'Aucune suggestion generee.');
  } catch (err) {
    console.error('[erreur IA]', err.message);
    await bot.sendMessage(chatId, 'Erreur lors de la generation des suggestions IA.');
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.text || msg.text.startsWith('/')) return;
  const sub = subs.get(chatId);
  if (!sub || !sub.awaitingJobText) return;

  subs.update(chatId, { awaitingJobText: false, lastJobText: msg.text });
  const comparison = compareToJobOffer(sub.cvText, msg.text);
  const lines = [
    `Correspondance avec l'offre : *${comparison.matchPercent}%*`,
    `Mots-cles presents : ${comparison.matched.slice(0, 15).join(', ') || 'aucun'}`,
    `Mots-cles manquants : ${comparison.missing.slice(0, 15).join(', ') || 'aucun'}`,
  ];
  await bot.sendMessage(chatId, lines.join('\n\n'), { parse_mode: 'Markdown' });
});

bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const doc = msg.document;
  const ext = path.extname(doc.file_name || '').toLowerCase();

  if (!['.pdf', '.txt'].includes(ext)) {
    bot.sendMessage(chatId, 'Format non supporte. Envoyez un fichier .pdf ou .txt.');
    return;
  }

  try {
    await bot.sendMessage(chatId, 'CV recu, analyse en cours...');
    const fileLink = await bot.getFileLink(doc.file_id);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const cvPath = path.join(DATA_DIR, `cv_${chatId}${ext}`);
    fs.writeFileSync(cvPath, response.data);

    const text = await extractCvText(cvPath);
    const keywords = extractKeywords(text);
    subs.update(chatId, { keywords, cvText: text });

    await bot.sendMessage(chatId, `CV analyse : ${keywords.length} mots-cles detectes.\n${keywords.slice(0, 20).join(', ')}`);

    const matches = await checkForChat(chatId, { onlyNew: false, top: 5 });
    await sendMatches(
      chatId,
      matches,
      "Aucune offre correspondante trouvee pour l'instant. Essayez /watch pour etre notifie des qu'il y en a.",
    );
  } catch (err) {
    console.error('[erreur traitement CV]', err.message);
    bot.sendMessage(chatId, "Erreur lors de l'analyse du CV. Reessayez.");
  }
});

bot.on('polling_error', (err) => console.error('[polling_error]', err.message));

for (const [chatId, sub] of subs.entries()) {
  if (sub.watching && sub.keywords && sub.keywords.length > 0) {
    startWatching(Number(chatId), sub.interval || 15);
  }
}

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('job-cv-scraper bot is running');
  })
  .listen(PORT, () => console.log(`Serveur de health check sur le port ${PORT}`));

console.log('Bot Telegram demarre.');
