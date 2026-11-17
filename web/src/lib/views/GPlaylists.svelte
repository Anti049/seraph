<script lang="ts">
  import PageHeader from "../components/PageHeader.svelte";
  import { api, media, type Playlist } from "../ganymede/api";
  import { router } from "../router.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Icon from "../components/Icon.svelte";

  let lists = $state<Playlist[] | null>(null);
  let error = $state<string | null>(null);

  api
    .playlists()
    .then((p) => (lists = p ?? []))
    .catch((e) => (error = (e as Error).message));
</script>

<div class="page" data-scroll-y>
  <PageHeader title="Playlists" subtitle="Ganymede" />
  {#if error}
    <div class="empty-state">Couldn't load playlists: {error}</div>
  {:else if !lists}
    <Spinner />
  {:else if !lists.length}
    <div class="empty-state">No playlists. Create them in the Ganymede web UI.</div>
  {:else}
    <div class="grid grid-cols-4 gap-x-7 gap-y-9">
      {#each lists as p (p.id)}
        <button
          class="group text-left transition duration-[180ms] ease-tv focus:scale-106"
          data-focus-id="gpl-{p.id}"
          onclick={() => router.push({ name: "g-playlist", id: p.id, title: p.name })}
        >
          <div class="relative overflow-hidden rounded-card bg-linear-135 from-surface-container-high to-surface-container pt-[56.25%] group-focus:shadow-ring">
            <div class="absolute inset-0 grid place-items-center text-dim">
              {#if p.thumbnail_path}<img class="size-full object-cover" src={media(p.thumbnail_path)} alt="" loading="lazy" />{:else}<Icon
                  name="playlists"
                  size="4rem"
                />{/if}
            </div>
          </div>
          <div class="mt-3 truncate text-[1.25rem] font-semibold">{p.name}</div>
          {#if p.description}<div class="truncate text-base text-on-surface-variant">{p.description}</div>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
