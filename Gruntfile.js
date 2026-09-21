module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // The glob does not descend, so src/js/locales/*.js stays out of the main
  // bundle and is built to dist/locales/ one file at a time instead.
  var jsFiles = [
    'src/js/jquery.grideditor.js',
    'src/js/*.js',
  ];

  var localeFiles = [{
    expand: true,
    cwd: 'src/js/locales/',
    src: ['*.js'],
    dest: 'dist/locales/',
  }];
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    concat: {
      js: {
        src: jsFiles,
        dest: 'dist/jquery.grideditor.js',
      },
    },
    
    uglify: {
      build: {
        options: {
          sourceMap: true,
        },
        src: jsFiles,
        dest: 'dist/jquery.grideditor.min.js',
      },
      locales: {
        options: {
          sourceMap: true,
        },
        files: localeFiles.map(function(files) {
          // extDot last, or grideditor.es.js would minify to grideditor.min.js
          return Object.assign({}, files, { ext: '.min.js', extDot: 'last' });
        }),
      },
    },
    
    copy: {
      // The readable file is what a page loads, next to the minified one
      locales: {
        files: localeFiles,
      },
    },
    
    less: {
      development: {
        files: [{
            cwd: 'src/less/', 
            src: [
              '*.less'
            ],
            dest: 'dist/',
            ext: '.css',
            expand: true,
        }]
      }
    },
    
    cssmin: {
      development: {
        files: {
          'dist/grideditor.min.css' : ['dist/grideditor.css'],
        }
      }
    },
    
    watch: {
      stylesheets: {
        files: ['src/**/*', 'example/*'],
        tasks: ['concat:js', 'uglify:build', 'less'],
        options: {
          spawn: false,
          livereload: true,
        },
      },
      locales: {
        files: ['src/js/locales/*.js'],
        tasks: ['copy:locales', 'uglify:locales'],
        options: {
          spawn: false,
          livereload: true,
        },
      },
    },
    
  });

  grunt.registerTask('default', ['concat:js', 'uglify', 'less', 'copy:locales']);

};