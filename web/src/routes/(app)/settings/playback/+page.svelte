<script lang="ts">
  import { settings } from "#lib/settings.svelte.ts";
  import { onOff, steps } from "#lib/components/settings/options.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
</script>

<PageHeader title="Playback" />
<Choice label="Play next episode automatically" opts={onOff} value={settings.autoplayNext} pick={(v) => settings.set("autoplayNext", v)} />
<Choice label="Skip intros automatically" opts={onOff} value={settings.autoSkipIntro} pick={(v) => settings.set("autoSkipIntro", v)} />
<Choice label="Skip step" opts={steps} value={settings.seekStep} pick={(v) => settings.set("seekStep", v)} />
