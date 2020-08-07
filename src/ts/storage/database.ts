import { databaseDescription } from "./database_description";

const VERSION = 10;
type CollectionName = keyof typeof databaseDescription["collections"];

export class Database {
	public idbDatabase: Promise<IDBDatabase>;
	/** In addition to collections, the database also offers a simple key-value store, similar to localStorage. */
	public keyValueStore: KeyValueStore;

	constructor() {
		this.keyValueStore = new KeyValueStore(this);

		this.idbDatabase = new Promise((resolve) => {
			let request = indexedDB.open("main-database", VERSION);
			request.onsuccess = (e) => {
				resolve((e.target as any).result);
			};

			request.onupgradeneeded = (e) => {
				let db = (e.target as any).result as IDBDatabase;
				let transaction = (e.target as any).transaction as IDBTransaction;

				// Create all necessary object stores
				for (let collectionName in databaseDescription.collections) {
					let description = databaseDescription.collections[collectionName as keyof typeof databaseDescription["collections"]];
					let objectStore: IDBObjectStore;

					try {
						objectStore = db.createObjectStore(collectionName, {keyPath: description.key});
					} catch (error) {
						objectStore = transaction.objectStore(collectionName);
					}

					// Create all necessary indexes
					for (let index of description.indexes) {
						try {
							objectStore.createIndex(index.property, index.property, {unique: index.unique});
						} catch (e) {}
					}
				}

				try {
					db.createObjectStore(KeyValueStore.storeName);
				} catch (e) {}
			};
		});
	}

	/** Adds or updates a record. */
	async put<K extends CollectionName>(collectionName: K, data: typeof databaseDescription["collections"][K]["format"]) {
		let db = await this.idbDatabase;
		let transaction = db.transaction(collectionName, 'readwrite');
		let store = transaction.objectStore(collectionName);

		store.put(data);
	}

	/**
	 * Gets a record based on one of its properties.
	 * @param collectionName The collection's name
	 * @param property The property
	 * @param value The property's value to search for
	 */
	async get<K extends CollectionName, P extends keyof typeof databaseDescription["collections"][K]["format"]>(collectionName: K, property: P, value: typeof databaseDescription["collections"][K]["format"][P]): Promise<typeof databaseDescription["collections"][K]["format"]> {
		let db = await this.idbDatabase;
		let transaction = db.transaction(collectionName, 'readonly');
		let store = transaction.objectStore(collectionName);
		let description = databaseDescription.collections[collectionName];
		let request: IDBRequest;
		let result: typeof databaseDescription["collections"][K]["format"] = null;

		if (property === description.key) {
			// The property is the primary key, so just do a regular get.
			request = store.get(value as any);
		} else if (description.indexes.find(x => x.property === property)) {
			// The property has an index, so use the index to get it.
			let index = store.index(property as string);
			request = index.get(value as any);
		} else {
			// Otherwise, we need to search through all records to find a match. Do so with a cursor:
			await new Promise((resolve) => {
				store.openCursor().onsuccess = (e) => {
					let cursor = (e.target as any).result as IDBCursor;
					if (cursor) {
						let record = (cursor as any).value as typeof databaseDescription["collections"][K]["format"];
						if (record[property] === value) {
							result = record;
							resolve();
							return;
						}
						cursor.continue();
					} else {
						resolve();
					}
				}
			});
		}

		if (request) {
			await new Promise((resolve) => request.onsuccess = resolve);
			result = request.result || null;
		}

		return result;
	}

	/** Finds a record based on a predicate. */
	async find<K extends CollectionName>(collectionName: K, predicate: (record: typeof databaseDescription["collections"][K]["format"]) => boolean) {
		let db = await this.idbDatabase;
		let transaction = db.transaction(collectionName, 'readonly');
		let store = transaction.objectStore(collectionName);
		let result: typeof databaseDescription["collections"][K]["format"] = null;

		await new Promise((resolve) => {
			// Loop through all records with a cursor until a match is found
			store.openCursor().onsuccess = (e) => {
				let cursor = (e.target as any).result as IDBCursor;
				if (cursor) {
					let record = (cursor as any).value as typeof databaseDescription["collections"][K]["format"];
					if (predicate(record)) {
						result = record;
						resolve();
						return;
					}

					cursor.continue();
				} else {
					resolve();
				}
			}
		});

		return result;
	}

	/** Deletes a record from the database. */
	async delete(collectionName: CollectionName, key: string) {
		let db = await this.idbDatabase;
		let transaction = db.transaction(collectionName, 'readwrite');
		let store = transaction.objectStore(collectionName);
		let request = store.delete(key);

		return new Promise(resolve => request.onsuccess = resolve);
	}
}

class KeyValueStore {
	private db: Database;
	static storeName = "keyValueStore";

	constructor(db: Database) {
		this.db = db;
	}

	async set<K extends keyof typeof databaseDescription['keyValueStore']>(key: K, value: typeof databaseDescription['keyValueStore'][K]) {
		let db = await this.db.idbDatabase;
		let transaction = db.transaction(KeyValueStore.storeName, 'readwrite');
		let store = transaction.objectStore(KeyValueStore.storeName);

		store.put(value, key);
	}

	async get<K extends keyof typeof databaseDescription['keyValueStore']>(key: K): Promise<typeof databaseDescription['keyValueStore'][K]> {
		let db = await this.db.idbDatabase;
		let transaction = db.transaction(KeyValueStore.storeName, 'readonly');
		let store = transaction.objectStore(KeyValueStore.storeName);

		let request = store.get(key);

		await new Promise(resolve => request.onsuccess = resolve);
		return request.result || null;
	}

	async delete(key: keyof typeof databaseDescription['keyValueStore']) {
		let db = await this.db.idbDatabase;
		let transaction = db.transaction(KeyValueStore.storeName, 'readwrite');
		let store = transaction.objectStore(KeyValueStore.storeName);
		let request = store.delete(key);

		return new Promise(resolve => request.onsuccess = resolve);
	}
}