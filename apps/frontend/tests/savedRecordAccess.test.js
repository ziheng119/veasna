const React = require('react');
const { act, create } = require('react-test-renderer');
let role = 'user';
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({user:{role}}) }));
const { useSavedRecordAccess } = require('../src/hooks/useSavedRecordAccess');
const Fields = require('../src/components/shared/SavedRecordFields').default;
global.IS_REACT_ACT_ENVIRONMENT = true;
test('initial load is locked, saved records stay editable for users and admins, and late responses cannot unlock another visit', async () => {
 const log = jest.spyOn(console,'error').mockImplementation(() => {});
 let result, renderer;
 function Harness({id}) { result = useSavedRecordAccess(id); return React.createElement(Fields,{locked:!result.editable},'Notes'); }
 try {
  await act(async () => { renderer = create(React.createElement(Harness,{id:1})); });
  expect(renderer.root.findByType('fieldset').props.disabled).toBe(true);
  await act(async () => result.markSaved(false)); expect(result.editable).toBe(true);
  // A saved record stays editable, so doctors can add what they find later.
  await act(async () => result.markSaved()); expect(result.editable).toBe(true); expect(result.saved).toBe(true);
  role = 'admin'; await act(async () => renderer.update(React.createElement(Harness,{id:1}))); expect(result.editable).toBe(true);
  const lateResponse = result.markSaved;
  role = 'user'; await act(async () => renderer.update(React.createElement(Harness,{id:2})));
  await act(async () => lateResponse(false)); expect(result.editable).toBe(false);
  await act(async () => result.markSaved(false)); expect(result.editable).toBe(true);
  // Unknown roles never edit.
  role = 'triage'; await act(async () => renderer.update(React.createElement(Harness,{id:2})));
  expect(result.editable).toBe(false);
  expect(renderer.root.findByType('fieldset').props.disabled).toBe(true);
 } finally { if(renderer) await act(async () => renderer.unmount()); log.mockRestore(); }
});
