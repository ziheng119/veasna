const {
  canAccessApi, canEditSavedRecords, ROLES, PERMISSIONS, DEFAULT_PERMISSIONS, normalizeRole, normalizePermissions,
  permissionsFor, missingPermission, permissionMessage,
} = require('../utils/permissions');

// A non-admin account with the default permissions (see today's patients, edit today's queue).
const user = (method, path, permissions) => canAccessApi('user', method, path, permissions);

test('only two assignable roles, with legacy account compatibility', () => {
 expect(ROLES).toEqual(['admin','user']); expect(normalizeRole('triage')).toBe('user');
});
test.each(['/patients/1','/visits/consultation/1','/queue','/pharmacy','/users','/auth/me','/form-options','/patients'])('both roles can read %s', path => {
 for (const role of ROLES) expect(canAccessApi(role,'GET',path)).toBe(true);
 expect(canAccessApi('invalid','GET',path)).toBe(false);
});
test('the admin always has every permission; other accounts what was saved, or the defaults', () => {
 expect(permissionsFor('admin', [])).toEqual(PERMISSIONS);
 expect(permissionsFor('user', null)).toEqual(DEFAULT_PERMISSIONS);
 expect(permissionsFor('user', ['analytics'])).toEqual(['analytics']);
 expect(permissionsFor('invalid', PERMISSIONS)).toEqual([]);
});
test('ticking a permission also ticks what it needs; unknown names are dropped', () => {
 expect(normalizePermissions(['edit_past'])).toEqual(['view_today', 'edit_today', 'view_past', 'edit_past']);
 expect(normalizePermissions(['view_past', 'bogus'])).toEqual(['view_today', 'view_past']);
 expect(normalizePermissions([])).toEqual([]);
 expect(normalizePermissions('analytics')).toBeNull();
});
test.each([
 ['/analytics', 'analytics'], ['/analytics/trend', 'analytics'], ['/analytics/referrals', 'analytics'],
 ['/export/patients', 'print'], ['/visits/referrals', 'print'], ['/visits/referrals/', 'print'],
])('GET %s needs the %s permission', (path, permission) => {
 expect(canAccessApi('admin','GET',path)).toBe(true);
 expect(user('GET', path)).toBe(false);
 expect(missingPermission('user', DEFAULT_PERMISSIONS, 'GET', path)).toBe(permission);
 expect(user('GET', path, [permission])).toBe(true);
});
test('the account list is admin only, whatever the permissions', () => {
 expect(user('GET', '/accounts', PERMISSIONS)).toBe(false);
 expect(canAccessApi('admin','GET','/accounts')).toBe(true);
});
test('the Patient List needs "see today\'s patients"; station queues do not', () => {
 expect(user('GET', '/patients', [])).toBe(false);
 expect(user('GET', '/patients/search', [])).toBe(false);
 expect(user('GET', '/queue', [])).toBe(true);
 expect(user('GET', '/patients/lookup', [])).toBe(true);
});
test('only admins create accounts or change station data', () => {
 expect(canAccessApi('admin','POST','/accounts')).toBe(true);
 for (const [method, path] of [['POST','/accounts'],['PUT','/accounts/3'],['DELETE','/accounts/3'],['PUT','/form-options/snellen'],['DELETE','/form-options/snellen'],['DELETE','/visits/4']]) {
  expect(user(method, path, PERMISSIONS)).toBe(false);
  expect(canAccessApi('admin',method,path)).toBe(true);
 }
});
test.each(['/patients/1','/registration/1','/visits/referral/1','/patient/1'])('only admins can change or delete via %s outside the record edits', path => {
 for (const method of ['PATCH','DELETE', ...(path === '/patient/1' ? [] : ['PUT'])]) {
  expect(user(method, path, PERMISSIONS)).toBe(false);
  expect(canAccessApi('admin',method,path)).toBe(true);
 }
});
test.each(['/patient/1','/visits/1','/visits/1/vitals','/visits/1/tb','/visits/1/tb/'])('correcting saved records needs "edit today\'s queue": PUT %s', path => {
 for (const role of ROLES) expect(canAccessApi(role,'PUT',path)).toBe(true);
 expect(user('PUT', path, ['view_today'])).toBe(false);
 expect(canAccessApi('invalid','PUT',path)).toBe(false);
});
test.each([['DELETE','/visits/1'],['DELETE','/patient/1'],['PUT','/visits/1/stations'],['PUT','/visits/x'],['PUT','/patient/1/extra'],['PATCH','/visits/1/vitals']])('deleting and other changes stay admin-only: %s %s', (method, path) => {
 expect(user(method, path, PERMISSIONS)).toBe(false);
});
test('every assignable role may change saved records; unknown roles may not', () => {
 for (const role of [...ROLES, 'triage']) expect(canEditSavedRecords(role)).toBe(true);
 for (const role of ['invalid', undefined, '']) expect(canEditSavedRecords(role)).toBe(false);
});
test.each(['/visits','/registration','/patients','/triage/history','/visits/consultation/1','/visits/dental/1','/visits/referral/1','/tb/1/flag','/prescriptions','/family','/family/leave'])('saving patient records needs "edit today\'s queue": POST %s', path => {
 expect(user('POST', path)).toBe(true);
 expect(user('POST', path, ['view_today'])).toBe(false);
 expect(missingPermission('user', ['view_today'], 'POST', path)).toBe('edit_today');
});
test.each(['/auth/register','/users','/locations','/patients/1/history','/unknown'])('users cannot bypass via POST %s', path => expect(user('POST', path, PERMISSIONS)).toBe(false));

