// Turning what someone types on a TV remote into Ganymede URLs to try.
//   "192.168.1.10:4800" → http://192.168.1.10:4800, then https://…
//   "ganymede.example.com" → https://…, then http://…

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?f[cd][0-9a-f]{2}:|\[?fe80:)/i;
const LOCAL_SUFFIX = /\.(local|lan|home|internal|home\.arpa)$/i;

export function isLocalHost(host: string): boolean {
  const h = host.replace(/:\d+$/, "");
  return PRIVATE_HOST.test(h) || LOCAL_SUFFIX.test(h) || !h.includes(".");
}

/** Candidate base URLs, most likely first. Empty if the input can't be a URL. */
export function candidates(input: string): string[] {
  const raw = input.trim().replace(/\s+/g, "").replace(/\/+$/, "");
  if (!raw) return [];
  const clean = (u: URL) => `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}`;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return [clean(new URL(raw))];
    } catch {
      return [];
    }
  }
  let u: URL;
  try {
    u = new URL(`http://${raw}`);
  } catch {
    return [];
  }
  const http = clean(u);
  const https = http.replace(/^http:/, "https:");
  return isLocalHost(u.host) ? [http, https] : [https, http];
}

/** Does `url` answer like a Ganymede server? Resolves to its channel count. */
export async function probeGanymede(url: string, timeoutMs = 8000): Promise<number> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const t = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    const res = await fetch(`${url}/api/v1/channel`, { signal: ctl?.signal });
    if (!res.ok) throw new Error(`Server answered ${res.status}`);
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object" || !("data" in json) || !("success" in json)) {
      throw new Error("That doesn't look like a Ganymede server");
    }
    return Array.isArray(json.data) ? json.data.length : 0;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Timed out");
    throw e instanceof TypeError ? new Error("Can't connect") : e;
  } finally {
    clearTimeout(t);
  }
}
