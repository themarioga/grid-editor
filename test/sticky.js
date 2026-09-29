/**
 * Browser tests for the style plugin's sticky: sticking a node to the top or
 * the bottom as the page scrolls, per breakpoint.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };
    window.stickyField = function(node) {
        return node.querySelector(':scope > .ge-tools-drawer [data-ge-style-section="position"] .ge-utility[data-ge-family="sticky"]');
    };
    window.start = function(colClasses) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-6 ' + colClasses + '">' +
            '<div class="ge-content"><p>a</p></div></div></div>';
        window.fixture.init({ plugins: window.fixture.plugins(['style']) });
    };
`;

async function run(t, page) {
    var written = await page.eval(`
        start('');
        ge().changeView('md');
        const field = stickyField(col());
        const options = field ? Array.from(field.querySelectorAll('option')).map(function(option) { return option.value; }).join(',') : null;
        const select = field.querySelector('select');
        select.value = 'top';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return { options: options, label: field.querySelector('.ge-utility-label').textContent, stuck: col().classList.contains('sticky-md-top') };
    `);
    t.check('Position has a Sticky field, top or bottom, and md top writes sticky-md-top (AC-46)',
        written.options === ',top,bottom' && written.label === 'Sticky' && written.stuck, written);

    var views = await page.eval(`
        start('sticky-md-top');
        const read = function(view) {
            ge().changeView(view);
            const style = getComputedStyle(col());
            return { position: style.position, top: style.top, z: style.zIndex };
        };
        return { md: read('md'), sm: read('sm') };
    `);
    t.check('md previews it stuck to the top, and sm as the column is without it (AC-47)',
        views.md.position === 'sticky' && views.md.top === '0px' && views.md.z === '1020' &&
        views.sm.position === 'relative', views);
}

module.exports = {
    name: 'sticky',
    description: 'the style plugin\'s sticky family',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await run(t, page);

        var errors = page.errors();
        t.check('the sticky tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
