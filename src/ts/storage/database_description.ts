import { Settings } from "../menu/settings/settings";
import { Keybindings } from "../input/key_bindings";

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
		"placeholder": {
			format: null as number,
			key: "",
			indexes: []
		}
	},
	/** Describes all possible key/value pairs. */
	keyValueStore: {
		settings: null as Settings,
		keybindings: null as Keybindings
	}
});