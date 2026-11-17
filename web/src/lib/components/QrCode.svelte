<script lang="ts">
  import { encode } from "uqr";
  let { text, class: klass = "size-64" }: { text: string; class?: string } = $props();

  // One path of 1×1 squares; a quiet zone of 2 modules keeps phone cameras happy on dark UIs.
  let qr = $derived.by(() => {
    const { data, size } = encode(text, { ecc: "L", border: 2 });
    let d = "";
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
    return { d, size };
  });
</script>

<svg class="{klass} rounded-xl bg-white" viewBox="0 0 {qr.size} {qr.size}" shape-rendering="crispEdges" role="img" aria-label="QR code">
  <path d={qr.d} fill="#11111b" />
</svg>
