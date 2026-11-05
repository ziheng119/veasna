// "Save & next" and the "done" prompt on station pages (components/shared/StationFlow.tsx).
const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 't', role: 'user' } }) }));
const move = (next_station, more = {}) => ({ next_station, held: false, waiting_for: [], family_moved: [], ...more });
jest.mock('../src/lib/api/queue/stations', () => ({ completeStation: jest.fn(async () => move('pharmacy')) }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../src/components/ui/button', () => ({ Button: props => require('react').createElement('button', props) }));
const toast = require('react-hot-toast').default;
const { completeStation } = require('../src/lib/api/queue/stations');
const { StationFlowProvider, SaveAndNextButton, StationDonePrompt, useStationFlow } = require('../src/components/shared/StationFlow');
global.IS_REACT_ACT_ENVIRONMENT = true;

const patient = (visit_id, queue_no, english_name) => ({ visit_id, queue_no, english_name });
const dara = patient(5, '7', 'Dara'), sok = patient(6, '8', 'Sok'), chan = patient(7, '9', 'Chan');
const refresh = jest.fn(async () => {});
// Stands in for the station queue, which registers the patients it shows.
function Queue({ patients }) {
  const flow = useStationFlow();
  React.useEffect(() => { flow.registerQueue(patients, refresh); }, [flow, patients]);
  return null;
}
const text = node => node.children.flatMap(child => (typeof child === 'string' ? [child] : text(child))).join('');

let renderer, onSelectPatient;
const render = async (child, patients = [sok, dara, chan]) => {
  onSelectPatient = jest.fn();
  await act(async () => {
    renderer = create(React.createElement(StationFlowProvider, { station: 'consultation', onSelectPatient },
      React.createElement(Queue, { patients }), child));
  });
};
const button = () => renderer.root.findByType('button');
afterEach(async () => { if (renderer) await act(async () => renderer.unmount()); renderer = null; jest.clearAllMocks(); });

test('Save & next saves, sends the patient to their next station and opens the next patient in the queue', async () => {
  const onSave = jest.fn(async () => true);
  await render(React.createElement(SaveAndNextButton, { patient: dara, onSave }));
  expect(text(renderer.root)).toMatch(/Save & next/);
  await act(async () => button().props.onClick());
  expect(onSave).toHaveBeenCalled();
  expect(completeStation).toHaveBeenCalledWith(5, 'consultation', 't');
  // The first other patient still waiting, in the order shown.
  expect(onSelectPatient).toHaveBeenCalledWith(sok);
  expect(refresh).toHaveBeenCalled();
  expect(toast.success.mock.calls[0][0]).toBe('Dara sent to Pharmacy. Now seeing number 8, Sok.');
});

test('nothing moves when the save fails', async () => {
  await render(React.createElement(SaveAndNextButton, { patient: dara, onSave: async () => false }));
  await act(async () => button().props.onClick());
  expect(completeStation).not.toHaveBeenCalled();
  expect(onSelectPatient).not.toHaveBeenCalled();
});

test('the last patient leaves an empty selection, and a finished visit is reported', async () => {
  completeStation.mockResolvedValueOnce(move(null));
  await render(React.createElement(SaveAndNextButton, { patient: dara, onSave: async () => true }), [dara]);
  await act(async () => button().props.onClick());
  expect(onSelectPatient).toHaveBeenCalledWith(null);
  expect(toast.success.mock.calls[0][0]).toBe('Dara has finished all stations. No one else is waiting here.');
});

test('a failure to send the patient on is shown, after the save', async () => {
  completeStation.mockRejectedValueOnce(new Error('Patient is no longer waiting at this station. Refresh the queue.'));
  await render(React.createElement(SaveAndNextButton, { patient: dara, onSave: async () => true }));
  await act(async () => button().props.onClick());
  expect(toast.error).toHaveBeenCalledWith('Patient is no longer waiting at this station. Refresh the queue.');
  expect(onSelectPatient).not.toHaveBeenCalled();
});

test('a family member who is done waits for their family; the next one still to be seen opens', async () => {
  // Dara and Sok are family A; Chan already waits for his own family here.
  const tan = { ...sok, family: 'A' }, waiting = { ...chan, family: 'B', family_waiting: true }, vanna = patient(8, '10', 'Vanna');
  completeStation.mockResolvedValueOnce(move(null, { held: true, waiting_for: [{ visit_id: 6, queue_no: '8', english_name: 'Sok' }] }));
  await render(React.createElement(SaveAndNextButton, { patient: { ...dara, family: 'A' }, onSave: async () => true }), [{ ...dara, family: 'A' }, waiting, tan, vanna]);
  await act(async () => button().props.onClick());
  expect(onSelectPatient).toHaveBeenCalledWith(tan);
  expect(toast.success.mock.calls[0][0]).toBe('Dara is done here and waits for their family (8 Sok). They move on together. Now seeing number 8, Sok.');
});

test('the last of a family to be done takes them all on; those who moved are not opened next', async () => {
  completeStation.mockResolvedValueOnce(move('pharmacy', { family_moved: [{ visit_id: 6, queue_no: '8', next_station: 'pharmacy' }] }));
  await render(React.createElement(SaveAndNextButton, { patient: dara, onSave: async () => true }), [dara, sok, chan]);
  await act(async () => button().props.onClick());
  expect(onSelectPatient).toHaveBeenCalledWith(chan);
  expect(toast.success.mock.calls[0][0]).toBe('Dara sent to Pharmacy, with family 8. Now seeing number 9, Chan.');
});

test('a patient waiting for family is told so instead of being offered to send on', async () => {
  await render(React.createElement(StationDonePrompt, { patient: { ...dara, family: 'A', family_waiting: true }, done: true }));
  expect(renderer.root.findAllByType('button')).toHaveLength(0);
  expect(text(renderer.root)).toMatch(/waiting for the rest of family A here/);
});

test('the done prompt appears once the station is done, and sends the patient on', async () => {
  await render(React.createElement(StationDonePrompt, { patient: dara, done: false }));
  expect(renderer.root.findAllByType('button')).toHaveLength(0);
  await act(async () => renderer.update(React.createElement(StationFlowProvider, { station: 'consultation', onSelectPatient },
    React.createElement(Queue, { patients: [sok, dara] }), React.createElement(StationDonePrompt, { patient: dara, done: true }))));
  expect(text(renderer.root)).toMatch(/Done at Consult: everything needed here is saved/);
  await act(async () => button().props.onClick());
  expect(completeStation).toHaveBeenCalledWith(5, 'consultation', 't');
  expect(onSelectPatient).toHaveBeenCalledWith(sok);
});

test('outside a station page neither shows', async () => {
  await act(async () => {
    renderer = create(React.createElement('div', null,
      React.createElement(SaveAndNextButton, { patient: dara, onSave: async () => true }),
      React.createElement(StationDonePrompt, { patient: dara, done: true })));
  });
  expect(renderer.root.findAllByType('button')).toHaveLength(0);
});
