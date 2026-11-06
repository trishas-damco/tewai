/**
 * Detect a guideline document's effective date.
 *
 * The uploader never types this: carrier guidelines state their own effective
 * period ("Effective September 2025"), and the version label is the same date
 * in YYYY-MM form. Until server-side PDF extraction lands (ingestion), the
 * dialog reads it from the uploaded file name so the flow is demonstrable.
 *
 * @param {string} text file name or extracted PDF text
 * @returns {{effectiveFrom: string, version: string} | null} YYYY-MM-01 / YYYY-MM
 */

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

function build(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  const padded = String(m).padStart(2, "0");
  return { effectiveFrom: `${y}-${padded}-01`, version: `${y}-${padded}` };
}

export function detectEffectiveDate(text) {
  const source = String(text || "").toLowerCase();
  if (!source) return null;

  // "September 2025", "Sept. 2025", "September, 2025"
  const named = source.match(
    new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s*,?\\s*(20\\d{2})\\b`),
  );
  if (named) return build(named[2], MONTHS[named[1]]);

  // "2025-09" or "2025_09"
  const iso = source.match(/\b(20\d{2})[-_](0[1-9]|1[0-2])\b/);
  if (iso) return build(iso[1], iso[2]);

  // "09/2025" or "9-2025"
  const monthFirst = source.match(/\b(0?[1-9]|1[0-2])[/-](20\d{2})\b/);
  if (monthFirst) return build(monthFirst[2], monthFirst[1]);

  return null;
}

export function formatEffectiveDate(effectiveFrom) {
  if (!effectiveFrom) return "—";
  const parsed = new Date(`${effectiveFrom}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return effectiveFrom;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
