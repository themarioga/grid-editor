/**
 * Browser tests for the six Bootstrap breakpoints and the all view.
 *
 * There is no visual baseline to compare against, so the checks here are
 * computed geometry: with the canvas at a known width, a column's pixel width
 * says whether the layout mode's CSS is doing its job. That catches a broken
 * mixin, which a class-name assertion would not.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var VIEWS = ['all', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

/** Every tier, with the prefixes and preview width the plugin promises. */
var TIERS = [
    { key: 'xs', col: 'col-', offset: 'offset-', preview: 400 },
    { key: 'sm', col: 'col-sm-', offset: 'offset-sm-', preview: 576 },
    { key: 'md', col: 'col-md-', offset: 'offset-md-', preview: 768 },
    { key: 'lg', col: 'col-lg-', offset: 'offset-lg-', preview: 992 },
    { key: 'xl', col: 'col-xl-', offset: 'offset-xl-', preview: 1200 },
    { key: 'xxl', col: 'col-xxl-', offset: 'offset-xxl-', preview: null },
];

/** A one-row canvas with one column, for measuring. */
var ONE_COLUMN = `
    jQuery('#myGrid').html('<div class="row"><div class="column"><div class="ge-content"><p>x</p></div></div></div>');
    window.fixture.init(arguments[0]);
    return true;
`;

/**
 * Column widths and offsets are percentages of the row's content box, and the
 * editing stylesheet animates a size change, so a measurement has to wait for
 * the layout to settle and then divide by the right thing.
 */
var MEASURE = `
    const settle = () => new Promise(resolve => setTimeout(resolve, 250));
    const units = function(node, property) {
        const row = node.parentElement;
        const rowStyle = getComputedStyle(row);
        const content = row.clientWidth -
            parseFloat(rowStyle.paddingLeft) - parseFloat(rowStyle.paddingRight);
        const value = property === 'width'
            ? node.getBoundingClientRect().width
            : parseFloat(getComputedStyle(node)[property]);

        return Math.round(value / content * 12 * 100) / 100;
    };
`;

/**
 * Each view constrains the canvas to its preview width, and leaves the all
 * view unconstrained.
 */
async function previewTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(`window.fixture.init(); return true;`);

    var widths = await page.eval(`
        const set = jQuery('#myGrid');
        const seen = {};
        for (const view of ${JSON.stringify(VIEWS)}) {
            set.gridEditor('changeView', view);
            await new Promise(resolve => setTimeout(resolve, 250));
            seen[view] = {
                maxWidth: getComputedStyle(set[0]).maxWidth,
                width: Math.round(set[0].getBoundingClientRect().width),
            };
        }
        return seen;
    `);

    var previews = TIERS.filter(function(tier) { return tier.preview; });
    t.check('each breakpoint view constrains the canvas to its preview width',
        previews.every(function(tier) { return widths[tier.key].maxWidth === tier.preview + 'px'; }),
        widths);
    t.check('the all view and the widest tier are not constrained',
        widths.all.maxWidth === 'none' && widths.xxl.maxWidth === 'none' &&
        widths.all.width > 1000,
        { all: widths.all, xxl: widths.xxl });
    t.check('a constrained canvas really is that wide',
        widths.xs.width === 400 && widths.sm.width === 576 && widths.md.width === 768,
        widths);
}

/**
 * A tier's classes are the ones that count in that tier's view, whatever the
 * window happens to be doing, and the others are switched off.
 */
async function effectiveClassTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var measured = await page.eval(MEASURE + `
        jQuery('#myGrid').html(
            '<div class="row"><div class="column col-3 col-sm-4 col-md-5 col-lg-6 col-xl-7 col-xxl-8">' +
            '<div class="ge-content"><p>x</p></div></div></div>'
        );
        window.fixture.init();

        const set = jQuery('#myGrid');
        const column = jQuery('#myGrid .column').first();
        const seen = {};

        for (const view of ${JSON.stringify(VIEWS)}) {
            set.gridEditor('changeView', view);
            await settle();
            seen[view] = units(column[0], 'width');
        }

        return seen;
    `);
    t.check('in a tier view, that tier is the one whose column class counts',
        measured.xs === 3 && measured.sm === 4 && measured.md === 5 &&
        measured.lg === 6 && measured.xl === 7 && measured.xxl === 8,
        measured);
    t.check('the all view renders what the browser would, which at this width is the widest tier',
        measured.all === 8, measured);

    // The tier classes cascade upward, as Bootstrap's do: a column that says
    // nothing about md is whatever the nearest smaller tier said
    var cascaded = await page.eval(MEASURE + `
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(
            '<div class="row">' +
            '<div class="column col-4"><div class="ge-content"><p>x</p></div></div>' +
            '<div class="column col-3 col-lg-6"><div class="ge-content"><p>x</p></div></div>' +
            '</div>'
        );
        window.fixture.init();

        const set = jQuery('#myGrid');
        const columns = jQuery('#myGrid .column');
        const seen = {};

        for (const view of ${JSON.stringify(VIEWS)}) {
            set.gridEditor('changeView', view);
            await settle();
            seen[view] = [units(columns[0], 'width'), units(columns[1], 'width')];
        }

        return seen;
    `);
    t.check('a tier with nothing of its own shows what the nearest smaller tier said',
        JSON.stringify(cascaded.xs) === '[4,3]' && JSON.stringify(cascaded.sm) === '[4,3]' &&
        JSON.stringify(cascaded.md) === '[4,3]' && JSON.stringify(cascaded.lg) === '[4,6]' &&
        JSON.stringify(cascaded.xl) === '[4,6]' && JSON.stringify(cascaded.xxl) === '[4,6]',
        cascaded);

    var offsets = await page.eval(MEASURE + `
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(
            '<div class="row"><div class="column col-4 col-lg-4 offset-2 offset-lg-5">' +
            '<div class="ge-content"><p>x</p></div></div></div>'
        );
        window.fixture.init();

        const set = jQuery('#myGrid');
        const column = jQuery('#myGrid .column').first();
        const seen = {};

        for (const view of ['xs', 'lg']) {
            set.gridEditor('changeView', view);
            await settle();
            seen[view] = units(column[0], 'marginLeft');
        }

        return seen;
    `);
    t.check('offset classes are visualized per view as well',
        offsets.xs === 2 && offsets.lg === 5, offsets);
}

