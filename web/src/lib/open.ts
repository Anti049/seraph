import type { Metadata } from "./plex";
import { account } from "./account.svelte";
import { router } from "./router.svelte";

/** Where selecting a card goes. */
export function open(item: Metadata) {
  const server = item.server ?? account.server?.machineId ?? "";
  switch (item.type) {
    case "show":
      router.push({ name: "show", server, ratingKey: item.ratingKey });
      break;
    case "season":
      router.push({ name: "show", server, ratingKey: item.parentRatingKey ?? item.ratingKey, season: item.ratingKey });
      break;
    default:
      router.push({ name: "details", server, ratingKey: item.ratingKey });
  }
}
