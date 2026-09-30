/**
 * Browser tests for column offsets: the indent tools, the 12 unit budget, and
 * what the budget refuses rather than rewrites.
 *
 * The rule that matters here is asymmetric, and it is the one the reference
 * fork got wrong: growing an indent may shrink the column, but growing a
 * column may never quietly shrink an indent the user set. It is refused, and
 * the tool visibly does nothing.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A canvas holding one row of columns described as [size, offset] pairs. */
function canvasOf(columns) {
    var markup = columns.map(function(column) {
        var classes = ['column', 'col-' + column[0]];
        if (column[1]) { classes.push('offset-' + column[1]); }
        return '<div class="' + classes.join(' ') + '"><div class="ge-content"><p>x</p></div></div>';
    }).join('');

    return "document.querySelector('#myGrid').innerHTML = '<div class=\"row\">" + markup + "</div>';";
}

/** The size and offset classes on each column of the row, as [size, offset]. */
var UNITS = `
    window.unitsOf = function(view) {
        const prefix = view === 'all' || view === 'xs' ? '' : view + '-';
        return Array.from(document.querySelectorAll('#myGrid .column')).map(function(column) {
            const classes = column.getAttribute('class');
            const size = new RegExp('(?:^|\\\\s)col-' + prefix + '(\\\\d+)(?:\\\\s|$)').exec(classes);
            const offset = new RegExp('(?:^|\\\\s)offset-' + prefix + '(\\\\d+)(?:\\\\s|$)').exec(classes);
            return [size ? +size[1] : null, offset ? +offset[1] : 0];
        });
    };
`;

function tool(name) {
    // A real click, which the tools listen for; shift held when the event
    // passed in says so
    return "(function(tool, e) { tool.dispatchEvent(new MouseEvent('click', " +
        "{ bubbles: true, cancelable: true, shiftKey: !!(e && e.shiftKey) })); })(" +
        "document.querySelector('#myGrid .column').querySelector(':scope > .ge-tools-drawer ." + name + "'), ";
}

async function toolTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var present = await page.eval(canvasOf([[6], [6]]) + `
        window.fixture.init();
        const drawer = document.querySelector('#myGrid .column').querySelector(':scope > .ge-tools-drawer');
        const icon = function(tool) { return drawer.querySelector('.' + tool + ' i').getAttribute('class'); };

        return {
            tools: Array.from(drawer.querySelectorAll(':scope > a')).map(function(a) { return a.getAttribute('class'); }),
            titles: drawer.querySelector('.ge-increase-col-offset').getAttribute('title'),
            // Bootstrap names these after the side the text is indented from,
            // so the icon that points right is the one called -left
            increaseIcon: icon('ge-increase-col-offset'),
            decreaseIcon: icon('ge-decrease-col-offset'),
        };
    `);
    t.check('a column drawer has an indent tool either side of the width tools',
        present.tools.indexOf('ge-decrease-col-offset') !== -1 &&
        present.tools.indexOf('ge-increase-col-offset') !== -1 &&
        present.titles === 'Increase indent\n(hold shift for max)',
        present);
    t.check('the indent tools point the way they act',
        present.increaseIcon === 'bi bi-text-indent-left' &&
        present.decreaseIcon === 'bi bi-text-indent-right',
        present);

    var stepped = await page.eval(UNITS + canvasOf([[4], [4]]) + `
        window.fixture.init({ default_view: 'xs' });

        const steps = [];
        for (let i = 0; i < 3; i++) {
            ${tool('ge-increase-col-offset')}'click');
            steps.push(window.unitsOf('xs')[0]);
        }
        ${tool('ge-decrease-col-offset')}'click');
        steps.push(window.unitsOf('xs')[0]);

        return { steps: steps, classes: document.querySelector('#myGrid .column').getAttribute('class') };
    `);
    t.check('the indent tools step through valid_col_offsets one unit at a time',
        JSON.stringify(stepped.steps) === JSON.stringify([[4, 1], [4, 2], [4, 3], [4, 2]]),
        stepped);
    t.check('an offset of zero is no class at all',
        !/offset-lg-0/.test(stepped.classes), stepped);

    var restricted = await page.eval(UNITS + canvasOf([[4], [4]]) + `
        window.fixture.init({ default_view: 'xs', valid_col_offsets: [0, 3, 6] });
        ${tool('ge-increase-col-offset')}'click');
        const first = window.unitsOf('xs')[0];
        ${tool('ge-increase-col-offset')}'click');
        return { first: first, second: window.unitsOf('xs')[0] };
    `);
    t.check('valid_col_offsets says which offsets the tools may land on',
        JSON.stringify(restricted.first) === '[4,3]' && JSON.stringify(restricted.second) === '[4,6]',
        restricted);
}

