import typescript from 'rollup-plugin-typescript2';

export default {
    input: './src/ts/index.ts',
    plugins: [
        typescript({
            abortOnError: false
        })
    ],
    output: {
        format: 'iife',
        file: './src/js/bundle.js',
        name: '', // Empty string here to create an unnamed IIFE
    }
}