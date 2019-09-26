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
    let newObj: any = {};

    for (let key in obj) {
        newObj[key] = obj[key];
    }

    return newObj as T;
}

export function jsonClone<T>(obj: T) {
    return JSON.parse(JSON.stringify(obj)) as T;
}

// https://stackoverflow.com/questions/8935632/check-if-character-is-number
export function charIsDigit(c: string) {
    return c >= '0' && c <= '9';
}

/** In contrast to Promise.all, this doesn't stop on the first rejection. */
export function promiseAllSettled<T>(values: Promise<T>[]) {
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