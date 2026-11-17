// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare global {
  /** Build-time constants (vite.config.ts). */
  const __GANYMEDE_DEFAULT__: string;
  const __APP_VERSION__: string;
  const __SERAPH_REPO__: string;
}

declare module "hls.js/light" {
  import Hls from "hls.js";
  export default Hls;
}

export {};
