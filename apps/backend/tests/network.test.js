const { parseOrigins, isPrivateHost, createOriginCheck } = require('../config/network');

describe('Frontend origin rules', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  test('parses comma-separated origins, ignoring spaces and trailing slashes', () => {
    expect(parseOrigins(' http://localhost:3001/ , http://192.168.0.20:3001,')).toEqual([
      'http://localhost:3001', 'http://192.168.0.20:3001',
    ]);
    expect(parseOrigins()).toEqual(['http://localhost:3001']);
  });

  test.each([
    ['localhost', true], ['127.0.0.1', true], ['10.1.2.3', true], ['172.16.0.1', true],
    ['172.31.255.255', true], ['192.168.1.10', true], ['[::1]', true],
    ['172.32.0.1', false], ['8.8.8.8', false], ['192.169.0.1', false], ['example.com', false],
    ['192.168.1', false], ['192.168.1.256', false],
  ])('private host %s -> %s', (host, expected) => {
    expect(isPrivateHost(host)).toBe(expected);
  });

  test('exact list only by default; requests without an Origin are allowed', () => {
    const allowed = createOriginCheck({ origins: ['http://192.168.1.20:3001'] });
    expect(allowed(undefined)).toBe(true);
    expect(allowed('http://192.168.1.20:3001')).toBe(true);
    expect(allowed('http://192.168.1.21:3001')).toBe(false);
  });

  test('ALLOW_LAN_ORIGINS mode accepts any private-network frontend, never public ones', () => {
    const allowed = createOriginCheck({ origins: [], allowLan: true });
    expect(allowed('http://192.168.1.21:3001')).toBe(true);
    expect(allowed('http://10.0.0.5:8080')).toBe(true);
    expect(allowed('http://evil.example')).toBe(false);
    expect(allowed('http://203.0.113.7:3001')).toBe(false);
    expect(allowed('file://192.168.1.21')).toBe(false);
    expect(allowed('not a url')).toBe(false);
  });

  test('warns once per rejected origin, so misconfiguration is visible in the backend log', () => {
    const allowed = createOriginCheck({ origins: [] });
    allowed('http://192.168.1.30:3001');
    allowed('http://192.168.1.30:3001');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('http://192.168.1.30:3001');
  });
});
