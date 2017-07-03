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
    }
});

grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-newer');
grunt.loadNpmTasks('grunt-browserify');

grunt.registerTask('default', ['watch']);