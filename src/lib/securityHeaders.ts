/**
 * Shared HTTP security headers and Content-Security-Policy (CSP) builder.
 * Used by both `next.config.ts` (static baseline for all routes/assets) and
 * `src/proxy.ts` (per-request nonce-based strict CSP for rendered pages).
 */

export interface SecurityHeaderEntry {
  key: string;
  value: string;
}

export const STATIC_SECURITY_HEADERS: readonly SecurityHeaderEntry[] = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

export interface BuildCspOptions {
  nonce?: string;
  isDev?: boolean;
  upgradeInsecureRequests?: boolean;
  supabaseUrl?: string;
}

function getSupabaseConnectSources(rawUrl?: string): string[] {
  const sources = new Set<string>([
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ]);
  if (!rawUrl) return [...sources];

  try {
    const parsed = new URL(rawUrl);
    sources.add(parsed.origin);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    sources.add(`${wsProtocol}//${parsed.host}`);
  } catch {
    // Ignore malformed env values; wildcard *.supabase.co remains active.
  }

  return [...sources];
}

/**
 * Builds a single-line Content-Security-Policy header value tailored to
 * Next.js, Vercel Analytics/Speed Insights, Supabase Realtime, and PDF/Excel exports.
 */
export function buildCspHeader({
  nonce,
  isDev = false,
  upgradeInsecureRequests = false,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
}: BuildCspOptions = {}): string {
  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : []),
    "https://va.vercel-scripts.com",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(" ");

  const connectSrc = [
    "'self'",
    ...getSupabaseConnectSources(supabaseUrl),
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
    ...(isDev ? ["ws:", "wss:", "http://localhost:*"] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Inline style attributes are used by Tailwind/Radix/Recharts/Gantt charts
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
  ];

  return directives.join("; ");
}
