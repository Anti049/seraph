<script lang="ts" module>
  import type { Channel } from "../ganymede/api";
  // Kept between visits so the list is there instantly.
  let cached: Channel[] | null = null;
</script>

<script lang="ts">
  // Second sidebar on Ganymede channel pages: every channel, plus "All channels".
  import { api, media } from "../ganymede/api";
  import { router } from "../router.svelte";
  import Icon from "./Icon.svelte";

  let { active }: { active: string | null } = $props();
  let channels = $state<Channel[]>(cached ?? []);

  api
    .channels()
    .then((c) => (channels = cached = (c ?? []).sort((a, b) => a.display_name.localeCompare(b.display_name))))
    .catch(() => {});

  const item =
    "nav-item nav-item-plain h-[3.6rem] flex-none rounded-xl text-[1.1rem] font-semibold transition-colors duration-150 focus:bg-inverse-surface focus:text-on-inverse-surface";
</script>

<nav
  class="sidebar w-80 flex-none gap-1 overflow-hidden rounded-3xl bg-surface-container-low px-3 py-5 [--sidebar-icon-size:2.2rem] [--sidebar-padding:0.75rem]"
  aria-label="Channels"
  data-focus-group
  data-focus-lock="y"
  data-focus-enter="left right"
  data-scroll-y
>
  <h1 class="mb-3 px-4 text-[1.6rem] font-bold">Channels</h1>
  <button
    class={[item, active === null ? "bg-surface-container-high text-on-surface" : "text-dim"]}
    data-focus-id="gch-rail-all"
    data-focus-default={active === null ? "" : undefined}
    onclick={() => router.replace({ name: "g-channels" })}
  >
    <Icon name="apps" size="2.2rem" />
    <span class="nav-label">All channels</span>
  </button>
  {#each channels as c (c.id)}
    <button
      class={[item, active === c.id ? "bg-surface-container-high text-on-surface" : "text-dim"]}
      data-focus-id="gch-rail-{c.id}"
      data-focus-default={active === c.id ? "" : undefined}
      onclick={() => router.replace({ name: "g-channel", id: c.id, title: c.display_name })}
    >
      <span class="grid size-[2.2rem] flex-none place-items-center overflow-hidden rounded-full bg-surface-container-high text-[1rem]">
        {#if c.image_path}<img class="size-full object-cover" src={media(c.image_path)} alt="" loading="lazy" />{:else}{c.display_name[0]}{/if}
      </span>
      <span class="nav-label">{c.display_name}</span>
    </button>
  {/each}
</nav>
