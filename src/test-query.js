// Test script to debug Micropub query endpoint

async function testQuery() {
  const token = process.env.MICROBLOG_APP_TOKEN;

  console.log('Token exists:', !!token);

  // Query with higher limit to find categorized posts
  const url = 'https://micro.blog/micropub?q=source&limit=100';
  console.log('Querying:', url);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log('Status:', response.status);

  const json = await response.json();
  const posts = json.items || [];

  console.log(`\nTotal posts returned: ${posts.length}`);

  // Count posts with categories
  const categorizedPosts = posts.filter(p => p.properties.category && p.properties.category.length > 0);
  console.log(`Posts with categories: ${categorizedPosts.length}`);

  // Show sample categorized posts
  if (categorizedPosts.length > 0) {
    console.log('\nFirst 3 categorized posts:');
    categorizedPosts.slice(0, 3).forEach(post => {
      console.log(`- URL: ${post.properties.url[0]}`);
      console.log(`  Category: ${post.properties.category.join(', ')}`);
      console.log(`  Content: ${post.properties.content[0].substring(0, 100)}...`);
    });
  } else {
    console.log('\nNo categorized posts found in first 100 results');
  }
}

testQuery().catch(e => console.error('Error:', e));
