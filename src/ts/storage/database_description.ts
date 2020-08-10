import { Settings } from "../menu/settings/settings";
import { Keybindings } from "../input/key_bindings";
import { BeatmapSetDescription } from "../datamodel/beatmap/beatmap_set";
import { VirtualDirectoryDescription } from "../file_system/virtual_directory";

interface DatabaseDescription {
	collections: Record<string, {
		format: any,
		key: string,
		indexes: {property: string, unique: boolean}[]
	}>,
	keyValueStore: Record<string, any>
}

const buildDatabaseDescription = <T extends DatabaseDescription>(keybinds: T) => keybinds;
export const databaseDescription = buildDatabaseDescription({
	/** Describes the collections in the database, including record type, primery key and indexes. */
	collections: {
		"directoryHandle": {
			format: null as {
				handle: FileSystemDirectoryHandle,
				id: string,
				/** If the user last granted permission to use this directory handle. If yes, prompt them the next time to reopen the directory. */
				permissionGranted: boolean,
				storeBeatmaps: boolean
			},
			key: "id",
			indexes: []
		},
		"beatmapSet": {
			format: null as BeatmapSetDescription,
			key: "id",
			indexes: [{property: "parentDirectoryHandleId", unique: false}]
		},
		"directory": {
			format: null as VirtualDirectoryDescription,
			key: "id",
			indexes: []
		}
	},
	/** Describes all possible key/value pairs. */
	keyValueStore: {
		settings: null as Settings,
		keybindings: null as Keybindings
	}
});