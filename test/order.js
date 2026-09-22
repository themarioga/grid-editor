/**
 * Browser tests for the order plugin: a column's place in its row, per
 * breakpoint, without moving the markup.
 *
 * The engine underneath is covered by test/utilities.js. What is tested here
 * is what the arrows write, how few classes they leave behind, and what the
 * canvas shows.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.cols = function() { return jQuery('#myGrid > .row').first().children('.column'); };
    window.col = function(name) { return cols().filter('[data-name="' + name + '"]'); };
    window.classes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) {
            return /^order-/.test(name);
        }).sort().join(' ');
    };
    window.all = function() {
        return cols().map(function() { return jQuery(this).attr('data-name') + ':' + classes(jQuery(this)); }).get().join(' ');
    };
    /** The names in the order the canvas shows them, by their computed order. */
    window.shown = function() {
        return cols().get()
            .map(function(element, index) { return { name: element.getAttribute('data-name'), order: +getComputedStyle(element).order, index: index }; })
            .sort(function(a, b) { return a.order - b.order || a.index - b.index; })
            .map(function(entry) { return entry.name; }).join(',');
    };
    window.click = function(name, which) {
        col(name).find('> .ge-tools-drawer > .ge-order-' + which).trigger('click');
    };
    window.start = function(classesByName, settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row">' + ['a', 'b', 'c'].map(function(name) {
            return '<div class="column col-4 ' + ((classesByName || {})[name] || '') + '" data-name="' + name + '">' +
                '<div class="ge-content"><p>' + name + '</p></div></div>';
        }).join('') + '</div>');
        window.fixture.init(jQuery.extend({ plugins: window.fixture.plugins(['order']) }, settings || {}));
    };
    window.moves = [];
    jQuery('#myGrid').on('grideditor:after-utility', function(e, payload) { window.moves.push(payload.source); });
`;

async function fieldTests(t, page) {
    var field = await page.eval(`
        start({ a: 'order-md-last' });
        const select = col('a').find('> .ge-tools-drawer .ge-utility[data-ge-family="order"] select');
        ge().changeView('md');
        return {
            options: select.find('option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
            rowFields: jQuery('#myGrid .row').first().find('> .ge-tools-drawer .ge-utility[data-ge-family="order"]').length,
            arrows: col('a').find('> .ge-tools-drawer > .ge-order-earlier, > .ge-tools-drawer > .ge-order-later').length,
            value: select.val(),
            shown: shown(),
            badge: col('a').attr('data-ge-order'),
        };
    `);
    t.check('columns get the order field and the arrows, rows do not',
        field.options === '=Default,first=First,0=0,1=1,2=2,3=3,4=4,5=5,last=Last' &&
        field.rowFields === 0 && field.arrows === 2,
        field);
    t.check('a breakpoint view shows the columns in the order their classes give there, and says so',
        field.value === 'last' && field.shown === 'b,c,a' && field.badge === 'Order: Last', field);

    var off = await page.eval(`
        start({}, { utilities: { order: { drawer: false } } });
        return { arrows: jQuery('#myGrid .ge-order-earlier, #myGrid .ge-order-later').length, fields: jQuery('#myGrid .ge-utility[data-ge-family="order"]').length };
    `);
    t.check('utilities.order.drawer false leaves the arrows out and keeps the field',
        off.arrows === 0 && off.fields === 3, off);
}

async function arrowTests(t, page) {
    var arrows = await page.eval(`
        start();
        ge().changeView('md');
        window.moves = [];
        click('a', 'later');
        const later = { classes: all(), shown: shown(), sources: window.moves.slice() };
        click('a', 'earlier');
        const back = { classes: all(), shown: shown() };
        window.moves = [];
        click('a', 'earlier');
        click('c', 'later');
        return { later: later, back: back, atTheEnds: window.moves.length };
    `);
    t.check('an arrow numbers the row\'s columns for this breakpoint and moves nothing in the markup',
        arrows.later.shown === 'b,a,c' &&
        arrows.later.classes === 'a:order-md-1 b:order-md-0 c:order-md-2' &&
        arrows.later.sources.every(function(source) { return source === 'tool'; }),
        arrows.later);
    t.check('back in the markup\'s order, the numbers come off again',
        arrows.back.shown === 'a,b,c' && arrows.back.classes === 'a: b: c:', arrows.back);
    t.check('the first column cannot go earlier, nor the last later',
        arrows.atTheEnds === 0, arrows);

    var inherited = await page.eval(`
        start({ a: 'order-1', b: 'order-0', c: 'order-2' });
        ge().changeView('md');
        const before = shown();
        click('b', 'later');
        return { before: before, shown: shown(), classes: all() };
    `);
    t.check('the markup\'s order is written out when the breakpoint below would undo it',
        inherited.before === 'b,a,c' && inherited.shown === 'a,b,c' &&
        inherited.classes === 'a:order-1 order-md-0 b:order-0 order-md-1 c:order-2 order-md-2',
        inherited);

    var allView = await page.eval(`
        start({ b: 'order-md-3' });
        click('c', 'earlier');
        const earlier = all();
        click('c', 'later');
        return { earlier: earlier, back: all() };
    `);
    t.check('in the all view an arrow writes the classes with no breakpoint, and clears the rest',
        allView.earlier === 'a:order-0 b:order-2 c:order-1' && allView.back === 'a: b: c:', allView);
}

async function markupTests(t, page) {
    var dropped = await page.eval(`
        start({ a: 'order-md-2' });
        ge().changeView('md');
        window.warnings = [];
        const original = console.warn;
        console.warn = function(message) { window.warnings.push(message); original.apply(console, arguments); };
        const payload = { kind: 'column', node: col('b'), to: { parent: jQuery('#myGrid .row').first(), index: 0 } };
        jQuery('#myGrid').trigger('grideditor:after-move', [payload]);
        jQuery('#myGrid').trigger('grideditor:after-move', [payload]);
        console.warn = original;
        return window.warnings.filter(function(message) { return /order classes/.test(message); }).length;
    `);
    t.check('dropping a column in a row ordered by class warns, once',
        dropped === 1, dropped);

    var exported = await page.eval(`
        const html = ge().getHtml();
        return { html: html, badgeBack: col('a').attr('data-ge-order') };
    `);
    t.check('getHtml keeps the classes, and neither the preview nor the badge',
        /order-md-2/.test(exported.html) && !/data-ge-order|data-ge-preview|style=/.test(exported.html) &&
        exported.badgeBack === 'Order: 2',
        exported.html.slice(0, 200));
}

module.exports = {
    name: 'order',
    description: 'the order utility plugin',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await fieldTests(t, page);
        await arrowTests(t, page);
        await markupTests(t, page);

        var errors = page.errors();
        t.check('the order tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
