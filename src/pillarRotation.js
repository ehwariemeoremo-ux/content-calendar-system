const { PILLARS } = require('../config/pillars');

/**
 * The rotation start date. Day 1 of this date = Pillar index 0 (Education).
 * This NEVER changes once content has started going out — changing it would
 * shift every future day's pillar. Only touch this before the very first run.
 */
const ROTATION_EPOCH = new Date(Date.UTC(2026, 8, 1)); // Sept 1, 2026 (month is 0-indexed)

/**
 * Returns the number of whole days between ROTATION_EPOCH and the given date.
 */
function daysSinceEpoch(date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const utcEpoch = Date.UTC(
    ROTATION_EPOCH.getUTCFullYear(),
    ROTATION_EPOCH.getUTCMonth(),
    ROTATION_EPOCH.getUTCDate()
  );
  return Math.round((utcDate - utcEpoch) / msPerDay);
}

/**
 * Returns the pillar object for a given date.
 * The cycle is continuous: Pillar1,2,3,4,1,2,3,4... with NO reset at week
 * or month boundaries. It only depends on how many days have passed since
 * ROTATION_EPOCH, mod 4.
 */
function getPillarForDate(date) {
  const dayIndex = daysSinceEpoch(date); // 0-based
  const pillarIndex = ((dayIndex % PILLARS.length) + PILLARS.length) % PILLARS.length;
  return PILLARS[pillarIndex];
}

module.exports = { getPillarForDate, daysSinceEpoch, ROTATION_EPOCH };
