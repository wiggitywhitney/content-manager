const https = require('https');

async function fetchAllPosts() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'micro.blog',
      path: '/micropub?q=source',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MICROBLOG_APP_TOKEN}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Failed: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
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
