import { ReplicatedStorage } from "@rbxts/services";
import type * as ZapClient from "./zapClient";

/** Typed handle to the Zap-generated client module (see server.ts). */
const module = ReplicatedStorage.WaitForChild("Network").WaitForChild("Client") as ModuleScript;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Zap output is a plain ModuleScript
export const ClientNet = require(module) as typeof ZapClient;
