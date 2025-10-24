#!/usr/bin/env node
/**
 * Test XML-RPC page management capabilities for Milestone 6
 * Purpose: Validate Option B feasibility - query pages and test is_navigation toggle
 */

const https = require('https');

// Configuration
const MICROBLOG_XMLRPC_TOKEN = process.env.MICROBLOG_XMLRPC_TOKEN; // MarsEdit token for XML-RPC
const MICROBLOG_USERNAME = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
const MICROBLOG_BLOG_ID = parseInt(process.env.MICROBLOG_BLOG_ID || '169604', 10);

if (!MICROBLOG_XMLRPC_TOKEN) {
  console.error('❌ ERROR: MICROBLOG_XMLRPC_TOKEN environment variable not set');
  console.error('   This should be the MarsEdit token from micro.blog/account/apps');
  console.error('   Run with: teller run -- /opt/homebrew/bin/node src/test-xmlrpc.js');
  process.exit(1);
}

if (!MICROBLOG_USERNAME || !MICROBLOG_BLOG_ID) {
  console.error('❌ ERROR: MICROBLOG_USERNAME and MICROBLOG_BLOG_ID must be set');
  console.error('   Check .env file or teller configuration');
  process.exit(1);
}

/**
 * Make XML-RPC request to Micro.blog
 */
function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    // Build XML-RPC request body
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      } else if (typeof param === 'boolean') {
        return `<param><value><boolean>${param ? 1 : 0}</boolean></value></param>`;
      } else if (typeof param === 'object' && !Array.isArray(param)) {
        const members = Object.entries(param).map(([key, value]) => {
          let valueXml;
          if (typeof value === 'string') {
            valueXml = `<string>${escapeXml(value)}</string>`;
          } else if (typeof value === 'boolean') {
            valueXml = `<boolean>${value ? 1 : 0}</boolean>`;
          } else if (typeof value === 'number') {
            valueXml = `<int>${value}</int>`;
          }
          return `<member><name>${key}</name><value>${valueXml}</value></member>`;
        }).join('');
        return `<param><value><struct>${members}</struct></value></param>`;
      }
    }).join('');

    const requestBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXml}
  </params>
</methodCall>`;

    // XML-RPC uses HTTP Basic Auth (NOT Bearer token)
    // Per docs: "Username + app token as password"
    const auth = Buffer.from(`${MICROBLOG_USERNAME}:${MICROBLOG_XMLRPC_TOKEN}`).toString('base64');

    const options = {
      hostname: 'micro.blog',
      path: '/xmlrpc',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(requestBody),
        'Authorization': 'Basic ' + auth
      }
    };

    console.log(`\n📡 Making XML-RPC request: ${methodName}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse XML-RPC array response - handles nested structs properly
 */
function parseXmlRpcArray(xml) {
  const pages = [];

  // Find the array data section
  const arrayMatch = xml.match(/<array><data>([\s\S]*?)<\/data><\/array>/);
  if (!arrayMatch) return pages;

  let content = arrayMatch[1];
  let pos = 0;

  // Extract top-level structs (pages) by counting depth
  while (pos < content.length) {
    const valueStart = content.indexOf('<value><struct>', pos);
    if (valueStart === -1) break;

    // Find matching </struct></value> by counting depth
    let depth = 0;
    let i = valueStart;
    let structEnd = -1;

    while (i < content.length) {
      if (content.substring(i, i + 15) === '<value><struct>') {
        depth++;
        i += 15;
      } else if (content.substring(i, i + 17) === '</struct></value>') {
        depth--;
        if (depth === 0) {
          structEnd = i + 17;
          break;
        }
        i += 17;
      } else {
        i++;
      }
    }

    if (structEnd === -1) break;

    // Extract page data from this struct
    const structXml = content.substring(valueStart, structEnd);
    const page = {};

    // Extract fields
    const idMatch = structXml.match(/<name>id<\/name><value><i4>(\d+)<\/i4>/);
    if (idMatch) page.id = parseInt(idMatch[1], 10);

    const titleMatch = structXml.match(/<name>title<\/name><value><string>(.*?)<\/string>/);
    if (titleMatch) page.title = titleMatch[1];

    const navMatch = structXml.match(/<name>is_navigation<\/name><value><boolean>([01])<\/boolean>/);
    if (navMatch) page.is_navigation = navMatch[1] === '1';

    const linkMatch = structXml.match(/<name>permalink<\/name><value><string>(.*?)<\/string>/);
    if (linkMatch) page.permalink = linkMatch[1];

    if (page.id && page.title) {
      pages.push(page);
    }

    pos = structEnd;
  }

  return pages;
}

