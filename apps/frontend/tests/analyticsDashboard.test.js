const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/lib/api/location', () => ({ getLocations: jest.fn().mockResolvedValue([{ id: 1, name: 'Clinic A' }, { id: 2, name: 'Clinic B' }]) }));
jest.mock('../src/lib/api/analytics', () => ({ getAnalytics: jest.fn() }));
const { getAnalytics } = require('../src/lib/api/analytics');
const Dashboard = require('../src/components/analytics/AnalyticsDashboard').default;
const sample = (locationId, date) => ({
  locationId, date, generatedAt: '2026-10-21T01:00:00Z',
  summary: { people: 4, visits: 5, consultedPeople: 2, dischargedVisits: 2, referralVisits: 2, notesSaved: 2, unsignedReferrals: 1 },
  stations: [], ages: [], destinations: [],
});
global.IS_REACT_ACT_ENVIRONMENT = true;

test('shows real counts, distinguishes proposed metrics and discards obsolete requests', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  getAnalytics.mockImplementation((id, date) => Promise.resolve(sample(id, date)));
  let renderer, resolveOld, oldSignal;
  try {
    await act(async () => { renderer = create(React.createElement(Dashboard)); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
    expect(JSON.stringify(renderer.toJSON())).toContain('Diabetes counts are not available reliably yet');
    getAnalytics.mockImplementationOnce((id, date, token, signal) => {
      oldSignal = signal;
      return new Promise(resolve => { resolveOld = () => resolve(sample(id, date)); });
    });
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '2026-10-20' } }));
    getAnalytics.mockRejectedValueOnce(new Error('Unable to load analytics.'));
    await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: '2' } }));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld());
    expect(renderer.root.findByProps({ role: 'alert' }).children.join('')).toContain('Unable to load');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Patients consulted');
    getAnalytics.mockImplementationOnce((id, date) => Promise.resolve({ ...sample(id, date), summary: { ...sample(id, date).summary, people: 0, visits: 0 } }));
    await act(async () => renderer.root.findByType('button').props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain('No visits are recorded');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});
