<script lang="ts">
  // "Something went wrong": what happened, plus a QR code that opens a pre-filled GitHub issue
  // on a phone. With a token saved in Settings it can also file the issue directly.
  import { tick } from "svelte";
  import { reporter } from "../report.svelte";
  import { focusFirst } from "../nav";
  import Btn from "./Btn.svelte";
  import Icon from "./Icon.svelte";
  import QrCode from "./QrCode.svelte";

  let root = $state<HTMLElement>();
  let r = $derived(reporter.current!);
  let link = $derived(r.issueUrl ?? reporter.issueLink(r));
  let previous: HTMLElement | null = null;

  $effect(() => {
    previous = document.activeElement as HTMLElement | null;
    tick().then(() => root && focusFirst(root));
    return () => previous?.isConnected && previous.focus({ preventScroll: true });
  });

  const headline: Record<string, string> = {
    native: "SERAPH closed unexpectedly last time",
    screen: "This screen ran into a problem",
    manual: "Report a problem",
  };
</script>

<div class="scrim absolute inset-0 z-90 grid place-items-center" bind:this={root} data-focus-trap role="alertdialog" aria-label="Error report">
  <div class="surface-container-low elevation-3 flex w-[72rem] gap-10 rounded-[1.6rem] p-10">
    <div class="flex flex-none flex-col items-center gap-3">
      <QrCode text={link} class="size-80" />
      <span class="max-w-80 text-center text-[0.95rem] text-on-surface-variant">
        {r.issueUrl ? "Scan to open the issue" : "Scan to report it on GitHub"}
      </span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col">
      <div class="flex items-center gap-3 text-error"><Icon name="info" size="2rem" /><span class="text-[1.1rem] font-bold">Error</span></div>
      <h2 class="mt-2 text-[2rem] leading-tight font-bold">{headline[r.kind] ?? "Something went wrong"}</h2>
      {#if r.kind !== "manual"}
        <pre class="surface-container-lowest mt-4 max-h-44 overflow-hidden rounded-xl p-4 text-[0.95rem] leading-snug whitespace-pre-wrap text-on-surface-variant">{r.message}
{r.stack.split("\n").slice(0, 3).join("\n")}</pre>
      {:else}
        <p class="mt-4 text-on-surface-variant">Scan the code to open a new issue with this TV's details filled in, then describe what happened.</p>
      {/if}
      <p class="mt-4 text-[0.95rem] text-dim">
        Reports go to github.com/{reporter.repo} and never include tokens, account names or server addresses. Reference: {r.fingerprint}
      </p>
      {#if reporter.fileError}<p class="mt-2 text-error">{reporter.fileError}</p>{/if}
      <div class="mt-auto flex gap-4 pt-6" data-focus-group>
        {#if reporter.hasToken && !r.issueUrl}
          <Btn variant="filled" data-autofocus="" disabled={reporter.filing} onclick={() => reporter.file(r)}>
            <Icon name="check" />
            {reporter.filing ? "Filing…" : "File it now"}
          </Btn>
        {:else if r.issueUrl}
          <span class="flex items-center gap-2 font-semibold text-success"><Icon name="check" /> Filed on GitHub</span>
        {/if}
        <Btn data-autofocus={reporter.hasToken && !r.issueUrl ? undefined : ""} onclick={() => reporter.dismiss()}>Close</Btn>
      </div>
    </div>
  </div>
</div>
