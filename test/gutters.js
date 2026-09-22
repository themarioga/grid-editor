/**
 * Browser tests for the gutters plugin: g, gx and gy on rows, per
 * breakpoint.
 *
 * What needs testing beyond the engine is the preview, which has to settle g
 * against gx the way Bootstrap's own css does, and the canvas, which draws a
 * row with gutter classes with its real gutters instead of the editor frame.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.row = function() { return jQuery('#myGrid > .row').first(); };
    window.col = function() { return row().children('.column').first(); };
    window.gutters = function() {
        const style = getComputedStyle(row()[0]);
        return {
            x: style.getPropertyValue('--bs-gutter-x').trim(),
            y: style.getPropertyValue('--bs-gutter-y').trim(),
            padding: getComputedStyle(col()[0]).paddingLeft,
            marked: row().hasClass('ge-gutters'),
        };
    };
    window.classes = function() {
        return (row().attr('class') || '').split(/\\s+/).filter(function(name) { return /^g[xy]?-/.test(name); }).sort().join(' ');
    };
    window.start = function(rowClasses) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row ' + rowClasses + '">' +
            '<div class="column col-6"><div class="ge-content"><p>a</p></div></div>' +
            '<div class="column col-6"><div class="ge-content"><p>b</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['gutters']) });
    };
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var plain = await page.eval(`
        start('');
        return {
            fields: row().find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(','),
            // The width field is the core's, on every column
            columnFields: col().find('> .ge-tools-drawer ' + '.ge-utility:not([data-ge-family="col"])').length,
            gutters: gutters(),
        };
    `);
    t.check('rows get g, gx and gy fields; columns get none',
        plain.fields === 'g,gx,gy' && plain.columnFields === 0, plain);
    t.check('a row with no gutter class keeps the editor\'s own frame',
        !plain.gutters.marked && plain.gutters.padding === '5px', plain.gutters);

    var perView = await page.eval(`
        start('g-2 g-md-5');
        const read = function(view) { ge().changeView(view); return gutters(); };
        return { xs: read('xs'), md: read('md'), all: (ge().changeView('all'), row().attr('data-ge-preview')) };
    `);
    t.check('a breakpoint view shows that breakpoint\'s gutters, and the columns are padded by them',
        perView.xs.x === '.5rem' && perView.xs.y === '.5rem' && perView.xs.padding === '4px' && perView.xs.marked &&
        perView.md.x === '3rem' && perView.md.padding === '24px',
        perView);
    t.check('the all view leaves the gutters to Bootstrap',
        perView.all === undefined, perView);

    var settled = await page.eval(`
        start('g-3 gx-1 gy-md-1');
        ge().changeView('xs');
        const xs = gutters();
        ge().changeView('md');
        const md = gutters();
        start('g-1 gx-md-4');
        ge().changeView('md');
        return { xs: xs, md: md, wider: gutters() };
    `);
    t.check('g and gx at one breakpoint settle as Bootstrap does: the bigger value wins',
        settled.xs.x === '1rem' && settled.xs.y === '1rem', settled.xs);
    t.check('a wider breakpoint\'s class wins over a smaller one\'s, whichever family',
        settled.md.y === '.25rem' && settled.md.x === '1rem' && settled.wider.x === '1.5rem' && settled.wider.y === '.25rem',
        settled);

    var chosen = await page.eval(`
        start('gx-md-4 gy-md-2 gx-lg-1');
        ge().changeView('md');
        row().find('> .ge-tools-drawer .ge-utility[data-ge-family="g"] select').val('3').trigger('change');
        const afterG = classes();
        const html = ge().getHtml();
        return { afterG: afterG, html: html };
    `);
    t.check('choosing g takes that breakpoint\'s gx and gy off, and leaves other breakpoints alone',
        chosen.afterG === 'g-md-3 gx-lg-1', chosen);
    t.check('getHtml has the classes and none of the editing marks',
        /class="row g-md-3 gx-lg-1"|class="row gx-lg-1 g-md-3"/.test(chosen.html) &&
        !/ge-gutters|data-ge-preview|style=/.test(chosen.html),
        chosen.html.slice(0, 160));

    var scaled = await page.eval(`
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row g-2"><div class="column col-12"><div class="ge-content"><p>a</p></div></div></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['gutters']), default_view: 'sm',
            utilities: { gutters: { scale: ['0', '2px', '10px', '20px', '30px', '40px'] } } });
        return gutters().x;
    `);
    t.check('utilities.gutters.scale is what the values come to in the preview',
        scaled === '10px', scaled);

    var errors = page.errors();
    t.check('the gutters tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'gutters',
    description: 'the gutters utility plugin',
    run: run,
};
