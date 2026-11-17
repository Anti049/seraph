<script lang="ts">
  // A line of explanatory text, optionally with an emphasised value and a status tag.
  let { text, strong, tag, bad = false }: { text: string; strong?: string; tag?: string; bad?: boolean } = $props();
</script>

<p class="mb-3 text-on-surface-variant">
  {text}{#if strong}<b class="text-on-surface">{strong}</b>{/if}
  {#if tag}<span class={["badge badge-tonal ml-2.5 inline-flex rounded-md px-2.5 py-0.5 text-[0.9rem]", bad ? "badge-error" : "badge-surface"]}>{tag}</span>{/if}
</p>
