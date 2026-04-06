import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: false,
  },
  serverExternalPackages: ['xlsx'],
};

export default nextConfig;
