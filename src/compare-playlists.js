const fs = require('fs');

/**
 * Compare two CSV files by title and date to find unique videos
 *
 * Usage: node compare-playlists.js <csv1> <csv2>
 */

function readCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header row
  const dataLines = lines.slice(1);

  const videos = [];
  for (const line of dataLines) {
    // Simple CSV parsing
    const fields = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField);

    if (fields.length >= 7) {
      videos.push({
        Name: fields[0],
        Type: fields[1],
        Show: fields[2],
        Date: fields[3],
        Link: fields[6]
      });
    }
  }

  return videos;
}

function normalizeTitle(title) {
  // Remove extra whitespace, convert to lowercase for comparison
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createKey(video) {
  // Create a unique key from normalized title and date
  return `${normalizeTitle(video.Name)}|${video.Date}`;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node compare-playlists.js <csv1> <csv2>');
    console.error('Example: node compare-playlists.js data/enlightning.csv data/enlightning-alt.csv');
    process.exit(1);
  }

  const csv1Path = args[0];
  const csv2Path = args[1];

  console.log(`Comparing:`);
  console.log(`  CSV 1: ${csv1Path}`);
  console.log(`  CSV 2: ${csv2Path}`);
  console.log();

  const videos1 = readCSV(csv1Path);
  const videos2 = readCSV(csv2Path);

  console.log(`Videos in CSV 1: ${videos1.length}`);
  console.log(`Videos in CSV 2: ${videos2.length}`);
  console.log();

  // Create sets of keys
  const keys1 = new Set(videos1.map(createKey));
  const keys2 = new Set(videos2.map(createKey));

  // Find videos only in CSV1
  const onlyInCSV1 = videos1.filter(v => !keys2.has(createKey(v)));

  // Find videos only in CSV2
  const onlyInCSV2 = videos2.filter(v => !keys1.has(createKey(v)));

  // Find common videos
  const common = videos1.filter(v => keys2.has(createKey(v)));

  console.log('='.repeat(70));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(70));
  console.log();
  console.log(`Common videos (in both): ${common.length}`);
  console.log(`Only in CSV 1: ${onlyInCSV1.length}`);
  console.log(`Only in CSV 2: ${onlyInCSV2.length}`);
  console.log();

  if (onlyInCSV1.length > 0) {
    console.log(`Videos only in ${csv1Path}:`);
    console.log('-'.repeat(70));
    for (const video of onlyInCSV1) {
      console.log(`  📹 ${video.Name}`);
      console.log(`     Date: ${video.Date}`);
      console.log(`     Link: ${video.Link}`);
      console.log();
    }
  }

  if (onlyInCSV2.length > 0) {
    console.log(`Videos only in ${csv2Path}:`);
    console.log('-'.repeat(70));
    for (const video of onlyInCSV2) {
      console.log(`  📹 ${video.Name}`);
      console.log(`     Date: ${video.Date}`);
      console.log(`     Link: ${video.Link}`);
      console.log();
    }
  }

  console.log('='.repeat(70));
}

main();
