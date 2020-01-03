// !!!! MAKE SURE TO COPY ALL CHANGES FROM THIS FILE INTO rollup-fast.config.js!!!!

import typescript from 'rollup-plugin-typescript2';

export default [{
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
	},
	onwarn: function (message) {
		// Sorry, but screw them. Classic example of humanity creating its own problems.
		if (message.code === 'CIRCULAR_DEPENDENCY') {
		  return;
		}
		console.warn(message);
	}
},
{
    input: './src/ts/multithreading/worker.ts',
    plugins: [
        typescript({
            abortOnError: false
        })
    ],
    output: {
        format: 'iife',
        file: './src/js/worker_bundle.js',
        name: '', // Empty string here to create an unnamed IIFE
	},
	onwarn: function (message) {
		if (message.code === 'CIRCULAR_DEPENDENCY') {
		  return;
		}
		console.warn(message);
	}
}];