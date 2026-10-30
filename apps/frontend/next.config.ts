import type { NextConfig } from "next";
import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

export default function config(phase: string): NextConfig {
  // The backend address is baked into the client bundle, so a clinic build should name
  // the backend's static LAN IP; localhost only works in a browser on the backend host.
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (phase === PHASE_PRODUCTION_BUILD) {
    if (!backendUrl) {
      console.warn("\n⚠ NEXT_PUBLIC_BACKEND_URL is not set: browsers will assume the backend is on the " +
        "host serving this frontend, port 3000. Set it to http://<backend-IP>:<PORT> if that is not the case.\n");
    } else if (/localhost|127\.0\.0\.1/.test(backendUrl)) {
      console.warn(`\n⚠ NEXT_PUBLIC_BACKEND_URL is "${backendUrl}": other LAN devices will not reach the ` +
        "backend. Set it to http://<backend-IP>:<PORT> and rebuild.\n");
    }
  }

  return {
    // Keep dev compilation from overwriting the clinic's prebuilt assets.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-production",
    outputFileTracingRoot: path.resolve(__dirname, "../.."),
  };
};
