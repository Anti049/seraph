// Steps shared by the Ganymede setup routes (address → scan → sign-in).
import { ganymede } from "./source.svelte";
import { gate } from "../gate.svelte";
import { router } from "../router.svelte";

/** Connect to `address`; then sign in, or finish if the session is already signed in. Returns an error message. */
export async function connectTo(address: string): Promise<string | null> {
  if (!address.trim()) return "Enter your Ganymede address, e.g. 192.168.1.10:4800 or ganymede.example.com";
  try {
    await ganymede.connect(address);
  } catch (err) {
    return (err as Error).message;
  }
  if (ganymede.phase !== "ready") return `Can't reach ${ganymede.url}`;
  if (ganymede.user) gate.finish();
  else router.push({ name: "g-signin" });
  return null;
}

/** Leave the flow without changing anything (only offered when there's somewhere to go back to). */
export function cancelSetup() {
  if (!router.back()) gate.finish();
}

/** Whether Cancel makes sense: the app is usable without finishing this flow. */
export function canCancelSetup() {
  return gate.plexReady || gate.ganymedeReady || router.depth > 0;
}
