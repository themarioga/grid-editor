/**
 * Browser tests for the alignment plugin: justify-content and align-items on
 * rows, align-self on columns, per breakpoint.
 *
 * The plugin is three families and their previews, so that is what is tested:
 * which node gets which field, and that each view shows what the classes mean
 * there. The engine underneath is covered by test/utilities.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.row = function() { return jQuery('#myGrid > .row').first(); };
    window.col = function() { return row().children('.column').first(); };
    window.families = function(node) {
        return node.find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(',');
    };
    window.css = function() {
        return {
            justify: getComputedStyle(row()[0]).justifyContent,
            items: getComputedStyle(row()[0]).alignItems,
            self: getComputedStyle(col()[0]).alignSelf,
        };
    };
    window.start = function(rowClasses, colClasses) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row ' + rowClasses + '">' +
            '<div class="column col-4 ' + colClasses + '"><div class="ge-content"><p>a</p></div></div>' +
            '<div class="column col-4"><div class="ge-content"><p>b</p><p>taller</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['alignment']) });
    };
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var fields = await page.eval(`
        start('', '');
        return {
            row: families(row()),
            column: families(col()),
            labels: row().find('> .ge-tools-drawer .ge-utility-label').map(function() { return this.textContent; }).get().join(','),
            justifyValues: row().find('> .ge-tools-drawer .ge-utility[data-ge-family="justify-content"] option').map(function() { return this.value; }).get().join(','),
        };
    `);
    t.check('rows get justify-content and align-items, columns align-self',
        // row-cols and the width are the core's own fields
        fields.row === 'row-cols,justify-content,align-items' && fields.column === 'col,align-self' &&
        fields.labels === 'Columns per row,Justify columns,Align columns' &&
        fields.justifyValues === ',start,center,end,between,around,evenly',
        fields);

    var previews = await page.eval(`
        start('justify-content-center justify-content-lg-between align-items-md-end', 'align-self-start align-self-xl-stretch');
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
        start('', '');
        ge().changeView('md');
        const select = row().find('> .ge-tools-drawer .ge-utility[data-ge-family="justify-content"] select');
        select.val('evenly').trigger('change');
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

    var errors = page.errors();
    t.check('the alignment tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'alignment',
    description: 'the alignment utility plugin',
    run: run,
};
