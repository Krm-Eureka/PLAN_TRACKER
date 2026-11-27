import type { NextConfig } from "next";
import {
  STATIC_SECURITY_HEADERS,
  buildCspHeader,
} from "./src/lib/securityHeaders";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - added to allow cross-origin HMR requests during local network development
  allowedDevOrigins: ['[IP_ADDRESS]'],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...STATIC_SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: buildCspHeader({ isDev }),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
