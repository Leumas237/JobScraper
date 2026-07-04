const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'had',
  'was', 'were', 'are', 'you', 'your', 'our', 'their', 'they', 'them', 'able',
  'will', 'would', 'could', 'should', 'about', 'into', 'over', 'under', 'more',
  'most', 'some', 'such', 'than', 'then', 'also', 'been', 'being', 'each',
  'other', 'which', 'while', 'where', 'when', 'what', 'who', 'whom', 'these',
  'those', 'here', 'there', 'not', 'but', 'can', 'all', 'any', 'its', 'it\'s',
  'les', 'des', 'une', 'un', 'et', 'ou', 'que', 'qui', 'dans', 'pour', 'avec',
  'sur', 'plus', 'mois', 'ans', 'ces', 'son', 'ses', 'leur', 'leurs', 'nous',
  'vous', 'être', 'avoir', 'fait', 'faire', 'tout', 'tous', 'toute', 'toutes',
]);

const SKILLS_DICTIONARY = [
  'javascript', 'typescript', 'node', 'nodejs', 'react', 'vue', 'angular',
  'python', 'django', 'flask', 'fastapi', 'java', 'spring', 'kotlin', 'swift',
  'go', 'golang', 'rust', 'c++', 'c#', '.net', 'php', 'laravel', 'symfony',
  'ruby', 'rails', 'sql', 'mysql', 'postgresql', 'postgres', 'mongodb',
  'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform',
  'ci/cd', 'git', 'graphql', 'rest', 'api', 'html', 'css', 'sass', 'tailwind',
  'machine learning', 'data science', 'pandas', 'numpy', 'tensorflow',
  'pytorch', 'devops', 'linux', 'bash', 'shell', 'microservices', 'agile',
  'scrum', 'testing', 'jest', 'cypress', 'selenium', 'excel', 'powerbi',
  'tableau', 'seo', 'marketing', 'comptabilite', 'gestion de projet',
];

async function extractCvText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractKeywords(text) {
  const lower = stripDiacritics(text.toLowerCase());
  const foundSkills = SKILLS_DICTIONARY.filter((skill) => lower.includes(skill));

  const words = lower
    .replace(/[^a-z0-9+#. ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));

  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([w]) => w);

  return Array.from(new Set([...foundSkills, ...topWords]));
}

module.exports = { extractCvText, extractKeywords, SKILLS_DICTIONARY };
