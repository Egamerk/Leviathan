--[[
	Select every UI in the place so it can be exported as ONE .rbxm.

	How to use (Roblox Studio):
	  1. Paste this whole file into the Command Bar (View → Command Bar) and press Enter.
	  2. In Explorer, right-click any selected item → Save to File… → assets/ui/all-ui.rbxm

	Finds every ScreenGui / SurfaceGui / BillboardGui in StarterGui, ReplicatedStorage,
	ServerStorage and Workspace. A GUI nested inside another GUI is skipped, since its
	parent already contains it. Nothing is modified.
]]

local Selection = game:GetService("Selection")
local SEARCH = { "StarterGui", "ReplicatedStorage", "ServerStorage", "Workspace" }

local found = {}
for _, serviceName in SEARCH do
	for _, instance in game:GetService(serviceName):GetDescendants() do
		if instance:IsA("LayerCollector") and not instance:FindFirstAncestorWhichIsA("LayerCollector") then
			table.insert(found, instance)
		end
	end
end

Selection:Set(found)
print(string.format("[select-all-ui] Selected %d GUI(s). Right-click → Save to File… to export them together.", #found))
