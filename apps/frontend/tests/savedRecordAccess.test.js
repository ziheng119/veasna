const React = require('react');
const { act, create } = require('react-test-renderer');
let role = 'user';
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({user:{role}}) }));
const { useSavedRecordAccess } = require('../src/hooks/useSavedRecordAccess');
const Fields = require('../src/components/shared/SavedRecordFields').default;
global.IS_REACT_ACT_ENVIRONMENT = true;
test('initial load is locked, first save locks users, admins can edit and late responses cannot unlock another visit', async () => {
 const log = jest.spyOn(console,'error').mockImplementation(() => {});
 let result, renderer;
 function Harness({id}) { result = useSavedRecordAccess(id); return React.createElement(Fields,{locked:!result.editable},'Notes'); }
 try {
  await act(async () => { renderer = create(React.createElement(Harness,{id:1})); });
  expect(renderer.root.findByType('fieldset').props.disabled).toBe(true);
  await act(async () => result.markSaved(false)); expect(result.editable).toBe(true);
  await act(async () => result.markSaved()); expect(result.editable).toBe(false);
  role = 'admin'; await act(async () => renderer.update(React.createElement(Harness,{id:1}))); expect(result.editable).toBe(true);
  const lateResponse = result.markSaved;
  role = 'user'; await act(async () => renderer.update(React.createElement(Harness,{id:2})));
  await act(async () => lateResponse(false)); expect(result.editable).toBe(false);
  await act(async () => result.markSaved(false)); expect(result.editable).toBe(true);
 } finally { if(renderer) await act(async () => renderer.unmount()); log.mockRestore(); }
});
