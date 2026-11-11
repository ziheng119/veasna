// The guided tour from the ? button (components/guide/GuideTour.tsx, lib/guide/steps.ts,
// lib/guide/geometry.ts, stores/useGuideStore.ts).
const fs = require('fs');
const path = require('path');
const React = require('react');
const { act, create } = require('react-test-renderer');

const push = jest.fn();
let pathname = '/';
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => pathname }));
jest.mock('../src/components/ui/button', () => {
  const React = require('react');
  return { Button: ({ children, ...props }) => React.createElement('button', props, children) };
});

const { GUIDE_STEPS } = require('../src/lib/guide/steps');
const { padRect, placePopover, spotlightPath, approach, EDGE, GAP } = require('../src/lib/guide/geometry');
const { useGuideStore } = require('../src/stores/useGuideStore');
const { canAccessPage } = require('../src/lib/permissions');
global.IS_REACT_ACT_ENVIRONMENT = true;

// Every source file, to check the tour's targets are still in the pages.
const SRC = path.join(__dirname, '../src');
const sources = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? sources(file) : /\.tsx?$/.test(entry.name) ? [fs.readFileSync(file, 'utf8')] : [];
});
const code = sources(SRC).join('\n');

describe('steps', () => {
  test('follow a patient from registration to Pharmacy, on pages a screening-day account can open', () => {
    expect(GUIDE_STEPS[0].target).toBeUndefined(); // the welcome card
    const chapters = GUIDE_STEPS.map((step) => step.chapter);
    expect(chapters.indexOf('Registration')).toBeLessThan(chapters.indexOf('Triage'));
    expect(chapters.indexOf('Triage')).toBeLessThan(chapters.indexOf('Consult'));
    expect(chapters.indexOf('Consult')).toBeLessThan(chapters.indexOf('Pharmacy'));
    for (const step of GUIDE_STEPS.slice(1)) expect(canAccessPage('user', step.path)).toBe(true);
    // The welcome shows over whatever page is open.
    expect(GUIDE_STEPS[0].path).toBeUndefined();
  });

  test('point at parts still in the code, and keep their texts short', () => {
    for (const step of GUIDE_STEPS) {
      if (step.target) expect(code).toMatch(new RegExp(`(data-tour|tour)="${step.target}"`));
      if (step.tab) expect(code).toContain(`data-tour-tab="${step.tab}"`);
      expect(step.body.length).toBeLessThanOrEqual(260);
    }
  });

  test("don't send anyone to admin-only actions as if they could do them", () => {
    const text = GUIDE_STEPS.map((step) => step.body).join(' ');
    // Printing and dispensing are named only as needing the admin account.
    expect(text).toMatch(/Printing it needs the admin account/);
    expect(text).toMatch(/Dispensing changes the stock, so the admin account does it/);
    expect(text).not.toMatch(/Analytics|Station data|Accounts page|Delete/);
  });
});

