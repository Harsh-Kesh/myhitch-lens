import "server-only";

/**
 * Minimal Copyleaks client: login, submit a document for a plagiarism scan, and run the AI-content detector.
 *
 * Env: COPYLEAKS_EMAIL and COPYLEAKS_API_KEY (the account's email and API key). Calls run in Copyleaks'
 * sandbox (mock data, no credits) unless COPYLEAKS_SANDBOX is exactly "false".
 */

const LOGIN_URL = "https://id.copyleaks.com/v3/account/login/api";
const API_URL = "https://api.copyleaks.com";

/** A scan is kept by Copyleaks for this many hours after it completes; we only need the webhook result. */
const SCAN_EXPIRATION_HOURS = 24;
/** The AI detector rejects anything shorter. */
export const AI_DETECTOR_MIN_CHARS = 255;

export function copyleaksConfigured(): boolean {
  return Boolean(process.env.COPYLEAKS_EMAIL && process.env.COPYLEAKS_API_KEY);
}

function sandbox(): boolean {
  return process.env.COPYLEAKS_SANDBOX !== "false";
}

// The access token lasts 48 hours and login is limited to 12 calls per 15 minutes, so it is cached per server process.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function login(): Promise<string> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: process.env.COPYLEAKS_EMAIL, key: process.env.COPYLEAKS_API_KEY }),
  });
  if (!res.ok) throw new Error(`Copyleaks login failed (${res.status}).`);
  const data = (await res.json()) as { access_token?: string; ".expires"?: string };
  if (!data.access_token) throw new Error("Copyleaks login returned no token.");
  const expires = data[".expires"] ? Date.parse(data[".expires"]) : NaN;
  // Refresh an hour early; fall back to a day if the expiry is missing.
  cachedToken = {
    value: data.access_token,
    expiresAt: (Number.isFinite(expires) ? expires : Date.now() + 24 * 3600_000) - 3600_000,
  };
  return cachedToken.value;
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  return login();
}

/** An authorised request. A 401 means the cached token went stale, so it logs in again and retries once. */
async function request(method: "PUT" | "POST", path: string, body: unknown): Promise<Response> {
  const send = async (token: string) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  let res = await send(await getToken());
  if (res.status === 401) {
    cachedToken = null;
    res = await send(await login());
  }
  return res;
}

async function failure(what: string, res: Response): Promise<Error> {
  const detail = (await res.text().catch(() => "")).slice(0, 200);
  return new Error(`${what} failed (${res.status})${detail ? `: ${detail}` : ""}`);
}

/**
 * Send a document for a plagiarism scan. Copyleaks answers 201 with no body and later calls the status
 * webhook; `secret` rides along as the developerPayload so the webhook can be recognised as genuine.
 */
export async function submitScan(opts: {
  scanId: string;
  filename: string;
  text: string;
  secret: string;
  /** Public base URL of this site, e.g. https://lens.example.com */
  webhookBaseUrl: string;
}): Promise<void> {
  const res = await request("PUT", `/v3/scans/submit/file/${encodeURIComponent(opts.scanId)}`, {
    base64: Buffer.from(opts.text, "utf8").toString("base64"),
    filename: opts.filename,
    properties: {
      // {STATUS} is filled in by Copyleaks: completed, error, creditschecked or indexed.
      webhooks: { status: `${opts.webhookBaseUrl}/api/copyleaks/webhook/${opts.scanId}/{STATUS}` },
      developerPayload: opts.secret,
      sandbox: sandbox(),
      expiration: SCAN_EXPIRATION_HOURS,
    },
  });
  if (!res.ok) throw await failure("Copyleaks scan submission", res);
}

/** Share of the text classified as AI-generated, 0-100. */
export async function detectAi(opts: { scanId: string; text: string }): Promise<number> {
  const res = await request("POST", `/v2/writer-detector/${encodeURIComponent(opts.scanId)}/check`, {
    text: opts.text,
    sandbox: sandbox(),
  });
  if (!res.ok) throw await failure("Copyleaks AI-content check", res);
  const data = (await res.json()) as { summary?: { ai?: number } };
  const ai = data.summary?.ai;
  if (typeof ai !== "number") throw new Error("Copyleaks AI-content check returned no summary.");
  return Math.round(ai * 1000) / 10; // a 0-1 fraction -> a percentage
}
