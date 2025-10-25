const fs = require('fs');
const path = require('path');

// CSV files to clean
const csvFiles = [
  'data/FINAL-2020.csv',
  'data/FINAL-2021.csv',
  'data/FINAL-2022.csv',
  'data/FINAL-2023.csv',
  'data/FINAL-2024.csv',
  'data/FINAL-ALL-HISTORICAL-2020-2024.csv'
];

console.log('=== CSV Data Cleanup ===\n');

let totalChanges = 0;

csvFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`);
    return;
  }

  console.log(`Processing ${file}...`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let changes = 0;
  const cleanedLines = lines.map((line, idx) => {
    // Skip header row
    if (idx === 0) return line;

    // Skip empty lines
    if (!line.trim()) return line;

    let cleanedLine = line;

    // Fix 1: Remove @username from titles
    // DevOps Speakeasy with Whitney Lee @wiggitywhitney → DevOps Speakeasy with Whitney Lee
    if (cleanedLine.includes(' @')) {
      const before = cleanedLine;
      cleanedLine = cleanedLine.replace(/ @\w+/g, '');
      if (before !== cleanedLine) {
        changes++;
        console.log(`  ✓ Removed @username from line ${idx + 1}`);
      }
    }

    // Fix 2: Remove "Cloud Native Live:" or "CNL:" prefix from titles
    if (cleanedLine.startsWith('Cloud Native Live:')) {
      const before = cleanedLine;
      cleanedLine = cleanedLine.replace(/^Cloud Native Live: /, '');
      if (before !== cleanedLine) {
        changes++;
        console.log(`  ✓ Removed "Cloud Native Live:" prefix from line ${idx + 1}`);
      }
    } else if (cleanedLine.startsWith('CNL:')) {
      const before = cleanedLine;
      cleanedLine = cleanedLine.replace(/^CNL: /, '');
      if (before !== cleanedLine) {
        changes++;
        console.log(`  ✓ Removed "CNL:" prefix from line ${idx + 1}`);
      }
    }

    // Fix 3: Remove "Tanzu Tuesdays NN -" or "Tanzu Tuesdays NN:" prefix (with episode number)
    if (cleanedLine.startsWith('Tanzu Tuesdays ')) {
      const before = cleanedLine;
      // Match "Tanzu Tuesdays 67 - " or "Tanzu Tuesdays 77: "
      cleanedLine = cleanedLine.replace(/^Tanzu Tuesdays \d+[:\-] /, '');
      if (before !== cleanedLine) {
        changes++;
        console.log(`  ✓ Removed "Tanzu Tuesdays" prefix with episode number from line ${idx + 1}`);
      }
    }

    return cleanedLine;
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, cleanedLines.join('\n'), 'utf-8');
    console.log(`  ✅ ${changes} changes made\n`);
    totalChanges += changes;
  } else {
    console.log(`  ℹ️  No changes needed\n`);
  }
});

console.log(`=== Summary ===`);
console.log(`Total changes: ${totalChanges}`);
console.log(`\nNext step: Re-run import to update spreadsheet`);