async function testXmlRpc() {
  console.log('🔬 Testing XML-RPC Page Management Capabilities for Milestone 6\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('📋 Test Goals:');
  console.log('   1. Authenticate with XML-RPC using app token');
  console.log('   2. Query existing pages via microblog.getPages');
  console.log('   3. Find the 5 category navigation pages');
  console.log('   4. Extract page IDs for future toggling\n');

  console.log(`🔑 Authentication:`);
  console.log(`   Username: ${MICROBLOG_USERNAME}`);
  console.log(`   Blog ID: ${MICROBLOG_BLOG_ID}`);
  console.log(`   Token Type: MarsEdit (XML-RPC)`);
  console.log(`   Token: ${MICROBLOG_XMLRPC_TOKEN.substring(0, 10)}...`);
  console.log('');

  try {
    // Test 1: Get all pages
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 1: Query all pages via microblog.getPages');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Correct parameter order: blogID, username, password, numPages, offset
    const response = await xmlrpcRequest('microblog.getPages', [
      MICROBLOG_BLOG_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN,
      100,  // number of pages to fetch
      0     // offset
    ]);

    console.log(`✅ Response Status: ${response.statusCode}`);
    console.log(`📦 Response Size: ${response.body.length} bytes\n`);

    // Debug: Show raw XML
    console.log('🔍 RAW XML RESPONSE:');
    console.log(response.body);
    console.log('');

    // Check for fault first
    if (response.body.includes('<fault>')) {
      console.error('❌ XML-RPC FAULT DETECTED');
      const faultMatch = response.body.match(/<string>(.*?)<\/string>/);
      if (faultMatch) {
        console.error(`   Error: ${faultMatch[1]}`);
      }
      process.exit(1);
    }

    // Parse the response
    const pages = parseXmlRpcArray(response.body);

    console.log(`📄 Total pages found: ${pages.length}`);

    if (pages.length === 0) {
      console.log('\n🔍 DEBUG: Checking first 500 chars of response...');
      console.log(response.body.substring(0, 500));
      console.log('\n🔍 DEBUG: Checking for struct tags...');
      console.log(`Contains </struct></value>: ${response.body.includes('</struct></value>')}`);
      console.log(`Contains <member>: ${response.body.includes('<member>')}`);
    }
    console.log('');

    // Debug: Show ALL pages returned
    console.log('🔍 DEBUG: All pages returned by API:');
    pages.forEach((page, idx) => {
      console.log(`\nPage ${idx + 1}:`);
      console.log(JSON.stringify(page, null, 2));
    });
    console.log('');

    // Find our 5 category pages
    const categoryNames = ['Video', 'Podcast', 'Guest', 'Blog', 'Presentations'];
    const categoryPages = [];

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 2: Find category navigation pages');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const categoryName of categoryNames) {
      const page = pages.find(p => p.title === categoryName);
      if (page) {
        categoryPages.push(page);
        console.log(`✅ Found: ${categoryName}`);
        console.log(`   Page ID: ${page.id}`);
        console.log(`   URL: ${page.permalink || 'N/A'}`);
        console.log(`   In Navigation: ${page.is_navigation ? '✓ Yes' : '✗ No'}`);
        console.log('');
      } else {
        console.log(`❌ NOT FOUND: ${categoryName}`);
        console.log('');
      }
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (categoryPages.length === 5) {
      console.log('✅ SUCCESS: All 5 category pages found!');
      console.log('\n📋 Page ID Mappings:');
      categoryPages.forEach(page => {
        console.log(`   ${page.title.padEnd(15)} → Page ID: ${page.id}`);
      });

      console.log('\n🎯 Next Steps:');
      console.log('   1. ✅ XML-RPC authentication works');
      console.log('   2. ✅ Can query and identify category pages');
      console.log('   3. ⏭️  Next: Test microblog.editPage with is_navigation toggle');
      console.log('   4. ⏭️  Next: Implement activity tracking + auto-toggle logic\n');

      console.log('🚀 Option B is FEASIBLE - proceed with implementation!');
    } else {
      console.log(`⚠️  WARNING: Only found ${categoryPages.length}/5 category pages`);
      console.log('   May need to adjust page title matching logic');
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\n🔍 Debugging tips:');
    console.error('   - Verify MICROBLOG_APP_TOKEN is set correctly');
    console.error('   - Verify username is correct (check Micro.blog account settings)');
    console.error('   - Check if XML-RPC is enabled for your account');
    console.error('   - Try running: teller run node src/test-xmlrpc.js');
    process.exit(1);
  }
}

testXmlRpc();
