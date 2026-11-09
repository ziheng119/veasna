const { canAccessPage, defaultPage, canEditSavedData, canEditVisit, isAdmin, NAVIGATION, ROLE_OPTIONS } = require('../src/lib/permissions');
test.each(['admin','user'])('%s can observe every station and patient page', role => {
 for (const path of [...NAVIGATION.map(item => item.href), '/patient-details','/pharmacy/dashboard']) expect(canAccessPage(role,path)).toBe(true);
 expect(defaultPage(role)).toBe('/');
 // Both roles correct saved records; admin-only actions (printing, downloads, deleting) are separate.
 expect(canEditSavedData(role)).toBe(true);
 expect(isAdmin(role)).toBe(role === 'admin');
});
test.each(['/analytics','/station-data','/accounts'])('only admins can open %s', path => {
 expect(canAccessPage('admin',path)).toBe(true);
 expect(canAccessPage('user',path)).toBe(false);
});
test('only two roles can be assigned', () => {
 expect(ROLE_OPTIONS.map(item => item.value)).toEqual(['user','admin']);
 expect(canAccessPage(undefined,'/')).toBe(false);
 expect(canEditSavedData('triage')).toBe(false);
});
test("earlier visits are read-only except for the admin", () => {
 expect(canEditVisit('admin',{ editable: false })).toBe(true);
 expect(canEditVisit('user',{ editable: true })).toBe(true); // the day's own visit
 expect(canEditVisit('user',{ editable: false })).toBe(false);
 expect(canEditVisit('user',undefined)).toBe(false); // fail closed until the visit list says
 expect(canEditVisit(undefined,{ editable: true })).toBe(false);
});
