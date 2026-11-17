// "A new version is out" — checks the repo's latest GitHub release at most once a day.
// TVs can't install updates from inside a web view, so this only tells you and gives a QR
// code to the release page (APK and Tizen widget are attached there).
import { APP_VERSION } from "./diagnostics";
import { reporter } from "./report.svelte";
import { getJSON, setJSON } from "./store";

interface Release {
  version: string;
  url: string;
  name: string;
  checkedAt: number;
}

const KEY = "sp:update";
const DAY = 24 * 60 * 60_000;

/** -1 / 0 / 1 comparing dotted versions ("v1.2.0" works too). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

class Updates {
  latest = $state<Release | null>(getJSON<Release | null>(KEY, null));
  checking = $state(false);
  dismissed = $state(false);

  get available(): Release | null {
    return this.latest && compareVersions(this.latest.version, APP_VERSION) > 0 ? this.latest : null;
  }

  async check(force = false) {
    if (!force && this.latest && Date.now() - this.latest.checkedAt < DAY) return;
    this.checking = true;
    try {
      const res = await fetch(`https://api.github.com/repos/${reporter.repo}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) return; // no releases yet, private repo, or rate-limited: try again tomorrow
      const r = await res.json();
      this.latest = { version: String(r.tag_name ?? ""), url: String(r.html_url ?? ""), name: String(r.name ?? r.tag_name ?? ""), checkedAt: Date.now() };
      setJSON(KEY, this.latest);
    } catch {
      /* offline */
    } finally {
      this.checking = false;
    }
  }
}

export const updates = new Updates();
