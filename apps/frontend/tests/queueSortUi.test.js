const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useUserStore', () => {
  const { create } = require('zustand'); return { useUserStore: create(() => ({ user: { id: 1 } })) };
});
jest.mock('../src/components/shared/PageCard', () => ({ PageCard: ({ action, headerExtra, children }) => React.createElement('section', null, action, headerExtra, children) }));
jest.mock('../src/components/ui/badge', () => ({ Badge: ({ children }) => React.createElement('span', { 'data-badge': true }, children) }));
jest.mock('../src/components/ui/button', () => ({ Button: props => React.createElement('button', props) }));
jest.mock('../src/components/ui/input', () => ({ Input: props => React.createElement('input', props) }));
let stationPatients = [];
jest.mock('../src/hooks/useLiveList', () => ({ useLiveList: () => ({ data: stationPatients, refresh: jest.fn() }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/components/shared/EditStationsDialog', () => ({ __esModule: true, default: () => null }));
const QueuePatientPicker = require('../src/components/shared/QueuePatientPicker').default;
const { PatientQueue } = require('../src/components/home/PatientQueue');
global.IS_REACT_ACT_ENVIRONMENT = true;

test('Home toggle survives search and live list replacement without changing source rows', async () => {
  const values = new Map(); global.localStorage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }; global.window = new EventTarget();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const patients = [
    { visit_id: 2, queue_no: '10', english_name: 'Alice', timestamp: '08:00 AM' },
    { visit_id: 1, queue_no: '2', english_name: 'Bob', timestamp: '09:00 AM' },
  ];
  let renderer;
  const numbers = () => renderer.root.findAll(n => n.type === 'span' && n.props['data-badge']).slice(1).map(n => n.children.join(''));
  const toggle = () => renderer.root.findAllByType('button').find(n => n.children.join('') === 'Arrival time');
  try {
    await act(async () => { renderer = create(React.createElement(PatientQueue, { patients })); });
    expect(numbers()).toEqual(['2', '10']);
    await act(async () => toggle().props.onClick()); expect(toggle().props['aria-pressed']).toBe(true);
    expect(numbers()).toEqual(['10', '2']);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Bob' } })); expect(numbers()).toEqual(['2']);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '' } }));
    await act(async () => renderer.update(React.createElement(PatientQueue, { patients: [...patients, { visit_id: 3, queue_no: '1', english_name: 'Carol' }] })));
    expect(numbers()).toEqual(['10', '2', '1']); expect(patients.map(p => p.queue_no)).toEqual(['10', '2']);
  } finally {
    if (renderer) await act(async () => renderer.unmount()); log.mockRestore(); delete global.localStorage; delete global.window;
  }
});

test('station queue defaults to arrival, shows station time, and keeps number mode on live refresh', async () => {
  const values = new Map(); global.localStorage = { getItem: k => values.get(k), setItem: (k,v) => values.set(k,v) }; global.window = new EventTarget();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  stationPatients = [
    { visit_id: 1, queue_no: '10', english_name: 'Alice', timestamp: '08:00 AM', station_arrival_time: '09:00 AM' },
    { visit_id: 2, queue_no: '2', english_name: 'Bob', timestamp: '08:30 AM', station_arrival_time: '10:00 AM' },
  ];
  const props = { station: 'triage', onSelectPatient: jest.fn() };
  let renderer;
  const numbers = () => renderer.root.findAll(n => n.type === 'span' && n.props['data-badge']).slice(1).map(n => n.children.join(''));
  try {
    await act(async () => { renderer = create(React.createElement(QueuePatientPicker, props)); });
    expect(numbers()).toEqual(['10', '2']);
    expect(renderer.root.findAllByType('span').some(n => n.children.join('') === 'Arrived 09:00 AM')).toBe(true);
    const toggle = renderer.root.findAllByType('button').find(n => n.children.join('') === 'Queue number');
    await act(async () => toggle.props.onClick()); expect(numbers()).toEqual(['2', '10']);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'Alice' } })); expect(numbers()).toEqual(['10']);
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '' } }));
    stationPatients = [...stationPatients, { visit_id: 3, queue_no: '1', english_name: 'Carol', timestamp: '11:00 AM' }];
    await act(async () => renderer.update(React.createElement(QueuePatientPicker, props)));
    expect(numbers()).toEqual(['1', '2', '10']);
    expect(renderer.root.findAllByType('span').some(n => n.children.join('') === 'Registered 11:00 AM')).toBe(true);
  } finally {
    if (renderer) await act(async () => renderer.unmount()); log.mockRestore(); delete global.localStorage; delete global.window;
  }
});
