<script lang="ts">
  import { reporter } from "#lib/report.svelte.ts";
  import { APP_VERSION, diagnostics } from "#lib/diagnostics.ts";
  import { relative } from "#lib/format.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";

  const env = diagnostics();
  const recent = $derived(reporter.recent);
</script>

<PageHeader title="About" subtitle="SERAPH {APP_VERSION}" />
<dl class="grid max-w-240 grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5">
  {#each env as [k, v] (k)}<dt class="text-dim">{k}</dt><dd class="text-subtext">{v}</dd>{/each}
</dl>
{#if recent.length}
  <h3 class="mt-7 mb-3 text-[1.2rem] font-semibold">Recent problems on this TV</h3>
  <div class="flex max-w-256 flex-col gap-2" data-focus-group>
    {#each recent as r (r.fingerprint)}
      <button class="tile flex items-center gap-4 px-5 py-3" onclick={() => (reporter.current = r)}>
        <span class="flex-1 truncate">{r.message}</span>
        <span class="text-[0.95rem] text-on-surface-variant">{relative(r.time)}</span>
      </button>
    {/each}
  </div>
{/if}
<p class="mt-6 text-dim">An independent client for Plex Media Server and Ganymede. Not affiliated with Plex Inc.</p>
