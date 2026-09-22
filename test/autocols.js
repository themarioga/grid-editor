/**
 * Browser tests for the two sizes that are not a number: equal (Bootstrap's
 * col) and auto (col-auto), at every breakpoint.
 *
 * What needs proving is that the editor treats them as sizes like any other -
 * it recognises them, previews them per view, offers them, writes them
 * through the resize events - and that the tools, which step through numbers,
 * turn one into a number starting from the width it has on the canvas.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.cols = function() { return jQuery('#myGrid > .row').first().children('.column'); };
    window.sizes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) { return /^col(-|$)/.test(name); }).sort().join(' ');
    };
    /** Each column's width as a share of its row, in twelfths, rounded. */
    window.twelfths = function() {
        const row = jQuery('#myGrid > .row').first()[0];
        const style = getComputedStyle(row);
        const content = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return cols().map(function() { return Math.round(this.getBoundingClientRect().width / content * 12); }).get().join(',');
    };
    window.field = function(col) { return col.find('> .ge-tools-drawer .ge-utility[data-ge-family="col"] select'); };
    window.log = [];
    jQuery('#myGrid').on('grideditor:before-resize grideditor:after-resize', function(e, payload) {
        window.log.push({ name: e.type, source: payload.source, from: payload.from, to: payload.to,
            breakpoint: payload.breakpoint, cleared: payload.cleared });
        if (e.type === 'grideditor:before-resize' && window.cancelNext) { window.cancelNext = false; e.preventDefault(); }
    });
    window.start = function(columns, settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row">' + columns.map(function(classes, index) {
            return '<div id="c' + index + '" class="' + classes + '"><div class="ge-content"><p>' + classes + '</p></div></div>';
        }).join('') + '</div>');
        window.fixture.init(settings || {});
        window.log = [];
    };
