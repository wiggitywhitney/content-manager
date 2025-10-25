const https = require('https');

/**
 * Delete all micro.blog posts older than 2025
 */

const MICROBLOG_APP_TOKEN = process.env.MICROBLOG_APP_TOKEN;
const HOSTNAME = 'micro.blog';

if (!MICROBLOG_APP_TOKEN) {
  console.error('Error: MICROBLOG_APP_TOKEN environment variable not set');
  process.exit(1);
}

// Fetch all posts from micro.blog with pagination support
async function fetchAllPosts() {
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
          'Authorization': `Bearer ${MICROBLOG_APP_TOKEN}`,
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve(parsed.items || []);
          } else {
            reject(new Error(`Failed to fetch posts: ${res.statusCode} ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log(`Fetched ${items.length} posts (offset: ${offset})`);
    allItems.push(...items);

    // Check if there are more posts to fetch
    hasMore = items.length === limit;
    offset += limit;
  }

  return { items: allItems };
}

// Delete a post
async function deletePost(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOSTNAME,
      path: '/micropub',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MICROBLOG_APP_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const postData = `action=delete&url=${encodeURIComponent(url)}`;

    const req = https.request(options, (res) => {
      if (res.statusCode === 200 || res.statusCode === 202 || res.statusCode === 404) {
        resolve(true);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => reject(new Error(`Delete failed: ${res.statusCode} ${data}`)));
      }
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Delete Old Micro.blog Posts ===\n');
  console.log('Fetching all posts from micro.blog...');

  const response = await fetchAllPosts();
  const allPosts = response.items || [];

  console.log(`Total posts found: ${allPosts.length}\n`);

  // Filter for posts older than 2025
  const oldPosts = allPosts.filter(post => {
    const url = post.url || post.properties?.url?.[0];
    if (!url) return false;

    // Extract year from URL: https://whitneylee.com/2024/01/15/...
    const yearMatch = url.match(/\/(\d{4})\//);
    if (!yearMatch) return false;

    const year = parseInt(yearMatch[1], 10);
    return year < 2025;
  });

  console.log(`Posts older than 2025: ${oldPosts.length}`);

  if (oldPosts.length === 0) {
    console.log('✅ No old posts to delete');
    return;
  }

  console.log('\nStarting deletion...\n');

  let deleted = 0;
  let failed = 0;

  for (const post of oldPosts) {
    const url = post.url || post.properties?.url?.[0];
    const content = post.properties?.content?.[0];
    const preview = typeof content === 'string'
      ? content.substring(0, 50)
      : content?.html?.substring(0, 50) || 'No content';

    try {
      console.log(`Deleting: ${url}`);
      console.log(`  Preview: ${preview}...`);
      await deletePost(url);
      deleted++;
      console.log(`  ✅ Deleted\n`);
    } catch (error) {
      failed++;
      console.log(`  ❌ Failed: ${error.message}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('=== Summary ===');
  console.log(`Total old posts: ${oldPosts.length}`);
  console.log(`Successfully deleted: ${deleted}`);
  console.log(`Failed: ${failed}`);
}

main().catch(console.error);
