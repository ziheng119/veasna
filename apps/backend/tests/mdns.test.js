const { EventEmitter } = require('events');
const { normalizeMdnsName, addressesFor, buildAnswer, startMdns } = require('../config/mdns');

const interfaces = {
  'Wi-Fi': [
    { family: 'IPv4', internal: false, address: '192.168.68.50', netmask: '255.255.252.0' },
    { family: 'IPv6', internal: false, address: 'fe80::7cde:72c4:b7ca:4094', netmask: 'ffff:ffff:ffff:ffff::' },
  ],
  'vEthernet (WSL)': [{ family: 'IPv4', internal: false, address: '172.20.32.1', netmask: '255.255.240.0' }],
  Loopback: [{ family: 'IPv4', internal: true, address: '127.0.0.1', netmask: '255.0.0.0' }],
};

const A = { name: 'veasna.local', type: 'A', ttl: 120, flush: true, data: '192.168.68.50' };
const AAAA = { name: 'veasna.local', type: 'AAAA', ttl: 120, flush: true, data: 'fe80::7cde:72c4:b7ca:4094' };

function fakeSocket() {
  const socket = new EventEmitter();
  socket.respond = jest.fn();
  socket.destroy = jest.fn();
  return socket;
}

describe('mDNS name', () => {
  test.each([
    ['veasna', 'veasna.local'], [' Veasna.local. ', 'veasna.local'], ['', ''], [undefined, ''],
  ])('normalizes %p -> %p', (input, expected) => {
    expect(normalizeMdnsName(input)).toBe(expected);
  });

  test('uses only the adapter on the asking device\'s subnet', () => {
    expect(addressesFor('192.168.69.7', interfaces)).toEqual({
      ipv4: ['192.168.68.50'], ipv6: ['fe80::7cde:72c4:b7ca:4094'],
    });
    expect(addressesFor('10.9.9.9', interfaces).ipv4).toEqual(['192.168.68.50', '172.20.32.1']);
  });

  test('answers IPv6 with a real address, or NSEC ("IPv4 only") when there is none', () => {
    const both = { ipv4: ['192.168.68.50'], ipv6: ['fe80::7cde:72c4:b7ca:4094'] };
    expect(buildAnswer('veasna.local', new Set(['A']), both)).toEqual({ answers: [A], additionals: [AAAA] });
    expect(buildAnswer('veasna.local', new Set(['AAAA']), both)).toEqual({ answers: [AAAA], additionals: [A] });

    const v4only = buildAnswer('veasna.local', new Set(['AAAA']), { ipv4: ['192.168.68.50'], ipv6: [] });
    expect(v4only.answers).toEqual([expect.objectContaining({ type: 'NSEC', data: { nextDomain: 'veasna.local', rrtypes: ['A'] } })]);
    expect(v4only.additionals).toEqual([A]);
  });

  test('is off when no name is set', () => {
    expect(startMdns('', { createSocket: fakeSocket })).toBeNull();
  });

  test('answers only for its own name, directly to non-standard ports', () => {
    const socket = fakeSocket();
    const mdns = startMdns('veasna', { createSocket: () => socket, interfaces });

    socket.emit('query', { id: 0, questions: [{ name: 'other.local', type: 'A' }] }, { address: '192.168.68.60', port: 5353 });
    expect(socket.respond).not.toHaveBeenCalled();

    socket.emit('query', { id: 0, questions: [{ name: 'VEASNA.local', type: 'A' }] }, { address: '192.168.68.60', port: 5353 });
    expect(socket.respond).toHaveBeenLastCalledWith({ answers: [A], additionals: [AAAA] });

    const question = { name: 'veasna.local', type: 'A' };
    socket.emit('query', { id: 42, questions: [question] }, { address: '192.168.68.60', port: 50000 });
    expect(socket.respond).toHaveBeenLastCalledWith(
      { id: 42, questions: [question], answers: [A], additionals: [AAAA] },
      { port: 50000, address: '192.168.68.60' },
    );

    mdns.close();
    expect(socket.destroy).toHaveBeenCalled();
  });
});
