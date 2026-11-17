// Error reporting to GitHub Issues.
//
// Anything that goes wrong (uncaught errors, failed promises, a screen that crashes while
// rendering, or a native crash the Android shell recorded last time) becomes a Report. The
// report dialog shows a QR code that opens a pre-filled "New issue" page on your phone, so no
// credentials ever live in the app. Optionally, a fine-grained GitHub token (Issues: write on
// this one repo) can be stored on the TV to file reports automatically; repeats of the same
// error are added as comments on the existing issue instead of opening new ones.
//
// Reports are scrubbed: tokens, API keys, server addresses and IPs are removed.
import { getItem, setItem } from "./store";
import { APP_VERSION, diagnostics } from "./diagnostics";

export const DEFAULT_REPO: string = __SERAPH_REPO__;

export type ReportKind = "error" | "rejection" | "screen" | "native" | "manual";

export interface Report {
  kind: ReportKind;
  message: string;
  stack: string;
  where: string;
  time: string;
  fingerprint: string;
  /** Set once filed automatically. */
  issueUrl?: string;
}

const K = { repo: "sp:report:repo", token: "sp:report:token", auto: "sp:report:auto", log: "sp:report:log" };

/** Strip anything private from text that goes into a public issue. */
export function scrub(text: string): string {
  return text
    .replace(/(X-Plex-Token|X-Plex-Client-Identifier|token|api[_-]?key|access_token|auth)=([^&\s"')]+)/gi, "$1=[redacted]")
    .replace(/(Bearer|token)\s+[\w.-]{8,}/gi, "$1 [redacted]")
    .replace(/\b(?:gh[pousr]_|github_pat_)\w{10,}/g, "[redacted]")
    .replace(/\bhttps?:\/\/[^\s/"')]+/g, (m) => (/github\.com|plex\.tv$/.test(m) ? m : "<server>"))
    .replace(/\b[\da-f]{32}\.plex\.direct(:\d+)?/gi, "<server>")
    .replace(/\b\d{1,3}(?:[.-]\d{1,3}){3}\b/g, "<ip>");
}

/** Stable id for "the same error": message shape + first app frame, numbers stripped. */
function fingerprint(message: string, stack: string): string {
  const frame = stack.split("\n").find((l) => /at |@/.test(l)) ?? "";
  const basis = `${message}|${frame}`.replace(/\d+/g, "#").replace(/\s+/g, " ");
  let h = 2166136261;
  for (let i = 0; i < basis.length; i++) h = Math.imul(h ^ basis.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function describe(err: unknown): { message: string; stack: string } {
  if (err instanceof Error) {
    const message = `${err.name}: ${err.message}`;
    // V8 stacks repeat the message as their first line(s); keep only the frames.
    let stack = err.stack ?? "";
    if (stack.startsWith(message)) stack = stack.slice(message.length).replace(/^\n/, "");
    else if (stack.startsWith(err.message)) stack = stack.slice(err.message.length).replace(/^\n/, "");
    return { message, stack };
  }
  if (typeof err === "string") return { message: err, stack: "" };
  try {
    return { message: JSON.stringify(err), stack: "" };
  } catch {
    return { message: String(err), stack: "" };
  }
}

const where = () => scrub(decodeURI(location.hash.replace(/^#/, "")) || "/").replace(/([?&](title|q)=)[^&]*/g, "$1…");

class Reporter {
  /** The report the dialog is showing. */
  current = $state<Report | null>(null);
  repo = $state(getItem(K.repo) || DEFAULT_REPO);
  hasToken = $state(!!getItem(K.token));
  auto = $state(getItem(K.auto) === "1");
  filing = $state(false);
  fileError = $state<string | null>(null);
  #seen = new Map<string, number>();

  install() {
    window.addEventListener("error", (e) => {
      // Resource load errors (an image 404) bubble here without an `error`; they're not bugs.
      if (!e.error && !e.message) return;
      this.capture(e.error ?? e.message, "error");
    });
    window.addEventListener("unhandledrejection", (e) => this.capture(e.reason, "rejection"));
    const native = takeNativeCrash();
    if (native) this.capture({ name: "NativeCrash", message: native.split("\n")[0], stack: native } as Error, "native", true);
  }

  /** Record a problem. `show` opens the dialog (fatal errors); others are only filed/logged. */
  capture(err: unknown, kind: ReportKind, show = kind !== "rejection") {
    const { message, stack } = describe(err);
    // Network hiccups and aborted fetches aren't bugs in the app.
    if (/AbortError|Failed to fetch|NetworkError|Load failed|Can't (reach|connect)|Timed out/i.test(message)) return;
    const report: Report = {
      kind,
      message: scrub(message).slice(0, 500),
      stack: scrub(stack).split("\n").slice(0, 30).join("\n"),
      where: where(),
      time: new Date().toISOString(),
      fingerprint: fingerprint(message, stack),
    };
    const last = this.#seen.get(report.fingerprint) ?? 0;
    if (Date.now() - last < 60_000) return; // same error looping: report it once a minute at most
    this.#seen.set(report.fingerprint, Date.now());
    this.#log(report);
    if (show || kind === "screen") this.current = report;
    if (this.auto && this.hasToken) void this.file(report);
  }

  dismiss() {
    this.current = null;
    this.fileError = null;
  }

  title(r: Report) {
    return `[crash] ${r.message.replace(/\s+/g, " ").slice(0, 90)}`;
  }

  body(r: Report, full = true) {
    const env = diagnostics()
      .map(([k, v]) => `| ${k} | ${v} |`)
      .join("\n");
    const stack = full ? r.stack : r.stack.split("\n").slice(0, 8).join("\n");
    return [
      `**What happened:** ${r.kind === "native" ? "the app closed unexpectedly" : r.kind === "screen" ? "a screen failed to render" : "an error was thrown"} on \`${r.where}\``,
      "",
      "```",
      r.message,
      stack,
      "```",
      "",
      "| | |",
      "|---|---|",
      env,
      `| Time | ${r.time} |`,
      "",
      `<!-- seraph-fingerprint: ${r.fingerprint} -->`,
      `Fingerprint: \`${r.fingerprint}\``,
    ].join("\n");
  }

  /** Pre-filled "new issue" link. Kept short so its QR code stays coarse enough to scan from the sofa. */
  issueLink(r: Report): string {
    const base = `https://github.com/${this.repo}/issues/new`;
    const make = (b: string) => `${base}?labels=crash-report&title=${encodeURIComponent(this.title(r))}&body=${encodeURIComponent(b)}`;
    const frames = r.stack.split("\n").slice(0, 3).map((l) => l.trim().slice(0, 90));
    const env = diagnostics().filter(([k]) => k === "App" || k === "Platform" || k === "Engine");
    const lines = [r.message.slice(0, 200), ...frames, ...env.map(([k, v]) => `${k}: ${v}`), `On: ${r.where}`, `Fingerprint: ${r.fingerprint}`];
    let body = "```\n" + lines.join("\n") + "\n```\n\n<!-- describe what you were doing -->";
    while (make(body).length > 850 && lines.length > 3) {
      lines.splice(1, 1); // drop stack frames first
      body = "```\n" + lines.join("\n") + "\n```";
    }
    return make(body);
  }

  /** File (or +1) the issue with the stored token. */
  async file(r: Report): Promise<string | null> {
    const token = getItem(K.token);
    if (!token) return null;
    this.filing = true;
    this.fileError = null;
    const gh = (path: string, init?: RequestInit) =>
      fetch(`https://api.github.com${path}`, {
        ...init,
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`GitHub ${res.status}: ${(await res.json().catch(() => ({})))?.message ?? res.statusText}`);
        return res.json();
      });
    try {
      const q = encodeURIComponent(`repo:${this.repo} is:issue is:open "seraph-fingerprint: ${r.fingerprint}" in:body`);
      const found = await gh(`/search/issues?q=${q}&per_page=1`).catch(() => ({ items: [] }));
      let url: string;
      if (found.items?.length) {
        const issue = found.items[0];
        await gh(`/repos/${this.repo}/issues/${issue.number}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: `Happened again.\n\n${this.body(r)}` }),
        });
        url = issue.html_url;
      } else {
        const issue = await gh(`/repos/${this.repo}/issues`, {
          method: "POST",
          body: JSON.stringify({ title: this.title(r), body: this.body(r), labels: ["crash-report"] }),
        });
        url = issue.html_url;
      }
      r.issueUrl = url;
      if (this.current?.fingerprint === r.fingerprint) this.current = { ...r };
      return url;
    } catch (e) {
      this.fileError = (e as Error).message;
      return null;
    } finally {
      this.filing = false;
    }
  }

  // ----- settings -----
  setRepo(repo: string) {
    this.repo = repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "") || DEFAULT_REPO;
    setItem(K.repo, this.repo === DEFAULT_REPO ? null : this.repo);
  }
  setToken(token: string) {
    setItem(K.token, token.trim() || null);
    this.hasToken = !!token.trim();
    if (!this.hasToken) this.setAuto(false);
  }
  setAuto(on: boolean) {
    this.auto = on;
    setItem(K.auto, on ? "1" : null);
  }
  /** Check the token can see the repo. */
  async verify(): Promise<string> {
    const token = getItem(K.token);
    if (!token) return "No token saved.";
    const res = await fetch(`https://api.github.com/repos/${this.repo}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res) return "Couldn't reach GitHub.";
    if (res.status === 404) return `The token can't see ${this.repo}. Check the repository name and the token's repository access.`;
    if (!res.ok) return `GitHub said ${res.status}.`;
    return `OK: reports will be filed in ${this.repo}.`;
  }

  /** Recent problems on this TV (newest first), for Settings → About. */
  get recent(): Report[] {
    try {
      return JSON.parse(getItem(K.log) || "[]");
    } catch {
      return [];
    }
  }
  #log(r: Report) {
    const list = [r, ...this.recent.filter((x) => x.fingerprint !== r.fingerprint)].slice(0, 10);
    setItem(K.log, JSON.stringify(list));
  }

  report(err: unknown, kind: ReportKind = "manual") {
    this.capture(err, kind, true);
  }
}

/** A crash the Android shell recorded before the app last closed (read once). */
function takeNativeCrash(): string | null {
  try {
    return window.SeraphTV?.takeCrash?.() || null;
  } catch {
    return null;
  }
}

export const reporter = new Reporter();
export { APP_VERSION };
