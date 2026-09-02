// Resolving the backend URL, in priority order:
//   1. NEXT_PUBLIC_BACKEND_URL — explicit override (baked in at build time).
//   2. In the browser: same host as the page, on the backend port. This is
//      what LAN clients need — they load the app from the host's IP and the
//      API lives on the same machine, so a build-time localhost value (which
//      would point at each client's own machine) is wrong.
//   3. SSR/build fallback: localhost. Never actually used — every API call
//      originates from a "use client" component.

const BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || "3000";

function resolveBackendUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export const backend_url = resolveBackendUrl();
