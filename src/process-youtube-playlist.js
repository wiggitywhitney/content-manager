const fs = require('fs');
const path = require('path');

/**
 * Process YouTube playlist JSONL file and convert to spreadsheet format
 *
 * Input: JSONL file from yt-dlp (one JSON object per line, may have WARNING lines)
 * Output: Array of objects ready for spreadsheet import
 *
 * Spreadsheet columns needed:
 * - Name (Column A): Video title
 * - Type (Column B): "Video" or "Podcast"
 * - Show (Column C): Playlist name (e.g., "You Choose!")
 * - Date (Column D): Upload date in M/D/YYYY format
 * - Location (Column E): Empty
 * - Confirmed (Column F): Empty (or "KEYNOTE" if applicable)
 * - Link (Column G): YouTube video URL
 * - Micro.blog URL (Column H): Empty (filled by sync script)
 */

/**
 * Parse upload_date from YYYYMMDD format to M/D/YYYY
 * @param {string} uploadDate - Date in YYYYMMDD format (e.g., "20240115")
 * @returns {string} - Date in M/D/YYYY format (e.g., "1/15/2024")
 */
function formatDate(uploadDate) {
  if (!uploadDate || uploadDate.length !== 8) {
    return '';
  }

  const year = uploadDate.substring(0, 4);
  const month = parseInt(uploadDate.substring(4, 6), 10); // Remove leading zero
  const day = parseInt(uploadDate.substring(6, 8), 10);   // Remove leading zero

  return `${month}/${day}/${year}`;
}

/**
 * Determine content type based on playlist
 * @param {string} playlistName - Name of the playlist
 * @returns {string} - "Video", "Podcast", or "NEEDS_REVIEW"
 */
function determineType(playlistName) {
  // Software Defined Interviews should be "Podcast"
  if (playlistName.includes('Software Defined Interviews')) {
    return 'Podcast';
  }

  // Presentations & Guest Appearances need manual review
  // to determine if they are "Presentations" or "Guest"
  if (playlistName.includes('Presentations') || playlistName.includes('Guest')) {
    return 'NEEDS_REVIEW';
  }

  // Everything else is "Video"
  return 'Video';
}

/**
 * Extract year from upload_date
 * @param {string} uploadDate - Date in YYYYMMDD format
 * @returns {number} - Year (e.g., 2024)
 */
function extractYear(uploadDate) {
  if (!uploadDate || uploadDate.length !== 8) {
    return null;
  }
  return parseInt(uploadDate.substring(0, 4), 10);
}

/**
 * Process a JSONL file from yt-dlp
 * @param {string} inputPath - Path to JSONL file
 * @param {string} playlistName - Name of the playlist (for Show column)
 * @returns {Object} - { videos: Array, stats: Object }
 */
function processPlaylist(inputPath, playlistName) {
  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  const videos = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip WARNING lines
    if (line.startsWith('WARNING:')) {
      continue;
    }

    try {
      const video = JSON.parse(line);

      // Extract required fields
      const title = video.title || '';
      const uploadDate = video.upload_date || '';
      const url = video.webpage_url || '';
      const year = extractYear(uploadDate);

      // Skip if missing critical fields
      if (!title || !uploadDate || !url) {
        errors.push({
          line: i + 1,
          reason: 'Missing title, date, or URL',
          data: { title, uploadDate, url }
        });
        continue;
      }

      // Create spreadsheet row
      videos.push({
        Name: title,
        Type: determineType(playlistName),
        Show: playlistName,
        Date: formatDate(uploadDate),
        Location: '',
        Confirmed: '',
        Link: url,
        'Micro.blog URL': '',
        // Metadata for organizing
        _year: year,
        _uploadDate: uploadDate
      });

    } catch (error) {
      // Skip invalid JSON lines (probably warnings mixed in)
      errors.push({
        line: i + 1,
        reason: 'JSON parse error',
        error: error.message
      });
    }
  }

  // Sort by upload date (oldest first)
  videos.sort((a, b) => a._uploadDate.localeCompare(b._uploadDate));

  // Group by year
  const byYear = {};
  for (const video of videos) {
    const year = video._year;
    if (!byYear[year]) {
      byYear[year] = [];
    }
    byYear[year].push(video);
  }

  return {
    videos,
    byYear,
    stats: {
      total: videos.length,
      errors: errors.length,
      errorDetails: errors,
      years: Object.keys(byYear).sort()
    }
  };
}

/**
 * Write videos to CSV file
 * @param {Array} videos - Array of video objects
 * @param {string} outputPath - Path to output CSV file
 */
function writeCSV(videos, outputPath) {
  const headers = ['Name', 'Type', 'Show', 'Date', 'Location', 'Confirmed', 'Link', 'Micro.blog URL'];

  const rows = [
    headers.join(','),
    ...videos.map(v => {
      // Escape fields that contain commas or quotes
      const escape = (field) => {
        const str = String(field || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escape(v.Name),
        escape(v.Type),
        escape(v.Show),
        escape(v.Date),
        escape(v.Location),
        escape(v.Confirmed),
        escape(v.Link),
        escape(v['Micro.blog URL'])
      ].join(',');
    })
  ];

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node process-youtube-playlist.js <input-jsonl> <playlist-name> [output-csv]');
    console.error('Example: node process-youtube-playlist.js data/youtube-extracts/you-choose.json "You Choose!" data/you-choose.csv');
    process.exit(1);
  }

  const inputPath = args[0];
  const playlistName = args[1];
  const outputPath = args[2] || inputPath.replace('.json', '.csv');

  console.log(`Processing playlist: ${playlistName}`);
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log();

  const result = processPlaylist(inputPath, playlistName);

  console.log('Statistics:');
  console.log(`  Total videos: ${result.stats.total}`);
  console.log(`  Parse errors: ${result.stats.errors}`);
  console.log(`  Years: ${result.stats.years.join(', ')}`);
  console.log();

  console.log('Videos by year:');
  for (const year of result.stats.years) {
    console.log(`  ${year}: ${result.byYear[year].length} videos`);
  }
  console.log();

  if (result.stats.errors > 0) {
    console.log('Errors:');
    result.stats.errorDetails.slice(0, 5).forEach(err => {
      console.log(`  Line ${err.line}: ${err.reason}`);
    });
    if (result.stats.errors > 5) {
      console.log(`  ... and ${result.stats.errors - 5} more errors`);
    }
    console.log();
  }

  // Write CSV
  writeCSV(result.videos, outputPath);
  console.log(`✅ Wrote ${result.videos.length} videos to ${outputPath}`);

  // Write per-year CSVs
  for (const year of result.stats.years) {
    const yearOutputPath = outputPath.replace('.csv', `-${year}.csv`);
    writeCSV(result.byYear[year], yearOutputPath);
    console.log(`✅ Wrote ${result.byYear[year].length} videos to ${yearOutputPath}`);
  }
}

module.exports = { processPlaylist, writeCSV };