describe('geometry', () => {
  test('the spotlight hole gets room around it and stays on screen', () => {
    expect(padRect({ x: 100, y: 100, w: 50, h: 20 }, 8, 1000, 800)).toEqual({ x: 92, y: 92, w: 66, h: 36 });
    // A target taller than the screen is cut to what is visible.
    const tall = padRect({ x: 0, y: -400, w: 300, h: 2000 }, 8, 1000, 800);
    expect(tall.y).toBeGreaterThanOrEqual(0);
    expect(tall.y + tall.h).toBeLessThanOrEqual(800);
  });

  test('the clip-path covers the screen with a rounded hole', () => {
    const clip = spotlightPath({ x: 10, y: 20, w: 100, h: 40 }, 800, 600, 14);
    expect(clip).toMatch(/^path\(evenodd, "M0 0H800V600H0Z/);
    expect(clip).toContain('M24 20H96A14 14 0 0 1 110 34');
    // A hole too small for the radius isn't drawn inside out.
    expect(spotlightPath({ x: 0, y: 0, w: 4, h: 4 }, 800, 600, 14)).toContain('A2 2');
  });

  test('the pop-up goes on the preferred side if it fits, else the side with room, with the arrow at the target', () => {
    const box = { w: 300, h: 160 };
    const below = placePopover({ x: 400, y: 50, w: 200, h: 40 }, box, 1200, 800);
    expect(below).toMatchObject({ side: 'bottom', y: 50 + 40 + GAP });
    expect(below.x + below.arrow).toBeCloseTo(500); // the target's centre
    // Preferred left, and there is room there.
    expect(placePopover({ x: 700, y: 300, w: 200, h: 200 }, box, 1200, 800, 'left')).toMatchObject({ side: 'left', x: 700 - GAP - 300 });
    // No room below a target at the bottom: above it.
    expect(placePopover({ x: 400, y: 700, w: 200, h: 60 }, box, 1200, 800).side).toBe('top');
    // Kept on screen near an edge.
    expect(placePopover({ x: 0, y: 50, w: 40, h: 40 }, box, 1200, 800).x).toBe(EDGE);
  });

  test('with no target, or a target filling the screen, the pop-up is centred without an arrow', () => {
    expect(placePopover(null, { w: 300, h: 160 }, 1200, 800)).toMatchObject({ side: 'center', x: 450, y: 320 });
    expect(placePopover({ x: 0, y: 0, w: 1200, h: 800 }, { w: 300, h: 160 }, 1200, 800).side).toBe('center');
  });

  test('movement eases towards its goal and settles exactly', () => {
    const step = approach(0, 100, 16);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(100);
    expect(approach(99.9, 100, 16)).toBe(100);
    expect(approach(0, 100, Infinity)).toBe(100); // reduced motion: no animation
  });
});

describe('store', () => {
  test('starts at the welcome, steps back and forth, and ends after the last step', () => {
    const guide = useGuideStore.getState();
    guide.start();
    expect(useGuideStore.getState()).toMatchObject({ active: true, index: 0 });
    guide.back();
    expect(useGuideStore.getState().index).toBe(0);
    guide.next();
    expect(useGuideStore.getState().index).toBe(1);
    useGuideStore.setState({ index: GUIDE_STEPS.length - 1 });
    guide.next();
    expect(useGuideStore.getState().active).toBe(false);
  });
});

describe('the tour on screen', () => {
  // Just enough of a browser for the tour: one marked part on the page, and frames run by hand.
  let frames, keydown, target;
  const node = () => ({ style: { setProperty: jest.fn() }, dataset: {}, offsetWidth: 340, offsetHeight: 200, focus: jest.fn(), animate: jest.fn(), querySelectorAll: () => [], contains: () => false });
  beforeEach(() => {
    jest.useFakeTimers();
    frames = [];
    target = { getBoundingClientRect: () => ({ left: 100, top: 120, width: 300, height: 80, bottom: 200 }), scrollIntoView: jest.fn() };
    Object.assign(global, {
      window: global, innerWidth: 1280, innerHeight: 800, location: { pathname: '/', search: '' },
      matchMedia: () => ({ matches: true }), // reduced motion: positions settle in one frame
      requestAnimationFrame: (callback) => frames.push(callback), cancelAnimationFrame: jest.fn(),
      addEventListener: (type, handler) => { if (type === 'keydown') keydown = handler; },
      removeEventListener: jest.fn(),
      document: {
        querySelector: () => null,
        querySelectorAll: (selector) => (selector.includes('"location"') ? [target] : []),
        elementsFromPoint: () => [], activeElement: null,
      },
    });
    useGuideStore.setState({ active: true, index: 0 });
    push.mockClear();
    pathname = '/';
  });
  afterEach(() => { jest.useRealTimers(); useGuideStore.setState({ active: false, index: 0 }); });
  const runFrame = () => act(() => { const pending = frames; frames = []; pending.forEach((callback) => callback(performance.now())); });
  const text = (tree) => JSON.stringify(tree.toJSON());
  const press = (key) => act(() => keydown({ key, preventDefault: jest.fn() }));

  test('shows each step, moves the spotlight to its part, and ends with Esc', () => {
    const GuideTour = require('../src/components/guide/GuideTour').default;
    const nodes = [];
    let tree;
    act(() => { tree = create(React.createElement(GuideTour), { createNodeMock: () => { const n = node(); nodes.push(n); return n; } }); });
    expect(text(tree)).toContain('Welcome to VEASNA');
    expect(tree.root.findByProps({ role: 'dialog' }).props['aria-modal']).toBe('true');

    press('ArrowRight');
    expect(text(tree)).toContain('Choose your location');
    runFrame();
    // The spotlight's hole is cut where the location picker is, with the ring and a ripple on it.
    const dim = nodes.find((n) => n.style.clipPath);
    expect(dim.style.clipPath).toContain('M0 0H1280V800H0Z');
    expect(text(tree)).toContain('guide-ripple');

    press('ArrowLeft');
    expect(text(tree)).toContain('Welcome to VEASNA');
    press('Escape');
    expect(useGuideStore.getState().active).toBe(false);
    act(() => { jest.advanceTimersByTime(300); });
    expect(tree.toJSON()).toBeNull();
  });

  test("opens each step's page, and says so while that page loads", () => {
    const GuideTour = require('../src/components/guide/GuideTour').default;
    const triage = GUIDE_STEPS.findIndex((step) => step.path === '/triage');
    useGuideStore.setState({ index: triage });
    let tree;
    act(() => { tree = create(React.createElement(GuideTour), { createNodeMock: node }); });
    expect(push).toHaveBeenCalledWith('/triage');
    expect(text(tree)).toContain('Opening Triage');
  });

  test('starts over the page that is open, and exiting goes back to it', () => {
    const GuideTour = require('../src/components/guide/GuideTour').default;
    pathname = '/triage';
    global.location = { pathname: '/triage', search: '?visit=12' };
    let tree;
    act(() => { tree = create(React.createElement(GuideTour), { createNodeMock: node }); });
    expect(push).not.toHaveBeenCalled();
    press('ArrowRight'); // the location step, on Home
    expect(push).toHaveBeenLastCalledWith('/');
    global.location = { pathname: '/', search: '' };
    act(() => tree.root.findByProps({ 'aria-label': 'Exit the guide' }).props.onClick());
    expect(push).toHaveBeenLastCalledWith('/triage?visit=12');
  });

  test("clicking the paused page doesn't reach it: the pop-up nudges and says why", () => {
    const GuideTour = require('../src/components/guide/GuideTour').default;
    let tree;
    act(() => { tree = create(React.createElement(GuideTour), { createNodeMock: node }); });
    const blocker = tree.root.find((n) => typeof n.props.onPointerDown === 'function');
    act(() => blocker.props.onPointerDown());
    expect(text(tree)).toContain('The page is paused during the guide');
    act(() => { jest.advanceTimersByTime(3000); });
    expect(text(tree)).not.toContain('The page is paused during the guide');
  });
});
