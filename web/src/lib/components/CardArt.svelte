<script lang="ts">
  // Shared artwork box for cards: aspect box, fallback title, progress bar and the focus ring.
  import type { Snippet } from "svelte";
  let {
    src,
    fallback,
    ratio = "wide",
    progress = 0,
    children,
  }: { src?: string; fallback: string; ratio?: "wide" | "poster"; progress?: number; children?: Snippet } = $props();
  let failed = $state(false);
</script>

<div
  class={[
    "relative overflow-hidden rounded-[0.6rem] bg-linear-150 from-surface-container-high to-surface-container group-focus:shadow-ring",
    ratio === "poster" ? "pt-[150%]" : "pt-[56.25%]",
  ]}
>
  {#if src && !failed}
    <img {src} alt="" loading="lazy" decoding="async" class="absolute inset-0 size-full object-cover" onerror={() => (failed = true)} />
  {:else}
    <div class="absolute inset-0 flex size-full items-center justify-center p-4 text-center font-semibold text-on-surface-variant">
      <span class="line-clamp-3">{fallback}</span>
    </div>
  {/if}
  {@render children?.()}
  {#if progress > 0}
    <div class="absolute inset-x-0 bottom-0 h-[0.32rem] bg-white/20">
      <div class="h-full bg-primary" style:width="{progress * 100}%"></div>
    </div>
  {/if}
</div>
