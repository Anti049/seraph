<script lang="ts">
  import { reporter, DEFAULT_REPO } from "#lib/report.svelte.ts";
  import { onOff } from "#lib/components/settings/options.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  let repoInput = $state(reporter.repo === DEFAULT_REPO ? "" : reporter.repo);
  let tokenInput = $state("");
  let reportNote = $state<string | null>(null);
  async function saveToken(e: Event) {
    e.preventDefault();
    reporter.setToken(tokenInput);
    tokenInput = "";
    reportNote = await reporter.verify();
  }
</script>

<PageHeader title="Error reports" />
<Note text="When something breaks, SERAPH shows a QR code that opens a pre-filled GitHub issue on your phone. Reports never include tokens, account names or server addresses." />
<form class="mb-4 flex items-center gap-3" onsubmit={(e) => (e.preventDefault(), reporter.setRepo(repoInput), (reportNote = `Reports go to ${reporter.repo}.`))}>
  <span class="w-88 flex-none text-on-surface-variant">GitHub repository</span>
  <input class="field h-[2.8rem] w-xl text-[1.15rem]" bind:value={repoInput} placeholder={DEFAULT_REPO} autocapitalize="off" spellcheck="false" />
  <button class="chip" type="submit">Save</button>
</form>
<form class="mb-4 flex items-center gap-3" onsubmit={saveToken}>
  <span class="w-88 flex-none text-on-surface-variant">Token for automatic filing</span>
  <input
    class="field h-[2.8rem] w-xl text-[1.15rem]"
    bind:value={tokenInput}
    type="password"
    placeholder={reporter.hasToken ? "•••••••• saved on this TV" : "Optional: fine-grained token, Issues: write"}
    autocapitalize="off"
    spellcheck="false"
  />
  <button class="chip" type="submit">Save</button>
  {#if reporter.hasToken}<button class="chip" type="button" onclick={() => (reporter.setToken(""), (reportNote = "Token removed."))}>Remove</button>{/if}
</form>
{#if reporter.hasToken}
  <Choice label="File reports automatically" opts={onOff} value={reporter.auto} pick={(v) => reporter.setAuto(v)} />
{/if}
{#if reportNote}<p class="mb-3 text-primary">{reportNote}</p>{/if}
<p class="text-dim">
  Create the token at github.com → Settings → Developer settings → Fine-grained tokens, limited to {reporter.repo} with only “Issues: Read and write”.
  It's stored on this TV only. Repeats of the same error are added to the existing issue.
</p>
<div class="mt-5 flex gap-4" data-focus-group>
  <Btn onclick={() => reporter.report(new Error("Manual report from Settings"), "manual")}><Icon name="info" /> Report a problem</Btn>
</div>
