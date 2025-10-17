#!/usr/bin/env node

/**
 * Google Sheets API Authentication Test
 *
 * This script tests authentication with Google Sheets API using service account
 * credentials provided via Teller from Google Secret Manager.
 *
 * Run with: teller run node src/auth-test.js
 */

const { google } = require('googleapis');

async function testAuthentication() {
  try {
    console.log('🔐 Testing Google Sheets API authentication...\n');

    // Check if service account credentials are available
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      console.error('❌ Error: GOOGLE_SERVICE_ACCOUNT_JSON environment variable not found');
      console.error('   Make sure to run with: teller run node src/auth-test.js');
      process.exit(1);
    }

    // Parse service account credentials
    const credentials = JSON.parse(serviceAccountJson);
    console.log('✓ Service account credentials loaded');
    console.log(`  Account: ${credentials.client_email}\n`);

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    // Get authenticated client
    const authClient = await auth.getClient();
    console.log('✓ Authentication client created');

    // Test authentication by getting access token
    const accessToken = await authClient.getAccessToken();
    if (accessToken.token) {
      console.log('✓ Successfully obtained access token\n');
      console.log('🎉 Successfully authenticated with Google Sheets API!\n');
      return true;
    } else {
      throw new Error('Failed to obtain access token');
    }

  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAuthentication();
