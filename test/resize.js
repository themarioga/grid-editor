/**
 * Browser tests for resizing a column by dragging its edge.
 *
 * Every check here drives a real pointer: a jQuery UI resizable reports the
 * pixels the pointer actually moved, and what this feature is about is turning
 * those pixels into whole grid units. The arithmetic is checked against the
 * row's own content width, measured in the page, so the numbers do not depend
 * on the window size the run happens to use.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

// The first column's east handle: querySelector takes the first in document
// order, and the drawer being the row's first child rules out :first-child
var HANDLE = '#myGrid .column > .ge-resize-e';

/** A row of columns, given as [size, offset] pairs, edited at the xs tier. */
function canvasOf(columns, settings) {
    var markup = columns.map(function(column) {
        var classes = ['column', 'col-' + column[0]];
        if (column[1]) { classes.push('offset-' + column[1]); }
        return '<div class="' + classes.join(' ') + '"><div class="ge-content"><p>x</p></div></div>';
    }).join('');

    return "jQuery('#myGrid').gridEditor('destroy');" +
        "jQuery('#myGrid').html('<div class=\"row\">" + markup + "</div>');" +
        'window.fixture.init(' + JSON.stringify($.extend({ default_view: 'xs' }, settings)) + ');' +
        'window.unit = (function() {' +
        '    const row = jQuery("#myGrid .row")[0];' +
        '    const style = getComputedStyle(row);' +
        '    return (row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 12;' +
        '})();' +
        'return window.unit;';
}

// Tiny stand-in so canvasOf can use $.extend on the node side
var $ = { extend: Object.assign };

/** The sizes of the row's columns, as written at the xs tier. */
var SIZES = `
    return jQuery('#myGrid .column').map(function() {
        const match = /(?:^|\\s)col-(\\d+)(?:\\s|$)/.exec(jQuery(this).attr('class'));
        return match ? +match[1] : null;
    }).get();
`;

async function snapTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    var unit = await page.eval(canvasOf([[6], [6]]));

    await page.dragBy(HANDLE, Math.round(unit), 0);
    var wider = await page.eval(SIZES);
    t.check('a drag of one unit lands on the class one unit wider',
        wider.join(',') === '7,5', { unit: unit, sizes: wider });

    await page.dragBy(HANDLE, Math.round(-unit * 2), 0);
    var narrower = await page.eval(SIZES);
    t.check('a drag the other way lands the same distance back',
        narrower.join(',') === '5,7', narrower);

    await page.dragBy(HANDLE, 3, 0);
    var nudged = await page.eval(SIZES + `;`);
    var nudgedLog = await page.eval(`return window.resizeLog || [];`);
    t.check('a drag of a few pixels changes nothing',
        nudged.join(',') === '5,7', { sizes: nudged, log: nudgedLog });

    var clean = await page.eval(`
        const column = jQuery('#myGrid .column').first();
        return {
            inlineWidth: column[0].style.width,
            classes: column.attr('class'),
        };
    `);
    t.check('the pixels are gone once the drag has landed',
        clean.inlineWidth === '' && /(^|\s)col-5(\s|$)/.test(clean.classes), clean);
}

async function balanceTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    var unit = await page.eval(canvasOf([[4], [4], [4]]));

    await page.dragBy(HANDLE, Math.round(unit * 2), 0);
    var balanced = await page.eval(SIZES);
    t.check('balance next takes the units out of the following column only',
        balanced.join(',') === '6,2,4', { unit: unit, sizes: balanced });

    var unbalanced = await page.eval(canvasOf([[4], [4], [4]], { resize: { enabled: true, handles: 'e', balance: false } }));
    await page.dragBy(HANDLE, Math.round(unbalanced * 2), 0);
    var loose = await page.eval(SIZES);
    t.check('balance false leaves the siblings alone and lets the row wrap',
        loose.join(',') === '6,4,4', loose);

    var budget = await page.eval(canvasOf([[6, 4], [2]]));
    await page.dragBy(HANDLE, Math.round(budget * 4), 0);
    var stopped = await page.eval(SIZES + `;`);
    var offsets = await page.eval(`
        return jQuery('#myGrid .column').first().attr('class');
    `);
    t.check('the budget stops the drag instead of rewriting the offset',
        stopped[0] <= 8 && /(^|\s)offset-4(\s|$)/.test(offsets),
        { sizes: stopped, classes: offsets });
}

async function eventTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    var unit = await page.eval(canvasOf([[6], [6]]));

    await page.eval(`
        window.resizeLog = [];
        jQuery('#myGrid').on('grideditor:before-resize grideditor:after-resize', function(e, payload) {
            window.resizeLog.push([e.type.replace('grideditor:', ''), payload.from, payload.to, payload.source]);
        });
        return true;
    `);

    await page.dragBy(HANDLE, Math.round(unit), 0);
    var announced = await page.eval(`return window.resizeLog;`);
    t.check('a drag announces before-resize on the way in and after-resize on the way out',
        JSON.stringify(announced) === JSON.stringify([
            ['before-resize', 6, null, 'dragdrop'],
            ['after-resize', 6, 7, 'dragdrop'],
        ]),
        announced);

    await page.eval(`window.resizeLog = []; return true;`);
    await page.dragBy(HANDLE, 3, 0);
    var subUnit = await page.eval(`return { log: window.resizeLog, sizes: (function() { ${SIZES} })() };`);
    t.check('a sub-unit drag fires before-resize but no after-resize',
        subUnit.log.length === 1 && subUnit.log[0][0] === 'before-resize' &&
        subUnit.sizes.join(',') === '7,5',
        subUnit);

    var canceled = await page.eval(`
        window.resizeLog = [];
        jQuery('#myGrid').on('grideditor:before-resize', function(e) { e.preventDefault(); });
        window.beforeDrag = jQuery('#myGrid .column').first().attr('class');
        return true;
    `);
    await page.dragBy(HANDLE, Math.round(unit * 2), 0);
    var afterCancel = await page.eval(`
        return {
            log: window.resizeLog,
            before: window.beforeDrag,
            after: jQuery('#myGrid .column').first().attr('class'),
            inlineWidth: jQuery('#myGrid .column').first()[0].style.width,
            resizing: jQuery('.ge-resizing').length,
        };
    `);
    t.check('a canceled before-resize stops the drag before it starts',
        afterCancel.after === afterCancel.before && afterCancel.inlineWidth === '' &&
        afterCancel.resizing === 0 &&
        afterCancel.log.filter(entry => entry[0] === 'after-resize').length === 0,
        afterCancel);
}

