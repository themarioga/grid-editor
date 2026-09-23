module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-copy');

  // The glob does not descend, so src/js/locales/*.js stays out of the main
  // bundle and is built to dist/locales/ one file at a time instead. The text
  // editors are plugins like the rest since 6.0: up to 5.x the bundle carried
  // a copy of each.
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

  // Container plugins, likewise: a page loads the ones it wants
  var pluginFiles = [{
    expand: true,
    cwd: 'src/js/plugins/',
    src: ['*.js'],
    dest: 'dist/plugins/',
  }];
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    concat: {
      js: {
        src: jsFiles,
        dest: 'dist/jquery.grideditor.js',
      },

      // One file for a page that would rather load one: the editor with its
      // drag library inside it. A page loads this or the pair, never both.
      bundle: {
        options: {
          banner: '/*!\n' +
            ' * grid-editor <%= pkg.version %> bundled with SortableJS.\n' +
            ' *\n' +
            ' * grid-editor: MIT, https://github.com/themarioga/grid-editor\n' +
            ' * SortableJS: MIT, https://github.com/SortableJS/Sortable\n' +
            ' */\n',
        },
        src: [
          'node_modules/sortablejs/Sortable.min.js',
          'dist/jquery.grideditor.min.js',
        ],
        dest: 'dist/jquery.grideditor.bundle.min.js',
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
      plugins: {
        options: {
          sourceMap: true,
        },
        files: pluginFiles.map(function(files) {
          return Object.assign({}, files, { ext: '.min.js', extDot: 'last' });
        }),
      },
    },
    
    copy: {
      // The readable file is what a page loads, next to the minified one
      locales: {
        files: localeFiles,
      },
      plugins: {
        files: pluginFiles,
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
      build: {
        options: {
          sourceMap: true,
        },
        files: {
          'dist/grideditor.min.css': ['dist/grideditor.css'],
        },
      },
    },
    
    watch: {
      stylesheets: {
        files: ['src/**/*', 'example/*'],
        tasks: ['concat:js', 'uglify:build', 'less', 'cssmin', 'concat:bundle'],
        options: {
          spawn: false,
          livereload: true,
        },
      },
      plugins: {
        files: ['src/js/plugins/*.js'],
        tasks: ['copy:plugins', 'uglify:plugins'],
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

  grunt.registerTask('default', ['concat:js', 'uglify', 'less', 'cssmin', 'copy', 'concat:bundle']);

};