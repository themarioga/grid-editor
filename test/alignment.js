/**
 * Browser tests for the alignment plugin, which is align-self on columns per
 * breakpoint, and for where a row's justify-content and align-items went: the
 * style plugin's Flex section.
 *
 * The engine underneath is covered by test/utilities.js, and the Flex
 * section's families by test/flex.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };
    /** The families in a node's Responsive section. */
    window.responsive = function(node) {
        return Array.from(node.querySelectorAll(':scope > .ge-tools-drawer .ge-utilities .ge-utility')).map(function(field) { return field.getAttribute('data-ge-family'); }).join(',');
    };
    /** The families in a node's Style › Flex section. */
    window.flexFields = function(node) {
        const section = node.querySelector(':scope > .ge-tools-drawer [data-ge-style-section="flex"]');
        return section ? Array.from(section.querySelectorAll('.ge-utility')).map(function(field) { return field.getAttribute('data-ge-family'); }).join(',') : '';
    };
    window.css = function() {
        return {
            justify: getComputedStyle(row()).justifyContent,
            items: getComputedStyle(row()).alignItems,
            self: getComputedStyle(col()).alignSelf,
        };
    };
    window.start = function(rowClasses, colClasses, plugins) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        window.warnings = [];
        document.querySelector('#myGrid').innerHTML = ('<div class="row ' + rowClasses + '">' +
            '<div class="column col-4 ' + colClasses + '"><div class="ge-content"><p>a</p></div></div>' +
            '<div class="column col-4"><div class="ge-content"><p>b</p><p>taller</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(plugins || ['alignment']) });
    };
    window.texts = function(nodes) { return Array.from(nodes).map(function(node) { return node.textContent; }).join(','); };
`;

async function run(t, page) {
    var alone = await page.eval(`
        start('', '');
        return {
            row: responsive(row()),
            column: responsive(col()),
            labels: texts(col().querySelectorAll(':scope > .ge-tools-drawer .ge-utilities .ge-utility-label')),
        };
    `);
    t.check('alone, alignment gives a column align-self and a row nothing (AC-41)',
        // row-cols and the width are the core's own fields
        alone.row === 'row-cols' && alone.column === 'col,align-self' && alone.labels === 'Width,Align self',
        alone);

    var both = await page.eval(`
        start('', '', ['style', 'alignment']);
        return {
            row: responsive(row()),
            flex: flexFields(row()),
            column: responsive(col()),
            duplicates: window.warnings.filter(function(w) { return /already declared/.test(w); }),
        };
    `);
    t.check('with style, a row\'s justify-content and align-items are in Style › Flex, not in Responsive (AC-40)',
        both.row === 'row-cols' && both.flex.indexOf('justify-content,align-items') !== -1 &&
        both.column === 'col,align-self' && both.duplicates.length === 0, both);

    var previews = await page.eval(`
        start('justify-content-center justify-content-lg-between align-items-md-end', 'align-self-start align-self-xl-stretch', ['style', 'alignment']);
        const read = function(view) { ge().changeView(view); return css(); };
        return { xs: read('xs'), md: read('md'), lg: read('lg'), xl: read('xl') };
    `);
    t.check('each breakpoint view shows the alignment its classes give there',
        previews.xs.justify === 'center' && previews.xs.items === 'normal' && previews.xs.self === 'flex-start' &&
        previews.md.items === 'flex-end' && previews.md.justify === 'center' &&
        previews.lg.justify === 'space-between' && previews.lg.self === 'flex-start' &&
        previews.xl.self === 'stretch',
        previews);

    var written = await page.eval(`
        start('', '', ['style', 'alignment']);
        ge().changeView('md');
        const select = row().querySelector(':scope > .ge-tools-drawer [data-ge-style-section="flex"] .ge-utility[data-ge-family="justify-content"] select');
        select.value = 'evenly';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        ge().setUtility(col(), 'align-self', 'center');
        const shown = css();
        const html = ge().getHtml();
        return { shown: shown, html: html };
    `);
    t.check('a choice in the panel or through the API is written for the breakpoint and shown at once',
        written.shown.justify === 'space-evenly' && written.shown.self === 'center' &&
        /class="row justify-content-md-evenly"/.test(written.html) && /align-self-md-center/.test(written.html),
        written.shown);
    t.check('getHtml has the classes and no preview',
        !/data-ge-preview|style=/.test(written.html), written.html.slice(0, 200));
}

module.exports = {
    name: 'alignment',
    description: 'the alignment utility plugin, and justify and align in the style plugin',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await run(t, page);

        var errors = page.errors();
        t.check('the alignment tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
