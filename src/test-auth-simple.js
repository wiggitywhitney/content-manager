#!/usr/bin/env node
/**
 * Test basic XML-RPC authentication with blogger.getUsersBlogs
 * This is the first method MarsEdit calls to verify credentials
 */

const https = require('https');

const MICROBLOG_TOKEN = process.env.MICROBLOG_APP_TOKEN;
const MICROBLOG_USERNAME = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';

if (!MICROBLOG_TOKEN) {
  console.error('❌ ERROR: MICROBLOG_APP_TOKEN not set');
  process.exit(1);
}

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
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

    console.log(`📡 Request: ${methodName}(${params.join(', ')})`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function testAuth() {
  console.log('🔬 Testing Basic XML-RPC Authentication\n');
  console.log(`Username: ${MICROBLOG_USERNAME}`);
  console.log(`Token: ${MICROBLOG_TOKEN.substring(0, 10)}...\n`);

  try {
    // Test blogger.getUsersBlogs - simplest auth test
    console.log('TEST: blogger.getUsersBlogs (basic auth verification)\n');

    const response = await xmlrpcRequest('blogger.getUsersBlogs', [
      '', // appkey (unused)
      MICROBLOG_USERNAME,
      MICROBLOG_TOKEN
    ]);

    console.log(`Status: ${response.statusCode}\n`);
    console.log('Response:');
    console.log(response.body);
    console.log('');

    if (response.body.includes('<fault>')) {
      const faultMatch = response.body.match(/<string>(.*?)<\/string>/);
      console.error(`\n❌ FAULT: ${faultMatch ? faultMatch[1] : 'Unknown'}`);
      console.log('\n💡 Next steps:');
      console.log('   1. Check micro.blog/account/apps - verify token exists');
      console.log('   2. Try generating a NEW app token');
      console.log('   3. Verify account has XML-RPC access enabled');
      process.exit(1);
    }

    console.log('✅ SUCCESS: Authentication works!');

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

testAuth();
