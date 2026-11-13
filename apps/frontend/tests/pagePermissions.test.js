const {
  canAccessPage, defaultPage, canEditSavedData, canEditVisit, can, isAdmin, NAVIGATION, ROLE_OPTIONS,
  DEFAULT_PERMISSIONS, PERMISSIONS, permissionsOf, togglePermission,
} = require('../src/lib/permissions');

const admin = { role: 'admin' };
// A screening-day account with what new accounts get by default.
const user = { role: 'user', permissions: DEFAULT_PERMISSIONS };

test('Patient List comes before Registration, which is no longer called Home', () => {
  expect(NAVIGATION.slice(0, 2)).toEqual([{ href: '/patient-list', label: 'Patient List' }, { href: '/', label: 'Registration' }]);
});

test.each([['admin', admin], ['user', user]])('%s can open every station and patient page', (_name, account) => {
  for (const path of [...NAVIGATION.map(item => item.href), '/patient-details', '/pharmacy/dashboard']) expect(canAccessPage(account, path)).toBe(true);
  expect(defaultPage(account)).toBe('/');
  expect(canEditSavedData(account)).toBe(true);
  expect(isAdmin(account.role)).toBe(account === admin);
});

test.each(['/station-data', '/accounts'])('only admins can open %s, whatever the permissions', path => {
  expect(canAccessPage(admin, path)).toBe(true);
  expect(canAccessPage({ role: 'user', permissions: PERMISSIONS.map(p => p.key) }, path)).toBe(false);
});

test('Analytics and the Patient List follow their permissions', () => {
  expect(canAccessPage(user, '/analytics')).toBe(false);
  expect(canAccessPage({ role: 'user', permissions: ['analytics'] }, '/analytics')).toBe(true);
  expect(canAccessPage({ role: 'user', permissions: [] }, '/patient-list')).toBe(false);
  // Station pages stay open: the account works from the queues.
  expect(canAccessPage({ role: 'user', permissions: [] }, '/triage')).toBe(true);
});

test('the admin has every permission; a sign-in saved before permissions existed has the defaults', () => {
  expect(permissionsOf(admin)).toEqual(PERMISSIONS.map(p => p.key));
  expect(permissionsOf({ role: 'user' })).toEqual(DEFAULT_PERMISSIONS);
  expect(can({ role: 'user', permissions: ['print'] }, 'print')).toBe(true);
  expect(can({ role: 'invalid', permissions: ['print'] }, 'print')).toBe(false);
});

test('ticking a permission ticks what it needs; unticking one unticks what needs it', () => {
  expect(togglePermission([], 'edit_past', true)).toEqual(['view_today', 'edit_today', 'view_past', 'edit_past']);
  expect(togglePermission(['view_today', 'edit_today', 'view_past', 'edit_past', 'analytics'], 'view_today', false))
    .toEqual(['edit_today', 'analytics']);
  expect(togglePermission(DEFAULT_PERMISSIONS, 'analytics', true)).toEqual(['view_today', 'edit_today', 'analytics']);
});

test('only two roles can be assigned', () => {
  expect(ROLE_OPTIONS.map(item => item.value)).toEqual(['user', 'admin']);
  expect(canAccessPage(undefined, '/')).toBe(false);
  expect(canEditSavedData({ role: 'triage' })).toBe(false);
  expect(canEditSavedData({ role: 'user', permissions: ['view_today'] })).toBe(false);
});

test('visits this account may not change are read-only', () => {
  expect(canEditVisit(admin, { editable: false })).toBe(true);
  expect(canEditVisit(user, { editable: true })).toBe(true); // the day's own visit
  expect(canEditVisit(user, { editable: false })).toBe(false);
  expect(canEditVisit(user, undefined)).toBe(false); // fail closed until the visit list says
  expect(canEditVisit({ role: 'user', permissions: ['view_today'] }, { editable: true })).toBe(false);
  expect(canEditVisit(undefined, { editable: true })).toBe(false);
});
