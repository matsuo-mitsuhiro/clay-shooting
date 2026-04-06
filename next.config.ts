import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    mcpServer: false,
  },
  serverExternalPackages: ['exceljs'],
};

export default nextConfig;
