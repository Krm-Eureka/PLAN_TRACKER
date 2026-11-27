import { describe, it, expect } from "vitest";
import {
  STATIC_SECURITY_HEADERS,
  buildCspHeader,
} from "../securityHeaders";

describe("STATIC_SECURITY_HEADERS", () => {
  const headerMap = Object.fromEntries(
    STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value])
  );

  it("sets clickjacking protection via X-Frame-Options", () => {
    expect(headerMap["X-Frame-Options"]).toBe("DENY");
  });

  it("sets MIME sniffing protection via X-Content-Type-Options", () => {
    expect(headerMap["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy", () => {
    expect(headerMap["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("restricts browser permissions via Permissions-Policy", () => {
    expect(headerMap["Permissions-Policy"]).toContain("camera=()");
    expect(headerMap["Permissions-Policy"]).toContain("microphone=()");
    expect(headerMap["Permissions-Policy"]).toContain("geolocation=()");
  });
});

describe("buildCspHeader", () => {
  it("builds strict nonce-based CSP for production without unsafe-inline or unsafe-eval scripts", () => {
    const csp = buildCspHeader({
      nonce: "abc123==",
      isDev: false,
      upgradeInsecureRequests: true,
    });

    expect(csp).toContain("script-src 'self' 'nonce-abc123==' 'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("includes unsafe-eval only in development mode", () => {
    const devCsp = buildCspHeader({ nonce: "devnonce", isDev: true });
    expect(devCsp).toContain("'unsafe-eval'");
    expect(devCsp).toContain("ws:");
    expect(devCsp).not.toContain("upgrade-insecure-requests");
  });

  it("adds custom supabase origin and websocket scheme when provided", () => {
    const csp = buildCspHeader({
      supabaseUrl: "https://myproj.supabase.co/rest/v1",
    });
    expect(csp).toContain("https://myproj.supabase.co");
    expect(csp).toContain("wss://myproj.supabase.co");
  });
});
