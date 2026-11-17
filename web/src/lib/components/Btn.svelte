<script lang="ts">
  // lunar-ui's Button at TV scale. `filled` = primary action, `tonal` = everything else.
  import { Button } from "@anti049/lunar-ui-svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  interface Props extends HTMLButtonAttributes {
    variant?: "filled" | "tonal" | "outlined" | "text";
    class?: string;
  }
  let { variant = "tonal", class: klass = "", children, ...rest }: Props = $props();
</script>

<Button {variant} class="btn {variant === 'filled' ? 'button-primary' : ''} {klass}" {...rest}>{@render children?.()}</Button>
