#!/usr/bin/env node
/**
 * Test MetaWeblog API instead of Micro.blog XML-RPC
 * MetaWeblog might have different permission requirements
 */

const https = require('https');

// Configuration
const MICROBLOG_TOKEN = process.env.MICROBLOG_APP_TOKEN;
const MICROBLOG_USERNAME = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
const MICROBLOG_BLOG_ID = parseInt(process.env.MICROBLOG_BLOG_ID || '169604', 10);

if (!MICROBLOG_TOKEN) {
  console.error('❌ ERROR: MICROBLOG_APP_TOKEN environment variable not set');
  process.exit(1);
}

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      }
    }).join('');

    const requestBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>${methodName}</methodName>
  <params>
    ${paramsXml}
  </params>
</methodCall>`;

    const auth = Buffer.from(`${MICROBLOG_USERNAME}:${MICROBLOG_TOKEN}`).toString('base64');

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

async function testMetaWeblog() {
  console.log('🔬 Testing MetaWeblog API (Alternative to microblog.* methods)\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`🔑 Authentication:`);
  console.log(`   Username: ${MICROBLOG_USERNAME}`);
  console.log(`   Blog ID: ${MICROBLOG_BLOG_ID}`);
  console.log(`   Token: ${MICROBLOG_TOKEN.substring(0, 10)}...`);
  console.log('');

  try {
    // Test 1: Try wp.getPages (WordPress/MetaWeblog API)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TEST 1: Query pages via wp.getPages (MetaWeblog API)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const response = await xmlrpcRequest('wp.getPages', [
      MICROBLOG_BLOG_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_TOKEN
    ]);

    console.log(`✅ Response Status: ${response.statusCode}`);
    console.log(`📦 Response Size: ${response.body.length} bytes\n`);

    console.log('🔍 RAW XML RESPONSE:');
    console.log(response.body);
    console.log('');

    // Check for fault
    if (response.body.includes('<fault>')) {
      console.error('❌ XML-RPC FAULT DETECTED');
      const faultMatch = response.body.match(/<string>(.*?)<\/string>/);
      if (faultMatch) {
        console.error(`   Error: ${faultMatch[1]}`);
      }

      console.log('\n💡 SUGGESTION: This might be a token permissions issue.');
      console.log('   Try checking micro.blog/account/apps for token settings');
      process.exit(1);
    }

    console.log('✅ SUCCESS: MetaWeblog API responded without fault!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

testMetaWeblog();
