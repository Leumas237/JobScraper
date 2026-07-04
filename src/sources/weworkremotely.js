const Parser = require('rss-parser');

const FEED_URL = 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
const parser = new Parser();

async function fetchJobs() {
  const feed = await parser.parseURL(FEED_URL);
  const items = feed.items || [];

  return items.map((item) => {
    const match = /^(.*?):\s*(.*)$/.exec(item.title || '');
    const company = match ? match[1] : 'Inconnu';
    const title = match ? match[2] : item.title;

    return {
      id: `wwr:${item.guid || item.link}`,
      title,
      company,
      location: 'Remote',
      remote: true,
      tags: item.categories || [],
      url: item.link,
      description: (item.contentSnippet || item.content || '').toString(),
      postedAt: item.isoDate ? new Date(item.isoDate) : null,
      source: 'WeWorkRemotely',
    };
  });
}

module.exports = { fetchJobs };
