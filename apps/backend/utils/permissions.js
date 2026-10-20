const ROLES = ['admin', 'registration', 'triage', 'tb', 'seva', 'physiotherapy', 'consultation', 'pharmacy', 'user'];
const STATION_ROLES = ['triage', 'tb', 'seva', 'physiotherapy', 'consultation'];

// Existing "user" accounts retain their former general-clinic access. New accounts
// should receive an explicit assignment; admin-only operations remain admin-only.
function canAccessApi(role, method, rawPath) {
  if (!ROLES.includes(role)) return false;
  const path = rawPath.replace(/\/+$/, '') || '/';
  if (role === 'admin') return true;
  if (/^\/(analytics|users)(\/|$)/.test(path) || path === '/auth/register') return false;
  if (path === '/auth/me') return method === 'GET';
  if (/^\/locations(\/|$)/.test(path)) return method === 'GET';
  if (method === 'DELETE' && !/^\/visits\/referral\/\d+$/.test(path)) return false;
  if (role === 'user') return true;
  if (/^\/pharmacy(\/|$)/.test(path)) return role === 'pharmacy';
  if (/^\/visits\/referrals?$/.test(path) || /^\/visits\/referral\//.test(path)) return role === 'consultation';
  if (method === 'GET') {
    // Shared patient/visit snapshots and queues are required across station pages.
    return /^\/(patients|patient|queue|visits|tb)(\/|$)/.test(path) ||
      (role === 'consultation' && /^\/consultations\/\d+\/referrals$/.test(path));
  }
  if (/^\/registration(\/|$)/.test(path) || path === '/visits' ||
      /^\/(patients|patient)(\/\d+)?$/.test(path) || /^\/visits\/\d+$/.test(path)) return role === 'registration';
  if (/^\/triage(\/|$)/.test(path)) return role === 'triage';
  if (/^\/tb\/\d+\/review$/.test(path)) return role === 'tb';
  if (/^\/visits\/seva\/\d+$/.test(path)) return role === 'seva';
  if (/^\/visits\/physiotherapy\/\d+$/.test(path) || /^\/patients\/\d+\/physiotherapy$/.test(path)) return role === 'physiotherapy';
  if (/^\/visits\/consultation\/\d+$/.test(path) || /^\/patients\/\d+\/consultations$/.test(path) || /^\/consultations\/\d+\/referrals$/.test(path)) return role === 'consultation';
  if (/^\/patients\/\d+\/(visual_acuity|presenting_complaint|history)$/.test(path)) return role === 'triage';
  const complete = path.match(/^\/queue\/\d+\/stations\/([^/]+)\/complete$/);
  if (complete) return role === complete[1];
  if (/^\/queue\/\d+\/(stations|complete)$/.test(path)) return role === 'registration' || STATION_ROLES.includes(role);
  return false; // New endpoints need an explicit assignment.
}

module.exports = { ROLES, STATION_ROLES, canAccessApi };
