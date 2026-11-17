// Geometric spatial navigation for D-pad remotes.
//
//  [data-focus]        an element that can receive D-pad focus (buttons/inputs get it too)
//  [data-focus-id]     stable id used to restore focus after navigating back
//  [data-focus-group]  a row/section; moving into it re-focuses its last-focused child
//  [data-focus-trap]   while present, navigation stays inside it (dialogs, player overlay)
//  [data-autofocus]    preferred initial focus inside a container
//  [data-focus-lock="y"|"x"]  up/down (or left/right) never leaves this container
//  [data-focus-enter="left"]  this container can only be entered by moving in the listed
//                             direction(s) (the side menus: you have to press Left to get in)

export type Dir = "up" | "down" | "left" | "right";

const SELECTOR = "[data-focus], button:not([disabled]), input:not([disabled]), a[href]";
const groupMemory = new WeakMap<Element, HTMLElement>();

/** An element that keeps focus across navigations (the side rail while you move through it):
 *  new screens put focus back on it instead of taking it. */
let held: HTMLElement | null = null;
export function holdFocus(el: HTMLElement | null) {
  held = el;
}
export function heldFocus(): HTMLElement | null {
  return held?.isConnected ? held : null;
}

function visible(el: HTMLElement): boolean {
  if (el.closest("[inert], [aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

function scope(): ParentNode {
  const traps = document.querySelectorAll<HTMLElement>("[data-focus-trap]");
  return traps.length ? traps[traps.length - 1] : document;
}

export function focusables(root: ParentNode = scope()): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(SELECTOR)).filter(visible);
}

export function focusEl(el: HTMLElement | null | undefined, opts: { scroll?: boolean } = {}): boolean {
  if (!el) return false;
  el.focus({ preventScroll: true });
  const group = el.closest("[data-focus-group]");
  if (group) groupMemory.set(group, el);
  if (opts.scroll !== false) reveal(el);
  return document.activeElement === el;
}

/** Keep the focused element on screen: rows scroll horizontally, the page scrolls to centre it. */
function reveal(el: HTMLElement) {
  const row = el.closest<HTMLElement>("[data-scroll-x]");
  if (row) {
    const pad = row.clientWidth * 0.06;
    const r = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    if (r.left < rr.left + pad) row.scrollBy({ left: r.left - rr.left - pad, behavior: "smooth" });
    else if (r.right > rr.right - pad) row.scrollBy({ left: r.right - rr.right + pad, behavior: "smooth" });
  }
  const page = el.closest<HTMLElement>("[data-scroll-y]");
  if (page) {
    const r = el.getBoundingClientRect();
    const pr = page.getBoundingClientRect();
    const margin = pr.height * 0.18;
    if (r.top < pr.top + margin || r.bottom > pr.bottom - margin) {
      const target = r.top - pr.top - (pr.height - r.height) / 2;
      page.scrollBy({ top: el.hasAttribute("data-focus-top") ? r.top - pr.top - margin : target, behavior: "smooth" });
    }
  }
}

export function focusFirst(root: ParentNode = scope()): boolean {
  const auto = root.querySelector<HTMLElement>("[data-autofocus]");
  if (auto && visible(auto)) return focusEl(auto);
  return focusEl(focusables(root)[0]);
}

/** focusFirst, retried for a few frames: elements sliding in from `visibility: hidden`
 *  (lunar-ui drawers) can't take focus until their transition has started. */
export function focusFirstSoon(root?: ParentNode, frames = 20): Promise<boolean> {
  return new Promise((resolve) => {
    const attempt = (left: number) => {
      if (focusFirst(root ?? scope())) return resolve(true);
      if (left <= 0) return resolve(false);
      requestAnimationFrame(() => attempt(left - 1));
    };
    attempt(frames);
  });
}

/** focusById with the same retry. */
export function focusByIdSoon(id: string | undefined, root: ParentNode = document, frames = 20): Promise<boolean> {
  return new Promise((resolve) => {
    const attempt = (left: number) => {
      if (focusById(id, root)) return resolve(true);
      if (left <= 0) return resolve(false);
      requestAnimationFrame(() => attempt(left - 1));
    };
    attempt(frames);
  });
}

export function focusById(id: string | undefined, root: ParentNode = document): boolean {
  if (!id) return false;
  const el = root.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(id)}"]`);
  return !!el && visible(el) && focusEl(el);
}

export function move(dir: Dir): boolean {
  const root = scope();
  const current = document.activeElement as HTMLElement | null;
  const all = focusables(root);
  if (!current || current === document.body || !all.includes(current)) return focusFirst(root);

  // Axis lock: e.g. the side menu keeps up/down inside itself.
  const axis = dir === "up" || dir === "down" ? "y" : "x";
  const lock = current.closest<HTMLElement>(`[data-focus-lock~="${axis}"]`);
  let pool = lock ? all.filter((el) => lock.contains(el)) : all;
  // Containers that only open to some directions (e.g. side menus only from the right, via Left).
  pool = pool.filter((el) => {
    const gate = el.closest<HTMLElement>("[data-focus-enter]");
    return !gate || gate.contains(current) || gate.dataset.focusEnter!.split(/\s+/).includes(dir);
  });

  const from = current.getBoundingClientRect();
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of pool) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let primary: number;
    let secondary: number;
    switch (dir) {
      case "right":
        if (cx <= fx + 1 || r.left < from.left + 1) continue;
        primary = Math.max(0, r.left - from.right);
        secondary = overlap(from.top, from.bottom, r.top, r.bottom) ? 0 : Math.abs(cy - fy);
        break;
      case "left":
        if (cx >= fx - 1 || r.right > from.right - 1) continue;
        primary = Math.max(0, from.left - r.right);
        secondary = overlap(from.top, from.bottom, r.top, r.bottom) ? 0 : Math.abs(cy - fy);
        break;
      case "down":
        if (cy <= fy + 1 || r.top < from.top + 1) continue;
        primary = Math.max(0, r.top - from.bottom);
        secondary = overlap(from.left, from.right, r.left, r.right) ? Math.abs(r.left - from.left) * 0.1 : Math.abs(cx - fx);
        break;
      case "up":
        if (cy >= fy - 1 || r.bottom > from.bottom - 1) continue;
        primary = Math.max(0, from.top - r.bottom);
        secondary = overlap(from.left, from.right, r.left, r.right) ? Math.abs(r.left - from.left) * 0.1 : Math.abs(cx - fx);
        break;
    }
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (!best) return false;

  // Entering a different row: go back to where we were in that row.
  const fromGroup = current.closest("[data-focus-group]");
  const toGroup = best.closest("[data-focus-group]");
  if (toGroup && toGroup !== fromGroup) {
    const remembered = groupMemory.get(toGroup);
    if (remembered && remembered.isConnected && visible(remembered)) best = remembered;
    else {
      const preferred = toGroup.querySelector<HTMLElement>("[data-focus-default]");
      if (preferred && visible(preferred)) best = preferred;
    }
  }
  return focusEl(best);
}

function overlap(a1: number, a2: number, b1: number, b2: number) {
  return Math.min(a2, b2) - Math.max(a1, b1) > 4;
}

export function activate(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  if (el instanceof HTMLInputElement && el.type !== "button" && el.type !== "submit") {
    // On TVs, OK on a text field opens the on-screen keyboard; submit its form on a second press.
    return false;
  }
  el.click();
  return true;
}
