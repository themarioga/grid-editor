/**
 * Tests for the test fixtures themselves.
 *
 * The fixture pages under `test/fixtures` load SortableJS and Bootstrap - and,
 * for the jQuery API's page, jQuery - from `test/vendor`, which is what lets
 * the rest of the suites run with the network switched off. That property is
 * easy to lose by copying a CDN link into a new fixture, so it is asserted
 * here: every request the page makes has to go to the test server.
 *
 * grid.html has no jQuery at all since 7.0, which is asserted too: the page
 * most suites run on is the proof that the editor does not need it.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

/**
 * Where the page actually loaded its resources from, and what it ended up with.
 */
var LOADED = `
    return {
        external: performance.getEntriesByType('resource')
            .map(entry => entry.name)
            .filter(name => name.indexOf(window.location.origin + '/') !== 0),
        jquery: window.jQuery ? window.jQuery.fn.jquery : null,
        dollar: typeof window.$,
        sortable: window.Sortable && Sortable.version,
        bootstrap: window.bootstrap && bootstrap.Tooltip.VERSION,
        icons: getComputedStyle(document.querySelector('.ge-tools-drawer .bi'), '::before').fontFamily,
        editor: typeof window.GridEditor,
        adapter: !!(window.jQuery && window.jQuery.fn.gridEditor),
    };
`;

async function run(t) {
    var page = await t.page('/test/fixtures/grid.html', `window.GridEditor && GridEditor.get('#myGrid')`);

    var loaded = await page.eval(LOADED);
    t.check('the fixture loads every dependency from the test server, not a CDN',
        loaded.external.length === 0, loaded.external.slice(0, 5));
    t.check('the vendored dependencies are the versions the fixture expects',
        /^1\.15\./.test(loaded.sortable) && /^5\.3\./.test(loaded.bootstrap) && loaded.editor === 'function',
        loaded);
    t.check('the fixture has no jQuery: the editor and its plugins run without it',
        loaded.jquery === null && loaded.dollar === 'undefined' && !loaded.adapter, loaded);
    t.check('the vendored icon font is the one the tool drawers render with',
        /bootstrap-icons/.test(loaded.icons), loaded);

    var initialized = await page.eval(`
        return {
            editing: document.querySelector('#myGrid').classList.contains('ge-editing'),
            rows: document.querySelectorAll('#myGrid > .row').length,
            columns: document.querySelectorAll('#myGrid .column').length,
            contentAreas: document.querySelectorAll('#myGrid .ge-content').length,
            drawers: document.querySelectorAll('#myGrid .ge-tools-drawer').length,
            addRowButtons: document.querySelectorAll('.ge-addRowGroup a').length,
        };
    `);
    t.check('the fixture initializes an editable canvas without a rich text editor',
        initialized.editing && initialized.rows === 2 && initialized.columns === 3 &&
        initialized.contentAreas === 3 && initialized.drawers > 0 &&
        initialized.addRowButtons === 3,
        initialized);

    // The editor has to work on this page as well as boot on it: add a row
    // from the toolbar, then check the markup it exports
    await page.click('.ge-addRowGroup a', 1);
    await sleep(300);
    var added = await page.eval(`
        const rows = document.querySelectorAll('#myGrid > .row');
        const columns = rows[rows.length - 1].querySelectorAll(':scope > .column');
        return {
            rows: rows.length,
            columnsInNewRow: columns.length,
            sizes: Array.from(columns, function(column) { return column.getAttribute('class'); }),
        };
    `);
    t.check('a row added from the toolbar lands on the fixture canvas',
        added.rows === 3 && added.columnsInNewRow === 2, added);

    var exported = await page.eval(`
        const html = GridEditor.get('#myGrid').getHtml();
        return {
            html: html.slice(0, 400),
            keptContent: html.indexOf('Fixture heading') !== -1,
            drawers: /ge-tools-drawer/.test(html),
            editable: /contenteditable/i.test(html),
            sortable: /ui-sortable|ge-drag-/.test(html),
            stillEditing: document.querySelector('#myGrid').classList.contains('ge-editing'),
        };
    `);
    t.check('getHtml on the fixture returns markup with no editor furniture',
        exported.keptContent && !exported.drawers && !exported.editable &&
        !exported.sortable && exported.stillEditing,
        exported);

    var errors = page.errors();
    t.check('the fixture logged no errors', errors.length === 0, errors.slice(0, 5));

    // The jQuery API's page loads its jQuery from the test server too
    var adapter = await t.page('/test/fixtures/adapter.html', `window.jQuery && jQuery('#myGrid').data('grideditor')`);
    var adapterLoaded = await adapter.eval(LOADED);
    t.check('the jQuery API\'s fixture loads its vendored jQuery 4 and the adapter, from the test server',
        adapterLoaded.external.length === 0 && /^4\./.test(adapterLoaded.jquery) && adapterLoaded.adapter,
        adapterLoaded);

    // Suites that need to initialize with their own settings, or to watch the
    // first init happen, open the page with ?init=manual
    var manual = await t.page('/test/fixtures/grid.html?init=manual', `window.fixture`);
    var before = await manual.eval(`
        return {
            instance: !!GridEditor.get('#myGrid'),
            drawers: document.querySelectorAll('#myGrid .ge-tools-drawer').length,
        };
    `);
    var after = await manual.eval(`
        window.fixture.init({ new_row_layouts: [[12]] });
        return {
            instance: !!GridEditor.get('#myGrid'),
            addRowButtons: document.querySelectorAll('.ge-addRowGroup a').length,
        };
    `);
    t.check('?init=manual leaves the canvas alone until the suite initializes it',
        !before.instance && before.drawers === 0 && after.instance && after.addRowButtons === 1,
        { before: before, after: after });
}

module.exports = {
    name: 'fixtures',
    description: 'the offline test fixtures',
    run: run,
};

if (require.main === module) {
    require('./run').main(['fixtures']);
}
