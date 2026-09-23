/**
 * Browser tests for the sections plugin: Bootstrap's .container,
 * .container-fluid and .container-{bp} on the canvas, each grouping rows.
 *
 * Beyond the plugin's own controls, what needs proving is the drag rules the
 * core gained for it - a section goes on the canvas and nowhere else, rows go
 * in and out of sections - and the preview, which gives each container class
 * the max-width it has at the breakpoint being edited.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.topLevel = function() {
        return jQuery('#myGrid').children().not('.ge-tools-drawer').map(function() {
            return this.id || this.className.split(' ')[0];
        }).get().join(',');
    };
    window.inside = function(id) {
        return jQuery('#' + id).children('.row').map(function() { return this.id; }).get().join(',');
    };
    window.log = [];
    jQuery('#myGrid').on('grideditor:before-add grideditor:after-add grideditor:after-delete grideditor:after-move grideditor:before-utility grideditor:after-utility', function(e, payload) {
        // A move's from and to carry jQuery sets, which do not travel back to the test
        const plain = function(value) { return value && typeof value === 'object' ? value.index : value; };
        window.log.push([e.type.replace('grideditor:', ''), payload.kind, payload.family, plain(payload.from), plain(payload.to)]);
        if (e.type === 'grideditor:before-utility' && window.cancelNext) { window.cancelNext = false; e.preventDefault(); }
    });
    const row = function(id, text) {
        return '<div class="row" id="' + id + '"><div class="column col-12" id="' + id + 'c"><div class="ge-content"><p>' + text + '</p></div></div></div>';
    };
    window.start = function(settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html(
            row('r0', 'A row on the canvas, tall enough to aim at') +
            '<div class="container" id="s1">' + row('r1', 'A row in the section, tall enough to aim at') + '</div>' +
            row('r2', 'Another row on the canvas, also tall enough')
        );
        window.fixture.init(jQuery.extend({ plugins: window.fixture.plugins(['sections']), confirm_delete: false }, settings || {}));
        window.log = [];
    };
`;

async function controlTests(t, page) {
    var marked = await page.eval(`
        start();
        jQuery('#r2c .ge-content').append('<div class="container" id="nested">not a section</div>');
        ge().reset();
        const s = jQuery('#s1');
        return {
            section: s.hasClass('ge-section'),
            tools: s.find('> .ge-tools-drawer > a').map(function() { return jQuery(this).attr('class').split(' ')[0]; }).get().join(','),
            nested: jQuery('#nested').hasClass('ge-section') || jQuery('#nested').children('.ge-tools-drawer').length > 0,
            button: jQuery('.ge-mainControls .ge-add-feature').text(),
            widths: s.find('> .ge-tools-drawer .ge-section-width option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
        };
    `);
    t.check('a container on the canvas is a section, with move, settings, delete and add row, in the order rows and columns use',
        marked.section && marked.tools === 'ge-move,ge-settings,ge-delete-section,ge-add-row', marked);
    t.check('a container inside an element\'s markup is left alone',
        !marked.nested, marked);
    t.check('the toolbar offers a section, and the width field every container',
        marked.button === 'Section' &&
        marked.widths === 'fixed=Fixed,sm=Fixed from sm,md=Fixed from md,lg=Fixed from lg,xl=Fixed from xl,xxl=Fixed from xxl,fluid=Full width',
        marked);

    var width = await page.eval(`
        const select = jQuery('#s1 > .ge-tools-drawer .ge-section-width select');
        select.val('fluid').trigger('change');
        const fluid = { classes: jQuery('#s1').attr('class'), log: window.log.slice() };
        window.log = [];
        window.cancelNext = true;
        select.val('md').trigger('change');
        return { fluid: fluid, canceled: { classes: jQuery('#s1').attr('class'), value: select.val(), log: window.log } };
    `);
    t.check('the width field swaps the container class, announced as a utility change',
        /container-fluid/.test(width.fluid.classes) && !/(^|\s)container(\s|$)/.test(width.fluid.classes) &&
        JSON.stringify(width.fluid.log) === '[["before-utility","section","section","fixed","fluid"],["after-utility","section","section","fixed","fluid"]]',
        width.fluid);
    t.check('a canceled width change leaves the class and the field as they were',
        /container-fluid/.test(width.canceled.classes) && width.canceled.value === 'fluid' && width.canceled.log.length === 1,
        width.canceled);

    var narrowed = await page.eval(`
        start({ sections: { widths: ['fixed', 'fluid'] } });
        return jQuery('#s1 > .ge-tools-drawer .ge-section-width option').map(function() { return this.value; }).get().join(',');
    `);
    t.check('sections.widths narrows the widths offered',
        narrowed === 'fixed,fluid', narrowed);

    var edited = await page.eval(`
        start();
        jQuery('#s1 > .ge-tools-drawer .ge-add-row').trigger('click');
        const rows = jQuery('#s1').children('.row').length;
        const addLog = window.log.slice();
        window.log = [];
        jQuery('.ge-mainControls .ge-add-feature').trigger('click');
        const added = jQuery('#myGrid').children('.ge-section').last();
        const toolbar = { classes: added.attr('class'), rows: added.children('.row').length, last: added.is(jQuery('#myGrid').children().last()), log: window.log.slice() };
        window.log = [];
        jQuery('#s1 > .ge-tools-drawer .ge-delete-section').trigger('click');
        return { rows: rows, addLog: addLog, toolbar: toolbar };
    `);
    await t.sleep(700);
    var deleted = await page.eval(`return { gone: jQuery('#s1').length === 0, log: window.log };`);
    t.check('the add row tool adds a row to the section',
        edited.rows === 2 && edited.addLog.some(function(entry) { return entry[0] === 'after-add' && entry[1] === 'row'; }),
        edited);
    t.check('the toolbar button adds a fixed section with a row, at the end of the canvas, announced as a section',
        /ge-section/.test(edited.toolbar.classes) && /(^|\s)container(\s|$)/.test(edited.toolbar.classes) &&
        edited.toolbar.rows === 1 && edited.toolbar.last &&
        edited.toolbar.log.some(function(entry) { return entry[0] === 'before-add' && entry[1] === 'section'; }),
        edited.toolbar);
    t.check('deleting a section removes it and says so',
        deleted.gone && deleted.log.some(function(entry) { return entry[0] === 'after-delete' && entry[1] === 'section'; }),
        deleted);
}

async function dragTests(t, page) {
    await page.eval(`start(); return true;`);

    // The gestures go against the direction a dragged block would shift the
    // page in: a row leaving the canvas above a section, or leaving the
    // section, takes its height with it, and what was under the pointer
    // moves up out from under it.

    // Dropped on a region's top edge, a block lands first in that region
    await page.drag('#r2 > .ge-tools-drawer .ge-move', '#s1', { yRatio: 0.01, steps: 24 });
    var into = await page.eval(`return { top: topLevel(), section: inside('s1') };`);
    t.check('a row dragged into a section lands in it',
        into.top === 'r0,s1' && into.section === 'r2,r1', into);

    // Out of the section, onto the canvas above it
    await page.drag('#r1 > .ge-tools-drawer .ge-move', '#r0', { yRatio: 0.02, steps: 24 });
    var out = await page.eval(`return { top: topLevel(), section: inside('s1') };`);
    t.check('a row dragged out of a section lands on the canvas',
        out.top === 'r1,r0,s1' && out.section === 'r2', out);

    await page.eval(`window.log = []; return true;`);
    await page.drag('#s1 > .ge-tools-drawer .ge-move', '#myGrid', { yRatio: 0.002, steps: 24 });
    var moved = await page.eval(`return { top: topLevel(), log: window.log.filter(function(entry) { return entry[1] === 'section'; }) };`);
    t.check('a section is dragged along the canvas, and the move is a section\'s',
        moved.top === 's1,r1,r0' && moved.log.length === 1 && moved.log[0][0] === 'after-move', moved);

    await page.drag('#s1 > .ge-tools-drawer .ge-move', '#r0c', { yRatio: 0.9 });
    var refused = await page.eval(`return { top: topLevel(), inColumn: jQuery('#r0c').children('.ge-section').length };`);
    t.check('a section is not dropped into a column',
        refused.inColumn === 0 && /s1/.test(refused.top), refused);

    // The toolbar's section button, dropped between two canvas rows, and
    // into a column, which has no room for a section
    await page.eval(`start({ toolbar_drag: true }); return true;`);
    await page.drag('.ge-mainControls .ge-add-feature', '#r2 > .ge-tools-drawer');
    var between = await page.eval(`return topLevel();`);
    await page.drag('.ge-mainControls .ge-add-feature', '#r0c .ge-content', { yRatio: 0.5 });
    var column = await page.eval(`return { top: topLevel(), inColumn: jQuery('#r0c').find('.ge-section, .container').length };`);
    t.check('the section button dropped on the canvas makes a section there',
        between === 'r0,s1,container,r2', between);
    t.check('dropped in a column, it makes the section on the canvas, just after the block it was dropped in',
        column.top === 'r0,container,s1,container,r2' && column.inColumn === 0, column);

    var rule = await page.eval(`
        const list = Sortable.get(jQuery('#s1')[0]);
        const put = list.options.group.checkPut;
        return { section: !!list, groupsWithCanvas: list.options.group.name === Sortable.get(jQuery('#myGrid')[0]).options.group.name };
    `);
    t.check('a section is a list in the canvas\'s group, so rows move between them',
        rule.section && rule.groupsWithCanvas, rule);
}

async function previewTests(t, page) {
    var widths = await page.eval(`
        start();
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').append('<div class="container-lg" id="s2"></div><div class="container-fluid" id="s3"></div>');
        window.fixture.init({ plugins: window.fixture.plugins(['sections']) });
        const read = function(view) {
            ge().changeView(view);
            return ['s1', 's2', 's3'].map(function(id) { return getComputedStyle(jQuery('#' + id)[0]).maxWidth; }).join(' ');
        };
        return { xs: read('xs'), md: read('md'), lg: read('lg'), xxl: read('xxl') };
    `);
    t.check('each breakpoint view gives a container the max-width it has at that breakpoint',
        widths.xs === '100% 100% none' && widths.md === '720px 100% none' &&
        widths.lg === '960px 960px none' && widths.xxl === '1320px 1320px none',
        widths);

    var created = await page.eval(`
        start();
        const section = jQuery('#myGrid').gridEditor('createSection', { width: 'md', rows: [[6, 6]], appendTo: '#myGrid' });
        return {
            classes: section.attr('class'),
            columns: section.find('> .row > .column').map(function() { return jQuery(this).attr('class'); }).get().join('|'),
            placed: section.parent()[0] === jQuery('#myGrid')[0],
            html: ge().getHtml(),
        };
    `);
    t.check('createSection makes a section of the width and rows asked for, and places it',
        /container-md/.test(created.classes) && created.placed && created.columns === 'column col-6|column col-6', created);
    t.check('getHtml has the containers and none of the editing marks',
        /<div class="container" id="s1">/.test(created.html) && /class="container-md"/.test(created.html) &&
        !/ge-section|ge-tools-drawer/.test(created.html),
        created.html.slice(0, 200));

    var off = await page.eval(`
        window.fixture.teardown();
        jQuery('#myGrid').html('<div class="container" id="s1"><div class="row"><div class="column col-12"><div class="ge-content"><p>x</p></div></div></div></div>');
        window.warnings = [];
        const original = console.warn;
        console.warn = function(message) { window.warnings.push(message); original.apply(console, arguments); };
        window.fixture.init();
        const made = jQuery('#myGrid').gridEditor('createSection', {});
        console.warn = original;
        return {
            drawer: jQuery('#s1').children('.ge-tools-drawer').length,
            made: made,
            warned: window.warnings.some(function(message) { return /sections plugin/.test(message); }),
        };
    `);
    t.check('without the plugin a container is left alone, and createSection says what is missing',
        off.drawer === 0 && off.made === null && off.warned, off);
}

module.exports = {
    name: 'sections',
    description: 'the sections plugin, .container and its kin',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await controlTests(t, page);
        await dragTests(t, page);
        await previewTests(t, page);

        var errors = page.errors();
        t.check('the sections tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
