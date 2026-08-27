require('dotenv').config();

const { getPillarForDate, ROTATION_EPOCH } = require('./src/pillarRotation');
const { generateDailyContent } = require('./src/contentGenerator');
const {
  ensureSheetStructure,
  appendCalendarRow,
  recordUsedTopic,
  getUsedTopicsForPillar,
  getRecentFormats,
  getLastCalendarDate,
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

    let idea;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        idea = await generateDailyContent({
          pillar,
          usedTopics: usedTopicsCache[pillar.name],
          recentFormats,
        });
        break; // success, stop retrying
      } catch (err) {
        const isTemporary = /503|UNAVAILABLE|high demand/i.test(err.message || '');
        if (isTemporary && attempt < MAX_ATTEMPTS) {
          const waitSeconds = attempt * 15; // 15s, then 30s
          console.log(
            `  Temporary Gemini overload (attempt ${attempt}/${MAX_ATTEMPTS}). Waiting ${waitSeconds}s before retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        } else {
          console.log(`  Skipping ${dateStr} after ${attempt} attempt(s): ${err.message}`);
        }
      }
    }

    if (!idea) {
      // Could not generate this day even after retries — move on to the next
      // day rather than stopping the whole run. Re-run this specific date
      // later to fill the gap.
      current = addDays(current, 1);
      continue;
    }

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
 * Entry point.
 * - If --start/--end are given, uses those exact dates (for manual backfills).
 * - Otherwise, defaults to "the day after whatever was last written to the
 *   calendar" — NOT the real-world current date. This matters because the
 *   Sheet is pre-filled with future dates (e.g. September–December 2026)
 *   well ahead of real time, so the automation must continue THAT sequence,
 *   not jump to today's real calendar date.
 * Usage:
 *   node index.js --start=2026-09-01 --end=2026-09-30
 *   node index.js --dry-run   (prints instead of writing to the Sheet)
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const startArg = args.find((a) => a.startsWith('--start='));
  const endArg = args.find((a) => a.startsWith('--end='));

  if (!dryRun && (!SPREADSHEET_ID || !process.env.GEMINI_API_KEY)) {
    console.error(
      'Missing GOOGLE_SHEET_ID or GEMINI_API_KEY in your .env file. See .env.example.'
    );
    process.exit(1);
  }

  let startDate;
  let endDate;

  if (startArg) {
    startDate = new Date(startArg.split('=')[1]);
    endDate = endArg ? new Date(endArg.split('=')[1]) : startDate;
  } else {
    // No dates given — continue from the day after the last row in the Sheet.
    const lastDateStr = dryRun ? null : await getLastCalendarDate(SPREADSHEET_ID);
    let nextDate;
    if (lastDateStr) {
      nextDate = addDays(new Date(lastDateStr), 1);
    } else {
      // Sheet is empty — fall back to the rotation's starting date.
      nextDate = ROTATION_EPOCH;
    }
    startDate = nextDate;
    endDate = nextDate;
  }

  await generateRange(startDate, endDate, { dryRun });
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
