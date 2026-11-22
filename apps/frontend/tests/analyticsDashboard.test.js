const React = require('react');
const { act, create } = require('react-test-renderer');
jest.mock('next/link', () => ({ __esModule: true, default: props => React.createElement('a', props) }));
jest.mock('../src/stores/useUserStore', () => ({ useUserStore: selector => selector({ user: { token: 'test' } }) }));
jest.mock('../src/lib/api/analytics', () => ({ getAnalytics: jest.fn(), getAnalyticsTrend: jest.fn(),
  getAnalyticsReferrals: jest.fn((date, period) => Promise.resolve({ date, period, generatedAt: '2026-10-21T01:00:00Z', destinations: [] })),
  getAnalyticsFollowUp: jest.fn((date, period) => Promise.resolve({ date, period, generatedAt: '2026-10-21T01:00:00Z',
    notDischarged: [{ visitId: 9, patientId: 4, queueNo: '12', visitDate: date, englishName: 'Sok Dara', khmerName: null, stickerColour: null, family: 'B', tbStatus: 'flagged', station: 'triage' }],
    notDischargedMore: false, unsignedReferrals: [], unsignedReferralsMore: false })),
  getAnalyticsPartnerNgo: jest.fn((date, period) => Promise.resolve({ date, period, generatedAt: '2026-10-21T01:00:00Z', more: false, types: [
    { id: 'cataract_surgery', label: 'Cataract surgery', listed: true, patients: [{ visitId: 7, patientId: 3, queueNo: '4', visitDate: date,
      referral: 'cataract_surgery', referralDate: '2026-11-02', diagnosis: 'Cataract, left eye', englishName: 'Chan Mony', khmerName: null,
      sex: 'F', dateOfBirth: '1960-01-05', phone: null, stickerColour: null, family: null, tbStatus: null }] },
    { id: 'seva_general', label: 'Partner NGO (general)', listed: true, patients: [] },
  ] })),
  getAnalyticsOptician: jest.fn((date, period) => Promise.resolve({ date, period, generatedAt: '2026-10-21T01:00:00Z', more: false, patients: [
    { visitId: 8, patientId: 5, queueNo: '6', visitDate: date, englishName: 'Keo Sophea', khmerName: null, sex: 'F', dateOfBirth: null,
      phone: '012 111 222', address: 'Village B', leftWithoutPinhole: '20/200', rightWithoutPinhole: '20/40', leftWithPinhole: null,
      rightWithPinhole: null, leftWithGlasses: null, rightWithGlasses: null, notes: 'Lost her glasses', stickerColour: null, family: null, tbStatus: null },
  ] })) }));
const { getAnalytics, getAnalyticsTrend, getAnalyticsPartnerNgo } = require('../src/lib/api/analytics');
const conditionCounts = ids => Object.fromEntries(['diabetes','hypertension','musculoskeletal','gastrointestinal','respiratory','vision','skin'].map(id => [id, ids.includes(id) ? 2 : 0]));
const trend = (date, period) => ({ range: null, period, unit: 'day', date, generatedAt: '2026-10-21T01:00:00Z', buckets: [
  { startDate: '2026-10-20', endDate: '2026-10-20', visits: 3, people: 3, consultedPeople: 2, conditions: conditionCounts(['diabetes']) },
  { startDate: '2026-10-21', endDate: '2026-10-21', visits: 5, people: 4, consultedPeople: 3, conditions: conditionCounts(['diabetes','skin']) },
] });
beforeEach(() => getAnalyticsTrend.mockImplementation((date, period) => Promise.resolve(trend(date, period))));
const Dashboard = require('../src/components/analytics/AnalyticsDashboard').default;
const sample = date => ({
  date, generatedAt: '2026-10-21T01:00:00Z',
  conditions: [{id: "diabetes", label: "Diabetes", count: 1}],
  summary: { consultedVisits: 3, conditionReviewedVisits: 2, people: 4, visits: 5, consultedPeople: 2, dischargedVisits: 2, referralVisits: 2, notesSaved: 2, unsignedReferrals: 1 },
  stations: [], ages: [], destinations: [],
});
global.IS_REACT_ACT_ENVIRONMENT = true;

