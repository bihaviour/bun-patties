import type { DevServer } from "patties/dev";
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
	const renderer = createRenderer({ dev: true });
	const router = await createRouter({ appDir: opts.appDir, renderer });

	startServer({
		port: opts.port,
		hostname: opts.host,
		dev: true,
		devServer: opts.devServer,
		routes: router.routes,
		fallback: router.fallback,
	});
}
