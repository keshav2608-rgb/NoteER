import os from 'os';

/**
 * Returns candidate LAN IPv4 addresses, sorted with the best active
 * physical/Wi-Fi adapter first and virtual/internal adapters deprioritized.
 */
export function getLanIpCandidates() {
  if (process.env.LAN_IP) {
    return [{ name: 'Custom LAN_IP', address: process.env.LAN_IP, recommended: true }];
  }
  if (process.env.HOST_IP) {
    return [{ name: 'Custom HOST_IP', address: process.env.HOST_IP, recommended: true }];
  }

  const interfaces = os.networkInterfaces();
  const candidates = [];

  const isVirtualName = (name) =>
    /virtual|vbox|vmnet|vmware|vethernet|hyper-v|wsl|loopback|bluetooth|pseudo|tunnel|tap|tun|docker|tailscale|zerotier/i.test(
      name
    );

  const isVirtualMac = (mac) => {
    if (!mac) return false;
    const lower = mac.toLowerCase();
    return (
      lower.startsWith('0a:00:27') || // VirtualBox
      lower.startsWith('00:05:69') || // VMware
      lower.startsWith('00:0c:29') || // VMware
      lower.startsWith('00:50:56') || // VMware
      lower.startsWith('00:15:5d')    // Hyper-V / WSL
    );
  };

  const isVirtualIp = (ip) => {
    return (
      ip.startsWith('192.168.56.') || // VirtualBox Host-Only default
      ip.startsWith('169.254.') ||    // APIPA / link-local
      ip.startsWith('127.')           // Loopback
    );
  };

  for (const [name, ifaceList] of Object.entries(interfaces)) {
    for (const iface of ifaceList || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        let score = 0;
        const isVirt =
          isVirtualName(name) || isVirtualMac(iface.mac) || isVirtualIp(iface.address);

        if (isVirt) {
          score -= 100;
        }

        // Prioritize Wi-Fi and Wireless interfaces
        if (/wi-fi|wifi|wlan|wireless/i.test(name)) {
          score += 50;
        } else if (/ethernet|eth|en/i.test(name) && !isVirt) {
          score += 30;
        }

        // Standard local LAN subnets
        if (iface.address.startsWith('192.168.') && !iface.address.startsWith('192.168.56.')) {
          score += 20;
        } else if (iface.address.startsWith('10.')) {
          score += 20;
        } else if (iface.address.startsWith('172.') && !isVirt) {
          score += 10;
        }

        candidates.push({
          name,
          address: iface.address,
          score,
          isVirt
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return candidates.map((c, index) => ({
    name: c.name,
    address: c.address,
    recommended: index === 0 && c.score > -50
  }));
}

/**
 * Returns the single best LAN IP address for multi-device pairing.
 */
export function getLanIpAddress() {
  const candidates = getLanIpCandidates();
  const recommended = candidates.find((c) => c.recommended);
  return recommended ? recommended.address : candidates[0]?.address || 'localhost';
}