/**
 * Writing: one prefix in a tier view, every prefix in the all view.
 */
async function writingTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var perTier = await page.eval(`
        jQuery('#myGrid').html('<div class="row"><div class="column col-6"><div class="ge-content"><p>x</p></div></div></div>');
        window.fixture.init({ default_view: 'md' });

        const column = jQuery('#myGrid .column').first();
        column.find('> .ge-tools-drawer .ge-decrease-col-width').trigger('click');

        return {
            classes: column.attr('class').split(/\\s+/).filter(name => /^col-/.test(name)).sort(),
            view: jQuery('#myGrid').gridEditor('getView'),
        };
    `);
    t.check('a size change in a tier view touches that tier only, reading the cascade for its starting point',
        perTier.view === 'md' && perTier.classes.join(' ') === 'col-6 col-md-5',
        perTier);

    var allView = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html('<div class="row"><div class="column col-6"><div class="ge-content"><p>x</p></div></div></div>');
        window.fixture.init({ default_view: 'all' });

        const column = jQuery('#myGrid .column').first();
        column.find('> .ge-tools-drawer .ge-decrease-col-width').trigger('click');

        return {
            classes: column.attr('class').split(/\\s+/).filter(name => /^col-/.test(name)).sort(),
        };
    `);
    t.check('a size change in the all view touches every tier',
        allView.classes.join(' ') === 'col-5 col-lg-5 col-md-5 col-sm-5 col-xl-5 col-xxl-5',
        allView);

    var created = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        ge.changeView('lg');
        const inTier = ge.createColumn(4);
        ge.changeView('all');
        const inAll = ge.createColumn(4);
        return {
            inTier: inTier.attr('class'),
            inAll: inAll.attr('class').split(/\\s+/).filter(name => /^col-/.test(name)).sort().join(' '),
        };
    `);
    t.check('createColumn writes the tiers the view covers',
        created.inTier === 'column col-lg-4' &&
        created.inAll === 'col-4 col-lg-4 col-md-4 col-sm-4 col-xl-4 col-xxl-4',
        created);

    var seeded = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(
            '<div class="row">' +
            '<div class="column col-lg-4"><div class="ge-content"><p>authored</p></div></div>' +
            '<div class="column"><div class="ge-content"><p>unsized</p></div></div>' +
            '</div>'
        );
        window.fixture.init();

        const columns = jQuery('#myGrid .column');
        return {
            authored: columns.eq(0).attr('class'),
            unsized: columns.eq(1).attr('class'),
        };
    `);
    t.check('a column that has any sizing is left as authored, and one with none is seeded once',
        /col-lg-4/.test(seeded.authored) && !/col-sm-|col-md-|col-xl-/.test(seeded.authored) &&
        /(^|\s)col-12(\s|$)/.test(seeded.unsized) && !/col-sm-|col-lg-/.test(seeded.unsized),
        seeded);
}

/**
 * 2.x callers passed a layout mode index, and their pages still work.
 */
async function backCompatTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(`
        window.warnings = [];
        const original = console.warn;
        console.warn = function() {
            window.warnings.push(Array.prototype.join.call(arguments, ' '));
            original.apply(console, arguments);
        };
        window.fixture.init();
        return true;
    `);

    var legacy = await page.eval(`
        const set = jQuery('#myGrid');
        const views = [0, 1, 2].map(function(index) {
            set.gridEditor('changeView', index);
            return set.gridEditor('getView');
        });
        return {
            views: views,
            warnings: window.warnings.filter(w => /changeView/.test(w)),
            canvasClass: jQuery('#myGrid').attr('class').match(/ge-layout-\\w+/g),
        };
    `);
    t.check('the 2.x layout mode indexes still mean desktop, tablet and phone',
        legacy.views.join(',') === 'lg,sm,xs' && legacy.warnings.length === 1 &&
        legacy.canvasClass.join() === 'ge-layout-xs',
        legacy);

    var limited = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        window.fixture.init({ layout_modes: ['all', 'lg', 'xs'], default_view: 'lg' });
        return {
            items: jQuery('.ge-layout-mode a').map(function() { return jQuery(this).attr('data-ge-view'); }).get(),
            button: jQuery('.ge-layout-mode button').text(),
            view: jQuery('#myGrid').gridEditor('getView'),
        };
    `);
    t.check('layout_modes limits the dropdown and default_view picks the view it starts in',
        limited.items.join(',') === 'all,lg,xs' && limited.button === 'Desktop' && limited.view === 'lg',
        limited);

    var errors = page.errors();
    t.check('the breakpoint tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'breakpoints',
    description: 'the six tiers, the all view and the layout previews',
    run: async function(t) {
        await previewTests(t);
        await effectiveClassTests(t);
        await writingTests(t);
        await backCompatTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['breakpoints']);
}
