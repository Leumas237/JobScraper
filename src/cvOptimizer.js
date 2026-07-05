const ACTION_VERBS = [
  'developpe', 'developed', 'construit', 'built', 'implemente', 'implemented',
  'dirige', 'led', 'gere', 'managed', 'concu', 'designed', 'cree', 'created',
  'ameliore', 'improved', 'optimise', 'optimized', 'automatise', 'automated',
  'lance', 'launched', 'architecture', 'architected', 'reduit', 'reduced',
  'augmente', 'increased', 'livre', 'delivered', 'coordonne', 'coordinated',
  'analyse', 'analyzed', 'deploye', 'deployed',
];

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function scoreAts(text) {
  const checks = [];

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  checks.push({ id: 'email', label: 'Adresse email presente', passed: hasEmail });

  const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(text);
  checks.push({ id: 'phone', label: 'Numero de telephone present', passed: hasPhone });

  const lower = stripDiacritics(text.toLowerCase());
  const sectionKeywords = ['experience', 'formation', 'education', 'competences', 'skills'];
  const hasSections = sectionKeywords.some((s) => lower.includes(s));
  checks.push({
    id: 'sections',
    label: 'Sections standards detectees (experience / formation / competences)',
    passed: hasSections,
  });

  const numberMatches = text.match(/\b\d+\s?%?\b/g) || [];
  checks.push({
    id: 'quantified',
    label: 'Resultats chiffres presents (%, chiffres)',
    passed: numberMatches.length >= 2,
  });

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-•*]/.test(l) || /^\d+[.)]/.test(l));
  const actionVerbBullets = bulletLines.filter((l) => {
    const firstWord = stripDiacritics(l.replace(/^[-•*\d.)\s]+/, '').split(/\s+/)[0] || '').toLowerCase();
    return ACTION_VERBS.some((v) => firstWord.startsWith(v.slice(0, 5)));
  });
  checks.push({
    id: 'action_verbs',
    label: "Puces commencant par des verbes d'action",
    passed: bulletLines.length === 0 || actionVerbBullets.length / bulletLines.length >= 0.4,
  });

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  checks.push({
    id: 'length',
    label: 'Longueur raisonnable (200 a 1200 mots)',
    passed: wordCount >= 200 && wordCount <= 1200,
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return { score, checks, wordCount };
}

module.exports = { scoreAts };
