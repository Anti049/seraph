<script lang="ts">
  // Captions drawn by SERAPH with YouTube's caption options: font, size, font colour/opacity,
  // background colour/opacity behind the text, window colour/opacity behind the whole block,
  // and character edge style.
  import { rgba, settings } from "../settings.svelte";
  import { fontStack, loadFont } from "../fonts";

  /** Lines to show; `raised` lifts them above the player controls. `scale` shrinks for previews. */
  let { lines, raised = false, scale = 1 }: { lines: string[]; raised?: boolean; scale?: number } = $props();

  $effect(() => loadFont(settings.subFont));

  const BASE_REM = 2.4; // 100%
  const BOTTOM = { low: 5, middle: 12, high: 22 };
  const EDGES: Record<string, string> = {
    none: "none",
    shadow: "0.06em 0.06em 0.12em rgba(0,0,0,.95), 0 0 0.2em rgba(0,0,0,.6)",
    raised: "-0.03em -0.03em 0 rgba(255,255,255,.35), 0.05em 0.05em 0 #000, 0.07em 0.07em 0 #000",
    depressed: "0.03em 0.03em 0 rgba(255,255,255,.35), -0.05em -0.05em 0 #000, -0.07em -0.07em 0 #000",
    outline:
      "-0.06em -0.06em 0 #000, 0.06em -0.06em 0 #000, -0.06em 0.06em 0 #000, 0.06em 0.06em 0 #000, 0 0.07em 0 #000, 0 -0.07em 0 #000, 0.07em 0 0 #000, -0.07em 0 0 #000",
  };

  let textStyle = $derived(
    [
      `font-family:${fontStack(settings.subFont)}`,
      `font-size:${((BASE_REM * settings.subScale) / 100) * scale}rem`,
      `color:${rgba(settings.subColor, settings.subFontOpacity)}`,
      `background:${rgba(settings.subBgColor, settings.subBgOpacity)}`,
      `text-shadow:${EDGES[settings.subEdge] ?? "none"}`,
    ].join(";"),
  );
  let windowBg = $derived(rgba(settings.subWindowColor, settings.subWindowOpacity));
  let bottom = $derived(`${(raised ? Math.max(BOTTOM[settings.subPosition], 16) : BOTTOM[settings.subPosition]) * scale}%`);
</script>

{#if lines.length}
  <div data-part="subs" class="pointer-events-none absolute inset-x-[6%] z-3 flex justify-center transition-[bottom] duration-200" style:bottom>
    <div class="flex flex-col items-center gap-[0.2em] rounded-[0.3em] p-[0.2em]" style:background={windowBg}>
      {#each lines as line, i (i)}
        <div class="flex flex-col items-center">
          {#each line.split("\n") as l, j (j)}
            <span data-part="sub-line" class="px-[0.3em] text-center leading-[1.28] font-semibold whitespace-pre-wrap" style={textStyle}>{l}</span>
          {/each}
        </div>
      {/each}
    </div>
  </div>
{/if}
