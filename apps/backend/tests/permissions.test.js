const { canAccessApi, ROLES, normalizeRole } = require('../utils/permissions');
test('only two assignable roles, with legacy account compatibility', () => {
 expect(ROLES).toEqual(['admin','user']); expect(normalizeRole('triage')).toBe('user');
});
test.each(['/patients/1','/visits/consultation/1','/queue','/pharmacy','/analytics','/users','/auth/me'])('both roles can read %s', path => {
 for (const role of ROLES) expect(canAccessApi(role,'GET',path)).toBe(true);
 expect(canAccessApi('invalid','GET',path)).toBe(false);
});
test.each(['/patients/1','/registration/1','/visits/1','/queue/1/stations','/pharmacy/1','/visits/referral/1'])('only admins can mutate saved data via %s', path => {
 for (const method of ['PUT','PATCH','DELETE']) {
  expect(canAccessApi('user',method,path)).toBe(false);
  expect(canAccessApi('admin',method,path)).toBe(true);
 }
});
test.each(['/visits','/registration','/patients','/pharmacy','/triage/history','/visits/consultation/1','/visits/referral/1','/tb/1/flag','/prescriptions'])('users can reach guarded creation endpoint %s', path => expect(canAccessApi('user','POST',path)).toBe(true));
test.each(['/auth/register','/users','/locations','/queue/1/complete','/queue/1/stations/triage/complete','/patients/1/history','/unknown'])('users cannot bypass via POST %s', path => expect(canAccessApi('user','POST',path)).toBe(false));

test('prescribing is open to users; dispensing or cancelling a prescription is admin-only', () => {
  expect(canAccessApi('user', 'POST', '/prescriptions')).toBe(true);
  for (const action of ['dispense', 'cancel']) {
    expect(canAccessApi('user', 'POST', `/prescriptions/1/${action}`)).toBe(false);
    expect(canAccessApi('admin', 'POST', `/prescriptions/1/${action}`)).toBe(true);
  }
});
