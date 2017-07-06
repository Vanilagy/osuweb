let grunt = require("grunt");

require('load-grunt-tasks')(grunt); // npm install --save-dev load-grunt-tasks

grunt.initConfig({
    babel: {
        options: {
            sourceMap: true,
            presets: ['es2015']
        },
        dist: {
            files: [{
                expand: true,
                cwd: 'js/',
                src: ['**/*.js'],
                dest: 'dist/',
                ext: '.js'
            }]
        }
    },
    browserify: {
        bundle: {
            src: ['dist/main.js'],
            dest: 'bundle.js'
        }
    },
    watch: {
        ej6: {
            files: "js/**/*.js",
            tasks: ['newer:babel', 'browserify']
        }
    },
    "node-minify": {
        uglify: {
            compressor: 'uglifyjs',
            options: {
                warnings: true,
                mangle: true,
                compress: true
            },
            files: {
                'bundle.min.js':  ['bundle.js']
            }
        }
    }
});

grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-newer');
grunt.loadNpmTasks('grunt-browserify');
grunt.loadNpmTasks('grunt-node-minify');

grunt.registerTask('default', ['watch']);
grunt.registerTask('release', ['newer:babel', 'browserify', 'node-minify:uglify']);