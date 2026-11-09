const { canAccessApi, canEditSavedRecords, ROLES, normalizeRole } = require('../utils/permissions');
test('only two assignable roles, with legacy account compatibility', () => {
 expect(ROLES).toEqual(['admin','user']); expect(normalizeRole('triage')).toBe('user');
});
test.each(['/patients/1','/visits/consultation/1','/queue','/pharmacy','/users','/auth/me','/form-options'])('both roles can read %s', path => {
 for (const role of ROLES) expect(canAccessApi(role,'GET',path)).toBe(true);
 expect(canAccessApi('invalid','GET',path)).toBe(false);
});
test.each(['/analytics','/analytics/trend','/accounts','/export/patients','/visits/referrals','/visits/referrals/'])('only admins can read %s', path => {
 expect(canAccessApi('admin','GET',path)).toBe(true);
 expect(canAccessApi('user','GET',path)).toBe(false);
});
test('only admins create accounts or change station data', () => {
 expect(canAccessApi('admin','POST','/accounts')).toBe(true);
 for (const [method, path] of [['POST','/accounts'],['PUT','/accounts/3'],['DELETE','/accounts/3'],['PUT','/form-options/snellen'],['DELETE','/form-options/snellen'],['DELETE','/visits/4']]) {
  expect(canAccessApi('user',method,path)).toBe(false);
  expect(canAccessApi('admin',method,path)).toBe(true);
 }
});
test.each(['/patients/1','/registration/1','/pharmacy/1','/visits/referral/1','/patient/1'])('only admins can change or delete via %s outside the record edits', path => {
 for (const method of ['PATCH','DELETE', ...(path === '/patient/1' ? [] : ['PUT'])]) {
  expect(canAccessApi('user',method,path)).toBe(false);
  expect(canAccessApi('admin',method,path)).toBe(true);
 }
});
test.each(['/patient/1','/visits/1','/visits/1/vitals','/visits/1/tb','/visits/1/tb/'])('both roles can correct saved records: PUT %s', path => {
 for (const role of ROLES) expect(canAccessApi(role,'PUT',path)).toBe(true);
 expect(canAccessApi('invalid','PUT',path)).toBe(false);
});
test.each([['DELETE','/visits/1'],['DELETE','/patient/1'],['PUT','/visits/1/stations'],['PUT','/visits/x'],['PUT','/patient/1/extra'],['PATCH','/visits/1/vitals']])('deleting and other changes stay admin-only: %s %s', (method, path) => {
 expect(canAccessApi('user',method,path)).toBe(false);
});
test('every assignable role may change saved records; unknown roles may not', () => {
 for (const role of [...ROLES, 'triage']) expect(canEditSavedRecords(role)).toBe(true);
 for (const role of ['invalid', undefined, '']) expect(canEditSavedRecords(role)).toBe(false);
});
test.each(['/visits','/registration','/patients','/pharmacy','/triage/history','/visits/consultation/1','/visits/dental/1','/visits/referral/1','/tb/1/flag','/prescriptions','/family','/family/leave'])('users can reach guarded creation endpoint %s', path => expect(canAccessApi('user','POST',path)).toBe(true));
test.each(['/auth/register','/users','/locations','/patients/1/history','/unknown'])('users cannot bypass via POST %s', path => expect(canAccessApi('user','POST',path)).toBe(false));

test.each([
  ['POST', '/queue/1/stations/triage/complete'], ['POST', '/queue/12/complete'], ['PUT', '/queue/1/stations'], ['PUT', '/queue/1/stations/'],
  ['PUT', '/queue/1/stations/physiotherapy'],
])('both roles can move patients through the clinic: %s %s', (method, path) => {
  for (const role of ROLES) expect(canAccessApi(role, method, path)).toBe(true);
  expect(canAccessApi('invalid', method, path)).toBe(false);
});
test.each([
  ['PATCH', '/queue/1/stations'], ['DELETE', '/queue/1/stations'], ['PUT', '/queue/1/complete'], ['POST', '/queue/1/stations'],
  ['PUT', '/queue/x/stations'], ['POST', '/queue/1/stations/triage/complete/extra'], ['PUT', '/queue/1/stations/triage/x'],
])('other queue requests stay admin-only: %s %s', (method, path) => {
  expect(canAccessApi('user', method, path)).toBe(false);
});

test('prescribing is open to users; dispensing or cancelling a prescription is admin-only', () => {
  expect(canAccessApi('user', 'POST', '/prescriptions')).toBe(true);
  for (const action of ['dispense', 'cancel']) {
    expect(canAccessApi('user', 'POST', `/prescriptions/1/${action}`)).toBe(false);
    expect(canAccessApi('admin', 'POST', `/prescriptions/1/${action}`)).toBe(true);
  }
});
