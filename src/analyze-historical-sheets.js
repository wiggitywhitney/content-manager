const { google } = require('googleapis');

// Historical spreadsheet IDs from PRD-6
const HISTORICAL_SHEETS = [
  {
    year: '2022',
    spreadsheetId: '1y5oxniWuw2R4UOOL00_oEQ1xRO1uaQPIQbvG_nt7vXc',
    sheetName: 'Sheet1'
  },
  {
    year: '2023',
    spreadsheetId: '1pwJz_r91m_zJWOI6XuqsMRQpwLnxAN32j-aIiJYuZm0',
    sheetName: 'Sheet1'
  },
  {
    year: '2024-1',
    spreadsheetId: '1nz_v9_WfFanJcvC5WRcZ6S9JPLSGlYdwsyzRxNUGjjE',
    sheetName: 'Sheet1'
  },
  {
    year: '2024-2',
    spreadsheetId: '1m7DTzOMu3Bkba8Mp3z4mDL0BVyJTCuYWrc20GlsmIrs',
    sheetName: 'Sheet1'
  }
];

/**
 * Analyze a single historical spreadsheet
 */
async function analyzeSheet(sheets, config) {
  const { year, spreadsheetId, sheetName } = config;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`ANALYZING: ${year} Spreadsheet`);
  console.log(`${'='.repeat(70)}`);

  try {
    // Read first 10 rows to analyze structure
    const range = `${sheetName}!A1:Z10`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log('⚠️  Spreadsheet appears to be empty');
      return null;
    }

    // Header row (first row)
    const headers = rows[0] || [];
    console.log(`\n📋 COLUMN STRUCTURE (${headers.length} columns):`);
    headers.forEach((header, index) => {
      const columnLetter = String.fromCharCode(65 + index); // A, B, C...
      console.log(`  ${columnLetter}: ${header || '(empty)'}`);
    });

    // Sample rows
    console.log(`\n📊 SAMPLE DATA (first 5 content rows):`);
    for (let i = 1; i < Math.min(6, rows.length); i++) {
      const row = rows[i];
      console.log(`\nRow ${i + 1}:`);
      row.forEach((cell, index) => {
        if (cell && cell.trim()) {
          const columnLetter = String.fromCharCode(65 + index);
          const headerName = headers[index] || `Column ${columnLetter}`;
          const displayValue = cell.length > 50 ? cell.substring(0, 47) + '...' : cell;
          console.log(`  ${headerName}: ${displayValue}`);
        }
      });
    }

    // Get formulas to check for hyperlinks
    console.log(`\n🔗 CHECKING FOR HYPERLINKS...`);
    const formulasResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`${sheetName}!A1:Z10`],
      fields: 'sheets(data(rowData(values(hyperlink,userEnteredValue))))'
    });

    const sheetData = formulasResponse.data.sheets?.[0];
    const rowData = sheetData?.data?.[0]?.rowData || [];

    let hasHyperlinks = false;
    rowData.forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // Skip header
      const cells = row.values || [];
      cells.forEach((cell, cellIndex) => {
        if (cell.hyperlink || cell.userEnteredValue?.formulaValue?.includes('HYPERLINK')) {
          hasHyperlinks = true;
          const columnLetter = String.fromCharCode(65 + cellIndex);
          const headerName = headers[cellIndex] || `Column ${columnLetter}`;
          console.log(`  Row ${rowIndex + 1}, ${headerName}: Has hyperlink/formula`);
        }
      });
    });

    if (!hasHyperlinks) {
      console.log('  No hyperlinks detected in first 10 rows');
    }

    // Total row count
    const allRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:A`,
    });
    const totalRows = (allRowsResponse.data.values || []).length;
    console.log(`\n📈 TOTAL ROWS: ${totalRows} (including header)`);

    return {
      year,
      spreadsheetId,
      headers,
      totalRows,
      hasHyperlinks,
      sampleRows: rows.slice(1, 6)
    };

  } catch (error) {
    console.error(`❌ Error analyzing ${year} spreadsheet:`, error.message);
    return null;
  }
}

/**
 * Main analysis function
 */
async function analyzeAllHistoricalSheets() {
  try {
    // Authenticate with Google Sheets API
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
    }

    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('\n🔍 HISTORICAL SPREADSHEET ANALYSIS');
    console.log('Analyzing 4 historical spreadsheets to understand format differences\n');

    const results = [];

    for (const config of HISTORICAL_SHEETS) {
      const result = await analyzeSheet(sheets, config);
      if (result) {
        results.push(result);
      }
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary comparison
    console.log(`\n\n${'='.repeat(70)}`);
    console.log('SUMMARY COMPARISON');
    console.log(`${'='.repeat(70)}\n`);

    results.forEach(result => {
      console.log(`${result.year}:`);
      console.log(`  Columns: ${result.headers.join(', ')}`);
      console.log(`  Total rows: ${result.totalRows}`);
      console.log(`  Has hyperlinks: ${result.hasHyperlinks ? 'YES' : 'NO'}`);
      console.log();
    });

    console.log('\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  }
}

// Run analysis
analyzeAllHistoricalSheets();