/**
 * The 12 unit budget: which way each tool gives.
 */
async function budgetTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var shrunk = await page.eval(UNITS + canvasOf([[12], [12]]) + `
        window.fixture.init({ default_view: 'xs' });
        ${tool('ge-increase-col-offset')}'click');
        return window.unitsOf('xs');
    `);
    t.check('growing the indent shrinks the column when the budget needs it',
        JSON.stringify(shrunk[0]) === '[11,1]', shrunk);

    var refused = await page.eval(UNITS + canvasOf([[9, 3], [12]]) + `
        window.fixture.init({ default_view: 'xs' });

        const before = window.unitsOf('xs')[0];
        ${tool('ge-increase-col-width')}'click');
        const after = window.unitsOf('xs')[0];

        // and the other way round, from below the edge
        ${tool('ge-decrease-col-width')}'click');
        const narrower = window.unitsOf('xs')[0];
        ${tool('ge-increase-col-width')}'click');

        return { before: before, after: after, narrower: narrower, back: window.unitsOf('xs')[0] };
    `);
    t.check('growing the column is refused when the indent leaves no room, and the indent is left alone',
        JSON.stringify(refused.before) === '[9,3]' && JSON.stringify(refused.after) === '[9,3]' &&
        JSON.stringify(refused.narrower) === '[8,3]' && JSON.stringify(refused.back) === '[9,3]',
        refused);

    var maxed = await page.eval(UNITS + canvasOf([[3], [4]]) + `
        window.fixture.init({ default_view: 'xs' });
        ${tool('ge-increase-col-width')}{ shiftKey: true });
        return window.unitsOf('xs');
    `);
    t.check('hold shift for max grows into the row\\u2019s spare space only',
        JSON.stringify(maxed[0]) === '[8,0]', maxed);

    var maxedWithOffsets = await page.eval(UNITS + canvasOf([[3, 2], [4]]) + `
        window.fixture.init({ default_view: 'xs' });
        ${tool('ge-increase-col-width')}{ shiftKey: true });
        return window.unitsOf('xs');
    `);
    t.check('the spare space counts the indents, not just the widths',
        JSON.stringify(maxedWithOffsets[0]) === '[6,2]', maxedWithOffsets);

    var maxIndent = await page.eval(UNITS + canvasOf([[3], [4]]) + `
        window.fixture.init({ default_view: 'xs' });
        ${tool('ge-increase-col-offset')}{ shiftKey: true });
        const maxed = window.unitsOf('xs');
        ${tool('ge-decrease-col-offset')}{ shiftKey: true });
        return { maxed: maxed, cleared: window.unitsOf('xs') };
    `);
    t.check('hold shift on the indent tools goes to the row\\u2019s edge and back to none',
        JSON.stringify(maxIndent.maxed[0]) === '[3,5]' &&
        JSON.stringify(maxIndent.cleared[0]) === '[3,0]',
        maxIndent);
}

/**
 * Offsets follow the view, like sizes do.
 */
