require('dotenv').config();

const { getPillarForDate } = require('./src/pillarRotation');
const { generateDailyContent } = require('./src/contentGenerator');
const {
  ensureSheetStructure,
  appendCalendarRow,
  recordUsedTopic,
  getUsedTopicsForPillar,
  getRecentFormats,
} = require('./src/sheetsClient');

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/**
 * Generates and writes content for every day between startDate and endDate (inclusive).
 * A small in-memory cache of used topics per pillar avoids re-fetching the sheet
 * on every single day within one run.
 */
async function generateRange(startDate, endDate, { dryRun = false } = {}) {
  if (!dryRun) {
    await ensureSheetStructure(SPREADSHEET_ID);
  }

  const usedTopicsCache = {}; // pillarName -> [topics]
  let recentFormats = dryRun ? [] : await getRecentFormats(SPREADSHEET_ID, 5);

  let current = new Date(startDate);
  while (current <= endDate) {
    const pillar = getPillarForDate(current);
    const dateStr = formatDate(current);
    const dayName = DAY_NAMES[current.getUTCDay()];

    if (!usedTopicsCache[pillar.name]) {
      usedTopicsCache[pillar.name] = dryRun
        ? []
        : await getUsedTopicsForPillar(SPREADSHEET_ID, pillar.name);
    }

    console.log(`\n[${dateStr} — ${dayName}] Pillar: ${pillar.name} — generating...`);

    const idea = await generateDailyContent({
      pillar,
      usedTopics: usedTopicsCache[pillar.name],
      recentFormats,
    });

    const facebookDraftText =
      `HOOK: ${idea.facebook_draft.hook}\n\n` +
      `CONTEXT: ${idea.facebook_draft.context}\n\n` +
      `VALUE: ${idea.facebook_draft.value}\n\n` +
      `CTA: ${idea.facebook_draft.cta}`;

    const row = [
      dateStr,
      dayName,
      pillar.name,
      idea.topic,
      idea.ig_tiktok_format,
      idea.facebook_format,
      facebookDraftText,
      idea.reference,
    ];

    if (dryRun) {
      console.log(JSON.stringify({ row, topic_summary: idea.topic_summary }, null, 2));
    } else {
      await appendCalendarRow(SPREADSHEET_ID, row);
      await recordUsedTopic(SPREADSHEET_ID, pillar.name, idea.topic, dateStr);
    }

    usedTopicsCache[pillar.name].push(idea.topic);
    recentFormats = [...recentFormats, idea.ig_tiktok_format].slice(-5);
    current = addDays(current, 1);
  }

  console.log('\nDone.');
}

/**
 * Entry point. Defaults to generating the current month if no args given.
 * Usage:
 *   node index.js --start=2026-09-01 --end=2026-09-30
 *   node index.js --dry-run   (prints instead of writing to the Sheet)
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const startArg = args.find((a) => a.startsWith('--start='));
  const endArg = args.find((a) => a.startsWith('--end='));

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const startDate = startArg ? new Date(startArg.split('=')[1]) : todayUTC;
  const endDate = endArg ? new Date(endArg.split('=')[1]) : todayUTC;

  if (!dryRun && (!SPREADSHEET_ID || !process.env.GEMINI_API_KEY)) {
    console.error(
      'Missing GOOGLE_SHEET_ID or GEMINI_API_KEY in your .env file. See .env.example.'
    );
    process.exit(1);
  }

  await generateRange(startDate, endDate, { dryRun });
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
