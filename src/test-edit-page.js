#!/usr/bin/env node
/**
 * Test microblog.editPage to toggle is_navigation
 * This confirms we can hide/show pages programmatically
 */

const https = require('https');

const MICROBLOG_XMLRPC_TOKEN = process.env.MICROBLOG_XMLRPC_TOKEN;
const MICROBLOG_USERNAME = process.env.MICROBLOG_USERNAME || 'wiggitywhitney';
const MICROBLOG_BLOG_ID = parseInt(process.env.MICROBLOG_BLOG_ID || '169604', 10);

// Test with Blog page (ID: 897491, fewest posts)
const TEST_PAGE_ID = 897491;
const TEST_PAGE_TITLE = 'Blog';

if (!MICROBLOG_XMLRPC_TOKEN) {
  console.error('❌ ERROR: MICROBLOG_XMLRPC_TOKEN not set');
  process.exit(1);
}

function xmlrpcRequest(methodName, params) {
  return new Promise((resolve, reject) => {
    const paramsXml = params.map(param => {
      if (typeof param === 'string') {
        return `<param><value><string>${escapeXml(param)}</string></value></param>`;
      } else if (typeof param === 'number') {
        return `<param><value><int>${param}</int></value></param>`;
      } else if (typeof param === 'boolean') {
        return `<param><value><boolean>${param ? 1 : 0}</boolean></value></param>`;
      } else if (typeof param === 'object' && !Array.isArray(param)) {
        // Struct for editPage content
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

    const auth = Buffer.from(`${MICROBLOG_USERNAME}:${MICROBLOG_XMLRPC_TOKEN}`).toString('base64');

    // Debug: show request body for editPage calls
    if (methodName === 'microblog.editPage') {
      console.log('📤 DEBUG: Request XML:');
      console.log(requestBody);
      console.log('');
    }

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

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function testEditPage() {
  console.log('🔬 Testing microblog.editPage - Navigation Toggle\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`🎯 Test Target: ${TEST_PAGE_TITLE} (ID: ${TEST_PAGE_ID})`);
  console.log(`📋 Test Plan:`);
  console.log(`   1. Hide page (is_navigation: false)`);
  console.log(`   2. Query to verify hidden`);
  console.log(`   3. Show page (is_navigation: true)`);
  console.log(`   4. Query to verify visible\n`);

  try {
    // Step 1: Hide the page
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 1: Hide page from navigation');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Try without blogID: pageID, username, password, content
    const hideResponse = await xmlrpcRequest('microblog.editPage', [
      TEST_PAGE_ID,       // pageID first
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN,
      {
        title: TEST_PAGE_TITLE,
        description: 'https://whitneylee.com/blog',
        is_navigation: false  // HIDE IT
      }
    ]);

    console.log('🔍 DEBUG: Response preview...');
    console.log(hideResponse.body.substring(0, 300));

    if (hideResponse.body.includes('<fault>')) {
      console.error('❌ FAILED: Could not hide page');
      console.error(hideResponse.body);
      process.exit(1);
    }

    console.log('✅ SUCCESS: editPage call completed');
    console.log('⏱️  Waiting 2 seconds for changes to propagate...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Verify hidden
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 2: Verify page is hidden');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const checkResponse = await xmlrpcRequest('microblog.getPage', [
      TEST_PAGE_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN
    ]);

    console.log('🔍 DEBUG: getPage response preview...');
    console.log(checkResponse.body.substring(0, 500));

    const isNavMatch = checkResponse.body.match(/<name>is_navigation<\/name><value><boolean>([01])<\/boolean>/);
    const currentState = isNavMatch ? isNavMatch[1] === '1' : null;

    if (currentState === false) {
      console.log('✅ VERIFIED: Page is now hidden (is_navigation: false)');
    } else {
      console.log(`⚠️  UNEXPECTED: Page state is ${currentState} (expected false)`);
    }
    console.log('');

    // Step 3: Restore visibility
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 3: Restore page to navigation');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const showResponse = await xmlrpcRequest('microblog.editPage', [
      TEST_PAGE_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN,
      {
        title: TEST_PAGE_TITLE,
        description: 'https://whitneylee.com/blog',
        is_navigation: true  // SHOW IT AGAIN
      }
    ]);

    if (showResponse.body.includes('<fault>')) {
      console.error('❌ FAILED: Could not restore page');
      console.error(showResponse.body);
      process.exit(1);
    }

    console.log('✅ SUCCESS: Page restored to navigation');
    console.log('⏱️  Waiting 2 seconds for changes to propagate...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Verify visible
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STEP 4: Verify page is visible again');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const finalCheckResponse = await xmlrpcRequest('microblog.getPage', [
      TEST_PAGE_ID,
      MICROBLOG_USERNAME,
      MICROBLOG_XMLRPC_TOKEN
    ]);

    const finalNavMatch = finalCheckResponse.body.match(/<name>is_navigation<\/name><value><boolean>([01])<\/boolean>/);
    const finalState = finalNavMatch ? finalNavMatch[1] === '1' : null;

    if (finalState === true) {
      console.log('✅ VERIFIED: Page is now visible (is_navigation: true)');
    } else {
      console.log(`⚠️  UNEXPECTED: Page state is ${finalState} (expected true)`);
    }
    console.log('');

    // Final summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (currentState === false && finalState === true) {
      console.log('🎉 SUCCESS: microblog.editPage works perfectly!');
      console.log('');
      console.log('✅ Can hide pages (is_navigation: false)');
      console.log('✅ Can show pages (is_navigation: true)');
      console.log('✅ Changes persist and can be queried');
      console.log('');
      console.log('🚀 Option B is FULLY VALIDATED - ready to implement!');
    } else {
      console.log('⚠️  Test completed but results were unexpected');
      console.log(`   Hidden state: ${currentState} (expected: false)`);
      console.log(`   Final state: ${finalState} (expected: true)`);
    }

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    process.exit(1);
  }
}

testEditPage();
