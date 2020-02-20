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

/** Returns the index of the last occurance of the element less than or equal to the key, or -1 if none was found. Adapted from https://www.geeksforgeeks.org/variants-of-binary-search/ */
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
		let comp = comparator(item, arr[i]);
		if (comp <= 0) {
			arr.splice(i, 0, item);
			return;
		}
	}

	arr.push(item);
}

/** Removes an item from an array, if it's in there. Returns true if the item was removed. */
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

export function createSearchableString(substrings: string[]) {
	let str = '';

	for (let i = 0; i < substrings.length; i++) {
		str += substrings[i];
		if (i !== substrings.length-1) str += ' ';
	}

	return str.toLowerCase();
}

export class OverridableDelay {
	private timeoutId: number = null;

	schedule(delay: number, func: Function) {
		clearTimeout(this.timeoutId);
		this.timeoutId = setTimeout(func, delay);
	}
}

export function compareStringsLowerCase(a: string, b: string) {
	return a.toLowerCase().localeCompare(b.toLowerCase());
}