test('shows real counts, distinguishes proposed metrics and discards obsolete requests', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  getAnalytics.mockImplementation(date => Promise.resolve(sample(date)));
  let renderer, resolveOld, oldSignal;
  try {
    await act(async () => { renderer = create(React.createElement(Dashboard)); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
    expect(JSON.stringify(renderer.toJSON())).toContain('Conditions addressed in consultation');
    getAnalytics.mockImplementationOnce((date, token, signal) => {
      oldSignal = signal;
      return new Promise(resolve => { resolveOld = () => resolve(sample(date)); });
    });
    await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: '2026-10-20' } }));
    getAnalytics.mockRejectedValueOnce(new Error('Unable to load analytics.'));
    await act(async () => renderer.root.findByProps({ label: 'Time period' }).props.onChange('week'));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld());
    const alert = renderer.root.findByProps({ role: 'alert' });
    expect(alert.findByType('span').children.join('')).toContain('Unable to load');
    expect(alert.findByType('button').children.join('')).toBe('Try again');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Patients consulted');
    getAnalytics.mockImplementationOnce((date, _token, _signal, period) => Promise.resolve({ ...sample(date), period, summary: { ...sample(date).summary, people: 0, visits: 0 } }));
    await act(async () => renderer.root.findAllByProps({ 'aria-label': 'Refresh data' })[0].props.onClick());
    expect(JSON.stringify(renderer.toJSON())).toContain('No visits are recorded');
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    log.mockRestore();
  }
});

