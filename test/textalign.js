/**
 * Browser tests for the textalign plugin: text-start, -center and -end per
 * breakpoint, on rows, columns, elements and containers.
 *
 * The preview is the interesting part. With no class applying in a view a
 * node aligns as its parent does, or as the host's css says, and a wider
 * breakpoint's class that is live in a wide window must not show through.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };
    window.align = function(node) { return getComputedStyle(node).textAlign; };
    window.start = function(rowClasses, colClasses, colStyle) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        document.querySelector('#myGrid').innerHTML = ('<div class="row ' + rowClasses + '">' +
            '<div class="column col-6 ' + colClasses + '"' + (colStyle ? ' style="' + colStyle + '"' : '') + '>' +
            '<div class="ge-content"><p>a</p><div data-ge-element="box">box</div></div></div>' +
            '<div class="column col-6"><div class="ge-content"><p>b</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['style']) });
    };
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var fields = await page.eval(`
        start('', '');
        const field = function(node) { return node.querySelectorAll(':scope > .ge-tools-drawer .ge-utility[data-ge-family="text-align"]'); };
        return {
            row: field(row()).length,
            column: field(col()).length,
            element: field(document.querySelector('#myGrid .ge-element')).length,
            options: Array.from(field(col())[0].querySelectorAll('option')).map(function(option) { return option.value + '=' + option.textContent; }).join(','),
        };
    `);
    t.check('rows, columns and elements get the text alignment field',
        fields.row === 1 && fields.column === 1 && fields.element === 1 &&
        fields.options === '=Default,start=Start,center=Center,end=End',
        fields);

    var views = await page.eval(`
        start('', 'text-center text-lg-end');
        const read = function(view) { ge().changeView(view); return align(col()); };
        return { xs: read('xs'), md: read('md'), lg: read('lg'), drawer: align(col().querySelector(':scope > .ge-tools-drawer')) };
    `);
    t.check('each breakpoint view shows the alignment its classes give there',
        views.xs === 'center' && views.md === 'center' && views.lg === 'right', views);
    t.check('the drawer\'s tools stay where they are whatever the node aligns',
        views.drawer === 'left', views);

    var inherited = await page.eval(`
        start('text-md-center', 'text-lg-end');
        const read = function(view) { ge().changeView(view); return { row: align(row()), col: align(col()) }; };
        return { xs: read('xs'), md: read('md'), xl: read('xl'), classes: col().getAttribute('class') };
    `);
    t.check('with no class applying, a node aligns as its parent does in that view',
        inherited.xs.row === 'start' && inherited.xs.col === 'start' &&
        inherited.md.row === 'center' && inherited.md.col === 'center' &&
        inherited.xl.col === 'right',
        inherited);
    t.check('asking the browser leaves the node\'s classes as they were',
        /text-lg-end/.test(inherited.classes) && /column col-6/.test(inherited.classes), inherited.classes);

    var host = await page.eval(`
        start('', 'text-md-center', 'text-align: right');
        ge().changeView('sm');
        const sm = align(col());
        const html = ge().getHtml();
        return { sm: sm, html: html };
    `);
    t.check('with no class applying, the host\'s own css stands',
        host.sm === 'right', host);
    t.check('getHtml has the class and the host\'s style, and no preview',
        /text-md-center/.test(host.html) && /style="text-align: right;?"/.test(host.html) &&
        !/data-ge-preview|important/.test(host.html),
        host.html.slice(0, 200));

    var errors = page.errors();
    t.check('the textalign tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'textalign',
    description: 'the textalign utility plugin',
    run: run,
};
