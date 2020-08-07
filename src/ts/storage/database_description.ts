import { Settings } from "../menu/settings/settings";
import { Keybindings } from "../input/key_bindings";
import { VirtualDirectoryDescription } from "../file_system/virtual_directory";
import { VirtualFileDescription } from "../file_system/virtual_file";
import { ExtendedBeatmapData, BasicBeatmapData } from "../util/beatmap_util";
import { BeatmapSetDescription } from "../datamodel/beatmap/beatmap_set";

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
				id: string
			},
			key: "id",
			indexes: []
		},
		"beatmapSet": {
			format: null as BeatmapSetDescription,
			key: "id",
			indexes: [{property: "parentDirectoryHandleId", unique: false}]
		}
	},
	/** Describes all possible key/value pairs. */
	keyValueStore: {
		settings: null as Settings,
		keybindings: null as Keybindings
	}
});