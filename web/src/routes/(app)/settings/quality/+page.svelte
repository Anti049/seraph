<script lang="ts">
  import { settings } from "#lib/settings.svelte.ts";
  import { qualities } from "#lib/components/settings/options.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
</script>

<PageHeader title="Video quality" />
<Choice label="At home" opts={qualities} value={settings.quality} pick={(v) => settings.set("quality", v)} />
<Choice label="Away from home" opts={qualities} value={settings.remoteQuality} pick={(v) => settings.set("remoteQuality", v)} />
<p class="text-dim">“Original” plays the file untouched when this TV supports it, and has the server convert it otherwise.</p>
