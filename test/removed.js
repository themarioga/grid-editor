/**
 * What 8.0 took out stays out: the deprecated utility plugins are not in
 * dist, the locale keys of the warnings it dropped are nowhere, the docs and
 * the code describe the editor as it is rather than as it was, and the
 * CKEditor error no longer talks about CKEditor 4.
 *
 * What stays on purpose, and may name old versions: the jQuery adapter,
 * which is 6.x's API; the conversion of markup 5.x saved; the credit to the
 * fork's origin; and the advice on tinyMCE releases.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var FIXTURE = '/test/fixtures/grid.html?init=manual';

var ALIASES = ['spacing', 'textalign', 'visibility', 'float'];
var RETIRED_KEYS = ['warning.setting_removed', 'warning.oninit_removed', 'warning.plugin_6x'];

/** A note about an earlier version: what the docs and the code should not have. */
var HISTORY = /deprecat|until 8|removed in [0-9]|up to [0-9]|since [0-9]\.[0-9]|[0-9]\.x\b|in [0-9]\.[0-9]\b|[0-9]\.[0-9] betas/i;

/**
 * Where such a note is the point: the adapter is 6.x's API, and the
 * conversion of 5.x's markup (and createElement's word about it) stays.
 */
var ALLOWED_FILES = ['src/js/grideditor.jquery.js'];
var ALLOWED_LINES = [
    /5\.x/,                                 // the conversion of markup 5.x saved, and its createElement warning
    /a block of the column since 6\.0/,     // that warning's text
    /A page written for 6\.x|jQuery API of 6\.x|Plugins written for 6\.x|written for 6\.x\./, // the adapter
    /carrying it on from 2\.x|including 2\.x to 3\.x|Everything from 3\.x on/,                // the fork's credit
    /tinyMCE 6 release/,                    // advice on which tinyMCE to use
];

function files(directory, pattern) {
    return fs.readdirSync(directory, { withFileTypes: true }).reduce(function(found, entry) {
        var full = path.join(directory, entry.name);
        if (entry.isDirectory()) { return found.concat(files(full, pattern)); }
        return pattern.test(entry.name) ? found.concat([full]) : found;
    }, []);
}

function staticTests(t) {
    var leftovers = fs.readdirSync(path.join(ROOT, 'dist', 'plugins')).filter(function(file) {
        return ALIASES.some(function(name) { return file.indexOf('grideditor.' + name + '.') === 0; });
    });
    t.check('dist/plugins has none of the deprecated utility plugins (AC-01)', leftovers.length === 0, leftovers);

    var sources = [
        path.join(ROOT, 'src', 'js', 'grideditor.js'),
        path.join(ROOT, 'src', 'js', 'locales', 'grideditor.es.js'),
        path.join(ROOT, 'docs', 'locale-keys.md'),
    ].concat(files(path.join(ROOT, 'src', 'js', 'plugins'), /\.js$/));
    var keys = [];
    sources.forEach(function(file) {
        var text = fs.readFileSync(file, 'utf8');
        RETIRED_KEYS.forEach(function(key) {
            if (text.indexOf(key) !== -1) { keys.push(path.relative(ROOT, file) + ': ' + key); }
        });
    });
    t.check('the keys of the warnings 8.0 dropped are in no locale and not in docs/locale-keys.md (AC-14)', keys.length === 0, keys);

    var documents = [path.join(ROOT, 'README.md')]
        .concat(files(path.join(ROOT, 'docs'), /\.md$/))
        .concat(files(path.join(ROOT, 'src'), /\.js$/));
    var notes = [];
    documents.forEach(function(file) {
        var relative = path.relative(ROOT, file);
        if (ALLOWED_FILES.indexOf(relative) !== -1) { return; }

        fs.readFileSync(file, 'utf8').split('\n').forEach(function(line, i) {
            if (HISTORY.test(line) && !ALLOWED_LINES.some(function(allowed) { return allowed.test(line); })) {
                notes.push(relative + ':' + (i + 1) + ': ' + line.trim());
            }
        });
    });
    t.check('the README, the docs and the code have no notes on earlier versions but the ones kept on purpose (AC-19)',
        notes.length === 0, notes.slice(0, 10));
}

async function ckeditorTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    var missing = await page.eval(`
        window.errorsLogged = [];
        const error = console.error;
        console.error = function() { window.errorsLogged.push(Array.prototype.join.call(arguments, ' ')); error.apply(console, arguments); };
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-12">' +
            '<div class="ge-content" data-ge-content-type="ckeditor"><p>a</p></div></div></div>';
        window.fixture.init({ content_types: ['ckeditor'] });
        document.querySelector('#myGrid .ge-content').click();
        console.error = error;
        return window.errorsLogged;
    `);
    t.check('with no CKEditor 5 on the page, the error says so and nothing about CKEditor 4 (AC-15)',
        missing.length === 1 && missing[0] === 'CKEditor 5 not available! Make sure you loaded its ckeditor5.umd.js file.', missing);

    var spanish = await page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('could not load the es locale'));
            document.head.appendChild(script);
        });
        return GridEditor.locales.es['error.ckeditor_missing'];
    `);
    t.check('and in Spanish too', spanish === '¡CKEditor 5 no está disponible! Asegúrate de haber cargado su archivo ckeditor5.umd.js.', spanish);

    var errors = page.errors([/CKEditor 5 not available/]);
    t.check('the CKEditor test logged no other errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'removed',
    description: 'what 8.0 took out: the deprecated plugins, the old warnings, the notes on earlier versions',
    run: async function(t) {
        staticTests(t);
        await ckeditorTests(t);
    },
};
