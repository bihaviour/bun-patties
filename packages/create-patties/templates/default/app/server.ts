import { type DevServer, setupDevClient } from "patties/dev";
import { createRenderer } from "patties/render";
import { createRouter } from "patties/router";
import { startServer } from "patties/server";

interface StartOpts {
	devServer: DevServer;
	port: number;
	host: string;
	appDir: string;
}

export default async function start(opts: StartOpts): Promise<void> {
	// Bundle islands and serve their chunks under `/_patties/client/*`.
	// `manifest` tells the renderer which <script> to inject so islands hydrate.
	const devClient = await setupDevClient({ appDir: opts.appDir });
	const renderer = createRenderer({ manifest: devClient.manifest, dev: true });
	const router = await createRouter({ appDir: opts.appDir, renderer });

	startServer({
		port: opts.port,
		hostname: opts.host,
		dev: true,
		devServer: opts.devServer,
		routes: { ...devClient.routes, ...router.routes },
		fallback: router.fallback,
	});
}
