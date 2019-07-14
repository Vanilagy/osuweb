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

export function lastArrayItem<T>(arr: T[]): T {
    return arr[arr.length - 1];
}