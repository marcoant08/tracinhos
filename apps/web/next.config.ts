import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tracinhos/game", "@tracinhos/shared"],
  serverExternalPackages: ["ws", "bufferutil", "utf-8-validate"],
};

export default nextConfig;