`;

async function detectionTests(t, page) {
    var detected = await page.eval(`
        start(['col', 'col-auto', 'col-6 col-md', 'col-12 col-lg-auto']);
        return {
            columns: cols().length,
            drawers: cols().filter(function() { return jQuery(this).children('.ge-tools-drawer').length === 1; }).length,
            sizes: cols().map(function() { return sizes(jQuery(this)); }).get(),
            classesField: cols().first().find('> .ge-tools-drawer .ge-classes').val(),
        };
    `);
    t.check('a column with only col, or only col-auto, is a column',
        detected.columns === 4 && detected.drawers === 4, detected);
    t.check('an equal or auto column is not given a col-12 it did not have',
        detected.sizes.join('|') === 'col|col-auto|col-6 col-md|col-12 col-lg-auto', detected);
    t.check('col and col-auto are grid classes, kept out of the classes field',
        detected.classesField === '', detected);

    var read = await page.eval(`
        start(['col-4 col-md col-xl-auto']);
        const col = cols().first();
        return ['all', 'xs', 'sm', 'md', 'lg', 'xl'].map(function(view) {
            return view + ':' + ge().getUtility(col, 'col', view);
        }).join(' ');
    `);
    t.check('the width reads through the cascade like any utility',
        read === 'all:4 xs:4 sm:4 md:equal lg:equal xl:auto', read);
}

async function fieldTests(t, page) {
    var field = await page.eval(`
        start(['col-4 col-md', 'col-8']);
        const col = cols().first();
        ge().changeView('sm');
        const sm = { value: field(col).val(), blank: field(col).find('option').first().text() };
        ge().changeView('md');
        return {
            options: field(col).find('option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
            sm: sm,
            md: field(col).val(),
            label: col.find('> .ge-tools-drawer .ge-utility[data-ge-family="col"] .ge-utility-label').text(),
        };
    `);
    t.check('a column\'s panel has a width field with every size, equal and auto',
        field.label === 'Width' &&
        field.options === '=Inherit: 4 (from xs),1=1,2=2,3=3,4=4,5=5,6=6,7=7,8=8,9=9,10=10,11=11,12=12,equal=Equal,auto=Auto',
        field);
    t.check('the field says what the view inherits, and shows equal where it applies',
        field.sm.value === '' && field.sm.blank === 'Inherit: 4 (from xs)' && field.md === 'equal', field);

    var written = await page.eval(`
        const col = cols().first();
        field(col).val('auto').trigger('change');
        const auto = { classes: sizes(col), log: window.log.slice() };
        window.log = [];
        window.cancelNext = true;
        field(col).val('3').trigger('change');
        return { auto: auto, canceled: { classes: sizes(col), value: field(col).val(), log: window.log.slice() } };
    `);
    var after = written.auto.log[1] || {};
    t.check('choosing in the width field is a resize: written for the view, announced as one',
        written.auto.classes === 'col-4 col-md-auto' && written.auto.log.length === 2 &&
        after.name === 'grideditor:after-resize' && after.source === 'panel' &&
        after.from === 'equal' && after.to === 'auto' && after.breakpoint === 'md',
        written.auto);
    t.check('a canceled width change leaves the class and puts the field back',
        written.canceled.classes === 'col-4 col-md-auto' && written.canceled.value === 'auto' &&
        written.canceled.log.length === 1,
        written.canceled);

    var everywhere = await page.eval(`
        start(['col-4 col-md-6 col-xl', 'col-8']);
        const col = cols().first();
        field(col).val('equal').trigger('change');
        return { classes: sizes(col), cleared: (window.log[1] || {}).cleared };
    `);
    t.check('in the all view the field writes col alone and says what it took off',
        everywhere.classes === 'col' &&
        JSON.stringify(everywhere.cleared) === '[{"breakpoint":"md","value":6},{"breakpoint":"xl","value":"equal"}]',
        everywhere);
}

async function previewTests(t, page) {
    var previews = await page.eval(`
        start(['col-6 col-md-auto', 'col-6 col-md', 'col-12 col-lg']);
        const read = function(view) { ge().changeView(view); return twelfths(); };
        return { xs: read('xs'), md: read('md'), lg: read('lg') };
    `);
    t.check('a breakpoint view shows equal and auto as that breakpoint has them',
        previews.xs === '6,6,12', previews);
    t.check('auto is as wide as its content, and equal shares what is left',
        // its content is a short line: the drawer's tools must not count
        previews.md.split(',')[0] <= 2 && +previews.md.split(',')[0] + +previews.md.split(',')[1] === 12 &&
        previews.md.split(',')[2] === '12',
        previews);
    t.check('a wider breakpoint\'s equal does not show in a narrower view',
        previews.lg.split(',')[2] !== '12' && previews.md.split(',')[2] === '12', previews);
}

async function toolTests(t, page) {
    var tools = await page.eval(`
        start(['col', 'col-6'], { default_view: 'xs' });
        const col = cols().first();
        const before = twelfths();
        col.find('> .ge-tools-drawer .ge-increase-col-width').trigger('click');
        return { before: before, classes: sizes(col), to: (window.log[1] || {}).to, from: (window.log[1] || {}).from };
    `);
    t.check('a width tool turns an equal column into a number, starting from the width it has',
        tools.before === '6,6' && tools.classes === 'col-7' && tools.from === 'equal' && tools.to === 7, tools);

    var drag = await page.eval(`
        start(['col-6', 'col'], { default_view: 'xs' });
        const row = jQuery('#myGrid > .row').first()[0];
        const style = getComputedStyle(row);
        return (row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 12;
    `);
    await page.dragBy('#c0 > .ge-resize-e', Math.round(drag * 2), 0);
    var balanced = await page.eval(`return { classes: cols().map(function() { return sizes(jQuery(this)); }).get(), widths: twelfths() };`);
    t.check('resizing next to an equal column leaves it to take what is left',
        balanced.classes.join('|') === 'col-8|col' && balanced.widths === '8,4', balanced);

    await page.eval(`start(['col', 'col-6'], { default_view: 'xs' });`);
    await page.dragBy('#c0 > .ge-resize-e', Math.round(drag * -2), 0);
    var converted = await page.eval(`return sizes(cols().first());`);
    t.check('dragging the edge of an equal column turns it into a number',
        converted === 'col-4', converted);
}

async function creationTests(t, page) {
    var created = await page.eval(`
        start(['col-12']);
        const row = ge().createRow(['auto', 'equal', 4]);
        const column = ge().createColumn('equal');
        return {
            row: row.children('.column').map(function() { return sizes(jQuery(this)); }).get().join('|'),
            column: sizes(column),
        };
    `);
    t.check('createRow and createColumn take equal and auto',
        created.row === 'col-auto|col|col-4' && created.column === 'col', created);

    var toolbar = await page.eval(`
        start(['col-12'], { new_row_layouts: [[12], ['auto', 'equal']] });
        const button = jQuery('.ge-addRowGroup a').eq(1);
        const icon = button.find('.ge-row-icon').children('.column').map(function() { return sizes(jQuery(this)); }).get().join('|');
        button.trigger('click');
        return {
            icon: icon,
            added: jQuery('#myGrid > .row').last().children('.column').map(function() { return sizes(jQuery(this)); }).get().join('|'),
        };
    `);
    t.check('a layout of equal and auto columns gets its toolbar button, and the button makes it',
        toolbar.icon === 'col-auto|col' && toolbar.added === 'col-auto|col', toolbar);

    var html = await page.eval(`return ge().getHtml();`);
    t.check('getHtml keeps col and col-auto as they are',
        /class="column col-auto"/.test(html) && /class="column col"/.test(html) && !/col-auto col-12|col col-12/.test(html),
        html.slice(0, 200));

    var restricted = await page.eval(`
        start(['col-auto', 'col-12'], { valid_col_sizes: [4, 6, 8, 12] });
        return {
            options: field(cols().first()).find('option').map(function() { return this.value; }).get().join(','),
        };
    `);
    t.check('without equal and auto in valid_col_sizes they are not offered, but a column that has one shows it',
        restricted.options === ',4,6,8,12,auto', restricted);
}

module.exports = {
    name: 'autocols',
    description: 'equal and auto column sizes',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await detectionTests(t, page);
        await fieldTests(t, page);
        await previewTests(t, page);
        await toolTests(t, page);
        await creationTests(t, page);

        var errors = page.errors();
        t.check('the auto column tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
