/**
 * Scrape Software Defined Interviews episodes 83-111
 *
 * Website pattern: https://www.softwaredefinedinterviews.com/{episode}
 * Each page has title, date, and video URL
 */

const fs = require('fs');

async function scrapeEpisode(episodeNum) {
  const url = `https://www.softwaredefinedinterviews.com/${episodeNum}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Episode ${episodeNum}: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract title from <title> tag or h1
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : `Episode ${episodeNum}`;

    // Clean up title (remove " - Software Defined Interviews" suffix if present)
    title = title.replace(/\s*-\s*Software Defined Interviews\s*$/i, '').trim();

    // Extract YouTube video URL
    const youtubeMatch = html.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    const videoUrl = youtubeMatch ? `https://www.youtube.com/watch?v=${youtubeMatch[1]}` : '';

    // Extract date - look for common date patterns in the HTML
    let date = '';

    // Pattern: "October 2nd, 2024" or "January 15th, 2025"
    const ordinalDateMatch = html.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th),\s+(\d{4})/i);

    if (ordinalDateMatch) {
      const monthNames = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
      };

      const month = monthNames[ordinalDateMatch[1].toLowerCase()];
      const day = parseInt(ordinalDateMatch[2], 10);
      const year = ordinalDateMatch[3];

      date = `${month}/${day}/${year}`;
    } else {
      // Fallback patterns
      const datePatterns = [
        /<time[^>]*datetime="([^"]+)"/i,
        /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})/  // M/D/YYYY or MM/DD/YYYY
      ];

      for (const pattern of datePatterns) {
        const match = html.match(pattern);
        if (match) {
          date = match[1];
          // Convert ISO date to M/D/YYYY if needed
          if (date.includes('T')) {
            const d = new Date(date);
            date = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
          }
          break;
        }
      }
    }

    console.log(`Episode ${episodeNum}: "${title}" (${date || 'no date'})`);

    return {
      Name: title,
      Type: 'Podcast',
      Show: 'Software Defined Interviews',
      Date: date,
      Location: '',
      Confirmed: '',
      Link: url,
      'Micro.blog URL': '',
      episodeNum
    };

  } catch (error) {
    console.error(`Episode ${episodeNum}: Error - ${error.message}`);
    return null;
  }
}

async function scrapeAllEpisodes(startEp, endEp) {
  console.log(`Scraping Software Defined Interviews episodes ${startEp}-${endEp}...\n`);

  const episodes = [];

  for (let ep = startEp; ep <= endEp; ep++) {
    const episode = await scrapeEpisode(ep);
    if (episode) {
      episodes.push(episode);
    }

    // Small delay to be respectful to the server
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nScraped ${episodes.length} episodes successfully\n`);

  return episodes;
}

function writeCSV(episodes, outputPath) {
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
    ...episodes.map(e => [
      escape(e.Name),
      escape(e.Type),
      escape(e.Show),
      escape(e.Date),
      escape(e.Location),
      escape(e.Confirmed),
      escape(e.Link),
      escape(e['Micro.blog URL'])
    ].join(','))
  ];

  fs.writeFileSync(outputPath, rows.join('\n'), 'utf8');
  console.log(`✅ Wrote ${episodes.length} episodes to ${outputPath}`);
}

async function main() {
  const startEp = 83;
  const endEp = 111;

  const episodes = await scrapeAllEpisodes(startEp, endEp);

  if (episodes.length > 0) {
    writeCSV(episodes, 'data/software-defined-interviews.csv');
  } else {
    console.error('No episodes scraped successfully');
    process.exit(1);
  }
}

main();
