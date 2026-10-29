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
    const alert = renderer.root.findByProps({ role: 'alert' });
    expect(alert.findByType('span').children.join('')).toContain('Unable to load');
    expect(alert.findByType('button').children.join('')).toBe('Try again');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Patients consulted');
    getAnalytics.mockImplementationOnce((id, date) => Promise.resolve({ ...sample(id, date), summary: { ...sample(id, date).summary, people: 0, visits: 0 } }));
    await act(async () => renderer.root.findAllByProps({ 'aria-label': 'Refresh data' })[0].props.onClick());
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
  const selector=()=>renderer.root.findByProps({label:'Time period'});
  await act(async()=>selector().props.onChange('week'));
  expect(getAnalytics.mock.calls.at(-1)[4]).toBe('week');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
  await act(async()=>selector().props.onChange('all'));
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
  await act(async()=>renderer.root.findByProps({label:'Time period'}).props.onChange('month'));
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
  await act(async()=>renderer.root.findByProps({label:'Trend range'}).props.onChange('12m'));
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

test('export menu downloads a CSV of the visible data and help tips explain each section', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date)=>Promise.resolve(sample(id,date)));
 const created=[];
 global.URL.createObjectURL=jest.fn(blob=>{created.push(blob);return 'blob:x';});
 global.URL.revokeObjectURL=jest.fn();
 const link={click:jest.fn(),remove:jest.fn()};
 global.document={createElement:jest.fn(()=>link),body:{appendChild:jest.fn()},addEventListener:jest.fn(),removeEventListener:jest.fn(),getElementById:jest.fn()};
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const exportButton=renderer.root.findByProps({'aria-haspopup':'menu'});
  expect(exportButton.props.disabled).toBe(false);
  await act(async()=>exportButton.props.onClick());
  const items=renderer.root.findAllByProps({role:'menuitem'});
  expect(items).toHaveLength(2);
  await act(async()=>items[0].props.onClick());
  expect(link.download).toBe(`veasna-analytics-clinic-a-day-${getAnalytics.mock.calls.at(-1)[1]}.csv`);
  expect(link.click).toHaveBeenCalled();
  const csv=await created[0].text();
  expect(csv).toContain('Summary,Patients reached,Unique patients,4');
  expect(csv).toContain('Conditions,Diabetes,Unique patients,1');
  expect(csv).toContain('Trend,2026-10-21,Skin conditions,2');
  expect(renderer.root.findAllByProps({role:'menuitem'})).toHaveLength(0);
  const tip=renderer.root.findByProps({'aria-label':'About Patients consulted'});
  await act(async()=>tip.props.onClick());
  expect(JSON.stringify(renderer.toJSON())).toContain('Saving notes alone does not count');
 } finally {if(renderer) await act(async()=>renderer.unmount());delete global.document;log.mockRestore();}
});

test('guide can be dismissed and empty results offer a wider view', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((id,date,_t,_s,period)=>Promise.resolve({...sample(id,date),period,summary:{...sample(id,date).summary,people:0,visits:0}}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  expect(JSON.stringify(renderer.toJSON())).toContain('How to use this page');
  await act(async()=>renderer.root.findByProps({'aria-label':'Hide guide'}).props.onClick());
  expect(JSON.stringify(renderer.toJSON())).not.toContain('How to use this page');
  const wider=renderer.root.findAll(node=>node.type==='button'&&node.children.join('')==='Try all locations')[0];
  await act(async()=>wider.props.onClick());
  expect(getAnalytics.mock.calls.at(-1)[0]).toBe('all');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});
