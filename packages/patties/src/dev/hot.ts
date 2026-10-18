// `bun --hot` re-evaluates every module on change but keeps `globalThis`, so
// anything that must survive a reload — or count reloads — lives there.

export interface HotState {
	/** Evaluations of the dev bootstrap in this process; >1 means a hot reload. */
	generation: number;
	/** Per-process id; lets the HMR client tell a restart from a hot reload. */
	serverId: string;
}

const KEY = Symbol.for("patties.dev.hot");

export function hotState(): HotState {
	const g = globalThis as unknown as Record<symbol, HotState | undefined>;
	let state = g[KEY];
	if (!state) {
		state = {
			generation: 0,
			serverId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
		};
		g[KEY] = state;
	}
	return state;
}
