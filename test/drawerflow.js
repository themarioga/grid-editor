/**
 * Browser tests for the drawer of a flex or grid node, a part of the style
 * plugin: out of the flow, on top and as wide as the node, so the content is
 * laid out below it as the page lays it out.
 *
 * What is tested is geometry: where the drawer is against its node, and where
 * the node's content is against the drawer.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };
    window.drawer = function(node) { return node.querySelector(':scope > .ge-tools-drawer'); };
    /** The node's children the page lays out: what is not the editor's. */
    window.items = function(node) {
        return Array.from(node.querySelectorAll(':scope > :not(.ge-tools-drawer):not(.ge-resize-handle)'));
    };
    /** Where the drawer and the items are, against the node's padding box. */
    window.layout = function(node) {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const inner = {
            left: box.left + parseFloat(style.borderLeftWidth),
            right: box.right - parseFloat(style.borderRightWidth),
            top: box.top + parseFloat(style.borderTopWidth),
        };
        const tools = drawer(node).getBoundingClientRect();
        return {
            out: node.classList.contains('ge-drawer-out'),
            position: getComputedStyle(drawer(node)).position,
            nodeTop: box.top,
            paddingTop: parseFloat(style.paddingTop),
            inner: inner,
            drawer: { top: tools.top, bottom: tools.bottom, left: tools.left, right: tools.right },
            items: items(node).map(function(item) {
                const rect = item.getBoundingClientRect();
                return { top: rect.top, left: rect.left };
            }),
        };
    };
    window.near = function(a, b) { return Math.abs(a - b) < 1.5; };
    window.start = function(html) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        document.querySelector('#myGrid').innerHTML = html;
        window.fixture.init({ plugins: window.fixture.plugins(['inline-style']) });
    };
    window.column = function(classes) {
        return '<div class="row"><div class="column col-12 ' + classes + '">' +
            '<div class="ge-content"><p>first</p></div><div class="ge-content"><p>second</p></div></div></div>';
    };
`;

async function run(t, page) {
    var flexed = await page.eval(`
        start(column('d-flex'));
        return layout(col());
    `);
    var top = flexed.drawer.top;
    t.check('a flex column\'s drawer is on top, as wide as the column, and its texts side by side below it (AC-49)',
        flexed.out && flexed.position === 'absolute' && Math.abs(top - flexed.nodeTop) < 2 &&
        Math.abs(flexed.drawer.left - flexed.inner.left) < 1.5 && Math.abs(flexed.drawer.right - flexed.inner.right) < 1.5 &&
        flexed.items.length === 2 && Math.abs(flexed.items[0].top - flexed.items[1].top) < 1.5 &&
        flexed.items[1].left > flexed.items[0].left && flexed.items[0].top >= flexed.drawer.bottom,
        flexed);

    var gaps = await page.eval(`
        start(column('d-flex flex-column'));
        const without = layout(col());
        start(column('d-flex flex-column gap-3'));
        const withGap = layout(col());
        return {
            without: without.items[0].top - without.drawer.bottom,
            withGap: withGap.items[0].top - withGap.drawer.bottom,
            between: withGap.items[1].top - withGap.items[0].top,
            stacked: without.items[1].top - without.items[0].top,
        };
    `);
    t.check('a gap separates the texts, not the drawer from the first (AC-50)',
        Math.abs(gaps.without - gaps.withGap) < 1.5 && gaps.between - gaps.stacked > 15, gaps);

    var nowrap = await page.eval(`
        start('<div class="row flex-nowrap">' + [1, 2, 3, 4].map(function() {
            return '<div class="column col-6"><div class="ge-content"><p>x</p></div></div>';
        }).join('') + '</div>');
        const node = row();
        const tools = drawer(node).getBoundingClientRect();
        const columns = Array.from(node.querySelectorAll(':scope > .column')).map(function(each) { return each.getBoundingClientRect().top; });
        return { out: node.classList.contains('ge-drawer-out'), bottom: tools.bottom, width: tools.width, rowWidth: node.clientWidth, tops: columns };
    `);
    t.check('a row that does not wrap has its drawer on top and its four columns on one line below (AC-51)',
        nowrap.out && Math.abs(nowrap.width - nowrap.rowWidth) < 1.5 &&
        nowrap.tops.every(function(each) { return Math.abs(each - nowrap.tops[0]) < 1.5 && each >= nowrap.bottom; }),
        nowrap);

    var plain = await page.eval(`
        start(column(''));
        return { row: layout(row()), column: layout(col()) };
    `);
    t.check('a row and a column as the grid has them keep their drawer in the flow (AC-52)',
        !plain.row.out && plain.row.position !== 'absolute' && !plain.column.out && plain.column.position !== 'absolute', plain);

    var grid = await page.eval(`
        start(column('d-grid'));
        return layout(col());
    `);
    t.check('a grid column\'s drawer is on top and takes no cell (AC-53)',
        grid.out && grid.position === 'absolute' && Math.abs(grid.drawer.left - grid.inner.left) < 1.5 &&
        grid.items[0].top >= grid.drawer.bottom, grid);

    var views = await page.eval(`
        start(column('d-md-flex'));
        ge().changeView('sm');
        const sm = layout(col());
        ge().changeView('md');
        return { sm: sm, md: layout(col()) };
    `);
    t.check('a column flex from md has its drawer in the flow at sm and out of it at md (AC-54)',
        !views.sm.out && views.sm.position !== 'absolute' && views.md.out && views.md.position === 'absolute', views);

    var padded = await page.eval(`
        start(column('d-flex p-3'));
        return layout(col());
    `);
    t.check('the column\'s padding is kept below the drawer (AC-55)',
        padded.out && Math.abs(padded.items[0].left - padded.inner.left - 16) < 1.5 &&
        padded.items[0].top >= padded.drawer.bottom && Math.abs(padded.paddingTop - 16) < 0.5, padded);

    var exported = await page.eval(`
        start(column('d-flex') + '<div class="row flex-nowrap"><div class="column col-6"><div class="ge-content"><p>x</p></div></div></div>');
        const html = ge().getHtml();
        const again = col().classList.contains('ge-drawer-out');
        window.fixture.teardown();
        return { html: html, again: again, torndown: document.querySelector('#myGrid').innerHTML };
    `);
    t.check('getHtml has none of it, and it is back after (AC-56)',
        !/ge-drawer-out|data-ge-drawer-out|style=/.test(exported.html) && exported.again &&
        !/ge-drawer-out|data-ge-drawer-out/.test(exported.torndown), exported.html.slice(0, 300));
}

module.exports = {
    name: 'drawerflow',
    description: 'the inline-style plugin\'s drawer on a flex or grid node',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await run(t, page);

        var errors = page.errors();
        t.check('the drawer tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
