<script lang="ts">
  import { api, isRecording, media, type Playback, type Video } from "../ganymede/api";
  import { ganymede } from "../ganymede/source.svelte";
  import { router } from "../router.svelte";
  import { clock, date, duration, typeLabel } from "../format";
  import Icon from "../components/Icon.svelte";
  import Btn from "../components/Btn.svelte";
  import Spinner from "../components/Spinner.svelte";
  import Backdrop from "../components/Backdrop.svelte";
  import MenuDrawer from "../components/MenuDrawer.svelte";
  import { ganymedeMoreMenu } from "../itemMenus";
  import { invalidateGanymede } from "../ganymede/api";

  let { id }: { id: string } = $props();
  let more = $state(false);
  let video = $state<Video | null>(null);
  let pb = $state<Playback | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    try {
      const [v, p] = await Promise.all([api.video(id), ganymede.fetchProgress(id)]);
      video = v;
      pb = p && p.time ? p : null;
    } catch (e) {
      error = (e as Error).message;
    }
  }
  load();

  let finished = $derived(ganymede.progress[id]?.status === "finished" || pb?.status === "finished");
  let resumeAt = $derived(pb && pb.status !== "finished" && pb.time > 15 ? pb.time : 0);
  let live = $derived(!!video && isRecording(video.status));

  const play = (offset = 0) => router.push({ name: "player", source: "ganymede", id, offset });

  async function toggleWatched() {
    if (finished) {
      await ganymede.clear(id);
      pb = null;
    } else {
      await ganymede.setStatus(id, "finished");
      pb = { ...(pb ?? { id: "", vod_id: id, time: 0, updated_at: "" }), status: "finished" };
    }
  }
</script>

{#if error}
  <div class="page"><div class="empty-state">Couldn't load video: {error}</div></div>
{:else if !video}
  <div class="page"><Spinner /></div>
{:else}
  <div class="absolute inset-0 overflow-hidden" data-scroll-y>
    <Backdrop src={media(video.thumbnail_path || video.web_thumbnail_path)} />
    <div class="relative max-w-328 pt-48 pr-16 pb-20 pl-12">
      {#if video.edges?.channel}<div class="mb-1.5 text-[1.25rem] font-bold text-primary">{video.edges.channel.display_name}</div>{/if}
      <h1 class="line-clamp-2 text-[3.2rem] leading-[1.12] font-extrabold tracking-tight">{video.title}</h1>
      <div class="mt-3.5 flex flex-wrap gap-x-6 gap-y-1.5 text-[1.15rem] text-subtext">
        {#if live}<span class="font-bold text-error">● Recording</span>{/if}
        <span>{typeLabel(video.type)}</span>
        <span>{date(video.streamed_at)}</span>
        <span>{duration(video.duration)}</span>
        {#if video.resolution}<span>{video.resolution}</span>{/if}
        {#if video.views}<span>{video.views.toLocaleString()} views</span>{/if}
        {#if finished}<span class="text-primary">Watched</span>{/if}
      </div>

      {#if resumeAt}
        <div class="mt-6 flex items-center gap-4 text-on-surface-variant">
          <div class="h-[0.35rem] w-96 overflow-hidden rounded-full bg-white/20">
            <div class="h-full bg-primary" style:width="{Math.min(100, (resumeAt / video.duration) * 100)}%"></div>
          </div>
          <span>{clock(video.duration - resumeAt)} left</span>
        </div>
      {/if}

      <div class="mt-8 flex flex-wrap gap-4" data-focus-group>
        {#if resumeAt}
          <Btn variant="filled" data-autofocus="" data-focus-id="gv-resume" onclick={() => play(resumeAt)}><Icon name="play" /> Resume</Btn>
          <Btn data-focus-id="gv-start" onclick={() => play(0)}><Icon name="restart" /> Restart</Btn>
        {:else}
          <Btn variant="filled" data-autofocus="" data-focus-id="gv-play" onclick={() => play(0)}><Icon name="play" /> {live ? "Watch live" : "Play"}</Btn>
        {/if}
        {#if ganymede.user}
          <Btn data-focus-id="gv-watched" onclick={toggleWatched}>
            <Icon name={finished ? "restart" : "check"} />
            {finished ? "Mark as unwatched" : "Mark as watched"}
          </Btn>
        {/if}
        <Btn data-focus-id="gv-more" onclick={() => (more = true)}><Icon name="more" /> More</Btn>
      </div>

      {#if video.edges?.chapters?.length}
        <h2 class="mt-11 mb-4 text-[1.5rem] font-bold">Chapters</h2>
        <div class="flex max-w-200 flex-col gap-1" data-focus-group>
          {#each video.edges.chapters as c (c.id)}
            <button
              class="group flex h-[3.4rem] items-center gap-6 rounded-xl px-5 text-left text-on-surface-variant focus:bg-inverse-surface focus:text-on-inverse-surface"
              data-focus-id="gv-ch-{c.id}"
              data-focus-top
              onclick={() => play(c.start)}
            >
              <span class="w-24 flex-none text-dim tabular-nums group-focus:text-on-inverse-surface">{clock(c.start)}</span>
              <span class="truncate">{c.title || "Untitled"}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
{#if video}
  <MenuDrawer root={ganymedeMoreMenu(video, finished, toggleWatched, async () => (invalidateGanymede(), await load()))} bind:open={more} />
{/if}
