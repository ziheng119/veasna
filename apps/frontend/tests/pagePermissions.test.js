const { canAccessPage, defaultPage, canEditSavedData, NAVIGATION, ROLE_OPTIONS } = require('../src/lib/permissions');
test.each(['admin','user'])('%s can observe every page', role => {
 for (const path of [...NAVIGATION.map(item => item.href), '/analytics','/patient-details','/pharmacy/dashboard']) expect(canAccessPage(role,path)).toBe(true);
 expect(defaultPage(role)).toBe('/');
 expect(canEditSavedData(role)).toBe(role === 'admin');
});
test('only two roles can be assigned', () => {
 expect(ROLE_OPTIONS.map(item => item.value)).toEqual(['user','admin']);
 expect(canAccessPage(undefined,'/')).toBe(false);
 expect(canEditSavedData('triage')).toBe(false);
});
