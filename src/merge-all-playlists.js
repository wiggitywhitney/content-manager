const fs = require('fs');

/**
 * Merge all playlist CSVs by year, deduplicate by title+date
 * Outputs separate CSV files for historical years (2020-2024)
 * Excludes 2025 content (that belongs in Sheet1)
 */

function readCSV(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

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
        Location: fields[4],
        Confirmed: fields[5],
        Link: fields[6],
        'Micro.blog URL': fields[7] || ''
      });
    }
  }

  return videos;
}

function normalizeTitle(title) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function createKey(video) {
  return `${normalizeTitle(video.Name)}|${video.Date}`;
}

function extractYear(dateStr) {
  // Date format: M/D/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return parseInt(parts[2], 10);
  }
  return null;
}

function writeCSV(videos, outputPath) {
  const headers = ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL'];

  const escape = (field) => {
    const str = String(field || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    headers.join(','),
    ...videos.map(v => [
      escape(v.Name),
      escape(v.Type),
      escape(v.Show),
      escape(v.Date),
      escape(v.Location),
      escape(v.Confirmed),
      escape(v.Link),
      escape(v['Micro.blog URL'])
    ].join(','))
  ];

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');
}

function main() {
  console.log('Merging all playlists...\n');

  // Read corrected NEEDS_REVIEW data
  const correctedData = new Map();
  if (fs.existsSync('data/needs-review-corrected.csv')) {
    console.log('Loading corrected NEEDS_REVIEW data...\n');
    const corrected = readCSV('data/needs-review-corrected.csv');
    corrected.forEach(video => {
      if (video.Link) {
        correctedData.set(video.Link, video);
      }
    });
    console.log(`Loaded ${correctedData.size} corrected entries\n`);
  }

  // Read all playlist CSVs by year
  const playlists = {
    'You Choose!': 'data/you-choose',
    '⚡️Enlightning (primary)': 'data/enlightning',
    '⚡️Enlightning (alternate)': 'data/enlightning-alt',
    'Presentations & Guest': 'data/presentations-guest',
    'IBM Cloud': 'data/ibm-videos',
    'Cloud Native Live': 'data/cloud-native-live',
    'Two Friends Talking Tanzu': 'data/two-friends-talking-tanzu',
    'VMware Tanzu YouTube': 'data/vmware-tanzu-youtube',
    'Other Content': 'data/other-content'
  };

  const years = [2020, 2021, 2022, 2023, 2024]; // Exclude 2025

  const allVideosByYear = {};

  // Read all videos from all playlists
  for (const year of years) {
    allVideosByYear[year] = [];

    for (const [playlistName, basePath] of Object.entries(playlists)) {
      const yearFile = `${basePath}-${year}.csv`;
      const videos = readCSV(yearFile);

      if (videos.length > 0) {
        console.log(`  ${playlistName} ${year}: ${videos.length} videos`);
        allVideosByYear[year].push(...videos);
      }
    }

    // Special case: Software Defined Interviews (single CSV, filter by year)
    const sdiVideos = readCSV('data/software-defined-interviews.csv');
    const sdiForYear = sdiVideos.filter(video => extractYear(video.Date) === year);
    if (sdiForYear.length > 0) {
      console.log(`  Software Defined Interviews ${year}: ${sdiForYear.length} videos`);
      allVideosByYear[year].push(...sdiForYear);
    }
  }

  console.log('\nDeduplicating by title + date...\n');

  // Deduplicate by title+date for each year
  const deduplicatedByYear = {};

  for (const year of years) {
    const videos = allVideosByYear[year];
    const seenKeys = new Set();
    const unique = [];

    for (const video of videos) {
      const key = createKey(video);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);

        // Apply corrected data if available
        if (correctedData.has(video.Link)) {
          const corrected = correctedData.get(video.Link);
          video.Type = corrected.Type;
          video.Show = corrected.Show;
          video.Confirmed = corrected.Confirmed || '';
        }

        unique.push(video);
      }
    }

    // Sort by date (oldest first)
    unique.sort((a, b) => {
      const dateA = new Date(a.Date);
      const dateB = new Date(b.Date);
      return dateA - dateB;
    });

    deduplicatedByYear[year] = unique;

    console.log(`  ${year}: ${videos.length} total → ${unique.length} unique videos`);
  }

  console.log('\nWriting final CSVs...\n');

  // Write year-specific CSVs
  for (const year of years) {
    const videos = deduplicatedByYear[year];

    if (videos.length > 0) {
      const outputPath = `data/FINAL-${year}.csv`;
      writeCSV(videos, outputPath);
      console.log(`  ✅ ${outputPath} (${videos.length} videos)`);
    }
  }

  // Write combined historical CSV (all years 2020-2024)
  const allHistorical = [];
  for (const year of years) {
    allHistorical.push(...deduplicatedByYear[year]);
  }

  // Sort by date
  allHistorical.sort((a, b) => {
    const dateA = new Date(a.Date);
    const dateB = new Date(b.Date);
    return dateA - dateB;
  });

  const combinedPath = 'data/FINAL-ALL-HISTORICAL-2020-2024.csv';
  writeCSV(allHistorical, combinedPath);
  console.log(`  ✅ ${combinedPath} (${allHistorical.length} videos)`);

  console.log('\n='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log('\nHistorical content (2020-2024) ready for import:');
  for (const year of years) {
    const count = deduplicatedByYear[year].length;
    if (count > 0) {
      console.log(`  ${year}: ${count} videos → data/FINAL-${year}.csv`);
    }
  }
  console.log(`\n  Total historical: ${allHistorical.length} videos → ${combinedPath}`);
  console.log('\n✅ 2025 content excluded (already in or will go to Sheet1)');
  console.log('='.repeat(70));
}

main();
