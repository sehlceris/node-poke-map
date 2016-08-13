module.exports = function (grunt) {

    var Config = {
        BUILD_DIRECTORY: 'build'
    };

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        nodemon: {
            dev: {
                script: `${Config.BUILD_DIRECTORY}/Clairvoyance.js`
            },
            options: {
                ignore: ['node_modules/**', 'Gruntfile.js', 'test']
            }
        },
        watch: {
            scripts: {
                files: ['src/**/*.ts', '!node_modules/**/*.ts', '!test/**/*.js'], // the watched files
                tasks: ['ts:build', 'copy:dist'], // the task to run
                options: {
                    spawn: false // makes the watch task faster
                }
            }
        },
        concurrent: {
            develop: {
                tasks: ['watch', 'nodemon'],
                options: {
                    logConcurrentOutput: true
                }
            },
            watchAndBuild: {
                tasks: ['watch'],
                options: {
                    logConcurrentOutput: true
                }
            }
        },
        tslint: {
            options: {
                configuration: grunt.file.readJSON('tslint.json')
            },
            all: {
                src: ['src/**/*.ts', '!node_modules/**/*.ts', '!obj/**/*.ts', '!typings/**/*.ts'] // avoid linting typings files and node_modules files
            }
        },
        ts: {
            build: {
                files: [
                    {
                        src: ['src/**/*.ts'],
                        dest: Config.BUILD_DIRECTORY
                    }
                ], // Avoid compiling TypeScript files in node_modules
                options: {
                    target: 'es6',
                    failOnTypeErrors: false,
                    module: 'commonjs', // To compile TypeScript using external modules like NodeJS
                    fast: 'never', // You'll need to recompile all the files each time for NodeJS
                    experimentalDecorators: true,
                    pretty: false,
                    sourceMap: true
                }
            }
        },
        copy: {
            dist: {
                files: [
                    // includes files within path
                    {expand: true, src: ['package.json'], dest: `${Config.BUILD_DIRECTORY}/`, filter: 'isFile'},
                    {expand: true, src: ['config.json'], dest: `${Config.BUILD_DIRECTORY}/`, filter: 'isFile'}
                ]
            }
        }
    });
    grunt.loadNpmTasks('grunt-ts');
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-nodemon');
    grunt.loadNpmTasks('grunt-concurrent');
    grunt.loadNpmTasks('grunt-contrib-copy');
    // Default tasks.
    grunt.registerTask('develop', ['ts:build', 'concurrent:develop']);
    grunt.registerTask('build', ['ts:build', 'concurrent:watchAndBuild']);
    grunt.registerTask('dist', ['ts:build', 'copy:dist']);
    grunt.registerTask('default', ['develop']);
};
