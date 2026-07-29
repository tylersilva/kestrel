/**
 * Secrets aren't declared in wrangler.jsonc, so `wrangler types` can't see
 * them — declaration-merge them into the generated Env here.
 */
interface Env {
	/** Fine-grained read-only PAT; absent → unauthenticated, degraded mode. */
	GITHUB_TOKEN?: string;
}
