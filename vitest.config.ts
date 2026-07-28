import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["test/sim/**/*.test.ts"],
				},
			},
			{
				plugins: [
					cloudflareTest({
						miniflare: {
							compatibilityDate: "2026-07-28",
							compatibilityFlags: ["nodejs_compat"],
						},
					}),
				],
				test: {
					name: "worker",
					include: ["test/worker/**/*.test.ts"],
				},
			},
		],
	},
});
