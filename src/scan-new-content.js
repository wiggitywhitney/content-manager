/**
 * Scan YouTube and Software Defined Interviews for new content
 * and add missing items to the staged spreadsheet.
 *
 * Usage:
 *   GOOGLE_SERVICE_ACCOUNT_JSON=$(gcloud secrets versions access latest --secret=content_manager_service_account --project=demoo-ooclock) node src/scan-new-content.js
 *
 * Or with teller (if configured):
 *   teller run -- node src/scan-new-content.js
 *
 * Options:
 *   --dry-run    Show what would be added without making changes
 *   --month=N    Only scan for content from month N (1-12), defaults to current year
 *   --year=N     Only scan for content from year N (e.g., 2026)
 */

const { google } = require("googleapis");

// Configuration
const STAGED_SPREADSHEET_ID = "1eatUotHm4YOin1_rsqRSb71wY4S-lh5SsGInJVznBts";
const YOUTUBE_CHANNEL_ID = "UCaGYZkSCN3MPwqRpt24KBKA"; // wiggitywhitney
const THUNDER_PLAYLIST_ID = "PLBexUsYDijawXI7x707H1YDdNT2vi98e_";
const SDI_URL = "https://www.softwaredefinedinterviews.com/";

// Parse command line args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const monthArg = args.find(a => a.startsWith("--month="));
const yearArg = args.find(a => a.startsWith("--year="));
const FILTER_MONTH = monthArg ? parseInt(monthArg.split("=")[1]) : null;
const FILTER_YEAR = yearArg ? parseInt(yearArg.split("=")[1]) : (FILTER_MONTH ? new Date().getFullYear() : null);

async function fetchSDIEpisodes() {
  console.log("Fetching SDI episodes from JSON feed...");
  const response = await fetch("https://www.softwaredefinedinterviews.com/json");
  const feed = await response.json();

  const episodes = [];

  for (const item of feed.items) {
    // Parse the ISO date
    const pubDate = new Date(item.date_published);
    const dateStr = `${String(pubDate.getMonth() + 1).padStart(2, "0")}/${String(pubDate.getDate()).padStart(2, "0")}/${pubDate.getFullYear()}`;

    // Clean up title (remove "Episode N: " prefix for cleaner display, but keep guest info)
    let title = item.title;
    // Keep the full title as-is since it includes guest names

    episodes.push({
      title: title,
      type: "Podcast",
      show: "Software Defined Interviews",
      date: dateStr,
      url: item.url,
      publishedAt: pubDate
    });
  }

  console.log(`  Found ${episodes.length} SDI episodes`);
  return episodes;
}

async function fetchYouTubeVideos(auth) {
  console.log("Fetching YouTube Thunder playlist...");
  const youtube = google.youtube({ version: "v3", auth });

  const videos = [];
  let pageToken = null;

  do {
    const response = await youtube.playlistItems.list({
      part: "snippet",
      playlistId: THUNDER_PLAYLIST_ID,
      maxResults: 50,
      pageToken
    });

    for (const item of response.data.items) {
      const snippet = item.snippet;
      if (snippet.title === "Private video") continue;

      const publishedAt = new Date(snippet.publishedAt);
      const dateStr = `${String(publishedAt.getMonth() + 1).padStart(2, "0")}/${String(publishedAt.getDate()).padStart(2, "0")}/${publishedAt.getFullYear()}`;

      videos.push({
        title: snippet.title,
        type: "Video",
        show: "🌩️ Thunder",
        date: dateStr,
        url: `https://youtu.be/${snippet.resourceId.videoId}`,
        publishedAt
      });
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  console.log(`  Found ${videos.length} Thunder videos`);
  return videos;
}

async function getExistingContent(sheets) {
  console.log("Reading staged spreadsheet...");
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    range: "A:G"
  });

  const rows = response.data.values || [];
  const urls = new Set();

  for (const row of rows) {
    if (row[6]) { // Column G is the URL
      urls.add(row[6].toLowerCase().trim());
    }
  }

  console.log(`  Found ${urls.size} existing URLs`);
  return { urls, rowCount: rows.length };
}

function filterByMonthAndYear(items, month, year) {
  if (!month && !year) return items;

  return items.filter(item => {
    const parts = item.date.split("/");
    const itemMonth = parseInt(parts[0]);
    const itemYear = parseInt(parts[2]);

    if (month && year) {
      return itemMonth === month && itemYear === year;
    } else if (year) {
      return itemYear === year;
    } else if (month) {
      return itemMonth === month;
    }
    return true;
  });
}

async function addNewContent(sheets, newItems, lastRow) {
  if (newItems.length === 0) {
    console.log("No new content to add.");
    return;
  }

  // Sort by date
  newItems.sort((a, b) => {
    const [am, ad, ay] = a.date.split("/").map(Number);
    const [bm, bd, by] = b.date.split("/").map(Number);
    const dateA = new Date(ay, am - 1, ad);
    const dateB = new Date(by, bm - 1, bd);
    return dateA - dateB;
  });

  console.log(`\nNew content to add (${newItems.length} items):`);
  for (const item of newItems) {
    console.log(`  - ${item.date} | ${item.show} | ${item.title}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] No changes made.");
    return;
  }

  const rows = newItems.map(item => [
    item.title,
    item.type,
    item.show,
    item.date,
    "", // Location
    "", // Confirmed
    item.url
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: STAGED_SPREADSHEET_ID,
    range: `A${lastRow + 1}`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: { values: rows }
  });

  console.log(`\nAdded ${newItems.length} rows to spreadsheet.`);
}

async function main() {
  console.log("=== Content Scanner ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (FILTER_MONTH || FILTER_YEAR) {
    const filterDesc = FILTER_MONTH && FILTER_YEAR
      ? `${FILTER_MONTH}/${FILTER_YEAR}`
      : FILTER_YEAR ? `year ${FILTER_YEAR}` : `month ${FILTER_MONTH}`;
    console.log(`Filtering to: ${filterDesc}`);
  }
  console.log("");

  // Set up Google auth
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/youtube.readonly"
    ]
  });

  const sheets = google.sheets({ version: "v4", auth });

  // Fetch all data
  const [sdiEpisodes, youtubeVideos, existing] = await Promise.all([
    fetchSDIEpisodes(),
    fetchYouTubeVideos(auth),
    getExistingContent(sheets)
  ]);

  // Combine and filter
  let allContent = [...sdiEpisodes, ...youtubeVideos];

  if (FILTER_MONTH || FILTER_YEAR) {
    allContent = filterByMonthAndYear(allContent, FILTER_MONTH, FILTER_YEAR);
    const filterDesc = FILTER_MONTH && FILTER_YEAR
      ? `month ${FILTER_MONTH}/${FILTER_YEAR}`
      : FILTER_YEAR ? `year ${FILTER_YEAR}` : `month ${FILTER_MONTH}`;
    console.log(`\nFiltered to ${allContent.length} items for ${filterDesc}`);
  }

  // Find new items (not already in spreadsheet)
  const newItems = allContent.filter(item =>
    !existing.urls.has(item.url.toLowerCase().trim())
  );

  // Add to spreadsheet
  await addNewContent(sheets, newItems, existing.rowCount);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
