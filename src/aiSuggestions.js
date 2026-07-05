const axios = require('axios');

const API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

function isEnabled() {
  return !!process.env.DEEPSEEK_API_KEY;
}

async function getAiSuggestions({ cvText, jobText, missingKeywords = [] }) {
  if (!isEnabled()) return null;

  const jobSection = jobText
    ? `Voici l'offre d'emploi ciblee :\n"""\n${jobText}\n"""\n\n` +
      `Mots-cles presents dans l'offre mais absents du CV : ${missingKeywords.join(', ') || 'aucun'}.\n\n`
    : '';

  const prompt =
    `Tu es un expert en redaction de CV et en recrutement. Voici un CV :\n"""\n${cvText}\n"""\n\n` +
    `${jobSection}Propose :\n` +
    `1. Un resume professionnel (2-3 phrases) adapte${jobText ? ' a cette offre' : ''}.\n` +
    `2. 3 a 5 reformulations de points d'experience avec des verbes d'action et des resultats chiffres quand c'est plausible.\n` +
    `3. Une liste courte de recommandations concretes pour ameliorer ce CV.\n\n` +
    `Reponds en francais, de maniere concise et actionnable.`;

  const response = await axios.post(
    API_URL,
    {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    },
  );

  const choice = response.data.choices && response.data.choices[0];
  return choice ? choice.message.content : null;
}

module.exports = { getAiSuggestions, isEnabled };
