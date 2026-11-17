// Remote-control input: normalises Samsung Tizen, Android TV and desktop keyboard
// events into a small set of actions and routes them through a handler stack.

export type Action =
  | "up" | "down" | "left" | "right" | "ok" | "back"
  | "playpause" | "play" | "pause" | "stop" | "ff" | "rw" | "next" | "prev"
  | "red" | "green" | "yellow" | "blue" | "info";

export interface InputEvent {
  action: Action;
  repeat: boolean;
  /** The original DOM event, if any (absent for Android bridge events). */
  source?: KeyboardEvent;
}

type Handler = (e: InputEvent) => boolean | void;

const KEYCODES: Record<number, Action> = {
  37: "left", 38: "up", 39: "right", 40: "down", 13: "ok",
  10009: "back", 27: "back", 166: "back", 461: "back", // Tizen Return, Esc, BrowserBack, webOS back
  10252: "playpause", 179: "playpause", 415: "play", 19: "pause", 413: "stop",
  417: "ff", 228: "ff", 412: "rw", 227: "rw", 10233: "next", 176: "next", 10232: "prev", 177: "prev",
  403: "red", 404: "green", 405: "yellow", 406: "blue", 457: "info",
};

const KEYNAMES: Record<string, Action> = {
  ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", Enter: "ok",
  Escape: "back", GoBack: "back", BrowserBack: "back",
  MediaPlayPause: "playpause", MediaPlay: "play", MediaPause: "pause", MediaStop: "stop",
  MediaFastForward: "ff", MediaRewind: "rw", MediaTrackNext: "next", MediaTrackPrevious: "prev",
  ColorF0Red: "red", ColorF1Green: "green", ColorF2Yellow: "yellow", ColorF3Blue: "blue", Info: "info",
};

// Desktop-browser conveniences for development.
const DEV_KEYS: Record<string, Action> = { " ": "playpause", c: "red", i: "info", Backspace: "back" };

const stack: Handler[] = [];
let fallback: Handler = () => false;

/** Push a handler that sees actions before the default navigation. Returns an unsubscribe fn. */
export function pushHandler(h: Handler): () => void {
  stack.push(h);
  return () => {
    const i = stack.lastIndexOf(h);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function setFallback(h: Handler) {
  fallback = h;
}

function isTextInput(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !["button", "checkbox", "radio", "submit", "range"].includes(el.type);
}

export function dispatch(e: InputEvent): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i](e) === true) return true;
  }
  return fallback(e) === true;
}

function toAction(ev: KeyboardEvent): Action | undefined {
  const typing = isTextInput(document.activeElement);
  if (typing) {
    // Let the text field handle editing keys; only escape it with up/down/back/enter.
    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "Backspace" || ev.key === " ") return;
    if (ev.key.length === 1) return;
  }
  return KEYNAMES[ev.key] ?? KEYCODES[ev.keyCode] ?? (typing ? undefined : DEV_KEYS[ev.key]);
}

export function installInput() {
  window.addEventListener(
    "keydown",
    (ev) => {
      const action = toAction(ev);
      if (!action) return;
      if (dispatch({ action, repeat: ev.repeat, source: ev })) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    true,
  );

  // Android TV shell bridge: the native Activity turns BACK and media keys into these events.
  window.addEventListener("tvkey", (ev) => {
    const action = (ev as CustomEvent<string>).detail as Action;
    if (action) dispatch({ action, repeat: false });
  });
}
