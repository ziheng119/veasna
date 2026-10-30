// config/network.js
// Origin rules shared by REST (CORS) and Socket.IO, so a frontend allowed for
// one transport is never rejected by the other.

const os = require('os');

const DEFAULT_ORIGIN = 'http://localhost:3001';

function parseOrigins(value = DEFAULT_ORIGIN) {
  return value.split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean);
}

// Loopback and RFC 1918 private IPv4 ranges: the addresses a clinic router hands out.
function isPrivateHost(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true;
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Returns (origin) => boolean. Browsers always send Origin on cross-origin requests;
// requests without one (curl, server-to-server) are allowed, as before.
function createOriginCheck({ origins = parseOrigins(), allowLan = false } = {}) {
  const exact = new Set(origins);
  const warned = new Set();
  return (origin) => {
    if (!origin || exact.has(origin)) return true;
    if (allowLan) {
      try {
        const url = new URL(origin);
        if ((url.protocol === 'http:' || url.protocol === 'https:') && isPrivateHost(url.hostname)) return true;
      } catch { /* malformed origin: rejected below */ }
    }
    if (!warned.has(origin)) {
      warned.add(origin);
      console.warn(`Rejected request from unlisted frontend origin ${origin}. ` +
        'Add it to NEXT_PUBLIC_FRONTEND_URL or set ALLOW_LAN_ORIGINS=true.');
    }
    return false;
  };
}

// Non-internal IPv4 addresses of this host, for printing the URLs clients should use.
function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(net => net && net.family === 'IPv4' && !net.internal)
    .map(net => net.address);
}

module.exports = { parseOrigins, isPrivateHost, createOriginCheck, lanAddresses };
