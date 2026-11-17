<script lang="ts">
  import { api, media, type Channel } from "../ganymede/api";
  import { router } from "../router.svelte";
  import Spinner from "../components/Spinner.svelte";
  import PageHeader from "../components/PageHeader.svelte";

  let channels = $state<Channel[] | null>(null);
  let error = $state<string | null>(null);

  api
    .channels()
    .then((c) => (channels = (c ?? []).sort((a, b) => a.display_name.localeCompare(b.display_name))))
    .catch((e) => (error = (e as Error).message));
</script>

<div class="min-w-0 flex-1 overflow-hidden" data-scroll-y>
    <PageHeader title="All channels" subtitle="Ganymede" />
    {#if error}
      <div class="empty-state">Couldn't load channels: {error}</div>
    {:else if !channels}
      <Spinner />
    {:else if !channels.length}
      <div class="empty-state">No channels yet.</div>
    {:else}
      <div class="grid grid-cols-5 gap-x-6 gap-y-10 pb-24">
        {#each channels as c (c.id)}
          <button
            class="group flex flex-col items-center gap-4 rounded-card px-2 py-4 transition duration-[180ms] ease-tv focus:scale-108"
            data-focus-id="gch-{c.id}"
            onclick={() => router.push({ name: "g-channel", id: c.id, title: c.display_name })}
          >
            <div
              class="grid size-40 place-items-center overflow-hidden rounded-full bg-surface-container-high text-[3.4rem] font-bold text-on-surface-variant group-focus:shadow-ring"
            >
              {#if c.image_path}<img class="size-full object-cover" src={media(c.image_path)} alt="" loading="lazy" />{:else}{c.display_name[0]}{/if}
            </div>
            <div class="max-w-full truncate text-[1.2rem] font-semibold text-on-surface-variant group-focus:text-on-surface">{c.display_name}</div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
