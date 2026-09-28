module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');

  // The scripts are ES modules built by build/build.js, which says what comes
  // out of it; Grunt runs the stylesheets and calls it.
  grunt.registerTask('scripts', 'Build the javascript into dist/', function() {
    var done = this.async();
    require('./build/build.js').main().then(function() { done(); }, function(error) {
      grunt.log.error(error && error.stack || error);
      done(false);
    });
  });

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

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
      scripts: {
        files: ['src/js/**/*.js', 'build/*.js'],
        tasks: ['scripts'],
        options: {
          spawn: false,
          livereload: true,
        },
      },
      stylesheets: {
        files: ['src/less/**/*', 'example/*'],
        tasks: ['less', 'cssmin'],
        options: {
          spawn: false,
          livereload: true,
        },
      },
    },
    
  });

  grunt.registerTask('default', ['scripts', 'less', 'cssmin']);

};
