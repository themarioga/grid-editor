/**
 * Browser tests for adding a column: the quick click, and the size picker a
 * hold on the tool offers instead.
 *
 * The gesture is the point here, so these drive a real pointer: hovering,
 * holding, and leaving again are things a synthetic event would not tell the
 * truth about.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A canvas with one row, holding the columns given as sizes. */
function canvasOf(sizes, settings) {
    var markup = sizes.map(function(size) {
        return '<div class="column col-' + size + '"><div class="ge-content"><p>x</p></div></div>';
    }).join('');

    return "jQuery('#myGrid').gridEditor('destroy');" +
        "jQuery('#myGrid').html('<div class=\"row\">" + markup + "</div>');" +
        'window.fixture.init(' + JSON.stringify(Object.assign({ default_view: 'xs' }, settings)) + ');' +
        'return true;';
}

var SIZES = `
    return jQuery('#myGrid .column').map(function() {
        const match = /(?:^|\\s)col-(\\d+)(?:\\s|$)/.exec(jQuery(this).attr('class'));
        return match ? +match[1] : null;
    }).get();
`;

var TOOL = '#myGrid > .row > .ge-tools-drawer .ge-add-column';

async function quickClickTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasOf([6]));

    await page.click(TOOL);
    var added = await page.eval(SIZES);
    t.check('a click adds a full width column',
        added.join(',') === '6,12', added);

    var pickerAfterClick = await page.eval(`return jQuery('.ge-size-picker').length;`);
    t.check('a click does not leave a picker behind', pickerAfterClick === 0, pickerAfterClick);

    await page.eval(canvasOf([6], { add_column: { size: 4 } }));
    await page.click(TOOL);
    var custom = await page.eval(SIZES);
    t.check('add_column.size says what a click adds, and keeps the rest of the defaults',
        custom.join(',') === '6,4', custom);

    var settings = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        return ge.settings.add_column;
    `);
    t.check('naming one key of add_column keeps the others',
        settings.size === 4 && settings.picker === true && settings.delay === 600, settings);
}

async function pickerTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasOf([6]));

    // Hovering briefly is still just hovering
    await page.hover(TOOL);
    await sleep(250);
    var tooSoon = await page.eval(`return jQuery('.ge-size-picker').length;`);
    t.check('a hover shorter than the delay offers nothing', tooSoon === 0, tooSoon);

    await sleep(600);
    var offered = await page.eval(`
        const picker = jQuery('.ge-size-picker');
        return {
            open: picker.length,
            insideTheTool: picker.closest('.ge-add-column').length === 1,
            sizes: picker.find('.ge-size').map(function() { return +jQuery(this).attr('data-ge-size'); }).get(),
            tight: picker.find('.ge-size-tight').map(function() { return +jQuery(this).attr('data-ge-size'); }).get(),
            titles: picker.find('.ge-size').first().attr('title'),
        };
    `);
    t.check('holding the tool offers every allowed size, under the tool itself',
        offered.open === 1 && offered.insideTheTool &&
        offered.sizes.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12' &&
        offered.titles === '1 of 12',
        offered);
    t.check('the sizes that do not fit what is left of the row are marked',
        offered.tight.join(',') === '7,8,9,10,11,12', offered.tight);

    await page.click('.ge-size-picker .ge-size[data-ge-size="4"]');
    var chosen = await page.eval(SIZES);
    var closed = await page.eval(`return jQuery('.ge-size-picker').length;`);
    t.check('choosing a size adds a column of that size and closes the picker',
        chosen.join(',') === '6,4' && closed === 0, { sizes: chosen, pickers: closed });

    var announced = await page.eval(`
        window.log = [];
        jQuery('#myGrid').on('grideditor:before-add-column grideditor:after-add-column', function(e, payload) {
            window.log.push([e.type.replace('grideditor:', ''), payload.kind, payload.source]);
        });
        return true;
    `);
    await page.hover(TOOL);
    await sleep(800);
    await page.click('.ge-size-picker .ge-size[data-ge-size="2"]');
    var events = await page.eval(`return { log: window.log, sizes: (function() { ${SIZES} })() };`);
    t.check('a column added from the picker is announced like any other',
        JSON.stringify(events.log) === JSON.stringify([
            ['before-add-column', 'column', 'tool'],
            ['after-add-column', 'column', 'tool'],
        ]) && events.sizes.join(',') === '6,4,2',
        events);
}

async function dismissTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasOf([6]));

    await page.hover(TOOL);
    await sleep(800);
    var open = await page.eval(`return jQuery('.ge-size-picker').length;`);

    // Away from the tool, and the question is withdrawn
    await page.hover('#myGrid > .row > .ge-tools-drawer .ge-move');
    await sleep(700);
    var afterLeaving = await page.eval(`return { pickers: jQuery('.ge-size-picker').length, columns: jQuery('#myGrid .column').length };`);
    t.check('moving away from the tool withdraws the offer, adding nothing',
        open === 1 && afterLeaving.pickers === 0 && afterLeaving.columns === 1,
        { open: open, afterLeaving: afterLeaving });

    // With the picker open, clicking the tool itself is a cancel
    await page.hover(TOOL);
    await sleep(800);
    await page.click(TOOL);
    var afterToolClick = await page.eval(`return { pickers: jQuery('.ge-size-picker').length, columns: jQuery('#myGrid .column').length };`);
    t.check('clicking the tool while it is offering sizes closes it rather than adding one',
        afterToolClick.pickers === 0 && afterToolClick.columns === 1, afterToolClick);

    var disabled = await page.eval(canvasOf([6], { add_column: { picker: false } }));
    await page.hover(TOOL);
    await sleep(800);
    var withoutPicker = await page.eval(`return jQuery('.ge-size-picker').length;`);
    t.check('add_column.picker false turns the gesture off', withoutPicker === 0, withoutPicker);

    await page.eval(canvasOf([6], { valid_col_sizes: [3, 6, 9, 12] }));
    await page.hover(TOOL);
    await sleep(800);
    var limited = await page.eval(`
        return jQuery('.ge-size-picker .ge-size').map(function() { return +jQuery(this).attr('data-ge-size'); }).get();
    `);
    t.check('valid_col_sizes says which sizes are offered', limited.join(',') === '3,6,9,12', limited);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return { picker: /ge-size-picker/.test(html), pickersLeft: jQuery('.ge-size-picker').length };
    `);
    t.check('an open picker is editor furniture: gone from the output and from the canvas',
        !exported.picker && exported.pickersLeft === 0, exported);

    var errors = page.errors();
    t.check('the add column tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'addcolumn',
    description: 'the add column tool and its size picker',
    run: async function(t) {
        await quickClickTests(t);
        await pickerTests(t);
        await dismissTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['addcolumn']);
}
