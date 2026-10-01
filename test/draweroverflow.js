/**
 * Browser tests for drawer_overflow: a drawer keeps its tools to one line,
 * the ones that don't fit behind a more tool that unfolds it.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var path = require('path');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A narrow column and a wide one, in a page narrow enough for the first to run out of room. */
function canvasWith(settings) {
    return `
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        document.querySelector('.container').style.width = '600px';
        const grid = document.querySelector('#myGrid');
        grid.innerHTML =
            '<div class="row" id="first">' +
                '<div class="column col-2" id="narrow"><div class="ge-content"><p>Narrow</p></div></div>' +
                '<div class="column col-10" id="wide"><div class="ge-content"><p>Wide</p></div></div>' +
            '</div>';
        window.fixture.init(${JSON.stringify(Object.assign({ default_view: 'xs' }, settings))});
    `;
}

// The drawers are fitted in the frame after they are laid out
var SETTLE = 'await new Promise(function(resolve) { setTimeout(resolve, 150); });';

/** What a column's drawer shows, and whether it is one line. */
function drawer(id) {
    return `
        const drawer = document.querySelector('#${id} > .ge-tools-drawer');
        const shown = Array.from(drawer.children).filter(function(node) {
            return node.tagName === 'A' && node.getClientRects().length > 0;
        });
        const tops = shown.map(function(node) { return Math.round(node.getBoundingClientRect().top); });
        const box = drawer.getBoundingClientRect();
        const more = drawer.querySelector(':scope > .ge-drawer-more');
        return {
            overflow: drawer.classList.contains('ge-drawer-overflow'),
            expanded: drawer.classList.contains('ge-drawer-expanded'),
            hidden: drawer.querySelectorAll(':scope > .ge-tool-overflow').length,
            moreShown: !!(more && more.getClientRects().length),
            tools: drawer.querySelectorAll(':scope > a:not(.ge-drawer-more)').length,
            shown: shown.length,
            oneLine: tops.every(function(top) { return top === tops[0]; }),
            inside: shown.every(function(node) { return node.getBoundingClientRect().right <= box.right + 0.5; }),
        };
    `;
}

async function overflowTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var narrow = await page.eval(canvasWith() + SETTLE + drawer('narrow'));
    t.check('a narrow column\'s drawer keeps to one line, the last tools behind the more tool',
        narrow.overflow && narrow.moreShown && narrow.hidden > 0 && narrow.oneLine && narrow.inside, narrow);

    var wide = await page.eval(drawer('wide'));
    t.check('a wide column\'s drawer, with room for every tool, has no more tool',
        !wide.overflow && !wide.moreShown && wide.hidden === 0 && wide.oneLine && wide.tools === narrow.tools, wide);

    await page.screenshot(path.join(t.screenshots, 'drawer-overflow.png'));

    await page.click('#narrow > .ge-tools-drawer > .ge-drawer-more');
    var expanded = await page.eval(drawer('narrow'));
    t.check('the more tool unfolds the drawer, every tool showing on more lines',
        expanded.expanded && expanded.shown === expanded.tools + 1 && !expanded.oneLine && expanded.inside, expanded);

    await page.screenshot(path.join(t.screenshots, 'drawer-overflow-expanded.png'));

    // A tool that was hidden is a tool like any other, unfolded
    await page.click('#narrow > .ge-tools-drawer > .ge-add-row');
    var added = await page.eval(SETTLE + `return document.querySelectorAll('#narrow > .row').length;`);
    t.check('a tool from the unfolded drawer works', added === 1, added);

    await page.click('#narrow > .ge-tools-drawer > .ge-drawer-more');
    var folded = await page.eval(drawer('narrow'));
    t.check('the more tool folds it away again', !folded.expanded && folded.oneLine && folded.hidden > 0, folded);

    var roomy = await page.eval(`document.querySelector('#narrow').classList.replace('col-2', 'col-12');` + SETTLE + drawer('narrow'));
    t.check('with room again, every tool is back on the line and the more tool goes',
        !roomy.overflow && !roomy.moreShown && roomy.hidden === 0 && roomy.oneLine, roomy);

    var nested = await page.eval(`
        document.querySelector('#narrow').classList.replace('col-12', 'col-2');
    ` + SETTLE + `
        const drawer = document.querySelector('#first > .ge-tools-drawer');
        return {
            fitted: drawer.classList.contains('ge-drawer-fit'),
            nestedFitted: document.querySelector('#narrow > .row > .ge-tools-drawer').classList.contains('ge-drawer-fit'),
        };
    `);
    t.check('a row\'s drawer is fitted too, and one added later', nested.fitted && nested.nestedFitted, nested);

    var wrapped = await page.eval(canvasWith({ drawer_overflow: 'wrap' }) + SETTLE + `
        return {
            fitted: document.querySelectorAll('#myGrid .ge-drawer-fit').length,
            more: document.querySelectorAll('#myGrid .ge-drawer-more').length,
        };
    `);
    t.check('drawer_overflow wrap leaves the drawers wrapping as they did',
        wrapped.fitted === 0 && wrapped.more === 0, wrapped);

    var html = await page.eval(canvasWith() + SETTLE + `return window.fixture.editor().getHtml();`);
    t.check('getHtml has nothing of it', !/ge-drawer|ge-tool-overflow/.test(html), html);

    var errors = page.errors();
    t.check('the drawer overflow tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'draweroverflow',
    description: 'the drawers keeping their tools to one line, behind a more tool',
    run: async function(t) {
        await overflowTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['draweroverflow']);
}
