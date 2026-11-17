<script lang="ts">
  let { name, color, class: klass = "size-24 text-[2.6rem]" }: { name: string; color: string; class?: string } = $props();
  const initial = $derived((name.trim()[0] ?? "?").toUpperCase());
</script>

<span class="grid flex-none place-items-center rounded-full font-extrabold text-on-primary {klass}" style:background={color}>{initial}</span>
