const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

function isEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function getAiSuggestions({ cvText, jobText, missingKeywords = [] }) {
  if (!isEnabled()) return null;

  const client = new Anthropic();

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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : null;
}

module.exports = { getAiSuggestions, isEnabled };
