// NEXT_PUBLIC_BACKEND_URL is embedded at build time. Without it, a browser assumes the
// backend runs on the host that served this page (default port 3000), so LAN devices
// never fall back to their own localhost.
function defaultBackendUrl() {
  if (typeof window === "undefined") return "http://localhost:3000";
  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || defaultBackendUrl();

export const backend_url = rawBackendUrl.replace(/\/$/, "");
