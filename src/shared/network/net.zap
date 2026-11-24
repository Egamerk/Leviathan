-- Leviathan network contract (https://zap.redblox.dev).
-- Regenerate with `npm run zap`. Output: src/{server,client}/network/zap.luau + .d.ts
-- (git-ignored; roblox-ts treats each .luau + .d.ts pair as an importable module).
--
-- Conventions:
--   * Client → Server events are fully typed with tight bounds so Zap rejects
--     malformed input before gameplay code ever sees it.
--   * Group new events under a "── <domain> ──" header (combat, inventory…).

opt server_output = "../../server/network/zap.luau"
opt client_output = "../../client/network/zap.luau"
opt casing = "camelCase"
opt typescript = true
opt write_checks = true
opt yield_type = "yield"

-- ── State replication (Charm Sync) ──────────────────────────────────────────

-- Client asks for its initial state once its signals are registered.
event requestState = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
}

-- Charm Sync payloads. `unknown` keeps Charm's delta format intact.
event syncState = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: unknown,
}
