<script lang="ts">
  import PageHeader from "../components/PageHeader.svelte";
  // Overflow menu: every Plex library, including ones hidden from the side menu.
  import { libraries } from "../libraries.svelte";
  import { router } from "../router.svelte";
  import Icon from "../components/Icon.svelte";

  libraries.load();
</script>

<div class="page" data-scroll-y>
  <PageHeader title="All libraries" subtitle="Plex" />
  <div class="grid grid-cols-4 gap-6">
    {#each libraries.all as l (l.id)}
      <button
        class="group flex flex-col items-start gap-2 rounded-[1.2rem] bg-surface-container p-7 text-left text-primary transition duration-150 ease-tv focus:scale-104 focus:bg-on-surface focus:text-primary-dim"
        data-focus-id="alllib-{l.id}"
        onclick={() => router.push({ name: "library", server: l.section.server, key: l.section.key, title: l.section.title, type: l.section.type })}
      >
        <Icon name={l.icon} size="3.2rem" />
        <span data-part="lib-name" class="mt-2.5 max-w-full truncate text-[1.5rem] font-bold text-on-surface group-focus:text-surface">{l.section.title}</span>
        <span class="text-on-surface-variant group-focus:text-surface">
          {l.section.type === "show" ? "TV shows" : "Movies"}{l.serverName ? ` · ${l.serverName}` : ""}{l.hidden ? " · hidden from menu" : ""}
        </span>
      </button>
    {/each}
  </div>
  <p class="mt-10 text-dim">Choose which libraries appear in the side menu, their order and icons in Settings → Plex libraries.</p>
</div>
