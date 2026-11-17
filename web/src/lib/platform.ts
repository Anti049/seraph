// Platform glue for the two shells (Samsung Tizen widget, Android TV WebView).

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    tizen?: any;
    webapis?: any;
    SeraphTV?: {
      exit(): void;
      platform?(): string;
      version?(): string;
      keepScreenOn?(on: boolean): void;
      getItem?(k: string): string | null;
      setItem?(k: string, v: string): void;
      removeItem?(k: string): void;
      setOrigin?(url: string): void;
      takeCrash?(): string | null;
    };
  }
}

export type Platform = "tizen" | "androidtv" | "browser";

export const platform: Platform = window.tizen || /Tizen/i.test(navigator.userAgent)
  ? "tizen"
  : window.SeraphTV || /Android/i.test(navigator.userAgent)
    ? "androidtv"
    : "browser";

const TIZEN_KEYS = [
  "MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop", "MediaFastForward", "MediaRewind",
  "MediaTrackNext", "MediaTrackPrevious", "ColorF0Red", "ColorF1Green", "ColorF2Yellow", "ColorF3Blue", "Info",
];

export function registerPlatformKeys() {
  const input = window.tizen?.tvinputdevice;
  if (!input) return;
  try {
    if (input.registerKeyBatch) input.registerKeyBatch(TIZEN_KEYS);
    else TIZEN_KEYS.forEach((k) => input.registerKey(k));
  } catch {
    TIZEN_KEYS.forEach((k) => {
      try {
        input.registerKey(k);
      } catch {
        /* key not supported on this model */
      }
    });
  }
}

/** Leave the app (Back pressed on the home screen). */
export function exitApp() {
  try {
    if (window.SeraphTV) return window.SeraphTV.exit();
    if (window.tizen?.application) return window.tizen.application.getCurrentApplication().exit();
  } catch {
    /* fall through */
  }
  // Tizen fallback: the widget's local launcher page is one step back in history and
  // exits the app itself when it is shown again.
  if (history.length > 1) history.back();
  else window.close();
}

/** Stop the TV's screensaver from kicking in while a video plays. */
export function setScreenSaver(enabled: boolean) {
  try {
    window.SeraphTV?.keepScreenOn?.(!enabled);
  } catch {
    /* bridge missing */
  }
  try {
    const app = window.webapis?.appcommon;
    if (!app) return;
    app.setScreenSaver(enabled ? app.AppCommonScreenSaverState.SCREEN_SAVER_ON : app.AppCommonScreenSaverState.SCREEN_SAVER_OFF);
  } catch {
    /* not available */
  }
}
