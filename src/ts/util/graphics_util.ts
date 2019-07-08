export interface Color {
    r: number, // 0-255
    g: number, // 0-255
    b: number, // 0-255
    a?: number // 0.0-1.0
}

export function colorToHexNumber(color: Color) {
    return color.r * 0x10000 + color.g * 0x100 + color.b * 0x1;
}