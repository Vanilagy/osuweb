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
                dest: 'babel/',
                ext: '.js'
            }]
        }
    },
    browserify: {
        bundle: {
            src: ['babel/main.js'],
            dest: 'dist/bundle.js'
        }
    },
    watch: {
        ej6: {
            files: ['js/**/*.js', 'index.html', 'lib/**/*', 'assets/**/*', 'audio/**/*', 'img/**/*'],
            tasks: ['default']
        }
    },
    copy: {
        options: {},
        files: {
            expand: true,
            src: ['index.html', 'lib/**/*', 'assets/**/*', 'audio/**/*', 'img/**/*'],
            dest: "dist/"
        }
    }
});

grunt.loadNpmTasks('grunt-contrib-copy');
grunt.loadNpmTasks('grunt-contrib-watch');
grunt.loadNpmTasks('grunt-newer');
grunt.loadNpmTasks('grunt-browserify');
grunt.loadNpmTasks('grunt-node-minify');

grunt.registerTask('watch-default', ['watch']);
grunt.registerTask('default', ['newer:babel', 'browserify', 'newer:copy']);
grunt.registerTask('force', ['babel', 'browserify', 'copy']);
grunt.registerTask('release', ['newer:babel', 'newer:copy', 'browserify', 'node-minify:uglify']);