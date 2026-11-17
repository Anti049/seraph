<script lang="ts">
  import { settings } from "#lib/settings.svelte.ts";
  import { onOff, volumes } from "#lib/components/settings/options.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
</script>

<PageHeader title="Interface" />
<Choice label="Menu sounds" opts={onOff} value={settings.sounds} pick={(v) => settings.set("sounds", v)} />
{#if settings.sounds}
  <Choice label="Sound volume" opts={volumes} value={settings.soundVolume} pick={(v) => settings.set("soundVolume", v)} />
{/if}
