const { canAccessPage, defaultPage, NAVIGATION } = require('../src/lib/permissions');

test.each(['registration', 'triage', 'tb', 'seva', 'physiotherapy', 'consultation', 'pharmacy'])('%s sees only assigned navigation', role => {
  const allowed = NAVIGATION.filter(item => canAccessPage(role, item.href));
  expect(allowed.length).toBe(role === 'registration' ? 2 : 1);
  expect(allowed.every(item => item.role === role)).toBe(true);
  expect(canAccessPage(role, defaultPage(role))).toBe(true);
  expect(canAccessPage(role, '/analytics')).toBe(false);
});
test('admin and legacy access, nested pharmacy routes and unknown roles', () => {
  expect(NAVIGATION.every(item => canAccessPage('admin', item.href))).toBe(true);
  expect(NAVIGATION.every(item => canAccessPage('user', item.href))).toBe(true);
  expect(canAccessPage('user', '/analytics')).toBe(false);
  expect(canAccessPage('pharmacy', '/pharmacy/dashboard')).toBe(true);
  expect(canAccessPage('triage', '/pharmacy/dashboard')).toBe(false);
  expect(canAccessPage('registration', '/patient-details')).toBe(true);
  expect(canAccessPage('consultation', '/patient-details')).toBe(false);
  expect(canAccessPage(undefined, '/')).toBe(false);
});
