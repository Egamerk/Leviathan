interface ReplicatedStorage extends Instance {
	Shared: Folder;
	Client: Folder;
	Network: Folder & {
		Server: ModuleScript;
		Client: ModuleScript;
	};
}
