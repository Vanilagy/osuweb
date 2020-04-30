const APPROXIMATE_LINE_HEIGHT = 32;
const APPROXIMATE_PAGE_HEIGHT = 800;

export const EMPTY_FUNCTION = () => {};

export interface NormalizedWheelEvent {
	readonly dx: number,
	readonly dy: number,
	readonly dz: number,
	readonly event: WheelEvent
}

export function padNumberWithZeroes(num: number, zeroes: number) {
	let str = String(num);
	let dotIndex = str.indexOf('.');
	let neededZeroes: number;

	if (dotIndex === -1) {
		neededZeroes = zeroes - str.length;
	} else {
		neededZeroes = zeroes - dotIndex;
	}

	if (neededZeroes < 0) neededZeroes = 0;

	return "0000000000000000000000000000".slice(0, neededZeroes) + str;
}

export function toPercentageString(num: number, decimals?: number) {
	if (decimals === undefined) {
		return (num * 100) + '%';
	} else {
		return (num * 100).toFixed(decimals) + '%'
	}
}

/** Throws if the passed value is FALSE. Not falsy. FALSE. Pass a boolean to this. */
export function assert(value: boolean) {
	if (!value) {
		throw new Error("Assertion failed!");
	}
}

export function last<T>(arr: T[]) {
	return arr[arr.length - 1];
}

export function randomInArray<T>(arr: T[]) {
	return arr[(Math.random() * arr.length) | 0];
}

export function shallowObjectClone<T extends object>(obj: T) {
	let newObj = {} as T;

	for (let key in obj) {
		newObj[key] = obj[key];
	}

	return newObj;
}

export function jsonClone<T>(obj: T) {
	return JSON.parse(JSON.stringify(obj)) as T;
}

// https://stackoverflow.com/questions/8935632/check-if-character-is-number
export function charIsDigit(c: string) {
	return c >= '0' && c <= '9';
}

/** In contrast to Promise.all, this doesn't stop on the first rejection. */
export function promiseAllSettled<T>(values: Promise<T>[]): Promise<({
	value: T,
	status: 'fulfilled'
} | {
	reason: any,
	status: 'rejected'
})[]> {
	let newValues = values.map((a) => {
		if (a instanceof Promise) {
			return a.then(
				(value) => ({ value, status: 'fulfilled' } as const),
				(reason) => ({ reason, status: 'rejected' } as const)
			);
		} else {
			return { value: a, status: 'fulfilled' } as const;
		}
	});

	return Promise.all(newValues);
}

let floatConverterDataView = new DataView(new ArrayBuffer(8));
export function toFloat32(f64: number) {
	floatConverterDataView.setFloat32(0, f64);
	return floatConverterDataView.getFloat32(0);
}

