import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - added to allow cross-origin HMR requests during local network development
  allowedDevOrigins: ['192.168.14.137'],
};

export default nextConfig;
