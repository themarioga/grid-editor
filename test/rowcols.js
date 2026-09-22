/**
 * Browser tests for columns per row: a row's row-cols-* classes, and the
 * columns they size.
 *
 * The part that needs proving is who sizes a column at each breakpoint -
 * its row or itself - because the budget, the tools, the width field and the
 * preview all ask, and Bootstrap's css has a definite answer: the class from
 * the wider breakpoint, and at one breakpoint col loses to row-cols, which
 * loses to col-auto and col-N.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.row = function() { return jQuery('#myGrid > .row').first(); };
    window.cols = function() { return row().children('.column'); };
    window.sizes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) { return /^col(-|$)/.test(name); }).sort().join(' ');
    };
    window.twelfths = function() {
        const style = getComputedStyle(row()[0]);
        const content = row()[0].clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return cols().map(function() { return Math.round(this.getBoundingClientRect().width / content * 12); }).get().join(',');
    };
    /** Columns change width with a short transition; measure once it is over. */
    window.settle = function() { return new Promise(function(resolve) { setTimeout(resolve, 250); }); };
    window.start = function(rowClasses, columns, settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row ' + rowClasses + '">' + columns.map(function(classes, index) {
            return '<div id="c' + index + '" class="column ' + classes + '"><div class="ge-content"><p>' + index + '</p></div></div>';
        }).join('') + '</div>');
        window.fixture.init(settings || {});
    };
