/**
 * Golden outputs: what getHtml and getPlainHtml gave in 6.0.0, for the
 * fixtures and for one scripted edit per kind of operation.
 *
 * 7.0 rewrote the editor without jQuery and promises the same markup for the
 * same input and the same edits (spec remove-jquery, I-2 and AC-02). The
 * baseline in test/fixtures/golden/ was recorded from the 6.0.0 dist, before
 * any of that rewrite, and every later build has to give it back.
 *
 *   npm test -- golden              compare with the baseline
 *   RECORD=1 npm test -- golden     write the baseline again (only on 6.0.0)
 *
 * The scenarios run through whichever API the fixture page has: the native
 * one when there is a GridEditor.get, the jQuery one otherwise. They drive the
 * editor with its methods and with clicks on its own tools, nothing that
 * depends on how it is built inside.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var fs = require('fs');
var path = require('path');

var FIXTURE = '/test/fixtures/grid.html?init=manual';
var GOLDEN = path.join(__dirname, 'fixtures', 'golden');
var BASELINE = path.join(GOLDEN, 'baseline.json');
var RECORDED_5X = path.join(__dirname, 'fixtures', '5x');

var HELPERS = `
    const grid = document.querySelector(window.fixture.grid);
    const native = () => window.GridEditor && typeof window.GridEditor.get === 'function';

    window.G = {
        call: function(name, ...args) {
            if (native()) {
                const instance = window.GridEditor.get(grid);
                return instance ? instance[name](...args) : null;
            }
            return window.jQuery(grid).gridEditor(name, ...args);
        },
        running: function() {
            return native() ? !!window.GridEditor.get(grid) : !!window.jQuery(grid).data('grideditor');
        },
        start: function(html, overrides) {
            if (G.running()) { G.call('destroy'); }
            if (html !== null) { grid.innerHTML = html; }
            window.fixture.init(Object.assign({ confirm_delete: false }, overrides || {}));
        },
        click: function(selector, index) {
            const found = grid.querySelectorAll(selector);
            const node = found[index || 0];
            if (!node) { throw new Error('no ' + selector + ' at ' + (index || 0)); }
            node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            node.click();
        },
        result: function() {
            return { html: G.call('getHtml'), plain: G.call('getPlainHtml') };
        },
    };
    return true;
`;

/**
 * Each scenario is a script run in the page after HELPERS; it returns what the
 * canvas gives once it is done. The original markup of the fixture page is
 * kept in window.ORIGINAL, taken before any editor touched it.
 */
var SCENARIOS = {
    'fixture': `
        G.start(ORIGINAL);
        return G.result();
    `,
    'fixture-with-every-plugin': `
        G.start(ORIGINAL, { plugins: null });
        return G.result();
    `,
    'add-rows': `
        G.start(ORIGINAL);
        G.call('createRow', [8, 4], { appendTo: '#myGrid' });
        G.call('createRow', ['auto', 'equal'], { prependTo: '#myGrid' });
        G.call('createRow', { row_cols: { xs: 1, md: 3 }, columns: 6 }, { appendTo: '#myGrid' });
        return G.result();
    `,
    'add-row-from-toolbar': `
        G.start(ORIGINAL);
        document.querySelectorAll('.ge-addRowGroup a')[1].click();
        return G.result();
    `,
    'add-column': `
        G.start(ORIGINAL);
        G.call('createColumn', 3, { appendTo: '#myGrid > .row:last-child', offset: 1 });
        return G.result();
    `,
    'delete-row': `
        G.start(ORIGINAL);
        G.click('.ge-delete-row', 0);
        return new Promise(resolve => setTimeout(() => resolve(G.result()), 700));
    `,
    'delete-column': `
        G.start(ORIGINAL);
        G.click('.ge-delete-column', 2);
        return new Promise(resolve => setTimeout(() => resolve(G.result()), 700));
    `,
    'resize-and-indent': `
        G.start(ORIGINAL);
        G.click('.ge-decrease-col-width', 1);
        G.click('.ge-increase-col-offset', 1);
        G.call('changeView', 'md');
        G.click('.ge-decrease-col-width', 0);
        G.call('changeView', 'all');
        return G.result();
    `,
    'utilities': `
        G.start(ORIGINAL, { plugins: window.fixture.plugins(['visibility', 'order', 'alignment', 'gutters', 'spacing', 'textalign', 'float']) });
        const second = document.querySelectorAll('#myGrid > .row')[1];
        const column = second.querySelector('.column');
        G.call('setUtility', column, 'order', '2', 'md');
        G.call('setUtility', column, 'display', 'none', 'xs');
        G.call('setUtility', second, 'g', '0');
        return G.result();
    `,
    'containers': `
        G.start(ORIGINAL);
        const tabs = G.call('createContainer', 'tabs', { appendTo: '#myGrid > .row:first-child > .column' });
        G.call('addTab', tabs, { label: 'Second' });
        const accordion = G.call('createContainer', 'accordion', { appendTo: '#myGrid > .row:last-child > .column:first-child' });
        G.call('addAccordionItem', accordion, { label: 'More' });
        G.call('createContainer', 'popup', { appendTo: '#myGrid > .row:last-child > .column:last-child' });
        G.call('createContainer', 'card', { appendTo: '#myGrid > .row:first-child > .column' });
        return G.result();
    `,
    'elements': `
        G.start(ORIGINAL, { elements: { enabled: true } });
        G.call('createElement', '<blockquote><p>A quote</p></blockquote>', { type: 'quote', label: 'Quote', appendTo: '#myGrid > .row:first-child > .column' });
        return G.result();
    `,
    'sections': `
        G.start(ORIGINAL, { plugins: window.fixture.plugins(['sections']) });
        G.call('createSection', { width: 'md', rows: [[6, 6]], appendTo: '#myGrid' });
        return G.result();
    `,
    'texts': `
        G.start(ORIGINAL, { content_types: ['tinymce'] });
        G.call('createText', 'tinymce', { content: '<p>New text</p>', appendTo: '#myGrid > .row:first-child > .column' });
        return G.result();
    `,
    'view-change-and-reset': `
        G.start(ORIGINAL);
        G.call('changeView', 'lg');
        G.call('reset');
        G.call('changeView', 'all');
        return G.result();
    `,
};

