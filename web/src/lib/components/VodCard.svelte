<script lang="ts">
  import { isRecording, media, type Video } from "../ganymede/api";
  import { ganymede } from "../ganymede/source.svelte";
  import { duration as fmt, relative, typeLabel } from "../format";
  import { router } from "../router.svelte";
  import Icon from "./Icon.svelte";
  import CardArt from "./CardArt.svelte";
  import CardMeta from "./CardMeta.svelte";

  let {
    video,
    focusId,
    showChannel = true,
    width,
    onfocus,
  }: { video: Video; focusId: string; showChannel?: boolean; width?: string; onfocus?: () => void } = $props();

  let frac = $derived(ganymede.fraction(video.id, video.duration));
  let finished = $derived(ganymede.progress[video.id]?.status === "finished");
  let live = $derived(isRecording(video.status));
  let thumb = $derived(video.web_thumbnail_path || video.thumbnail_path);
  let sub = $derived(`${showChannel && video.edges?.channel ? `${video.edges.channel.display_name} · ` : ""}${relative(video.streamed_at)}`);
  const tag = "badge badge-filled badge-surface absolute! rounded-[0.35rem] px-2 py-0.5 text-[0.9rem] font-semibold";
</script>

<button
  class="group relative w-[23rem] flex-none origin-[center_35%] text-left transition duration-[180ms] ease-tv focus:z-2 focus:scale-108"
  style:width
  data-focus-id={focusId}
  onclick={() => router.push({ name: "g-video", id: video.id })}
  {onfocus}
>
  <CardArt src={thumb ? media(thumb) : undefined} fallback={video.title} progress={finished ? 0 : frac}>
    {#if live}
      <span class="{tag} badge-error top-2 left-2">● REC</span>
    {:else if video.type !== "archive"}
      <span class="{tag} top-2 left-2">{typeLabel(video.type)}</span>
    {/if}
    {#if finished}
      <span class="badge badge-filled badge-surface tv-badge absolute! top-2 right-2 px-0 text-primary" aria-label="Watched">
        <Icon name="check" size="1.2rem" />
      </span>
    {:else}
      <span class="{tag} right-2 bottom-3">{fmt(video.duration)}</span>
    {/if}
  </CardArt>
  <CardMeta title={video.title} {sub} />
</button>