/** Returns the index of the last occurrences of the element less than or equal to the key, or -1 if none was found. Adapted from https://www.geeksforgeeks.org/variants-of-binary-search/ */
export function binarySearchLessOrEqual(arr: number[], key: number): number;
export function binarySearchLessOrEqual<T>(arr: T[], key: number, valueGetter: (x: T) => number): number;
export function binarySearchLessOrEqual<T>(arr: T[], key: number, valueGetter?: (x: T) => number) {
	let ans = -1,
		low = 0,
		high = arr.length-1;

	while (low <= high) {
		let mid = (low + (high - low + 1) / 2) | 0;
		let midVal = valueGetter? valueGetter(arr[mid]) : arr[mid] as unknown as number;

		if (midVal <= key) {
			ans = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	return ans;
}

/** Remove all undefined elements from an array. */
export function unholeArray<T>(arr: T[]) {
	for (let i = 0; i < arr.length; i++) {
		if (arr[i] === undefined) arr.splice(i--, 1);
	}
}

export function getNow(override?: number) {
	if (override !== undefined) return override;
	return performance.now();
}

export function normalizeWheelEvent(e: WheelEvent): NormalizedWheelEvent {
	let dx = e.deltaX,
		dy = e.deltaY,
		dz = e.deltaZ;

	if (e.deltaMode === 1) {
		dx *= APPROXIMATE_LINE_HEIGHT;
		dy *= APPROXIMATE_LINE_HEIGHT;
		dz *= APPROXIMATE_LINE_HEIGHT;
	} else if (e.deltaMode === 2) {
		dx *= APPROXIMATE_PAGE_HEIGHT;
		dy *= APPROXIMATE_PAGE_HEIGHT;
		dz *= APPROXIMATE_PAGE_HEIGHT;
	}

	return {
		dx, dy, dz,
		event: e
	}
}

/** Inserts an item into an array at a specific point, satisfying a comparator. */
export function insertItem<T>(arr: T[], item: T, comparator: (a: T, b: T) => number) {
	for (let i = 0; i < arr.length; i++) {
		let comp = comparator(arr[i], item);
		if (comp >= 0) {
			arr.splice(i, 0, item);
			return;
		}
	}

	arr.push(item);
}

/** Inserts an item into a sorted array at a specific point, satisfying a comparator. */
export function insertItemBinary<T>(arr: T[], item: T, comparator: (a: T, b: T) => number) {
	let low = 0;
	let high = arr.length - 1;
	let ans = -1;

	while (low <= high) {
		let mid = ((low + high) / 2) | 0;
		let comp = comparator(arr[mid], item);

		if (comp <= 0) {
			ans = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	arr.splice(ans+1, 0, item);
}

/** Removes an item from an array - if it's in there. Returns true if the item was removed. */
export function removeItem<T>(arr: T[], item: T) {
	let index = arr.indexOf(item);
	if (index !== -1) {
		arr.splice(index, 1);
		return true;
	}

	return false;
}

/** Pushes an item into an array if it's not already in there. Returns true if the item wasn't in there before. */
export function pushItemUnique<T>(arr: T[], item: T) {
	let index = arr.indexOf(item);
	if (index === -1) {
		arr.push(item);
		return true;
	}

	return false;
}

export interface Searchable {
	searchableString: string
}

export function createSearchableString(substrings: string[]) {
	let str = '';

	for (let i = 0; i < substrings.length; i++) {
		str += substrings[i];
		if (i !== substrings.length-1) str += ' ';
	}

	return str.toLowerCase();
}

export function matchesSearchable(searchable: Searchable, words: string[]) {
	let matchCount = 0;

	for (let i = 0; i < words.length; i++) {
		if (searchable.searchableString.includes(words[i])) matchCount++;
	}

	return matchCount === words.length;
}

export class OverridableDelay {
	private timeoutId: number = null;

	schedule(delay: number, func: Function) {
		clearTimeout(this.timeoutId);
		this.timeoutId = setTimeout(func, delay);
	}
}

/** Compares to strings based on lexicographical order. You might say "Oh but dude, why didn't you use < or localeCompare??" Well, this one was the fastest. */
export function compareStrings(a: string, b: string) {
	let min = Math.min(a.length, b.length);

	for (let i = 0; i < min; i++) {
		let charA = a[i];//.toLowerCase();
		let charB = b[i];//.toLowerCase();

		if (charA < charB) return -1;
		if (charA > charB) return 1;
	}

	if (a.length > min) return 1;
	if (b.length > min) return -1;

	return 0;
}

export function bytesToString(bytes: Uint8Array) {
	let str = "";

	for (let i = 0; i < bytes.byteLength; i++) {
		str += String.fromCharCode(bytes[i]);
	}

	return str;
}

export function removeHTMLElement(element: HTMLElement) {
	element.parentElement.removeChild(element);
}

export function stringContainsOnly(string: string, characters: string[], startIndex = 0, endIndex?: number) {
	if (endIndex === undefined) endIndex = string.length;

	for (let i = startIndex; i < endIndex; i++) {
		if (!characters.includes(string[i])) return false;
	}

	return true;
}

/** Removes surrounding double quotes from a string if it has them. */
export function removeSurroundingDoubleQuotes(str: string) {
	if (str[0] === `"` && str[str.length-1] === `"`) return str.slice(1, -1);
	return str;
}

export function retryUntil(breakCondition: () => boolean, retryDelay = 50) {
	return new Promise((resolve, reject) => {
		let interval = setInterval(retry, retryDelay);

		function retry() {
			try {
				if (breakCondition()) {
					resolve();
					clearInterval(interval);
				}
			} catch (e) {
				reject();
				clearInterval(interval);
			}
		}
		retry();
	});
}

export function escapeRegExp(str: string) {
	return str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function replaceAll(str: string, find: string, replace: string) {
	return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export interface Interval {
	start: number,
	end: number
}

export function getIntervalMidpoint(interval: Interval) {
	return (interval.start + interval.end) / 2;
}

export function getIntervalSize(interval: Interval) {
	return interval.end - interval.start;
}

// Based on https://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array
/** Shuffles an array in-place. */
export function shuffle<T>(arr: T[]) {
	let j, x, i;
	
    for (i = arr.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = arr[i];
        arr[i] = arr[j];
        arr[j] = x;
	}
	
    return arr;
}

export function arraysEqualShallow<T>(arr1: T[], arr2: T[]) {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}