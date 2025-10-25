const https = require('https');

const HOSTNAME = 'micro.blog';
const TOKEN = process.env.MICROBLOG_APP_TOKEN;

async function fetchAllPosts() {
  if (!TOKEN) {
    throw new Error('MICROBLOG_APP_TOKEN environment variable not set');
  }

  const allItems = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const items = await new Promise((resolve, reject) => {
      const options = {
        hostname: HOSTNAME,
        path: `/micropub?q=source&limit=${limit}&offset=${offset}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Failed: ${res.statusCode} ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.items || []);
          } catch (e) {
            reject(new Error(`Invalid JSON from Micropub: ${e.message}`));
          }
        });
      });

      req.setTimeout(10000, () => req.destroy(new Error('Micropub request timeout')));
      req.on('error', reject);
      req.end();
    });

    allItems.push(...items);
    hasMore = items.length === limit;
    offset += limit;
  }

  return { items: allItems };
}

async function main() {
  const response = await fetchAllPosts();
  const posts = response.items || [];

  // Count by year
  const byYear = {};
  posts.forEach(post => {
    const url = post.url || post.properties?.url?.[0];
    if (url) {
      const match = url.match(/\/(\d{4})\//);
      if (match) {
        const year = match[1];
        byYear[year] = (byYear[year] || 0) + 1;
      }
    }
  });

  console.log('Posts by year on micro.blog:');
  Object.keys(byYear).sort().forEach(year => {
    console.log(`  ${year}: ${byYear[year]} posts`);
  });
  console.log(`Total: ${posts.length} posts`);
}

main().catch(console.error);
