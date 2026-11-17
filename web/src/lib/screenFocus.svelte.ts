// Focus handling shared by the route-group layouts: after each navigation, Back lands on the
// card you came from and a new screen focuses its first control (once its data has rendered).
// While an element holds focus (holdFocus: the side rail, which navigates as you move through
// it) the new screen leaves it there; you enter the screen by moving into it.
import { tick } from "svelte";
import { focusById, focusEl, focusFirst, heldFocus } from "./nav";
import { router } from "./router.svelte";

/** Call from a layout's script; `root` is the element its pages render into. */
export function screenFocus(root: () => HTMLElement | undefined) {
  $effect(() => {
    const entry = router.current;
    const restoring = router.restoring;
    const el = root();
    if (!el) return;
    return focusWhenReady(el, () => {
      const a = document.activeElement;
      if (a && a !== el && el.contains(a)) return true;
      // Navigation can blur it (SvelteKit's focus reset, Back steps when leaving a deeper screen).
      const h = heldFocus();
      if (h) return a === h || focusEl(h, { scroll: false });
      return (restoring && focusById(entry.focusId, el)) || focusFirst(el);
    });
  });
}

/** Try `attempt` now and again whenever the DOM under `root` changes (data still loading), for up to 8 s. */
export function focusWhenReady(root: HTMLElement, attempt: () => boolean) {
  let observer: MutationObserver | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  tick().then(() => {
    if (attempt()) return;
    observer = new MutationObserver(() => {
      if (attempt()) observer?.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    timeout = setTimeout(() => observer?.disconnect(), 8000);
  });
  return () => {
    observer?.disconnect();
    clearTimeout(timeout);
  };
}
