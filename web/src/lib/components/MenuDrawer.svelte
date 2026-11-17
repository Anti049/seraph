<script lang="ts" module>
  /** One row in a menu page. */
  export interface MenuItem {
    id: string;
    label: string;
    icon?: string;
    /** Value shown on the right (current quality, speed…). */
    detail?: string;
    /** Radio-style: shows a check when true. */
    checked?: boolean;
    /** Switch-style: shows On/Off. */
    toggle?: boolean;
    danger?: boolean;
    disabled?: boolean;
    /** Opens a sub-page. */
    page?: () => MenuPage;
    /** Runs, then closes the menu, unless it returns "stay" (or "back" to pop one page). */
    action?: () => void | "stay" | "back" | Promise<void | "stay" | "back">;
  }

  export interface MenuPage {
    title: string;
    /** Items, or a loader for them (shows a spinner while loading). */
    items?: MenuItem[] | (() => Promise<MenuItem[]>);
    /** Key/value facts (file info, stats). */
    facts?: [string, string][];
    /** A QR code with a caption (open in web, feedback…). */
    qr?: { url: string; caption: string };
    note?: string;
  }
</script>

<script lang="ts">
  // A lunar-ui drawer (drawer-end) holding a stack of menu pages: the player's captions and
  // settings menus and the details "More" menu. Back pops a page, or closes on the first one.
  import { tick, untrack } from "svelte";
  import { pushHandler } from "../input";
  import { focusFirstSoon } from "../nav";
  import Icon from "./Icon.svelte";
  import Spinner from "./Spinner.svelte";
  import QrCode from "./QrCode.svelte";

  let { root, open = $bindable(false), onclose }: { root: () => MenuPage; open?: boolean; onclose?: () => void } = $props();

  // Each level keeps the factory that built it, so it can be rebuilt with fresh values.
  let stack = $state<{ make: () => MenuPage; page: MenuPage }[]>([]);
  let items = $state<MenuItem[] | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let el = $state<HTMLElement>();
  let previous: HTMLElement | null = null;
  let page = $derived(stack[stack.length - 1]?.page);

  $effect(() => {
    if (!open) return;
    untrack(() => {
      previous = document.activeElement as HTMLElement | null;
      show([{ make: root, page: root() }]);
    });
    return pushHandler((e) => {
      if (e.action !== "back") return false;
      back();
      return true;
    });
  });

  async function show(next: typeof stack, focus = true) {
    stack = next;
    error = null;
    const p = next[next.length - 1].page;
    if (typeof p.items === "function") {
      items = null;
      try {
        const loaded = await p.items();
        if (stack[stack.length - 1]?.page === p) items = loaded;
      } catch (e) {
        error = (e as Error).message;
        items = [];
      }
    } else items = p.items ?? [];
    await tick();
    if (focus && el) await focusFirstSoon(el);
  }

  function back() {
    if (stack.length > 1) show(stack.slice(0, -1));
    else close();
  }

  function close() {
    open = false;
    stack = [];
    onclose?.();
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }

  async function choose(it: MenuItem) {
    if (it.disabled || busy) return;
    if (it.page) {
      const make = it.page;
      return show([...stack, { make, page: make() }]);
    }
    if (!it.action) return;
    busy = true;
    error = null;
    try {
      const r = await it.action();
      if (r === "stay") {
        const top = stack[stack.length - 1];
        const focused = (document.activeElement as HTMLElement | null)?.dataset.focusId;
        await show([...stack.slice(0, -1), { make: top.make, page: top.make() }], false);
        el?.querySelector<HTMLElement>(`[data-focus-id="${focused}"]`)?.focus();
      } else if (r === "back") back();
      else close();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<div class={["drawer-scrim z-40", open && "drawer-scrim-open"]} data-open={open ? "" : undefined}></div>
<aside
  bind:this={el}
  class="drawer drawer-end z-41 w-[36rem] max-w-none gap-1 px-7 py-10"
  data-open={open ? "" : undefined}
  data-focus-trap={open ? "" : undefined}
  aria-hidden={!open}
  aria-label={page?.title}
>
  {#if page}
    <div class="mb-4 flex items-center gap-3 px-3">
      {#if stack.length > 1}<Icon name="back" size="1.5rem" />{/if}
      <h2 class="truncate text-[1.5rem] font-bold">{page.title}</h2>
    </div>
    {#if page.qr}
      <div class="flex flex-col items-center gap-3 py-4">
        <QrCode text={page.qr.url} class="size-64" />
        <p class="max-w-80 text-center text-on-surface-variant">{page.qr.caption}</p>
      </div>
    {/if}
    {#if page.facts}
      <dl class="mb-3 grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-1.5 px-3 text-[1.02rem]">
        {#each page.facts as [k, v] (k)}<dt class="text-dim">{k}</dt><dd class="break-words text-subtext">{v}</dd>{/each}
      </dl>
    {/if}
    {#if items === null}
      <Spinner size="3rem" />
    {:else}
      <div class="flex flex-col gap-1" data-scroll-y>
        {#each items as it (it.id)}
          <button
            class={[
              "group flex min-h-14 flex-none items-center gap-4 rounded-xl px-4 text-left transition-colors duration-100 focus:bg-inverse-surface focus:text-on-inverse-surface disabled:opacity-40",
              it.danger ? "text-error" : it.checked ? "text-on-surface" : "text-subtext",
            ]}
            data-focus-id="menu-{it.id}"
            data-autofocus={it.checked ? "" : undefined}
            disabled={it.disabled}
            onclick={() => choose(it)}
          >
            {#if it.checked !== undefined}
              <span class={["grid size-6 flex-none place-items-center", it.checked ? "text-primary group-focus:text-on-inverse-surface" : "opacity-0"]}>
                <Icon name="check" size="1.4rem" />
              </span>
            {:else if it.icon}
              <Icon name={it.icon} size="1.6rem" />
            {/if}
            <span class="min-w-0 flex-1 truncate py-2">{it.label}</span>
            {#if it.toggle !== undefined}
              <span
                class={[
                  "relative h-7 w-12 flex-none rounded-full transition-colors",
                  it.toggle ? "bg-primary" : "bg-surface-container-highest",
                ]}
              >
                <span class={["absolute top-1 size-5 rounded-full bg-white transition-[left]", it.toggle ? "left-6" : "left-1"]}></span>
              </span>
            {:else if it.detail}
              <span class="flex-none text-dim group-focus:text-on-inverse-surface">{it.detail}</span>
            {/if}
            {#if it.page}<Icon name="chevron-right" size="1.4rem" />{/if}
          </button>
        {/each}
        {#if !items.length && !page.facts && !page.qr && !error}<p class="px-4 py-3 text-dim">Nothing here.</p>{/if}
      </div>
    {/if}
    {#if page.note}<p class="mt-3 px-3 text-[0.95rem] text-dim">{page.note}</p>{/if}
    {#if error}<p class="mt-3 px-3 text-error">{error}</p>{/if}
  {/if}
</aside>
