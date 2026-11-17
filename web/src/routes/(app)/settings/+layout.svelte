<script lang="ts">
  // Settings: a second sidebar of sections; each section is its own route. Moving through the
  // list opens that section (replacing it in history, so Back leaves Settings in one press).
  import { page } from "$app/state";
  import { router, type SettingsSection } from "#lib/router.svelte.ts";
  import { SECTIONS } from "#lib/settingsSections.ts";
  import { libraries } from "#lib/libraries.svelte.ts";
  import Icon from "#lib/components/Icon.svelte";

  let { children } = $props();
  libraries.load();

  let sections = $derived(SECTIONS.filter((t) => !t.show || t.show()));
  // From SvelteKit's page (updated before render), not the router stack (updated after).
  let current = $derived((page.route.id?.split("/").pop() ?? "profiles") as SettingsSection);

  function open(id: (typeof SECTIONS)[number]["id"]) {
    if (id !== current) router.replace({ name: "settings", section: id });
  }
</script>

<div class="page flex gap-10 pl-6" data-part="settings">
  <nav
    class="sidebar w-[19rem] flex-none gap-1 rounded-3xl bg-surface-container-low px-3 py-5 [--sidebar-icon-size:1.6rem] [--sidebar-padding:0.75rem]"
    aria-label="Settings sections"
    data-focus-group
    data-focus-lock="y"
    data-focus-enter="left right"
  >
    <h1 class="mb-3 px-4 text-[1.6rem] font-bold">Settings</h1>
    {#each sections as t (t.id)}
      <button
        class={[
          "nav-item h-[3.6rem] flex-none rounded-xl text-[1.15rem] font-semibold transition-colors duration-150 focus:bg-inverse-surface focus:text-on-inverse-surface",
          current === t.id ? "bg-surface-container-high text-on-surface" : "text-dim",
        ]}
        data-focus-id="set-{t.id}"
        data-focus-default={current === t.id ? "" : undefined}
        data-autofocus={current === t.id ? "" : undefined}
        onfocus={() => open(t.id)}
        onclick={() => open(t.id)}
      >
        <Icon name={t.icon} size="1.6rem" />
        <span class="nav-label">{t.label}</span>
      </button>
    {/each}
  </nav>
  <div class="min-w-0 flex-1 overflow-hidden" data-scroll-y>
    <div class="pb-24">
      {@render children()}
    </div>
  </div>
</div>
