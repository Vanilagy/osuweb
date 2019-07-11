export function padNumberWithZeroes(num: number, zeroes: number) {
    let str = String(num);
    let dotIndex = str.indexOf('.');
    let neededZeroes: number;

    if (dotIndex === -1) {
        neededZeroes = zeroes - str.length;
    } else {
        neededZeroes = zeroes - dotIndex;
    }

    return "0000000000000000000000000000".slice(0, neededZeroes) + str;
}