`;

async function fieldTests(t, page) {
    var field = await page.eval(`
        start('row-cols-2', ['', '']);
        const select = row().find('> .ge-tools-drawer .ge-utility[data-ge-family="row-cols"] select');
        const before = { value: select.val(), columns: cols().map(function() { return sizes(jQuery(this)); }).get().join('|') };
        ge().changeView('md');
        select.val('3').trigger('change');
        return {
            label: row().find('> .ge-tools-drawer .ge-utility[data-ge-family="row-cols"] .ge-utility-label').text(),
            options: select.find('option').map(function() { return this.value; }).get().join(','),
            before: before,
            classes: row().attr('class'),
        };
    `);
    t.check('a row\'s panel has a columns per row field, from 1 to 6 and auto',
        field.label === 'Columns per row' && field.options === ',1,2,3,4,5,6,auto', field);
    t.check('columns in a row with row-cols are not given a col-12',
        field.before.value === '2' && field.before.columns === '|', field);
    t.check('the field writes row-cols for the view being edited',
        /row-cols-2/.test(field.classes) && /row-cols-md-3/.test(field.classes), field);

    var off = await page.eval(`
        start('row-cols-3', ['', '', ''], { row_cols: false });
        return {
            field: row().find('> .ge-tools-drawer .ge-utility[data-ge-family="row-cols"]').length,
            badge: row().attr('data-ge-row-cols'),
            columns: cols().map(function() { return sizes(jQuery(this)); }).get().join('|'),
        };
    `);
    t.check('row_cols false takes the field and the badge away, and still leaves the row\'s columns alone',
        off.field === 0 && off.badge === undefined && off.columns === '||', off);
}

async function previewTests(t, page) {
    var views = await page.eval(`
        start('row-cols-1 row-cols-md-3', ['', '', '']);
        const read = async function(view) { ge().changeView(view); await settle(); return { widths: twelfths(), badge: row().attr('data-ge-row-cols') }; };
        const xs = await read('xs');
        const md = await read('md');
        ge().changeView('all');
        return { xs: xs, md: md, all: row().attr('data-ge-row-cols') };
    `);
    t.check('each breakpoint view shares the row out as its row-cols says, and the row says how',
        views.xs.widths === '12,12,12' && views.xs.badge === '1 per row' &&
        views.md.widths === '4,4,4' && views.md.badge === '3 per row' && views.all === '1 per row',
        views);

    var narrower = await page.eval(`
        start('row-cols-lg-4', ['', '', '', '']);
        ge().changeView('sm');
        await settle();
        return { widths: twelfths(), badge: row().attr('data-ge-row-cols') };
    `);
    t.check('a wider breakpoint\'s row-cols does not show in a narrower view',
        narrower.widths === '12,12,12,12' && narrower.badge === undefined, narrower);

    var precedence = await page.eval(`
        start('row-cols-md-3', ['col-6', 'col-md-6', 'col-md', 'col-md-auto']);
        ge().changeView('md');
        await settle();
        const widths = twelfths().split(',');
        return { widths: widths, auto: widths[3] < 4 };
    `);
    t.check('a smaller breakpoint\'s size loses to row-cols, the same breakpoint\'s col-6 wins, and col loses',
        precedence.widths[0] === '4' && precedence.widths[1] === '6' && precedence.widths[2] === '4',
        precedence);
    t.check('the same breakpoint\'s col-auto wins over row-cols',
        precedence.auto, precedence);

    var auto = await page.eval(`
        start('row-cols-auto', ['', '']);
        ge().changeView('sm');
        await settle();
        return twelfths().split(',').map(Number);
    `);
    t.check('row-cols-auto makes every column as wide as its content',
        auto[0] <= 3 && auto[1] <= 3, auto);
}

async function editingTests(t, page) {
    var added = await page.eval(`
        start('row-cols-md-3', ['', '']);
        ge().changeView('md');
        row().find('> .ge-tools-drawer .ge-add-column').trigger('click');
        const inRow = sizes(cols().last());
        start('', ['col-6']);
        ge().changeView('md');
        row().find('> .ge-tools-drawer .ge-add-column').trigger('click');
        return { inRow: inRow, plain: sizes(cols().last()) };
    `);
    t.check('a column added to a row with row-cols takes its share, with no size of its own',
        added.inRow === '' && added.plain === 'col-md-12', added);

    var tool = await page.eval(`
        start('row-cols-md-3', ['', '', '']);
        ge().changeView('md');
        const field = cols().first().find('> .ge-tools-drawer .ge-utility[data-ge-family="col"] select');
        const blank = field.find('option').first().text();
        let from = 'none';
        jQuery('#myGrid').one('grideditor:after-resize', function(e, payload) { from = payload.from; });
        cols().first().find('> .ge-tools-drawer .ge-increase-col-width').trigger('click');
        await settle();
        return {
            blank: blank,
            classes: cols().map(function() { return sizes(jQuery(this)); }).get().join('|'),
            from: from,
            widths: twelfths(),
        };
    `);
    t.check('the width field says a column takes its share from the row',
        tool.blank === 'From the row: 3 per row', tool);
    t.check('a width tool takes a column out of the share with a size of its own, from the share it had',
        tool.classes === 'col-md-5||' && tool.from === null && tool.widths.split(',')[0] === '5', tool);

    var api = await page.eval(`
        start('row-cols-2', ['', '']);
        const into = ge().createColumn(undefined, { appendTo: row() });
        const created = ge().createRow({ row_cols: { xs: 1, md: 3 }, columns: 4 });
        return {
            into: sizes(into),
            rowClasses: created.attr('class'),
            columns: created.children('.column').map(function() { return sizes(jQuery(this)); }).get().join('|'),
        };
    `);
    t.check('createColumn with no size, into a row with row-cols, takes the row\'s share',
        api.into === '', api);
    t.check('createRow takes a row-cols layout',
        api.rowClasses === 'row row-cols-1 row-cols-md-3' && api.columns === '|||', api);

    var toolbar = await page.eval(`
        start('', ['col-12'], { new_row_layouts: [[12], { row_cols: { xs: 1, md: 3 }, columns: 6 }] });
        const button = jQuery('.ge-addRowGroup a').eq(1);
        const icon = button.find('.ge-row-icon').children('.column').length;
        button.trigger('click');
        const added = jQuery('#myGrid > .row').last();
        return {
            title: button.attr('title'),
            icon: icon,
            rowClasses: added.attr('class').split(/\\s+/).filter(function(name) { return /^row-cols/.test(name); }).join(' '),
            columns: added.children('.column').length,
            sized: added.children('.column').filter(function() { return sizes(jQuery(this)) !== ''; }).length,
            html: ge().getHtml(),
        };
    `);
    t.check('a row-cols layout gets its toolbar button, and the button makes the row',
        toolbar.title === 'Add a row of 6 columns, 1, md: 3 per row' && toolbar.icon === 3 &&
        toolbar.rowClasses === 'row-cols-1 row-cols-md-3' && toolbar.columns === 6 && toolbar.sized === 0,
        toolbar);
    t.check('getHtml keeps row-cols and the unsized columns, and none of the editing marks',
        /class="row row-cols-1 row-cols-md-3"/.test(toolbar.html) && /class="column"/.test(toolbar.html) &&
        !/data-ge-row-cols|data-ge-preview|style=/.test(toolbar.html),
        toolbar.html.slice(0, 200));
}

module.exports = {
    name: 'rowcols',
    description: 'columns per row, row-cols-*',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await fieldTests(t, page);
        await previewTests(t, page);
        await editingTests(t, page);

        var errors = page.errors();
        t.check('the row-cols tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
