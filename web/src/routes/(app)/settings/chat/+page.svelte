<script lang="ts">
  import { settings } from "#lib/settings.svelte.ts";
  import { onOff, chatSizes } from "#lib/components/settings/options.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Choice from "#lib/components/settings/Choice.svelte";
</script>

<PageHeader title="Chat replay" />
<Choice label="Show chat by default" opts={onOff} value={settings.chatVisible} pick={(v) => settings.set("chatVisible", v)} />
<Choice
  label="Position"
  opts={[
    { v: "side" as const, l: "Beside video" },
    { v: "overlay" as const, l: "Over video" },
  ]}
  value={settings.chatMode}
  pick={(v) => settings.set("chatMode", v)}
/>
<Choice label="Text size" opts={chatSizes} value={settings.chatSize} pick={(v) => settings.set("chatSize", v)} />
