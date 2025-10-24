#!/usr/bin/env node
/**
 * Hide the Blog page from navigation for visual verification
 */

const https = require('https');

const MICROBLOG_XMLRPC_TOKEN = process.env.MICROBLOG_XMLRPC_TOKEN;
const MICROBLOG_USERNAME = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
const TEST_PAGE_ID = 897491; // Blog page

if (!MICROBLOG_XMLRPC_TOKEN) {
  console.error('❌ ERROR: MICROBLOG_XMLRPC_TOKEN not set');
  process.exit(1);
}

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${param.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      } else if (typeof param === 'object') {
        const members = Object.entries(param).map(([key, value]) => {
          let valueXml;
          if (typeof value === 'string') {
            valueXml = `<string>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`;
          } else if (typeof value === 'boolean') {
            valueXml = `<boolean>${value ? 1 : 0}</boolean>`;
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

async function hidePage() {
  console.log('🔒 Hiding "Blog" page from navigation...\n');

  try {
    const response = await xmlrpcRequest('microblog.editPage', [
      TEST_PAGE_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN,
      {
        title: 'Blog',
        description: 'https://whitneylee.com/blog',
        is_navigation: false
      }
    ]);

    if (response.body.includes('<fault>')) {
      console.error('❌ FAILED:', response.body);
      process.exit(1);
    }

    console.log('✅ SUCCESS: "Blog" page hidden from navigation');
    console.log('');
    console.log('👀 Please verify:');
    console.log('   1. Go to https://whitneylee.com');
    console.log('   2. Check if "Blog" link is GONE from navigation');
    console.log('   OR');
    console.log('   3. Go to Micro.blog → Design → Edit Navigation');
    console.log('   4. Check if "Blog" is unchecked');
    console.log('');
    console.log('💡 To restore it, run:');
    console.log('   teller run -- /opt/homebrew/bin/node src/restore-blog-page.js');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

hidePage();