function fiveX() {
    return fs.readdirSync(RECORDED_5X)
        .filter(function(file) { return /^[a-z]+\.html$/.test(file); })
        .sort()
        .map(function(file) {
            return {
                name: '5x-' + file.replace('.html', ''),
                html: fs.readFileSync(path.join(RECORDED_5X, file), 'utf8'),
                overrides: file === 'auto.html' ? { elements: { enabled: true, auto: true } } : {},
            };
        });
}

async function collect(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(`window.ORIGINAL = document.querySelector(window.fixture.grid).innerHTML; return true;`);
    await page.eval(HELPERS);

    var results = {};

    for (var name of Object.keys(SCENARIOS)) {
        results[name] = await page.eval(SCENARIOS[name]);
    }

    for (var recorded of fiveX()) {
        results[recorded.name] = await page.eval(`
            G.start(${JSON.stringify(recorded.html)}, ${JSON.stringify(Object.assign({ plugins: null }, recorded.overrides))});
            return G.result();
        `);
    }

    return { results: results, errors: page.errors() };
}

/**
 * Container ids end in four random characters (ge-tab-1-x3kd), different on
 * every run; what is compared is everything else.
 */
function stable(result) {
    if (!result) { return result; }

    var strip = function(html) { return html.replace(/\b(ge-[a-z-]+-\d+)-[a-z0-9]{4}\b/g, '$1-????'); };
    return { html: strip(result.html), plain: strip(result.plain) };
}

async function run(t) {
    var collected = await collect(t);
    Object.keys(collected.results).forEach(function(name) {
        collected.results[name] = stable(collected.results[name]);
    });

    t.check('the golden scenarios logged no errors', collected.errors.length === 0, collected.errors.slice(0, 5));

    if (process.env.RECORD) {
        fs.mkdirSync(GOLDEN, { recursive: true });
        fs.writeFileSync(BASELINE, JSON.stringify(collected.results, null, 2) + '\n');
        t.check('the baseline was written to test/fixtures/golden/baseline.json', true);
        return;
    }

    if (!fs.existsSync(BASELINE)) {
        t.check('a baseline exists in test/fixtures/golden (record it with RECORD=1)', false);
        return;
    }

    var baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

    Object.keys(baseline).forEach(function(name) {
        var then = baseline[name];
        var now = collected.results[name];
        var same = now && now.html === then.html && now.plain === then.plain;
        t.check('"' + name + '" gives the markup 6.0.0 gave', same, same ? undefined : { now: now, then: then });
    });

    t.check('every scenario has a baseline',
        Object.keys(collected.results).every(function(name) { return name in baseline; }),
        Object.keys(collected.results).filter(function(name) { return !(name in baseline); }));
}

module.exports = {
    name: 'golden',
    description: 'getHtml and getPlainHtml give what 6.0.0 gave, for the fixtures and one edit per operation',
    run: run,
};

if (require.main === module) {
    require('./run').main(['golden']);
}
