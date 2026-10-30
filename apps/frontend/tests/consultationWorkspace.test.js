const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/components/shared/QueuePatientPicker', () => ({ __esModule: true, default: props => React.createElement('queue-picker', props) }));
jest.mock('../src/components/shared/SearchBar', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/shared/read-only/patient-container/PatientContainer', () => ({ __esModule: true, default: props => React.createElement('patient-snapshot', { visit: props.selectedPatient.visit_id }) }));
jest.mock('../src/components/shared/read-only/triage-container/TriageContainer', () => ({ __esModule: true, default: props => React.createElement('triage-summary', { visit: props.selectedPatient.visit_id }) }));
jest.mock('../src/components/doctors-consultation/DoctorsNotesContainer', () => ({ __esModule: true, default: props => React.createElement('consultation-notes', { visit: props.patient.visit_id }) }));
const Page = require('../src/app/(main)/doctors-consultation/page').default;
global.IS_REACT_ACT_ENVIRONMENT = true;

test('repeated patient switches retain one of each panel and a stable top row', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  let renderer, summaryColumn;
  try {
    await act(async () => { renderer = create(React.createElement(Page)); });
    for (const visit of [1, 2, 1, 3, 2, 1]) {
      await act(async () => renderer.root.findByType('queue-picker').props.onSelectPatient({ visit_id: visit, patient_id: visit }));
      for (const name of ['patient-snapshot', 'triage-summary', 'consultation-notes']) {
        const panels = renderer.root.findAllByType(name);
        expect(panels).toHaveLength(1);
        expect(panels[0].props.visit).toBe(visit);
      }
      const currentColumn = renderer.root.findByType('patient-snapshot').parent.parent;
      if (summaryColumn) expect(currentColumn).toBe(summaryColumn);
      summaryColumn = currentColumn;
    }
    expect(log.mock.calls.flat().join(' ')).not.toMatch(/same key|unique.*key/i);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