test('period selection requests fresh data and hides results from the previous period', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((date,_token,_signal,period)=>Promise.resolve({...sample(date),period}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const selector=()=>renderer.root.findByProps({label:'Time period'});
  await act(async()=>selector().props.onChange('week'));
  expect(getAnalytics.mock.calls.at(-1)[3]).toBe('week');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
  await act(async()=>selector().props.onChange('all'));
  expect(getAnalytics.mock.calls.at(-1)[3]).toBe('all');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients consulted');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('condition dropdown shows all seven choices and unclassified data never looks like zero cases', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation(date=>Promise.resolve({...sample(date),summary:{...sample(date).summary,conditionReviewedVisits:0}}));
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

test('no draft labels remain and there is no location to choose: one clinic', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((date,_token,_signal,period)=>Promise.resolve({...sample(date),period}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const text=JSON.stringify(renderer.toJSON());
  expect(text).not.toMatch(/Analytics draft|Proposed next steps|Not yet measured/);
  expect(renderer.root.findAllByProps({'aria-label':'Clinic location'})).toHaveLength(0);
  expect(text).not.toMatch(/Clinic location|All locations|by location/);
  await act(async()=>renderer.root.findByProps({label:'Time period'}).props.onChange('month'));
  expect(getAnalytics.mock.calls.at(-1)[3]).toBe('month');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('the trend chart follows the page period, switches metric, and condition mix shows a pie of recorded conditions', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((date,_t,_s,period)=>Promise.resolve({...sample(date),period,conditions:[{id:'diabetes',label:'Diabetes',count:3},{id:'skin',label:'Skin conditions',count:1}]}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  expect(getAnalyticsTrend.mock.calls.at(-1)[1]).toBe('day');
  expect(JSON.stringify(renderer.toJSON())).toContain('Patients reached and consulted per day');
  // No range of its own: the chart covers what the numbers above it cover.
  expect(renderer.root.findAllByProps({label:'Trend range'})).toHaveLength(0);
  await act(async()=>renderer.root.findByProps({label:'Time period'}).props.onChange('trip'));
  expect(getAnalyticsTrend.mock.calls.at(-1)[1]).toBe('trip');
  expect(getAnalytics.mock.calls.at(-1)[3]).toBe('trip');
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
 getAnalytics.mockImplementation(date=>Promise.resolve(sample(date)));
 getAnalyticsTrend.mockRejectedValue(new Error('Unable to load trends. Please try again.'));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const text=JSON.stringify(renderer.toJSON());
  expect(text).toContain('Unable to load trends');
  expect(text).toContain('Patients consulted');
  // The trend error has its own retry.
  getAnalyticsTrend.mockImplementation((date, period) => Promise.resolve(trend(date, period)));
  const trends=renderer.root.findByProps({id:'trends'});
  await act(async()=>trends.findByProps({role:'alert'}).findAllByType('button')[0].props.onClick());
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Unable to load trends');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('export menu downloads a CSV of the visible data and help tips explain each section', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation(date=>Promise.resolve(sample(date)));
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
  expect(link.download).toBe(`veasna-analytics-day-${getAnalytics.mock.calls.at(-1)[0]}.csv`);
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
 getAnalytics.mockImplementation((date,_t,_s,period)=>Promise.resolve({...sample(date),period,summary:{...sample(date).summary,people:0,visits:0}}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  expect(JSON.stringify(renderer.toJSON())).toContain('How to use this page');
  await act(async()=>renderer.root.findByProps({'aria-label':'Hide guide'}).props.onClick());
  expect(JSON.stringify(renderer.toJSON())).not.toContain('How to use this page');
  const wider=renderer.root.findAll(node=>node.type==='button'&&node.children.join('')==='Try all time')[0];
  await act(async()=>wider.props.onClick());
  expect(getAnalytics.mock.calls.at(-1)[3]).toBe('all');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('a headline sums up the period and follow-up names who is still open', async () => {
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 getAnalytics.mockImplementation((date,_t,_s,period)=>Promise.resolve({...sample(date),period}));
 let renderer;
 try {
  await act(async()=>{renderer=create(React.createElement(Dashboard));});
  const text=JSON.stringify(renderer.toJSON());
  // Today's Day view: open visits are still in the clinic; Station workload says Waiting.
  const words=node=>typeof node==='string'?node:(node.children||[]).map(words).join('');
  const headline=words(renderer.root.findByProps({id:'overview'}).findAllByType('p')[0]);
  expect(headline).toBe('Today, 4 patients were reached and 2 consulted; 2 visits have a referral (1 unsigned); 3 still in the clinic.');
  expect(text).toContain('Still in the clinic');
  expect(text).toContain('Sok Dara');
  expect(text).toContain('Waiting');
  await act(async()=>renderer.root.findByType('input').props.onChange({target:{value:'2026-10-20'}}));
  const past=JSON.stringify(renderer.toJSON());
  expect(words(renderer.root.findByProps({id:'overview'}).findAllByType('p')[0])).toContain('3 visits not discharged');
  expect(past).not.toContain('Still in the clinic');
  expect(past).toContain('Not discharged');
 } finally {if(renderer) await act(async()=>renderer.unmount());log.mockRestore();}
});

test('headlineSentence reads naturally for one patient and for a trip', () => {
 const { headlineSentence } = require('../src/components/analytics/AnalyticsDashboard');
 const one = { ...sample('2026-10-21'), summary: { ...sample('2026-10-21').summary, people: 1, consultedPeople: 1, visits: 1, dischargedVisits: 1, referralVisits: 1, unsignedReferrals: 0 },
   days: [{ date: '2026-10-20' }, { date: '2026-10-21' }] };
 expect(headlineSentence(one, 'trip', false, '20 – 21 Oct 2026')).toBe('This trip (20 – 21 Oct 2026, 2 clinic days), 1 patient was reached and 1 consulted; 1 visit has a referral; every visit was discharged.');
});

test('Partner NGO referrals show each patient with the referral type and date, for the page period', async () => {
  getAnalytics.mockImplementation(date => Promise.resolve(sample(date)));
  let renderer;
  await act(async () => { renderer = create(React.createElement(Dashboard)); });
  const section = renderer.root.find(node => node.type === 'section' && node.props.id === 'partner-ngo');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join(' ');
  const rows = section.findAllByType('tbody')[0].findAllByType('tr');
  expect(rows).toHaveLength(1);
  const row = text(rows[0]);
  expect(row).toContain('Cataract surgery');
  expect(row).toContain('2 Nov 2026');
  expect(row).toContain('Cataract, left eye');
  // Types with no patients get no empty table.
  expect(section.findAllByType('table')).toHaveLength(1);
  expect(getAnalyticsPartnerNgo).toHaveBeenLastCalledWith(expect.any(String), 'day', 'test', expect.anything());
});

test('optician referrals list who Triage ticked, with details and the readings taken', async () => {
  getAnalytics.mockImplementation(date => Promise.resolve(sample(date)));
  let renderer;
  await act(async () => { renderer = create(React.createElement(Dashboard)); });
  const section = renderer.root.find(node => node.type === 'section' && node.props.id === 'optician');
  const text = node => typeof node === 'string' ? node : (node.children ?? []).map(text).join(' ');
  const rows = section.findAllByType('tbody')[0].findAllByType('tr');
  expect(rows).toHaveLength(1);
  const row = text(rows[0]);
  for (const part of ['Keo Sophea', '012 111 222', 'Village B', 'Without pinhole', 'L 20/200 · R 20/40', 'Lost her glasses']) expect(row).toContain(part);
  // Readings not taken are left out.
  expect(row).not.toContain('With glasses');
});
