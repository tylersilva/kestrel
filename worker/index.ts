import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ENGINE_VERSION } from "../sim/index.ts";
import { simRoutes } from "./routes/sim.ts";

/**
 * Kestrel API. Static assets are served by the Workers assets layer;
 * only /api/* reaches this Worker (assets.run_worker_first in wrangler.jsonc).
 */
const app = new Hono<{ Bindings: Env }>();

app.use(secureHeaders());

app.get("/api/health", (c) =>
	c.json({ ok: true, engineVersion: ENGINE_VERSION, serverTime: Date.now() }),
);

app.route("/api/sim", simRoutes);

app.notFound((c) =>
	c.json({ error: { code: "not_found", message: "No such route" } }, 404),
);

app.onError((err, c) => {
	console.error(err);
	return c.json(
		{ error: { code: "internal", message: "Something went wrong" } },
		500,
	);
});

export default app;
