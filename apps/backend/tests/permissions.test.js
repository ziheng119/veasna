const { canAccessApi } = require('../utils/permissions');

test.each([
  ['registration', 'POST', '/registration', true],
  ['registration', 'PUT', '/patient/12', true],
  ['registration', 'POST', '/visits/consultation/12', false],
  ['triage', 'POST', '/triage/history', true],
  ['triage', 'POST', '/patients/12/history', true],
  ['triage', 'POST', '/visits/seva/12', false],
  ['tb', 'POST', '/tb/12/review', true],
  ['consultation', 'POST', '/tb/12/review', false],
  ['seva', 'POST', '/visits/seva/12', true],
  ['physiotherapy', 'POST', '/visits/physiotherapy/12', true],
  ['consultation', 'DELETE', '/visits/referral/12', true],
  ['triage', 'DELETE', '/visits/referral/12', false],
  ['consultation', 'GET', '/visits/referrals', true],
  ['pharmacy', 'PATCH', '/pharmacy/12', true],
  ['seva', 'PATCH', '/pharmacy/12', false],
  ['triage', 'POST', '/queue/12/stations/triage/complete', true],
  ['triage', 'POST', '/queue/12/stations/consultation/complete', false],
  ['pharmacy', 'POST', '/queue/12/complete', false],
  ['consultation', 'PUT', '/queue/12/stations', true],
  ['triage', 'GET', '/patient/visit/12', true],
  ['seva', 'GET', '/visits/history/1/12', true],
  ['pharmacy', 'GET', '/locations', true],
  ['triage', 'POST', '/locations', false],
  ['user', 'GET', '/analytics', false],
  ['user', 'POST', '/auth/register', false],
  ['admin', 'GET', '/analytics', true],
  ['triage', 'POST', '/unknown', false],
  ['invalid', 'GET', '/queue', false],
])('%s %s %s => %s', (role, method, path, allowed) => {
  expect(canAccessApi(role, method, path)).toBe(allowed);
});
