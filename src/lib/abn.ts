/**
 * Australian Business Number validation — a local checksum (works offline,
 * catches typos instantly) backed by a live lookup against the ABR's free
 * ABN Lookup web service (works whenever ABN_LOOKUP_GUID is configured).
 */

const ABN_LOOKUP_GUID = process.env.ABN_LOOKUP_GUID;

/** Official ATO weighting factors for the modulus-89 ABN checksum. */
const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function normalizeAbn(rawAbn: string): string {
  return rawAbn.replace(/\D/g, "");
}

/** The published ABN checksum algorithm — no network call, always available. */
export function isValidAbnChecksum(rawAbn: string): boolean {
  const digits = normalizeAbn(rawAbn);
  if (digits.length !== 11) return false;

  const sum = digits
    .split("")
    .reduce((total, digit, i) => total + (Number(digit) - (i === 0 ? 1 : 0)) * WEIGHTS[i], 0);

  return sum % 89 === 0;
}

export interface AbnLookupResult {
  valid: boolean;
  entityName?: string;
  status?: string;
  error?: string;
}

/**
 * Validates an ABN: checksum first (rejects malformed input immediately),
 * then a live ABR lookup confirming the ABN actually exists and is Active.
 *
 * If ABN_LOOKUP_GUID isn't configured, or the ABR service is unreachable,
 * falls back to checksum-only validation rather than blocking the caller —
 * a government API outage shouldn't stop someone from signing up.
 */
export async function lookupAbn(rawAbn: string): Promise<AbnLookupResult> {
  const digits = normalizeAbn(rawAbn);
  if (!isValidAbnChecksum(digits)) {
    return { valid: false, error: "That doesn't look like a valid ABN — check the 11 digits." };
  }
  if (!ABN_LOOKUP_GUID) {
    return { valid: true };
  }

  try {
    const url = `https://abr.business.gov.au/json/AbnDetails.aspx?abn=${digits}&guid=${ABN_LOOKUP_GUID}`;
    const res = await fetch(url);
    const raw = await res.text();

    // The ABR API always wraps its response in a "callback(...)" JSONP shell,
    // even when no callback parameter is supplied.
    const match = raw.match(/^\w+\(([\s\S]*)\)$/);
    const json = JSON.parse(match ? match[1] : raw);

    if (!json.Abn) {
      return { valid: false, error: json.Message || "That ABN wasn't found on the Australian Business Register." };
    }
    if (json.AbnStatus !== "Active") {
      return {
        valid: false,
        entityName: json.EntityName || undefined,
        status: json.AbnStatus || undefined,
        error: `That ABN's status is "${json.AbnStatus || "unknown"}", not Active.`,
      };
    }
    return { valid: true, entityName: json.EntityName || undefined, status: json.AbnStatus };
  } catch (err) {
    console.error("ABN Lookup request failed, falling back to checksum-only:", err);
    return { valid: true };
  }
}
