/**
 * Browser tests for the drag mechanics themselves, as opposed to what any one
 * feature does with them.
 *
 * Three rules the editor relies on everywhere, and which belong to the drag
 * toolkit rather than to rows, columns or containers: a region's drawer stays
 * where it is, a list moves only its own children, and a handle that covers a
 * drawer still lets the tools in it be clicked.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A column holding two nested rows, which are the blocks being dragged. */
var NESTED = `
    jQuery('#myGrid').gridEditor('destroy');
    jQuery('#myGrid').html(
        '<div class="row"><div class="column col-12" id="outer">' +
        '<div class="row" id="one"><div class="column col-12" id="inner">' +
        '<div class="ge-content"><p>nested row one, tall enough to aim at</p></div>' +
        '</div></div>' +
        '<div class="row" id="two"><div class="column col-12">' +
        '<div class="ge-content"><p>nested row two, also tall enough</p></div>' +
        '</div></div>' +
        '</div></div>'
    );
`;

var CHILDREN = `
    return jQuery('#outer').children().map(function() {
        return this.id || this.className.split(' ')[0];
    }).get().join(',');
`;

async function drawerTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(NESTED + 'window.fixture.init(); return true;');
    var before = await page.eval(CHILDREN);

    // Aimed at the drawer itself, and then at the very top edge of the
    // column: both are "above the drawer" as far as the pointer is concerned
    await page.drag('#two > .ge-tools-drawer .ge-move', '#outer > .ge-tools-drawer', { yRatio: 0.1 });
    var ontoDrawer = await page.eval(CHILDREN);

    await page.drag('#two > .ge-tools-drawer .ge-move', '#outer', { yRatio: 0.005, steps: 24 });
    var ontoEdge = await page.eval(CHILDREN);

    t.check('a block dropped on a region’s drawer lands after it, not above it',
        before === 'ge-tools-drawer,one,two,ui-resizable-handle' &&
        ontoDrawer.indexOf('ge-tools-drawer,two') === 0 &&
        ontoEdge.indexOf('ge-tools-drawer,two') === 0,
        { before: before, ontoDrawer: ontoDrawer, ontoEdge: ontoEdge });
}

async function ownChildrenTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(NESTED + 'window.fixture.init(); return true;');

    // The canvas sorts rows, and its selector matches every row under it,
    // nested ones included. Which list a drag belongs to is decided by the
    // rule that an item is a direct child of the list that moves it - without
    // it, grabbing a row three levels down would be the canvas's drag.
    var rule = await page.eval(`
        const list = Sortable.get(jQuery('#myGrid')[0]);
        const ask = function(node) {
            return list.options.filter.call(list, { target: node }, node, list);
        };
        return {
            selectorMatchesNested: jQuery('#one').is(list.options.draggable),
            nestedRowRefused: ask(jQuery('#one')[0]),
            ownRowAccepted: ask(jQuery('#myGrid > .row')[0]),
        };
    `);
    t.check('a list moves its own children only, however deep the selector matches',
        rule.selectorMatchesNested && rule.nestedRowRefused === true &&
        rule.ownRowAccepted === false,
        rule);

    // And the drag that follows from it: the nested row reorders inside the
    // column it lives in, which is the list that owns it
    await page.drag('#two > .ge-tools-drawer .ge-move', '#one', { yRatio: 0.15 });
    var reordered = await page.eval(`
        return {
            inColumn: jQuery('#outer').children('.row').map(function() { return this.id; }).get().join(','),
            atCanvasLevel: jQuery('#myGrid').children('.row').length,
        };
    `);
    t.check('so a nested row reorders within its own column',
        reordered.inColumn === 'two,one' && reordered.atCanvasLevel === 1, reordered);
}

async function handleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    // With the whole drawer as the handle, every tool in it sits under the
    // thing that starts a drag, so a real click has to survive being filtered
    var before = await page.eval(NESTED + `
        window.fixture.init({ drag_handle: 'drawer', confirm_delete: false });
        return {
            rows: jQuery('#outer').children('.row').length,
            tools: jQuery('#two > .ge-tools-drawer > a').map(function() {
                return jQuery(this).attr('class').split(' ')[0];
            }).get(),
        };
    `);
    await page.click('#two > .ge-tools-drawer .ge-delete-row');
    await cdp.sleep(400);
    var deleted = await page.eval(`return jQuery('#outer').children('.row').map(function() { return this.id; }).get();`);
    t.check('a tool inside the handle is still a tool: clicking delete deletes',
        before.rows === 2 && before.tools.indexOf('ge-move') === -1 &&
        deleted.join(',') === 'one',
        { before: before, left: deleted });

    var dragsStill = await page.eval(`
        return { handle: Sortable.get(jQuery('#outer')[0]).options.handle };
    `);
    t.check('and the whole drawer is what drags',
        dragsStill.handle === '.ge-tools-drawer', dragsStill);

    var errors = page.errors();
    t.check('the sorting tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'sorting',
    description: 'the drag mechanics every feature relies on',
    run: async function(t) {
        await drawerTests(t);
        await ownChildrenTests(t);
        await handleTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['sorting']);
}
