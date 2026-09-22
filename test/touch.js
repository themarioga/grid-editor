/**
 * Browser tests for editing with a finger.
 *
 * This is the feature that justifies a major on its own: jQuery UI's sortable
 * never handled touch without the unmaintained touch-punch shim, so every
 * gesture here fails on 3.x. What is under test is that the three gestures the
 * editor owns - sorting, resizing, and carrying a toolbar button onto the
 * canvas - all work from a touchscreen, and that a touch that is not a drag
 * still leaves the page to the page.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** Two rows, each a single column, both tall enough to aim a finger at. */
var TWO_ROWS = `
    jQuery('#myGrid').gridEditor('destroy');
    jQuery('#myGrid').html(
        '<div class="row" id="first"><div class="column col-6" id="left">' +
        '<div class="ge-content"><p>The first row, with enough text in it to be worth aiming at.</p></div>' +
        '</div><div class="column col-6" id="right">' +
        '<div class="ge-content"><p>Its second column, the one the resize drags against.</p></div>' +
        '</div></div>' +
        '<div class="row" id="second"><div class="column col-12">' +
        '<div class="ge-content"><p>The second row, which is the one the finger moves.</p></div>' +
        '</div></div>'
    );
`;

var ROWS = `jQuery('#myGrid').children('.row').map(function() { return this.id; }).get().join(',')`;

async function sortTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(TWO_ROWS + `
        window.moves = [];
        window.fixture.init();
        jQuery('#myGrid').on('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.index, payload.to.index]);
        });
        return true;
    `);

    var before = await page.eval('return ' + ROWS + ';');
    await page.touchDrag('#second > .ge-tools-drawer .ge-move', '#first', { yRatio: 0.15 });
    var after = await page.eval(`
        return { rows: ${ROWS}, moves: window.moves };
    `);
    t.check('a row is sorted with a finger, and reports the move like any other',
        before === 'first,second' && after.rows === 'second,first' &&
        after.moves.length === 1 && after.moves[0][0] === 'row',
        { before: before, after: after });

    // Below the touch delay the gesture is the page's, not the editor's,
    // which is what leaves a touch device able to scroll. Dragged by a delta
    // rather than onto a target: an upward swipe the page does not consume is
    // taken by the browser as a back gesture, which would end the test by
    // leaving the page rather than by failing it.
    await page.touchDragBy('#second > .ge-tools-drawer .ge-move', 40, 60, { hold: 0, steps: 3 });
    var early = await page.eval(`
        return { rows: ${ROWS}, moves: window.moves.length, helpers: jQuery('.ge-drag-helper').length };
    `);
    t.check('a finger that moves before the touch delay does not drag anything',
        early.rows === 'second,first' && early.moves === 1 && early.helpers === 0, early);
}

async function resizeTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var unit = await page.eval(TWO_ROWS + `
        window.fixture.init();
        return jQuery('#first').width() / 12;
    `);

    var sizes = `jQuery('#first .column').map(function() {
        return (jQuery(this).attr('class').match(/col-(\\d+)\\b/) || [])[1];
    }).get().join(',')`;

    var before = await page.eval('return ' + sizes + ';');
    await page.touchDragBy('#left > .ge-resize-e', Math.round(unit * 2), 0);
    var after = await page.eval(`
        return {
            sizes: ${sizes},
            inlineWidth: jQuery('#left')[0].style.width,
            resizing: jQuery('.ge-resizing').length,
        };
    `);
    t.check('a column is resized with a finger, and the pixels are thrown away on drop',
        before === '6,6' && after.sizes === '8,4' &&
        after.inlineWidth === '' && after.resizing === 0,
        { before: before, after: after });
}

async function paletteTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(TWO_ROWS + `
        window.fixture.init({ drag_handle: 'drawer' });
        return true;
    `);

    await page.touchDrag('.ge-addRowGroup a[data-ge-layout="6,6"]', '#second', { yRatio: 0.1 });
    var dropped = await page.eval(`
        return {
            rows: ${ROWS},
            columnsOfNew: jQuery('#myGrid > .row').eq(1).children('.column').length,
            markers: jQuery('.ge-drop-marker').length,
            helpers: jQuery('.ge-toolbar-helper').length,
        };
    `);
    t.check('a toolbar button is carried onto the canvas with a finger',
        dropped.rows.split(',').length === 3 &&
        dropped.rows.indexOf('first,') === 0 && dropped.columnsOfNew === 2 &&
        dropped.markers === 0 && dropped.helpers === 0,
        dropped);

    var errors = page.errors();
    t.check('the touch tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'touch',
    description: 'editing from a touchscreen',
    run: async function(t) {
        await sortTests(t);
        await resizeTests(t);
        await paletteTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['touch']);
}
