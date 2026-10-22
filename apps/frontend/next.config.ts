import type { NextConfig } from "next";
import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function config(phase: string): NextConfig {
  return {
    // Keep dev compilation from overwriting the clinic's prebuilt assets.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-production",
    outputFileTracingRoot: path.resolve(__dirname, "../.."),
  };
};
