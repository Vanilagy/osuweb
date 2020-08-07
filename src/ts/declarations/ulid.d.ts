interface PRNG {
    (): number;
}

interface ULID {
    (seedTime?: number): string;
}

declare namespace ULID {
	function ulid(seedTime?: number): string;
	function replaceCharAt(str: string, index: number, char: string): string;
	function incrementBase32(str: string): string;
	function randomChar(prng: PRNG): string;
	function encodeTime(now: number, len: number): string;
	function encodeRandom(len: number, prng: PRNG): string;
	function decodeTime(id: string): number;
	function detectPrng(allowInsecure?: boolean, root?: any): PRNG;
}