async function artifactTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    var unit = await page.eval(canvasOf([[6], [6]]));

    var editing = await page.eval(`
        return {
            handles: jQuery('#myGrid .ge-resize-handle').length,
            columns: jQuery('#myGrid .column').length,
            east: jQuery('#myGrid .ge-resize-e').length,
            readouts: jQuery('#myGrid .ge-resize-size').length,
        };
    `);
    t.check('every column has a handle on the edge the setting asked for',
        editing.handles === editing.columns && editing.east === editing.columns &&
        editing.readouts === editing.columns,
        editing);

    // The readout says which class the column would land on, mid drag.
    // Sampled on pointermove, because the gesture captures the pointer and a
    // captured pointer fires no compatibility mouse events.
    await page.eval(`
        window.readouts = [];
        jQuery('#myGrid').on('pointermove', function() {
            const text = jQuery('#myGrid .ge-resize-size').first().text();
            if (text && window.readouts.indexOf(text) === -1) { window.readouts.push(text); }
        });
        return true;
    `);
    await page.dragBy(HANDLE, Math.round(unit * 2), 0);
    var readouts = await page.eval(`return { seen: window.readouts, afterwards: jQuery('#myGrid .ge-resize-size').first().text() };`);
    t.check('the drawer shows the class the column would land on while dragging',
        readouts.seen.indexOf('col-8') !== -1 && readouts.afterwards === '',
        readouts);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            pixels: /style=/i.test(html),
            jqueryUi: /ui-resizable|ui-sortable|ge-resize-handle|ge-drag-/.test(html),
            readout: /ge-resize-size/.test(html),
            drawer: /ge-tools-drawer/.test(html),
            keptSize: /col-8/.test(html),
            stillEditing: jQuery('#myGrid').hasClass('ge-editing'),
            handlesAfterwards: jQuery('#myGrid .ge-resize-handle').length,
        };
    `);
    t.check('a drag-resized column exports as its class and nothing else',
        !exported.pixels && !exported.jqueryUi && !exported.readout && !exported.drawer &&
        exported.keptSize && exported.stillEditing && exported.handlesAfterwards > 0,
        Object.assign({}, exported, { html: exported.html.slice(0, 200) }));

    var errors = page.errors();
    t.check('the resize tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Resizing and sorting share the column, and must not share a gesture: the
 * handle is on the edge, the sort handle is the drawer. This is the check the
 * plan asks to do by hand in a headful run; doing it with a real pointer here
 * means it is checked on every run instead.
 */
async function gestureTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    // The fixture's own markup rather than a bare row: the columns hold a
    // paragraph each, so they are tall enough for a drop onto one of them to
    // be an ordinary drag and not a hit on a 30 pixel drawer
    var unit = await page.eval(`
        window.fixture.init();

        const columns = jQuery('#myGrid > .row').eq(1).children('.column');
        columns.eq(0).attr('id', 'left');
        columns.eq(1).attr('id', 'right');

        window.moves = 0;
        window.resizes = 0;
        jQuery('#myGrid').on('grideditor:after-move', function() { window.moves++; });
        jQuery('#myGrid').on('grideditor:after-resize', function() { window.resizes++; });

        const row = columns.parent()[0];
        const style = getComputedStyle(row);
        return (row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / 12;
    `);

    var order = `
        return {
            order: jQuery('#myGrid > .row').eq(1).children('.column')
                .map(function() { return this.id; }).get().join(','),
            moves: window.moves,
            resizes: window.resizes,
            sizes: jQuery('#myGrid > .row').eq(1).children('.column')
                .map(function() { return /col-lg-(\\d+)/.exec(jQuery(this).attr('class'))[1]; }).get().join(','),
        };
    `;

    // The edge resizes and does not sort
    await page.dragBy('#left > .ge-resize-e', Math.round(unit), 0);
    var afterEdge = await page.eval(order);
    t.check('dragging the column edge resizes it and never sorts it',
        afterEdge.order === 'left,right' && afterEdge.moves === 0 &&
        afterEdge.resizes === 1 && afterEdge.sizes === '7,5',
        afterEdge);

    // The drawer sorts and does not resize
    await page.drag('#right > .ge-tools-drawer .ge-move', '#left', { yRatio: 0.15 });
    var afterDrawer = await page.eval(order);
    t.check('dragging the drawer sorts the column and never resizes it',
        afterDrawer.order === 'right,left' && afterDrawer.moves === 1 &&
        afterDrawer.resizes === 1 && afterDrawer.sizes === '5,7',
        afterDrawer);

    await page.screenshot(require('path').join(t.screenshots, 'resize-handles.png'));

    var errors = page.errors();
    t.check('the gesture tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'resize',
    description: 'resizing a column by dragging its edge',
    run: async function(t) {
        await snapTests(t);
        await balanceTests(t);
        await eventTests(t);
        await artifactTests(t);
        await gestureTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['resize']);
}
