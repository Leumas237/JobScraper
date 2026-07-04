const axios = require('axios');

const API_URL = 'https://www.arbeitnow.com/api/job-board-api';

function toDate(value) {
  if (!value) return null;
  if (typeof value === 'number') return new Date(value * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchJobs() {
  const { data } = await axios.get(API_URL, { timeout: 15000 });
  const jobs = data && data.data ? data.data : [];

  return jobs.map((job) => ({
    id: `arbeitnow:${job.slug}`,
    title: job.title,
    company: job.company_name,
    location: job.location || (job.remote ? 'Remote' : 'N/A'),
    remote: !!job.remote,
    tags: job.tags || [],
    url: job.url,
    description: (job.description || '').replace(/<[^>]+>/g, ' '),
    postedAt: toDate(job.created_at),
    source: 'Arbeitnow',
  }));
}

module.exports = { fetchJobs };
