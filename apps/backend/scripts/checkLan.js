#!/usr/bin/env node
// Verifies, from any device on the clinic network, the path a browser uses to reach the
// backend: health (incl. PostgreSQL), REST CORS for a frontend origin, the Socket.IO
// live-update handshake and, with credentials, an authenticated live-update session.
// Read-only: it never writes clinic data. Needs Node 18+ (global fetch), no packages.
//
// Usage: node scripts/checkLan.js <backend-url> <frontend-origin> [username password]
// e.g.   node scripts/checkLan.js http://192.168.1.10:3000 http://192.168.1.20:3001 user user

const [backendArg, originArg, username, password] = process.argv.slice(2);
if (!backendArg || !originArg) {
  console.error('Usage: node scripts/checkLan.js <backend-url> <frontend-origin> [username password]');
  process.exit(2);
}
const backend = backendArg.replace(/\/$/, '');
const origin = originArg.replace(/\/$/, '');
let failures = 0;

// `hint` is printed only on failure: what to change to fix it.
function report(ok, label, detail, hint) {
  if (!ok) failures++;
  const notes = [detail, ok ? null : hint].filter(Boolean).join('; ');
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${notes ? ` - ${notes}` : ''}`);
  return ok;
}

async function request(path, options = {}) {
  return fetch(`${backend}${path}`, { ...options, signal: AbortSignal.timeout(5000) });
}

// Engine.IO v4 long-polling: the fallback transport, and enough to test auth without a WebSocket client.
async function socketHandshake(token) {
  const base = '/socket.io/?EIO=4&transport=polling';
  const open = await request(base, { headers: { Origin: origin } });
  if (open.status !== 200) return { status: open.status };
  const { sid } = JSON.parse((await open.text()).slice(1));
  if (!token) return { status: 200 };
  await request(`${base}&sid=${sid}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain;charset=UTF-8' },
    body: `40${JSON.stringify({ token })}`,
  });
  const reply = await (await request(`${base}&sid=${sid}`, { headers: { Origin: origin } })).text();
  return { status: 200, connected: /(^|\x1e)40\{/.test(reply), reply };
}

async function main() {
  console.log(`Backend ${backend}, frontend origin ${origin}\n`);

  try {
    const health = await request('/health');
    const body = await health.json();
    report(health.ok, 'Backend reachable and database connected', `HTTP ${health.status}, database: ${body.database}`);
  } catch (err) {
    report(false, 'Backend reachable', err.cause?.code || err.message, 'check the IP, PORT, host firewall and that the backend is running');
    return;
  }

  const preflight = await request('/api/queue', {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
  });
  const originHint = 'add it to NEXT_PUBLIC_FRONTEND_URL or set ALLOW_LAN_ORIGINS=true, then restart the backend';
  report(preflight.headers.get('access-control-allow-origin') === origin, 'REST API accepts this frontend origin',
    `HTTP ${preflight.status}`, originHint);

  const handshake = await socketHandshake();
  report(handshake.status === 200, 'Live-update channel accepts this frontend origin', `HTTP ${handshake.status}`, originHint);

  if (!username) {
    console.log('\nSKIP  Authenticated live-update session (pass username and password to test)');
  } else {
    const login = await request('/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const { token } = await login.json().catch(() => ({}));
    if (report(login.ok && !!token, 'Login', `HTTP ${login.status}`, 'check the username and password')) {
      const session = await socketHandshake(token);
      report(session.connected, 'Authenticated live-update session', session.connected ? '' : session.reply);
    }
  }

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
}

main()
  .catch(err => report(false, 'Unexpected error', err.message))
  .finally(() => process.exit(failures ? 1 : 0));
