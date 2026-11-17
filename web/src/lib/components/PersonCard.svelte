<script lang="ts">
  // Cast & crew: round photo, name, role.
  let { name, role = "", photo = "", focusId, onclick }: { name: string; role?: string; photo?: string; focusId: string; onclick?: () => void } = $props();
  let failed = $state(false);
  const initials = $derived(name.split(/\s+/).map((w) => w[0]).slice(0, 2).join(""));
</script>

<button class="group flex w-[9.5rem] flex-none flex-col items-center gap-2.5 text-center transition duration-150 ease-tv focus:scale-108" data-focus-id={focusId} {onclick}>
  <div class="grid size-[7.5rem] place-items-center overflow-hidden rounded-full bg-surface-container-high text-[2rem] font-bold text-on-surface-variant group-focus:shadow-ring">
    {#if photo && !failed}<img class="size-full object-cover" src={photo} alt="" loading="lazy" onerror={() => (failed = true)} />{:else}{initials}{/if}
  </div>
  <div class="w-full">
    <div class="truncate text-[1.02rem] font-semibold">{name}</div>
    {#if role}<div class="truncate text-[0.9rem] text-on-surface-variant">{role}</div>{/if}
  </div>
</button>
