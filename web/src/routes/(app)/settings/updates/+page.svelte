<script lang="ts">
  import { updates } from "#lib/updates.svelte.ts";
  import { APP_VERSION } from "#lib/diagnostics.ts";
  import { relative } from "#lib/format.ts";
  import PageHeader from "#lib/components/PageHeader.svelte";
  import Note from "#lib/components/settings/Note.svelte";
  import QrCode from "#lib/components/QrCode.svelte";
  import Btn from "#lib/components/Btn.svelte";
  import Icon from "#lib/components/Icon.svelte";

  updates.check();
  const checked = $derived(updates.latest ? ` (checked ${relative(new Date(updates.latest.checkedAt).toISOString()).toLowerCase()})` : "");
</script>

<PageHeader title="Updates" />
{#if updates.available}
  <div class="primary-container flex items-center gap-8 rounded-2xl p-6">
    <QrCode text={updates.available.url} class="size-40 flex-none" />
    <div>
      <div class="text-[1.4rem] font-bold">{updates.available.name} is available</div>
      <p class="mt-1">You have {APP_VERSION}. Scan to open the release page; the APK and Samsung widget are attached there.</p>
    </div>
  </div>
{:else}
  <Note text={updates.checking ? "Checking for updates…" : `SERAPH ${APP_VERSION} is the latest version${checked}.`} />
{/if}
<div class="mt-5 flex gap-4" data-focus-group>
  <Btn onclick={() => updates.check(true)}><Icon name="restart" /> Check now</Btn>
</div>