async function viewTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var perTier = await page.eval(UNITS + canvasOf([[6], [6]]) + `
        window.fixture.init({ default_view: 'md' });
        ${tool('ge-increase-col-offset')}'click');
        return {
            md: window.unitsOf('md')[0],
            xs: window.unitsOf('xs')[0],
            classes: document.querySelector('#myGrid .column').getAttribute('class'),
        };
    `);
    t.check('an indent in a tier view writes that tier only',
        JSON.stringify(perTier.md) === '[null,1]' && JSON.stringify(perTier.xs) === '[6,0]' &&
        /offset-md-1/.test(perTier.classes) && !/(^|\\s)offset-1/.test(perTier.classes),
        perTier);

    var allView = await page.eval(UNITS + canvasOf([[6], [6]]) + `
        window.fixture.editor().destroy();
        ` + canvasOf([[6], [6]]) + `
        window.fixture.init({ default_view: 'all' });
        ${tool('ge-increase-col-offset')}'click');
        return {
            offsets: document.querySelector('#myGrid .column').getAttribute('class').split(/\\s+/)
                .filter(name => /^offset-/.test(name)).sort(),
        };
    `);
    // 5.0: the all view writes the base class alone
    t.check('an indent in the all view writes the base class',
        allView.offsets.join(' ') === 'offset-1',
        allView);

    var created = await page.eval(`
        const ge = window.fixture.editor();
        ge.changeView('lg');
        const column = ge.createColumn(4, { offset: 2 });
        ge.changeView('all');
        const everywhere = ge.createColumn(4, { offset: 2 });
        return {
            column: column.getAttribute('class'),
            everywhere: everywhere.getAttribute('class').split(/\\s+/).filter(name => /^offset-/.test(name)).length,
        };
    `);
    t.check('createColumn takes an offset, for the view it is called in',
        /col-lg-4/.test(created.column) && /offset-lg-2/.test(created.column) &&
        created.everywhere === 1,
        created);

    var announced = await page.eval(UNITS + canvasOf([[6], [6]]) + `
        window.fixture.editor().destroy();
        ` + canvasOf([[6], [6]]) + `
        window.log = [];
        window.fixture.init({
            default_view: 'xs',
            callbacks: {
                before_indent: function(payload) { window.log.push(['before', payload.from, payload.to]); },
                after_indent: function(payload) { window.log.push(['after', payload.from, payload.to]); },
            },
        });
        ['grideditor:before-indent', 'grideditor:after-indent'].forEach(function(name) {
            document.querySelector('#myGrid').addEventListener(name, function(e) {
                window.log.push([e.type.replace('grideditor:', ''), e.detail.kind, e.detail.source]);
            });
        });

        ${tool('ge-increase-col-offset')}'click');
        const moved = window.log.slice();

        window.log = [];
        document.querySelector('#myGrid').addEventListener('grideditor:before-indent', function(e) { e.preventDefault(); });
        ${tool('ge-increase-col-offset')}'click');

        return { moved: moved, units: window.unitsOf('xs')[0], canceled: window.log, };
    `);
    t.check('an indent announces itself and can be canceled',
        JSON.stringify(announced.moved) === JSON.stringify([
            ['before-indent', 'column', 'tool'], ['before', 0, 1],
            ['after-indent', 'column', 'tool'], ['after', 0, 1],
        ]) &&
        JSON.stringify(announced.units) === '[6,1]' &&
        announced.canceled.length === 2,
        announced);

    var hidden = await page.eval(UNITS + `
        window.fixture.editor().destroy();
        ` + canvasOf([[6, 2], [4]]) + `
        window.fixture.init({ default_view: 'xs', indent: { tools: false } });
        const drawer = document.querySelector('#myGrid .column > .ge-tools-drawer');
        const column = window.fixture.editor().createColumn(4, { offset: 1 });
        return {
            indent: drawer.querySelectorAll(':scope > .ge-decrease-col-offset, :scope > .ge-increase-col-offset').length,
            width: drawer.querySelectorAll(':scope > .ge-decrease-col-width, :scope > .ge-increase-col-width').length,
            kept: window.unitsOf('xs')[0],
            created: /(?:^|\\s)offset-1(?:\\s|$)/.test(column.getAttribute('class')),
            html: /offset-2/.test(window.fixture.editor().getHtml()),
        };
    `);
    t.check('indent.tools false takes the indent tools out and leaves the width tools',
        hidden.indent === 0 && hidden.width === 2, hidden);
    t.check('with indent.tools false the markup keeps its offsets, and createColumn still takes one',
        JSON.stringify(hidden.kept) === '[6,2]' && hidden.created && hidden.html, hidden);

    var errors = page.errors();
    t.check('the offset tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'offsets',
    description: 'column offsets and the 12 unit budget',
    run: async function(t) {
        await toolTests(t);
        await budgetTests(t);
        await viewTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['offsets']);
}
