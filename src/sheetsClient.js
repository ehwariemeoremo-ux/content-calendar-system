const { google } = require('googleapis');

const CALENDAR_TAB = 'Content Calendar';
const USED_TOPICS_TAB = 'Used Topics';

const CALENDAR_HEADERS = [
  'Date',
  'Day of Week',
  'Pillar',
  'Content Topic',
  'IG / TikTok Format',
  'Facebook Format',
  'Facebook Post Draft',
  'Reference / Notes',
];

const USED_TOPICS_HEADERS = ['Pillar', 'Topic', 'Date Used'];

async function getAuthClient() {
  // GitHub Actions / hosted environments: full JSON key pasted as one secret string
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth.getClient();
  }

  // Local development: path to the downloaded JSON key file
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

async function getSheetsClient() {
  const authClient = await getAuthClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Makes sure both tabs exist with the right headers. Safe to call every run.
 */
async function ensureSheetStructure(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = meta.data.sheets.map((s) => s.properties.title);

  const requests = [];
  if (!existingTabs.includes(CALENDAR_TAB)) {
    requests.push({ addSheet: { properties: { title: CALENDAR_TAB } } });
  }
  if (!existingTabs.includes(USED_TOPICS_TAB)) {
    requests.push({ addSheet: { properties: { title: USED_TOPICS_TAB } } });
  }

  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }

  // Write headers if the tab is empty
  await writeHeadersIfMissing(spreadsheetId, CALENDAR_TAB, CALENDAR_HEADERS);
  await writeHeadersIfMissing(spreadsheetId, USED_TOPICS_TAB, USED_TOPICS_HEADERS);

  await applyCalendarFormatting(spreadsheetId);
}

const PILLAR_COLORS = {
  Education: { red: 0.80, green: 0.89, blue: 1.0 }, // light blue
  'Digital Skills': { red: 0.80, green: 0.95, blue: 0.80 }, // light green
  'Remote Work': { red: 1.0, green: 0.93, blue: 0.75 }, // light amber
  'Career Development': { red: 0.92, green: 0.82, blue: 1.0 }, // light purple
};

/**
 * Makes the Content Calendar tab look professional: bold/colored header,
 * frozen header row, wrapped text on long columns, sensible column widths,
 * and a distinct background color per pillar. Safe to call on every run —
 * re-applying the same formatting is harmless (idempotent), except the
 * conditional format rules, which are only added once.
 */
async function applyCalendarFormatting(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const calendarSheet = meta.data.sheets.find((s) => s.properties.title === CALENDAR_TAB);
  const sheetId = calendarSheet.properties.sheetId;
  const existingConditionalFormats = calendarSheet.conditionalFormats || [];
  const existingBandedRanges = calendarSheet.bandedRanges || [];

  const NAVY = { red: 0.09, green: 0.13, blue: 0.24 };
  const CREAM_BAND = { red: 0.97, green: 0.96, blue: 0.93 };
  const WHITE = { red: 1, green: 1, blue: 1 };
  const BORDER_GRAY = { red: 0.82, green: 0.82, blue: 0.82 };
  const CLASSIC_FONT = 'Georgia';

  const requests = [
    // Header row: dark navy background, white bold serif text, taller row
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: NAVY,
            textFormat: { bold: true, foregroundColor: WHITE, fontFamily: CLASSIC_FONT, fontSize: 11 },
            verticalAlignment: 'MIDDLE',
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    },
    // Freeze the header row
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Classic serif font across all data rows
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000 },
        cell: { userEnteredFormat: { textFormat: { fontFamily: CLASSIC_FONT, fontSize: 10 } } },
        fields: 'userEnteredFormat.textFormat(fontFamily,fontSize)',
      },
    },
    // Center-align the short, structured columns: Date, Day, Pillar, IG/TikTok Format, Facebook Format
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 2, endColumnIndex: 3 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 4, endColumnIndex: 5 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } },
        fields: 'userEnteredFormat.horizontalAlignment',
      },
    },
    // Wrap text for the long content columns (Content Topic, Facebook Post Draft, Reference)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 6, endColumnIndex: 7 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 7, endColumnIndex: 8 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)',
      },
    },
    // Column widths
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
        properties: { pixelSize: 260 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
        properties: { pixelSize: 420 },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 },
        properties: { pixelSize: 280 },
        fields: 'pixelSize',
      },
    },
    // Thin, subtle borders across the whole table for a structured, premium look
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 8 },
        top: { style: 'SOLID', width: 1, color: BORDER_GRAY },
        bottom: { style: 'SOLID', width: 1, color: BORDER_GRAY },
        left: { style: 'SOLID', width: 1, color: BORDER_GRAY },
        right: { style: 'SOLID', width: 1, color: BORDER_GRAY },
        innerHorizontal: { style: 'SOLID', width: 1, color: BORDER_GRAY },
        innerVertical: { style: 'SOLID', width: 1, color: BORDER_GRAY },
      },
    },
  ];

  // Alternating row shading (banding) — only add once; it auto-extends to new rows
  if (existingBandedRanges.length === 0) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 8 },
          rowProperties: {
            headerColorStyle: { rgbColor: NAVY },
            firstBandColorStyle: { rgbColor: WHITE },
            secondBandColorStyle: { rgbColor: CREAM_BAND },
          },
        },
      },
    });
  }

  // Pillar color-coding — only add once (avoid duplicating on every run)
  if (existingConditionalFormats.length === 0) {
    Object.entries(PILLAR_COLORS).forEach(([pillarName, color]) => {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 }],
            booleanRule: {
              condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: pillarName }] },
              format: { backgroundColor: color },
            },
          },
          index: 0,
        },
      });
    });
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function writeHeadersIfMissing(spreadsheetId, tabName, headers) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:Z1`,
  });
  const hasHeaders = res.data.values && res.data.values.length > 0;
  if (!hasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

/**
 * Appends one row for a single day's content plan.
 */
async function appendCalendarRow(spreadsheetId, rowValues) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${CALENDAR_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowValues] },
  });
}

/**
 * Records a topic as used so future generations never repeat it.
 */
async function recordUsedTopic(spreadsheetId, pillarName, topic, dateStr) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${USED_TOPICS_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[pillarName, topic, dateStr]] },
  });
}

/**
 * Loads every topic already used for a given pillar, so the generator can
 * avoid repeating them.
 */
async function getUsedTopicsForPillar(spreadsheetId, pillarName) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${USED_TOPICS_TAB}!A2:C`,
  });
  const rows = res.data.values || [];
  return rows.filter((r) => r[0] === pillarName).map((r) => r[1]);
}

/**
 * Returns the IG/TikTok format used on the last N days written to the
 * calendar (across all pillars), most recent last. Used to stop the AI
 * from defaulting to the same format every single day.
 */
async function getRecentFormats(spreadsheetId, count = 5) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CALENDAR_TAB}!A2:E`,
  });
  const rows = res.data.values || [];
  return rows.slice(-count).map((r) => r[4]).filter(Boolean); // column E = IG/TikTok Format
}

module.exports = {
  ensureSheetStructure,
  appendCalendarRow,
  recordUsedTopic,
  getUsedTopicsForPillar,
  getRecentFormats,
  CALENDAR_TAB,
  USED_TOPICS_TAB,
};
