// Find Ganymede servers on the local network.
//  - Android TV: the native shell scans its own /24 (fast, no browser restrictions).
//  - Samsung: the TV reports its IP via Samsung/Tizen APIs; we scan from JavaScript.
//  - Browser: the user types the subnet (e.g. 192.168.1).

import { probeGanymede } from "./address";

export const PORTS = [4800, 4000, 80, 8080]; // 4800 = Ganymede's docker-compose default

export interface Found {
  url: string;
  channels: number;
}

export interface ScanProgress {
  done: number;
  total: number;
  found: Found[];
  finished: boolean;
}

type Bridge = { scanGanymede?(ports: string): void; cancelScan?(): void; localNetwork?(): string };
const bridge = () => (window as unknown as { SeraphTV?: Bridge }).SeraphTV;

/* eslint-disable @typescript-eslint/no-explicit-any */
/** This device's IPv4 address, if the platform can tell us. */
export async function localIp(): Promise<string | null> {
  try {
    const net = bridge()?.localNetwork?.();
    if (net) return JSON.parse(net).ip ?? null;
  } catch {
    /* ignore */
  }
  const w = window as any;
  try {
    const ip = w.webapis?.network?.getIp?.();
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {
    /* ignore */
  }
  const si = w.tizen?.systeminfo;
  if (si) {
    for (const prop of ["ETHERNET_NETWORK", "WIFI_NETWORK"]) {
      const ip = await new Promise<string | null>((resolve) => {
        try {
          si.getPropertyValue(prop, (v: any) => resolve(v?.ipAddress || null), () => resolve(null));
        } catch {
          resolve(null);
        }
      });
      if (ip && ip !== "0.0.0.0") return ip;
    }
  }
  return null;
}

export const canScanNatively = () => !!bridge()?.scanGanymede;

/** "192.168.1.37" → "192.168.1" */
export const subnetOf = (ip: string) => ip.split(".").slice(0, 3).join(".");

export interface ScanHandle {
  cancel(): void;
}

export function scan(subnet: string | null, onProgress: (p: ScanProgress) => void): ScanHandle {
  const b = bridge();
  if (b?.scanGanymede) {
    const handler = (e: Event) => onProgress((e as CustomEvent<ScanProgress>).detail);
    window.addEventListener("ganymede-scan", handler);
    b.scanGanymede(PORTS.join(","));
    return {
      cancel() {
        window.removeEventListener("ganymede-scan", handler);
        b.cancelScan?.();
      },
    };
  }
  return jsScan(subnet ?? "192.168.1", onProgress);
}

function jsScan(subnet: string, onProgress: (p: ScanProgress) => void): ScanHandle {
  let cancelled = false;
  const targets: string[] = [];
  for (let h = 1; h <= 254; h++) for (const port of PORTS) targets.push(`http://${subnet}.${h}${port === 80 ? "" : `:${port}`}`);
  const found: Found[] = [];
  let done = 0;
  let next = 0;
  const report = (finished = false) => onProgress({ done, total: targets.length, found: [...found], finished });

  const worker = async () => {
    while (!cancelled && next < targets.length) {
      const url = targets[next++];
      try {
        const channels = await probeGanymede(url, 1500);
        if (!cancelled) found.push({ url, channels });
      } catch {
        /* nothing there */
      }
      done++;
      if (done % 24 === 0 || found.length) report();
    }
  };
  Promise.all(Array.from({ length: 48 }, worker)).then(() => !cancelled && report(true));
  report();
  return {
    cancel() {
      cancelled = true;
    },
  };
}
