function scoreJob(job, keywords) {
  const haystack = `${job.title} ${job.description} ${(job.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  const matched = [];

  for (const keyword of keywords) {
    const k = keyword.toLowerCase().trim();
    if (!k) continue;
    const occurrences = haystack.split(k).length - 1;
    if (occurrences > 0) {
      score += occurrences;
      matched.push(keyword);
    }
  }

  return { score, matched };
}

function matchJobs(jobs, keywords, { minScore = 1 } = {}) {
  return jobs
    .map((job) => {
      const { score, matched } = scoreJob(job, keywords);
      return { ...job, score, matchedKeywords: matched };
    })
    .filter((job) => job.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

module.exports = { matchJobs, scoreJob };
