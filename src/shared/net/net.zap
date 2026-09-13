opt server_output = "zapServer.luau"
opt client_output = "zapClient.luau"
opt casing = "camelCase"
opt typescript = true
opt write_checks = true
opt yield_type = "yield"

type PlayerDelta = struct {
	guid: string.utf8,
	money: f64,
}

event ready = {
	from: Client,
	type: Reliable,
	call: SingleAsync,
}

event replicatePlayer = {
	from: Server,
	type: Reliable,
	call: SingleAsync,
	data: PlayerDelta,
}

funct getPing = {
	call: Async,
	rets: u16,
}
