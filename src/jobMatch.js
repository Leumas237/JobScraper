const { extractKeywords } = require('./cvParser');

function compareToJobOffer(cvText, jobText) {
  const cvKeywords = new Set(extractKeywords(cvText));
  const jobKeywords = extractKeywords(jobText);

  const matched = jobKeywords.filter((k) => cvKeywords.has(k));
  const missing = jobKeywords.filter((k) => !cvKeywords.has(k));

  const matchPercent = jobKeywords.length === 0
    ? 0
    : Math.round((matched.length / jobKeywords.length) * 100);

  return { matchPercent, matched, missing, jobKeywords };
}

module.exports = { compareToJobOffer };
