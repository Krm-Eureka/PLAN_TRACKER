import { describe, expect, it } from "vitest";
import {
  generatePkcePair,
  generateOAuthState,
  signLineOAuthCookie,
  verifyLineOAuthCookie,
  buildLineAuthorizeUrl,
} from "../lineOAuth";

describe("lineOAuth helpers", () => {
  const secret = "test-signing-secret";

  it("generates PKCE verifier and S256 challenge", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(32);
    expect(codeChallenge.length).toBeGreaterThanOrEqual(32);
    expect(codeChallenge).not.toBe(codeVerifier);
  });

  it("signs and verifies OAuth state cookie while rejecting tampering or expiry", () => {
    const state = generateOAuthState();
    const { codeVerifier } = generatePkcePair();
    const validCookie = signLineOAuthCookie(
      {
        state,
        codeVerifier,
        userId: "user-123",
        exp: Date.now() + 60_000,
      },
      secret
    );

    const parsed = verifyLineOAuthCookie(validCookie, secret);
    expect(parsed?.state).toBe(state);
    expect(parsed?.userId).toBe("user-123");

    // Tampered cookie
    expect(verifyLineOAuthCookie(validCookie + "x", secret)).toBeNull();
    // Wrong secret
    expect(verifyLineOAuthCookie(validCookie, "wrong-secret")).toBeNull();

    // Expired cookie
    const expiredCookie = signLineOAuthCookie(
      {
        state,
        codeVerifier,
        userId: "user-123",
        exp: Date.now() - 1000,
      },
      secret
    );
    expect(verifyLineOAuthCookie(expiredCookie, secret)).toBeNull();
  });

  it("builds LINE authorize URL with aggressive bot_prompt and PKCE S256", () => {
    const url = new URL(
      buildLineAuthorizeUrl({
        channelId: "123456",
        redirectUri: "https://example.com/api/line/oauth/callback",
        state: "st-1",
        codeChallenge: "ch-1",
      })
    );

    expect(url.origin).toBe("https://access.line.me");
    expect(url.searchParams.get("bot_prompt")).toBe("aggressive");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toBe("profile");
  });
});
