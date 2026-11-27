import crypto from "crypto";

export const LINE_OAUTH_COOKIE_NAME = "line_oauth_ctx";
export const LINE_OAUTH_TTL_SECONDS = 10 * 60;

export interface LineOAuthCookiePayload {
  state: string;
  codeVerifier: string;
  userId: string;
  exp: number;
}

export function isLineLoginConfigured(): boolean {
  return Boolean(
    process.env.LINE_LOGIN_CHANNEL_ID?.trim() &&
      process.env.LINE_LOGIN_CHANNEL_SECRET?.trim()
  );
}

function getCookieSigningSecret(): string {
  return (
    process.env.NEXTAUTH_SECRET ||
    process.env.LINE_LOGIN_CHANNEL_SECRET ||
    ""
  );
}

export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier, "utf8")
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function signLineOAuthCookie(
  payload: LineOAuthCookiePayload,
  secret = getCookieSigningSecret()
): string {
  if (!secret) {
    throw new Error("Cookie signing secret is not configured");
  }
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyLineOAuthCookie(
  rawCookie: string | undefined,
  secret = getCookieSigningSecret()
): LineOAuthCookiePayload | null {
  if (!rawCookie || !secret) return null;
  const dotIdx = rawCookie.indexOf(".");
  if (dotIdx <= 0) return null;

  const body = rawCookie.slice(0, dotIdx);
  const sig = rawCookie.slice(dotIdx + 1);
  if (!body || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64url");

  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as LineOAuthCookiePayload;
    if (
      !parsed.state ||
      !parsed.codeVerifier ||
      !parsed.userId ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildLineAuthorizeUrl(params: {
  channelId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.channelId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", "profile");
  // Offer to add the linked LINE Official Account on the consent screen
  url.searchParams.set("bot_prompt", "aggressive");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
