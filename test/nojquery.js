/**
 * No jQuery: what dist/ ships does not use it, but for the two files that are
 * about it - the jQuery adapter, and summernote's plugin, since summernote
 * needs jQuery itself - and a page with none edits with every plugin.
 *
 * The scan reads the readable builds, where the names are as written: a
 * minified file may call anything `$`. The bundle is the minified editor
 * behind SortableJS, whose own clone helper looks for window.jQuery or
 * Zepto and uses neither when they are not there; it is the editor's own
 * build that is held to this, in its readable form.
 *
 * Spec remove-jquery: I-1 and AC-01.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var fs = require('fs');
var path = require('path');

var DIST = path.join(__dirname, '..', 'dist');

/** Where a script reaches for jQuery: the global, its $ and its plugin API. */
var USES = /\bjQuery\s*[.(]|window\.jQuery\b|\$\.fn\b|\$\.(extend|each|data|Event|event)\b|\$\(/;

/** The two files that are about jQuery, and may use it. */
var ALLOWED = /^(grideditor\.jquery\.js|plugins\/grideditor\.summernote(\.esm)?\.js)$/;

function readableScripts() {
    var found = [];

    ['', 'plugins', 'locales'].forEach(function(dir) {
        fs.readdirSync(path.join(DIST, dir)).forEach(function(file) {
            if (!/\.js$/.test(file) || /\.min\.js$/.test(file)) { return; }
            found.push(dir ? dir + '/' + file : file);
        });
    });

    return found;
}

/** What the build makes of src: the editor, its module and the adapter, and each plugin and locale both ways. */
function expectedScripts() {
    var SRC = path.join(__dirname, '..', 'src', 'js');
    var count = function(dir) {
        return fs.readdirSync(path.join(SRC, dir)).filter(function(file) { return /\.js$/.test(file); }).length;
    };

    return 3 + 2 * count('plugins') + 2 * count('locales');
}

function staticTests(t) {
    var scripts = readableScripts();
    var using = scripts.filter(function(file) {
        return !ALLOWED.test(file) && USES.test(fs.readFileSync(path.join(DIST, file), 'utf8'));
    });

    t.check('every readable script in dist/ was scanned: the editor, its module, the adapter, each plugin and locale both ways',
        scripts.indexOf('grideditor.js') !== -1 && scripts.indexOf('grideditor.esm.js') !== -1 &&
        scripts.indexOf('plugins/grideditor.tabs.js') !== -1 && scripts.indexOf('plugins/grideditor.tabs.esm.js') !== -1 &&
        scripts.indexOf('locales/grideditor.es.esm.js') !== -1 && scripts.length === expectedScripts(),
        { found: scripts.length, expected: expectedScripts() });
    t.check('no file in dist/ uses jQuery but the adapter and the summernote plugin', using.length === 0, using);
    t.check('and those two do: the scan finds what it looks for',
        USES.test(fs.readFileSync(path.join(DIST, 'grideditor.jquery.js'), 'utf8')) &&
        USES.test(fs.readFileSync(path.join(DIST, 'plugins', 'grideditor.summernote.js'), 'utf8')));
    t.check('the jQuery-named 6.x builds are gone from dist/',
        !fs.existsSync(path.join(DIST, 'jquery.grideditor.js')) && !fs.existsSync(path.join(DIST, 'jquery.grideditor.bundle.min.js')));
}

async function runtimeTests(t) {
    var page = await t.page('/test/fixtures/grid.html?init=manual', `window.fixture`);

    var ran = await page.eval(`
        const settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
        document.querySelector('#myGrid').innerHTML =
            '<div class="row"><div class="col-6" id="left"><p>Left</p></div><div class="col-6" id="right"><p>Right</p></div></div>';
        const ge = window.fixture.init({ plugins: null, elements: { enabled: true }, confirm_delete: false });
        const steps = [];
        const step = function(name, work) {
            try { work(); steps.push(name); } catch (error) { steps.push(name + ': ' + error); }
        };

        step('add a row', function() { ge.createRow([4, 4, 4], { appendTo: '#myGrid' }); });
        step('add a column', function() { ge.createColumn(3, { appendTo: '#myGrid > .row' }); });
        step('containers', function() {
            ['tabs', 'accordion', 'popup', 'card'].forEach(function(type) { ge.createContainer(type, { appendTo: '#left' }); });
            ge.addTab(document.querySelector('[data-ge-container="tabs"]'), { label: 'More' });
            ge.addAccordionItem(document.querySelector('[data-ge-container="accordion"]'), { label: 'More' });
        });
        step('an element', function() { ge.createElement('<blockquote>Quote</blockquote>', { appendTo: '#right' }); });
        step('a section', function() { ge.createSection({ appendTo: '#myGrid', rows: [[6, 6]] }); });
        step('resize and indent', function() {
            document.querySelector('#left > .ge-tools-drawer .ge-decrease-col-width').click();
            document.querySelector('#left > .ge-tools-drawer .ge-increase-col-offset').click();
        });
        step('utilities', function() {
            ge.changeView('md');
            ge.setUtility('#right', 'order', '1');
            ge.setUtility('#right', 'display', 'none');
            ge.changeView('all');
        });
        step('settings panel', function() { document.querySelector('#left > .ge-tools-drawer .ge-settings').click(); });
        await settle(400);
        step('close the panel', function() { document.querySelector('body > .ge-settings-panel.show .ge-settings-close').click(); });
        await settle(400);
        step('source view', function() {
            document.querySelector('.gm-edit-mode').click();
            document.querySelector('.gm-edit-mode').click();
        });
        step('copy and paste a row', function() {
            document.querySelector('#myGrid > .row > .ge-tools-drawer .ge-copy').click();
            document.querySelector('.ge-add-feature[data-ge-feature="clipboard"][data-ge-item="0"]').click();
        });
        step('delete a column', function() { document.querySelector('#right > .ge-tools-drawer .ge-delete-column').click(); });
        await settle(700);
        step('getHtml and getPlainHtml', function() {
            const html = ge.getHtml();
            const marking = /.{0,80}(ge-tools-drawer|data-ge-|class="[^"]*\\bge-).{0,80}/.exec(ge.getPlainHtml());
            if (!/class="row/.test(html)) { throw new Error('no rows in getHtml'); }
            if (marking) { throw new Error('marking left in getPlainHtml: ' + marking[0]); }
        });
        step('reset and destroy', function() { ge.reset(); ge.destroy(); });

        return { steps: steps, jquery: typeof window.jQuery, dollar: typeof window.$ };
    `);

    var failed = ran.steps.filter(function(step) { return /: /.test(step); });
    t.check('on a page with no jQuery every operation runs, with every plugin loaded',
        failed.length === 0 && ran.steps.length === 14, ran.steps);
    t.check('and jQuery is still not there at the end', ran.jquery === 'undefined' && ran.dollar === 'undefined', ran);

    var errors = page.errors();
    t.check('the no-jQuery run logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function run(t) {
    staticTests(t);
    await runtimeTests(t);
}

module.exports = {
    name: 'nojquery',
    description: 'dist/ does not use jQuery but where it must, and a page with none edits with every plugin',
    run: run,
};

if (require.main === module) {
    require('./run').main(['nojquery']);
}
