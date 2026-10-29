const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
jest.mock('../src/stores/useLocationStore', () => ({ useLocationStore: selector => selector({ currentLocation: { id: 1 } }) }));
jest.mock('../src/lib/api/location', () => ({ getLocations: jest.fn().mockResolvedValue([{ id: 1, name: 'Clinic A' }, { id: 2, name: 'Clinic B' }]) }));
jest.mock('../src/lib/api/analytics', () => ({ getAnalytics: jest.fn(), getAnalyticsTrend: jest.fn() }));
const { getAnalytics, getAnalyticsTrend } = require('../src/lib/api/analytics');
const conditionCounts = ids => Object.fromEntries(['diabetes','hypertension','musculoskeletal','gastrointestinal','respiratory','vision','skin'].map(id => [id, ids.includes(id) ? 2 : 0]));
const trend = (locationId, date, range) => ({ range, date, locationId, generatedAt: '2026-10-21T01:00:00Z', buckets: [
  { startDate: '2026-10-20', endDate: '2026-10-20', visits: 3, people: 3, consultedPeople: 2, conditions: conditionCounts(['diabetes']) },
  { startDate: '2026-10-21', endDate: '2026-10-21', visits: 5, people: 4, consultedPeople: 3, conditions: conditionCounts(['diabetes','skin']) },
] });
beforeEach(() => getAnalyticsTrend.mockImplementation((id, date, range) => Promise.resolve(trend(id, date, range))));
const Dashboard = require('../src/components/analytics/AnalyticsDashboard').default;
const sample = (locationId, date) => ({
  locationId, date, generatedAt: '2026-10-21T01:00:00Z',
  conditions: [{id: "diabetes", label: "Diabetes", count: 1}],
  summary: { consultedVisits: 3, conditionReviewedVisits: 2, people: 4, visits: 5, consultedPeople: 2, dischargedVisits: 2, referralVisits: 2, notesSaved: 2, unsignedReferrals: 1 },
  stations: [], ages: [], destinations: [], locations: [{ locationId: 1, people: 3, visits: 4 }, { locationId: 2, people: 1, visits: 1 }],
});
global.IS_REACT_ACT_ENVIRONMENT = true;

test('shows real counts, distinguishes proposed metrics and discards obsolete requests', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  getAnalytics.mockImplementation((id, date) => Promise.resolve(sample(id, date)));
  let renderer, resolveOld, oldSignal;
  try {
    await act(async () => { renderer = create(React.createElement(Dashboard)); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
    expect(JSON.stringify(renderer.toJSON())).toContain('Conditions addressed in consultation');
    getAnalytics.mockImplementationOnce((id, date, token, signal) => {
      oldSignal = signal;
      return new Promise(resolve => { resolveOld = () => resolve(sample(id, date)); });
    });
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '2026-10-20' } }));
    getAnalytics.mockRejectedValueOnce(new Error('Unable to load analytics.'));
    await act(async () => renderer.root.findAllByType('select')[0].props.onChange({ target: { value: '2' } }));
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

test('period selection requests fresh data and hides results from the previous period', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date,_token,_signal,period)=>Promise.resolve({...sample(id,date),period}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const selector=()=>renderer.root.findByProps({'aria-label':'Time period'});
  await act(async()=>selector().props.onChange({target:{value:'week'}}));
  expect(getAnalytics.mock.calls.at(-1)[4]).toBe('week');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
  await act(async()=>selector().props.onChange({target:{value:'all'}}));
  expect(getAnalytics.mock.calls.at(-1)[4]).toBe('all');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('condition dropdown shows all seven choices and unclassified data never looks like zero cases', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date)=>Promise.resolve({...sample(id,date),summary:{...sample(id,date).summary,conditionReviewedVisits:0}}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const selector=renderer.root.findByProps({'aria-label':'Condition'});
  expect(selector.findAllByType('option').map(option=>option.children.join(''))).toEqual(['Diabetes','Hypertension','Musculoskeletal issues','Gastrointestinal issues','Respiratory issues','Vision issues','Skin conditions']);
  expect(JSON.stringify(renderer.toJSON())).toContain('Not recorded');
  await act(async()=>selector.props.onChange({target:{value:'skin'}}));
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted with ');
  expect(JSON.stringify(renderer.toJSON())).toContain('Incomplete condition data');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('no draft labels remain and All locations requests overall data with a location comparison', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date,_token,_signal,period)=>Promise.resolve({...sample(id,date),period}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  expect(JSON.stringify(renderer.toJSON())).not.toMatch(/Analytics draft|Proposed next steps|Not yet measured/);
  const location=renderer.root.findByProps({'aria-label':'Clinic location'});
  expect(location.findAllByType('option').map(option=>option.props.value)).toEqual(['all',1,2]);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Patients reached by location');
  await act(async()=>location.props.onChange({target:{value:'all'}}));
  expect(getAnalytics.mock.calls.at(-1)[0]).toBe('all');
  expect(getAnalyticsTrend.mock.calls.at(-1)[0]).toBe('all');
  const text=JSON.stringify(renderer.toJSON());
  expect(text).toContain('Patients reached by location');
  expect(text).toContain('Clinic A');
  await act(async()=>renderer.root.findByProps({'aria-label':'Time period'}).props.onChange({target:{value:'month'}}));
  expect(getAnalytics.mock.calls.at(-1)[4]).toBe('month');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('trend chart switches range and metric, and condition mix shows a pie of recorded conditions', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date)=>Promise.resolve({...sample(id,date),conditions:[{id:'diabetes',label:'Diabetes',count:3},{id:'skin',label:'Skin conditions',count:1}]}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  expect(getAnalyticsTrend.mock.calls.at(-1)[2]).toBe('30d');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients reached and consulted per day');
  await act(async()=>renderer.root.findByProps({'aria-label':'Trend range'}).props.onChange({target:{value:'12m'}}));
  expect(getAnalyticsTrend.mock.calls.at(-1)[2]).toBe('12m');
  await act(async()=>renderer.root.findByProps({'aria-label':'Trend metric'}).props.onChange({target:{value:'conditions'}}));
  expect(renderer.root.findAllByType('polyline')).toHaveLength(7);
  await act(async()=>renderer.root.findByProps({'aria-label':'Trend metric'}).props.onChange({target:{value:'skin'}}));
  expect(renderer.root.findAllByType('polyline')).toHaveLength(1);
  const pie=renderer.root.findByProps({'aria-label':'Condition mix for the selected period'});
  expect(pie.findAllByType('title').map(node=>node.children.join(''))).toEqual(['Diabetes: 3 (75%)','Skin conditions: 1 (25%)']);
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('trend failures show an error without hiding the rest of the dashboard', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date)=>Promise.resolve(sample(id,date)));
 getAnalyticsTrend.mockRejectedValue(new Error('Unable to load trends. Please try again.'));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const text=JSON.stringify(renderer.toJSON());
  expect(text).toContain('Unable to load trends');
  expect(text).toContain('Patients consulted');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});
