import { describe, expect, it } from 'vitest';
import { isPublicNetworkAddress, normalizeNetworkHostname } from '../../electron/networkSafety';

describe('desktop network safety', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.8',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
    '64:ff9b:1::7f00:1',
    '100::1',
    '2001:2::1',
    '2002:7f00:1::1',
    '3fff::1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicNetworkAddress(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])('accepts public address %s', (address) => {
    expect(isPublicNetworkAddress(address)).toBe(true);
  });

  it('normalizes bracketed IPv6 hostnames for DNS and TLS', () => {
    expect(normalizeNetworkHostname('[::1]')).toBe('::1');
  });
});
