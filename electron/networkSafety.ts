import { BlockList, isIP } from 'node:net';

const blockedAddresses = new BlockList();
const globalIpv6 = new BlockList();

globalIpv6.addSubnet('2000::', 3, 'ipv6');

for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(address, prefix, 'ipv4');
}

for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['2001::', 23],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const) {
  blockedAddresses.addSubnet(address, prefix, 'ipv6');
}

export const normalizeNetworkHostname = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

export const isPublicNetworkAddress = (address: string): boolean => {
  if (address.toLowerCase().startsWith('::ffff:')) return false;
  const family = isIP(address);
  if (family === 4) return !blockedAddresses.check(address, 'ipv4');
  if (family === 6) {
    return globalIpv6.check(address, 'ipv6') && !blockedAddresses.check(address, 'ipv6');
  }
  return false;
};
