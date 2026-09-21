import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
