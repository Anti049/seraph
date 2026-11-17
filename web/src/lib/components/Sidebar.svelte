<script lang="ts">
  import Logo from "./Logo.svelte";
  import Icon from "./Icon.svelte";
  import { router, type Route } from "../router.svelte";
  import { focusFirstSoon, heldFocus, holdFocus } from "../nav";
  import { account } from "../account.svelte";
  import { ganymede } from "../ganymede/source.svelte";
  import { libraries } from "../libraries.svelte";
  import { profiles } from "../profiles.svelte";
  import { gate } from "../gate.svelte";
  import { tick } from "svelte";
  import Avatar from "./Avatar.svelte";

  $effect(() => {
    account.phase;
    account.connected.length;
    libraries.load();
  });
  let plexOn = $derived(account.ready && libraries.sections.length > 0);

  interface Item {
    id: string;
    label: string;
    sublabel?: string;
    icon: string;
    route: Route;
    group?: string;
  }
  let items = $derived<Item[]>([
    { id: "search", label: "Search", icon: "search", route: { name: "search" } },
    { id: "home", label: "Home", icon: "home", route: { name: "home" } },
    // Plex: the libraries chosen in Settings, in the chosen order, then the overflow menu.
    ...libraries.visible.map((l, i) => ({
      id: `lib-${l.id}`,
      label: l.section.title,
      sublabel: l.serverName ? l.serverName : undefined,
      icon: l.icon,
      route: { name: "library", server: l.section.server, key: l.section.key, title: l.section.title, type: l.section.type } as Route,
      group: i === 0 ? "Plex" : undefined,
    })),
    ...(plexOn
      ? [{ id: "libraries", label: "All libraries", icon: "apps", route: { name: "libraries" } as Route, group: libraries.visible.length ? undefined : "Plex" }]
      : []),
    ...(ganymede.phase === "ready"
      ? [
          { id: "g-channels", label: "Channels", icon: "channels", route: { name: "g-channels" } as Route, group: "Ganymede" },
          { id: "g-playlists", label: "Playlists", icon: "playlists", route: { name: "g-playlists" } as Route },
          // The queue needs the archiver role (or higher) or an API key.
          ...((ganymede.user && ganymede.user.role !== "user") || ganymede.apiKey
            ? [{ id: "g-queue", label: "Queue", icon: "queue", route: { name: "g-queue" } as Route }]
            : []),
        ]
      : []),
    { id: "settings", label: "Settings", icon: "settings", route: { name: "settings" } },
  ]);

  let open = $state(false);

  // Moving through the rail with the D-pad opens each screen behind it while focus stays in the
  // rail (holdFocus: the new screen puts focus back here instead of taking it). Debounced so
  // holding Down doesn't load every screen on the way. Entering the rail from the page never
  // navigates. The hold ends when focus moves to something outside the rail.
  let nav = $state<HTMLElement>();
  let pending: ReturnType<typeof setTimeout> | undefined;
  function follow(e: FocusEvent, it: Item) {
    holdFocus(e.currentTarget as HTMLElement);
    const from = e.relatedTarget;
    if (!(from instanceof Node && nav?.contains(from))) return;
    clearTimeout(pending);
    pending = setTimeout(() => router.root(it.route, { keepFocus: true }), 250);
  }
  function left(e: FocusEvent) {
    const to = e.relatedTarget;
    if (to instanceof Node && nav?.contains(to)) return;
    // Focus going nowhere (a navigation blurring it) keeps the hold; going somewhere ends it.
    if (to) holdFocus(null);
    open = !to && !!heldFocus();
  }
  $effect(() => () => {
    clearTimeout(pending);
    if (heldFocus() && nav?.contains(heldFocus())) holdFocus(null);
  });

  // OK on an item: go there (if not already) and hand focus to the screen.
  function choose(e: MouseEvent, it: Item) {
    clearTimeout(pending);
    holdFocus(null);
    const main = (e.currentTarget as HTMLElement).closest(".scaffold")?.querySelector("main") ?? undefined;
    (e.currentTarget as HTMLElement).blur();
    router.root(it.route);
    // If the screen is already showing, screenFocus won't run again: focus it here.
    void tick().then(() => {
      if (main && (document.activeElement === document.body || !document.activeElement)) void focusFirstSoon(main);
    });
  }

  let active = $derived.by(() => {
    const r = router.stack[0].route;
    if (r.name === "library") return `lib-${r.server}:${r.key}`;
    if (r.name === "g-channel") return "g-channels";
    if (r.name === "g-playlist") return "g-playlists";
    return r.name;
  });
</script>

<!--
  lunar-ui sidebar: a `sidebar-rail` (icons) that becomes a `sidebar` (icons + labels) while it
  holds focus. Labels fade with lunar-ui's own --sidebar-rail switch; sizes come from the
  tv-scaffold knobs (--sidebar-rail-width, --sidebar-width, --sidebar-icon-size, --sidebar-padding).
-->
<nav
  class={[
    "z-20 gap-2 overflow-y-scroll duration-200 ease-tv items-center pt-4 px-2",
    open ? "sidebar elevation-3" : "sidebar-rail hover:sidebar",
  ]}
  onfocusin={() => (open = true)}
  onfocusout={left}
  bind:this={nav}
  data-focus-group
  data-focus-lock="y"
  data-focus-enter="left"
>
  <div class="mb-10 flex aspect-square w-16 flex-row" aria-hidden="true">
    <Logo class="w-full" />
  </div>
  {#each items as it (it.id)}
    {#if it.group}
      <!-- a hairline while it's a rail, a section label once it opens -->
      <div
        class={[
          "nav-heading",
          // open ? "mt-4 mb-1 h-[1.4rem] text-dim" : "my-3 h-[0.1rem] bg-outline-variant text-transparent",
        ]}
      >
        {it.group}
      </div>
    {/if}
    <button
      class={[
        "nav-item-plain nav-item h-12 sidebar-rail:pl-7.5",
      ]}
      data-focus-id="nav-{it.id}"
      data-focus-default={active === it.id ? "" : undefined}
      onfocus={(e) => follow(e, it)}
      onclick={(e) => choose(e, it)}
      aria-current={active.startsWith(it.id) ? "page" : undefined}
    >
      <Icon name={it.icon} class="sidebar-rail:self-center" />
      <div class="nav-label flex flex-col">
        <span class="font-semibold text-body-medium">{it.label}</span>
        {#if it.sublabel}
          <span class="text-on-surface-variant text-caption-small -mt-1">{it.sublabel}</span>
        {/if}
      </div>
    </button>
  {/each}
    <!-- <button
      class="nav-item relative mt-auto h-[4.2rem] flex-none rounded-2xl text-[1.3rem] font-semibold text-dim transition-colors duration-150 focus:bg-inverse-surface focus:text-on-inverse-surface"
      data-focus-id="nav-profile"
      onclick={() => gate.open({ name: "profiles" })}
    >
      <Avatar name={profiles.active.name} color={profiles.active.color} class="size-[1.9rem] text-[1rem]" />
      <span class="sidebar-label">{profiles.active.name} · Switch profile</span>
    </button> -->
</nav>
