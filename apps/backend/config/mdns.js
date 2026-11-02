// config/mdns.js
// Answers mDNS (Bonjour) lookups for a name such as veasna.local with this host's
// LAN address, so devices can open http://veasna.local:3001 instead of an IP.
// Lookups and answers stay on the local network: no DNS server or internet needed.

const os = require('os');
const multicastDns = require('multicast-dns');

const MDNS_PORT = 5353;
const TTL_SECONDS = 120;

// "Veasna" -> "veasna.local"; empty means mDNS is turned off.
function normalizeMdnsName(value = '') {
  const name = value.trim().toLowerCase().replace(/\.$/, '');
  if (!name) return '';
  return name.endsWith('.local') ? name : `${name}.local`;
}

function ipToNumber(ip) {
  return ip.split('.').reduce((total, part) => total * 256 + Number(part), 0);
}

function family(net) {
  return net.family === 4 || net.family === 'IPv4' ? 4 : 6;
}

// This host's addresses on the network the asking device is on, matched by IPv4
// subnet so virtual adapters (WSL, Hyper-V) are left out. Falls back to every LAN
// address when none match (e.g. the device is on a routed subnet).
function addressesFor(remoteAddress, interfaces = os.networkInterfaces()) {
  const external = Object.values(interfaces).map(nets => (nets || []).filter(net => !net.internal));
  const onRemoteSubnet = external.filter(nets => nets.some(net => {
    if (family(net) !== 4) return false;
    const mask = ipToNumber(net.netmask);
    // >>> 0 keeps the bitwise result unsigned so the two sides compare equal.
    return ((ipToNumber(net.address) & mask) >>> 0) === ((ipToNumber(remoteAddress || '0.0.0.0') & mask) >>> 0);
  }));
  const nets = (onRemoteSubnet.length ? onRemoteSubnet : external).flat();
  return {
    ipv4: nets.filter(net => family(net) === 4).map(net => net.address),
    ipv6: nets.filter(net => family(net) === 6).map(net => net.address),
  };
}

// The answer for one set of questions about our name. Browsers ask for IPv4 (A) and
// IPv6 (AAAA) together and wait for both. Windows ignores the standard "no IPv6"
// reply (NSEC) and waits ~10 s, so IPv6 is answered with a real address when the
// host has one; NSEC is kept for hosts without IPv6.
function buildAnswer(hostname, types, { ipv4, ipv6 }) {
  const record = type => data => ({ name: hostname, type, ttl: TTL_SECONDS, flush: true, data });
  const a = ipv4.map(record('A'));
  const aaaa = ipv6.map(record('AAAA'));
  const noIpv6 = { name: hostname, type: 'NSEC', ttl: TTL_SECONDS, flush: true, data: { nextDomain: hostname, rrtypes: ['A'] } };

  const answers = [];
  if (types.has('A') || types.has('ANY')) answers.push(...a);
  if (types.has('AAAA') || types.has('ANY')) answers.push(...(aaaa.length ? aaaa : [noIpv6]));
  const additionals = [...a, ...aaaa].filter(rec => !answers.includes(rec));
  return { answers, additionals };
}

// Starts answering for `name`. Returns { hostname, close } or null when turned off.
function startMdns(name, { createSocket = multicastDns, interfaces } = {}) {
  const hostname = normalizeMdnsName(name);
  if (!hostname) return null;

  const mdns = createSocket();
  mdns.on('error', err => console.warn(`mDNS name ${hostname} unavailable (${err.message}). Devices can still use the IP address.`));
  mdns.on('query', (query, rinfo) => {
    const asked = query.questions.filter(q =>
      q.name.toLowerCase() === hostname && ['A', 'AAAA', 'ANY'].includes(q.type));
    if (!asked.length) return;

    const addresses = addressesFor(rinfo && rinfo.address, interfaces || os.networkInterfaces());
    if (!addresses.ipv4.length) return;
    const { answers, additionals } = buildAnswer(hostname, new Set(asked.map(q => q.type)), addresses);

    // Queries sent from another port expect a direct reply that echoes the query;
    // normal ones are answered to the whole network.
    if (rinfo && rinfo.port !== MDNS_PORT) {
      mdns.respond({ id: query.id, questions: asked, answers, additionals }, { port: rinfo.port, address: rinfo.address });
    } else {
      mdns.respond({ answers, additionals });
    }
  });

  return { hostname, close: () => mdns.destroy() };
}

module.exports = { normalizeMdnsName, addressesFor, buildAnswer, startMdns };
