const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export const backend_url = rawBackendUrl.replace(/\/$/, "");

