<script lang="ts">
  let { title, sub = "" }: { title: string; sub?: string } = $props();
</script>

<div class="px-0.5 pt-3">
  <div class="truncate text-[1.1rem] font-semibold text-on-surface group-focus:text-white">{title}</div>
  <div class="mt-0.5 min-h-[1.3em] truncate text-[0.95rem] text-on-surface-variant">{sub}</div>
</div>