test.each([
  ['POST', '/queue/1/stations/triage/complete'], ['POST', '/queue/12/complete'], ['PUT', '/queue/1/stations'], ['PUT', '/queue/1/stations/'],
  ['PUT', '/queue/1/stations/physiotherapy'],
])('moving patients through the clinic needs "edit today\'s queue": %s %s', (method, path) => {
  for (const role of ROLES) expect(canAccessApi(role, method, path)).toBe(true);
  expect(user(method, path, ['view_today'])).toBe(false);
  expect(canAccessApi('invalid', method, path)).toBe(false);
});
test.each([
  ['PATCH', '/queue/1/stations'], ['DELETE', '/queue/1/stations'], ['PUT', '/queue/1/complete'], ['POST', '/queue/1/stations'],
  ['PUT', '/queue/x/stations'], ['POST', '/queue/1/stations/triage/complete/extra'], ['PUT', '/queue/1/stations/triage/x'],
])('other queue requests stay admin-only: %s %s', (method, path) => {
  expect(user(method, path, PERMISSIONS)).toBe(false);
});

test('prescribing is part of the queue; stock, dispensing and cancelling need the pharmacy permission', () => {
  expect(user('POST', '/prescriptions')).toBe(true);
  for (const [method, path] of [['POST', '/prescriptions/1/dispense'], ['POST', '/prescriptions/1/cancel'], ['POST', '/pharmacy'],
    ['POST', '/pharmacy/1/dispense'], ['PATCH', '/pharmacy/1'], ['PATCH', '/pharmacy/1/name']]) {
    expect(user(method, path)).toBe(false);
    expect(missingPermission('user', DEFAULT_PERMISSIONS, method, path)).toBe('pharmacy');
    expect(user(method, path, ['pharmacy'])).toBe(true);
    expect(canAccessApi('admin', method, path)).toBe(true);
  }
  expect(user('DELETE', '/pharmacy/1', PERMISSIONS)).toBe(false);
});

test('refusals name the permission to ask for', () => {
  expect(permissionMessage('analytics')).toMatch(/"Analytics" permission/);
  expect(permissionMessage('admin')).toMatch(/admin/);
});
