/**
 * Browser tests for the float plugin: float-start, -end and -none per
 * breakpoint, on elements.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.col = function() { return jQuery('#myGrid .column').first(); };
    window.element = function() { return jQuery('#myGrid .ge-element').first(); };
    window.floating = function() { return getComputedStyle(element()[0]).float; };
    window.start = function(elementClasses, elementStyle) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row"><div class="column col-12"><div class="ge-content">' +
            '<div data-ge-element="aside" class="' + elementClasses + '"' + (elementStyle ? ' style="' + elementStyle + '"' : '') + '>aside</div>' +
            '<p>Text that flows round the element.</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['float']) });
    };
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var fields = await page.eval(`
        start('');
        const field = function(node) { return node.find('> .ge-tools-drawer .ge-utility[data-ge-family="float"]'); };
        return {
            element: field(element()).length,
            column: field(col()).length,
            row: field(jQuery('#myGrid .row').first()).length,
            options: field(element()).find('option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
            onColumn: ge().setUtility(col(), 'float', 'end'),
        };
    `);
    t.check('only elements get the float field',
        fields.element === 1 && fields.column === 0 && fields.row === 0 &&
        fields.options === '=Default,start=Start,end=End,none=None',
        fields);
    t.check('floating a column is refused',
        fields.onColumn === false, fields);

    var views = await page.eval(`
        start('float-md-end');
        const read = function(view) { ge().changeView(view); return floating(); };
        return { xs: read('xs'), md: read('md'), xxl: read('xxl'), all: (ge().changeView('all'), element().attr('data-ge-preview')) };
    `);
    t.check('each breakpoint view shows how the element floats there',
        views.xs === 'none' && views.md === 'right' && views.xxl === 'right', views);
    t.check('the all view leaves it to Bootstrap',
        views.all === undefined, views);

    var host = await page.eval(`
        start('float-md-none', 'float: left');
        ge().changeView('sm');
        const sm = floating();
        ge().changeView('md');
        const md = floating();
        ge().setUtility(element(), 'float', 'start');
        const html = ge().getHtml();
        return { sm: sm, md: md, html: html };
    `);
    t.check('with no class applying, the host\'s own float stands; a class overrules it',
        host.sm === 'left' && host.md === 'none', host);
    t.check('getHtml has the class and the host\'s style, and no preview',
        /float-md-start/.test(host.html) && /style="float: left;?"/.test(host.html) &&
        !/data-ge-preview|important/.test(host.html),
        host.html.slice(0, 200));

    var errors = page.errors();
    t.check('the float tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'float',
    description: 'the float utility plugin',
    run: run,
};
