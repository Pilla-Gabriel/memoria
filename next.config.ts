import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Next.js blocks dev-server requests from hosts other than localhost by default.
  // Set DEV_ALLOWED_ORIGINS (comma-separated) in .env to reach the dev server from
  // another device on the LAN, e.g. DEV_ALLOWED_ORIGINS=192.168.0.108
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()),
};

export default nextConfig;
