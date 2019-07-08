import typescript from 'rollup-plugin-typescript';

export default {
    input: './src/ts/index.ts',
    plugins: [
        typescript()
    ],
    output: {
        format: 'iife',
        file: './src/js/bundle.js',
        name: '', // Empty string here to create an unnamed IIFE
    }
}