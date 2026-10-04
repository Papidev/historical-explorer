import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig = (phase: string): NextConfig => ({
  pageExtensions:
    phase === PHASE_DEVELOPMENT_SERVER
      ? ["dev.tsx", "dev.ts", "tsx", "ts", "jsx", "js"]
      : ["tsx", "ts", "jsx", "js"],
  reactCompiler: true,
});

export default nextConfig;
