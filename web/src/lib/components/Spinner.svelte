<script lang="ts">
  let { size = "4rem", label = "" }: { size?: string; label?: string } = $props();
</script>

<div class="flex flex-col items-center gap-4 p-12">
  <div
    class="animate-spin rounded-full border-[0.35rem] border-white/15 border-t-primary [animation-duration:0.9s]"
    style:width={size}
    style:height={size}
  ></div>
  {#if label}<div class="text-on-surface-variant">{label}</div>{/if}
</div>
