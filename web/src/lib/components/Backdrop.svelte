<script lang="ts">
  // Fixed artwork on the right, faded into the surface on the left and bottom.
  let { src, height = "100%", fade = 45 }: { src: string; height?: string; fade?: number } = $props();
</script>

<img class="fixed top-0 right-0 w-[74%] animate-fade-in object-cover" style:height {src} alt="" />
<div
  class="fixed inset-0"
  style:background="linear-gradient(90deg, var(--theme-color-surface) 30%, rgb(30 30 46 / 0.65) 60%, rgb(30 30 46 / 0.2)), linear-gradient(0deg, var(--theme-color-surface) {fade -
    45}%, rgb(30 30 46 / 0) {fade}%)"
></div>
