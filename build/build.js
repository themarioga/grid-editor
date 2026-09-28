/**
 * The javascript build.
 *
 * The sources are ES modules; this turns them into what dist/ ships. Grunt
 * still runs the stylesheets and calls this for the scripts, so
 * `npm run build` is the one command either way.
 *
 *   node build/build.js
 *
 * Every script comes out twice: as a classic script for a <script> tag,
 * readable and minified with its map, and as an ES module for `import`.
 *
 * - dist/grideditor.js, .min.js           the editor, as window.GridEditor
 * - dist/grideditor.esm.js                 the editor, exporting GridEditor
 * - dist/grideditor.bundle.min.js          the minified editor with SortableJS
 *                                          in front of it, for a page that
 *                                          would rather load one file
 * - dist/grideditor.jquery.js, .min.js     the jQuery adapter, classic only:
 *                                          a jQuery page loads scripts
 * - dist/plugins/grideditor.<name>.js      each plugin, classic
 * - dist/plugins/grideditor.<name>.esm.js  and as a module
 * - dist/locales/grideditor.<code>.js      each locale, the same two ways
 * - dist/grideditor.d.ts                   the types of the public API
 *
 * A plugin's classic script finds the editor on window, through
 * src/js/register.js; its module imports ../grideditor.esm.js. Neither
 * carries a copy of the editor. The text editors carry
 * src/js/text/grideditor.text.js, which each of them imports.
 */

var fs = require('fs');
var path = require('path');
var esbuild = require('esbuild');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'src', 'js');
var DIST = path.join(ROOT, 'dist');

var pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// What the lint config allows the sources
var TARGET = 'es2018';

var COMMON = {
    bundle: true,
    target: TARGET,
    logLevel: 'warning',
    legalComments: 'inline',
    define: { __GRIDEDITOR_VERSION__: JSON.stringify(pkg.version) },
};

function write(file, contents) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
}

/**
 * The editor, as the classic script of a plugin sees it: the one the page
 * loaded, through register.js, never a copy.
 */
var editorFromWindow = {
    name: 'editor-from-window',
    setup: function(build) {
        build.onResolve({ filter: /(^|\/)grideditor\.js$/ }, function() {
            return { path: path.join(SRC, 'register.js') };
        });
    },
};

/** The editor, as a plugin's module sees it: the module build, next to it. */
function editorAsModule(relative) {
    return {
        name: 'editor-as-module',
        setup: function(build) {
            build.onResolve({ filter: /(^|\/)grideditor\.js$/ }, function() {
                return { path: relative, external: true };
            });
        },
    };
}

/** A classic script, readable and minified with its map. */
async function classic(entry, outfile, plugins) {
    var options = Object.assign({}, COMMON, {
        entryPoints: [entry],
        format: 'iife',
        plugins: plugins || [],
    });

    await esbuild.build(Object.assign({}, options, { outfile: outfile }));
    await esbuild.build(Object.assign({}, options, {
        outfile: outfile.replace(/\.js$/, '.min.js'),
        minify: true,
        sourcemap: 'external',
    }));
}

async function module_(entry, outfile, plugins) {
    await esbuild.build(Object.assign({}, COMMON, {
        entryPoints: [entry],
        outfile: outfile,
        format: 'esm',
        plugins: plugins || [],
    }));
}

async function core() {
    await classic(path.join(SRC, 'grideditor.classic.js'), path.join(DIST, 'grideditor.js'));
    await module_(path.join(SRC, 'grideditor.js'), path.join(DIST, 'grideditor.esm.js'));
    await classic(path.join(SRC, 'grideditor.jquery.js'), path.join(DIST, 'grideditor.jquery.js'), [editorFromWindow]);
}

function bundle() {
    var banner = '/*!\n' +
        ' * grid-editor ' + pkg.version + ' bundled with SortableJS.\n' +
        ' *\n' +
        ' * grid-editor: MIT, https://github.com/themarioga/grid-editor\n' +
        ' * SortableJS: MIT, https://github.com/SortableJS/Sortable\n' +
        ' */\n';
    var sortable = fs.readFileSync(path.join(ROOT, 'node_modules', 'sortablejs', 'Sortable.min.js'), 'utf8');
    var editor = fs.readFileSync(path.join(DIST, 'grideditor.min.js'), 'utf8')
        // The map belongs to the file on its own, not to the bundle
        .replace(/\n?\/\/# sourceMappingURL=.*\s*$/, '\n');

    write(path.join(DIST, 'grideditor.bundle.min.js'), banner + sortable + '\n' + editor);
}

/** Every plugin, or every locale, both ways. */
async function extensions(fromDir, toDir) {
    var files = fs.readdirSync(fromDir).filter(function(file) { return /\.js$/.test(file); });

    for (var file of files) {
        var entry = path.join(fromDir, file);

        await classic(entry, path.join(toDir, file), [editorFromWindow]);
        await module_(entry, path.join(toDir, file.replace(/\.js$/, '.esm.js')), [editorAsModule('../grideditor.esm.js')]);
    }
}

function types() {
    var source = path.join(ROOT, 'types', 'grideditor.d.ts');
    if (fs.existsSync(source)) { write(path.join(DIST, 'grideditor.d.ts'), fs.readFileSync(source, 'utf8')); }
}

async function main() {
    await core();
    bundle();
    await extensions(path.join(SRC, 'plugins'), path.join(DIST, 'plugins'));
    await extensions(path.join(SRC, 'locales'), path.join(DIST, 'locales'));
    types();
}

module.exports = { main: main };

if (require.main === module) {
    main().catch(function(error) {
        console.error(error);
        process.exitCode = 1;
    });
}
