/**
 * Browser tests for the public API: the method dispatch, the instance handle
 * and the methods spec section 1 documents.
 *
 * These run on the offline fixture rather than on an example page, because
 * what is under test is the plugin's own surface and not a rich text editor.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html';

/**
 * Collect the plugin's warnings, which are part of the contract: an unknown
 * method, a deprecated one and a not-yet-implemented one each have to say so.
 */
var CAPTURE_WARNINGS = `
    window.warnings = [];
    const original = console.warn;
    console.warn = function() {
        window.warnings.push(Array.prototype.join.call(arguments, ' '));
        original.apply(console, arguments);
    };
    return true;
`;

/** What the canvas looks like, structurally, for round-trip comparison. */
var STRUCTURE = `
    return {
        rows: jQuery('#myGrid .row').length,
        columns: jQuery('#myGrid .column').length,
        contentAreas: jQuery('#myGrid .ge-content').length,
        classes: jQuery('#myGrid .column').map(function() {
            return jQuery(this).attr('class').split(/\\s+/).filter(c => /^col-/.test(c)).sort().join(' ');
        }).get(),
        text: jQuery('#myGrid').text().replace(/\\s+/g, ' ').trim(),
    };
`;

/**
 * The dispatch rules: what a method returns, and what happens when there is
 * no editor on the element.
 */
async function dispatchTests(t) {
    var page = await t.page(FIXTURE, `jQuery('#myGrid').data('grideditor')`);
    await page.eval(CAPTURE_WARNINGS);

    var handle = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const names = ['getHtml', 'init', 'deinit', 'reset', 'destroy', 'remove', 'changeView',
            'getView', 'createRow', 'createColumn', 'createElement', 'createContainer',
            'addTab', 'addAccordionItem', 'setLocale'];
        return {
            missing: names.filter(name => typeof ge[name] !== 'function'),
            canvasIsTheElement: ge.canvas[0] === document.getElementById('myGrid'),
            settingsFrozen: Object.isFrozen(ge.settings),
            settingsCopied: ge.settings.new_row_layouts !== jQuery('#myGrid').data('grideditor').settings.new_row_layouts
                ? 'handle rebuilt' : 'same object',
            contentTypes: ge.settings.content_types,
            layouts: ge.settings.new_row_layouts.length,
        };
    `);
    t.check('the instance handle exposes every method plus settings and canvas',
        handle.missing.length === 0 && handle.canvasIsTheElement && handle.settingsFrozen,
        handle);

    var writeAttempt = await page.eval(`
        'use strict';
        const ge = jQuery('#myGrid').data('grideditor');
        let threw = false;
        try { ge.settings.content_types = ['tinymce']; } catch (error) { threw = true; }
        return { threw: threw, unchanged: ge.settings.content_types.length === 0 };
    `);
    t.check('the settings copy cannot be written through', writeAttempt.unchanged, writeAttempt);

    var returns = await page.eval(`
        const set = jQuery('#myGrid');
        return {
            html: typeof set.gridEditor('getHtml'),
            view: set.gridEditor('getView'),
            viewAfterChange: (set.gridEditor('changeView', 'md'), set.gridEditor('getView')),
            init: set.gridEditor('init') === set,
            deinit: set.gridEditor('deinit') === set,
            reset: set.gridEditor('reset') === set,
            changeView: set.gridEditor('changeView', 'lg') === set,
            createRow: set.gridEditor('createRow', [6, 6]) instanceof jQuery,
            createColumn: set.gridEditor('createColumn', 6) instanceof jQuery,
            createElement: set.gridEditor('createElement', '<span>x</span>') instanceof jQuery,
        };
    `);
    t.check('each method returns what the spec says it returns',
        returns.html === 'string' && returns.view === 'all' && returns.viewAfterChange === 'md' &&
        returns.init && returns.deinit &&
        returns.reset && returns.changeView && returns.createRow && returns.createColumn &&
        returns.createElement,
        returns);

    var noInstance = await page.eval(`
        const plain = jQuery('<div id="plain"><p>plain markup</p></div>').appendTo('body');
        return {
            html: plain.gridEditor('getHtml'),
            reset: plain.gridEditor('reset') === plain,
            destroy: plain.gridEditor('destroy') === plain,
            createRow: plain.gridEditor('createRow', [12]),
            getView: plain.gridEditor('getView'),
            untouched: plain.attr('class') === undefined && plain.find('.ge-tools-drawer').length === 0,
        };
    `);
    t.check('a method on an element with no editor is a no-op, except getHtml',
        noInstance.html === '<p>plain markup</p>' && noInstance.reset && noInstance.destroy &&
        noInstance.createRow === null && noInstance.getView === null && noInstance.untouched,
        noInstance);

    var empty = await page.eval(`
        const nothing = jQuery('#no-such-element');
        return {
            length: nothing.length,
            reset: nothing.gridEditor('reset') === nothing,
            html: nothing.gridEditor('getHtml'),
        };
    `);
    t.check('a method on an empty set does nothing and still chains',
        empty.length === 0 && empty.reset && empty.html === null, empty);

    var unknown = await page.eval(`
        const set = jQuery('#myGrid');
        const chained = set.gridEditor('noSuchMethod') === set &&
            set.gridEditor('noSuchMethod') === set &&
            set.gridEditor('noSuchMethod') === set;
        return {
            chained: chained,
            warnings: window.warnings.filter(w => w.indexOf('noSuchMethod') !== -1),
        };
    `);
    t.check('an unknown method warns once and chains',
        unknown.chained && unknown.warnings.length === 1, unknown);

    var unimplemented = await page.eval(`
        const set = jQuery('#myGrid');
        return {
            container: set.gridEditor('createContainer', 'tabs'),
            tab: set.gridEditor('addTab', jQuery()),
            item: set.gridEditor('addAccordionItem', jQuery()),
            repeated: set.gridEditor('createContainer', 'tabs'),
            warnings: window.warnings.filter(w => /not implemented/.test(w)),
        };
    `);
    t.check('a method a later phase fills in returns null and warns once',
        unimplemented.container === null && unimplemented.tab === null &&
        unimplemented.item === null && unimplemented.repeated === null &&
        unimplemented.warnings.length === 3,
        unimplemented);

    var errors = page.errors();
    t.check('the dispatch tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * createRow, createColumn, createElement: detached by default, placed when
 * asked, and the canvas reset around the placement.
 */
async function createTests(t) {
    var page = await t.page(FIXTURE, `jQuery('#myGrid').data('grideditor')`);
    await page.eval(CAPTURE_WARNINGS);

    var detached = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const before = jQuery('#myGrid > .row').length;
        const row = ge.createRow([8, 4]);
        return {
            detached: row.parent().length === 0,
            rowsOnCanvas: jQuery('#myGrid > .row').length === before,
            columns: row.children().length,
            classes: row.children().map(function() { return jQuery(this).attr('class'); }).get(),
            drawers: row.find('.ge-tools-drawer').length,
            contentAreas: row.find('.ge-content').length,
        };
    `);
    t.check('createRow returns a detached row with its columns and no drawers',
        detached.detached && detached.rowsOnCanvas && detached.columns === 2 &&
        detached.drawers === 0 && detached.contentAreas === 2 &&
        /col-lg-8/.test(detached.classes[0]) && /col-lg-4/.test(detached.classes[1]),
        detached);

    var placedByHost = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const row = ge.createRow([12]);
        row.appendTo(ge.canvas);
        const beforeReset = row.find('> .ge-tools-drawer').length;
        ge.reset();
        return {
            beforeReset: beforeReset,
            afterReset: row.find('> .ge-tools-drawer').length,
            columnClass: row.find('> div.column').length,
            lastRowIsOurs: jQuery('#myGrid > .row').last()[0] === row[0],
        };
    `);
    t.check('a row the host places itself gets its controls from reset()',
        placedByHost.beforeReset === 0 && placedByHost.afterReset === 1 &&
        placedByHost.columnClass === 1 && placedByHost.lastRowIsOurs,
        placedByHost);

    var placements = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const first = jQuery('#myGrid > .row').first();
        const appended = ge.createRow([6, 6], { appendTo: ge.canvas });
        const prepended = ge.createRow([12], { prependTo: ge.canvas });
        const after = ge.createRow([12], { insertAfter: first });
        const before = ge.createRow([12], { insertBefore: first });
        const rows = jQuery('#myGrid > .row').get();
        return {
            appendedLast: rows[rows.length - 1] === appended[0],
            prependedFirst: rows[0] === prepended[0],
            afterFirst: rows.indexOf(after[0]) === rows.indexOf(first[0]) + 1,
            beforeFirst: rows.indexOf(before[0]) === rows.indexOf(first[0]) - 1,
            drawers: [appended, prepended, after, before]
                .map(row => row.find('> .ge-tools-drawer').length),
            columnsMarked: appended.find('> div.column').length,
        };
    `);
    t.check('appendTo, prependTo, insertAfter and insertBefore place the node and reset',
        placements.appendedLast && placements.prependedFirst && placements.afterFirst &&
        placements.beforeFirst && placements.drawers.every(count => count === 1) &&
        placements.columnsMarked === 2,
        placements);

    var column = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const column = ge.createColumn(4, { content: '<p>column content</p>' });
        const sized = ge.createColumn(3, { appendTo: jQuery('#myGrid > .row').first() });
        return {
            detached: column.parent().length === 0,
            classes: column.attr('class'),
            content: column.find('.ge-content').html(),
            placedClasses: sized.attr('class'),
            placedDrawer: sized.find('> .ge-tools-drawer').length,
        };
    `);
    t.check('createColumn writes the column classes and takes content',
        column.detached && /col-lg-4/.test(column.classes) && /col-sm-4/.test(column.classes) &&
        column.content === '<p>column content</p>' && /col-lg-3/.test(column.placedClasses) &&
        column.placedDrawer === 1,
        column);

    var noSize = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const column = ge.createColumn();
        return {
            classes: column.attr('class'),
            warnings: window.warnings.filter(w => /createColumn/.test(w)),
        };
    `);
    t.check('createColumn without a size warns and falls back to a full width column',
        /col-lg-12/.test(noSize.classes) && noSize.warnings.length === 1, noSize);

    var badLayout = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const row = ge.createRow(12);
        return {
            columns: row.children().length,
            isRow: row.hasClass('row'),
            warnings: window.warnings.filter(w => /createRow/.test(w)),
        };
    `);
    t.check('createRow given something that is not a layout array warns and makes an empty row',
        badLayout.columns === 0 && badLayout.isRow && badLayout.warnings.length === 1, badLayout);

    var element = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');
        const contentArea = jQuery('#myGrid .ge-content').first();
        const element = ge.createElement('<span class="my-app-tag">Analytics tag</span>', {
            type: 'analytics-tag',
            label: 'Analytics',
            appendTo: contentArea,
        });
        const plain = ge.createElement('<span>no type</span>');
        return {
            placed: element.parent()[0] === contentArea[0],
            type: element.attr('data-ge-element'),
            label: element.attr('data-ge-label'),
            cssClass: element.attr('class'),
            // The element carries its drawer now that it is on the canvas,
            // so what matters is that the host's own markup is still in there
            keptHostMarkup: element.find('.my-app-tag').length === 1 &&
                element.find('.my-app-tag').text() === 'Analytics tag',
            plainDetached: plain.parent().length === 0,
            plainType: plain.attr('data-ge-element'),
            plainLabel: plain.attr('data-ge-label'),
            canvasStillEditing: jQuery('#myGrid').hasClass('ge-editing'),
        };
    `);
    t.check('createElement wraps host markup, marks it and places it',
        element.placed && element.type === 'analytics-tag' && element.label === 'Analytics' &&
        element.cssClass === 'ge-element' &&
        element.keptHostMarkup &&
        element.plainDetached && element.plainType === 'element' &&
        element.plainLabel === undefined && element.canvasStillEditing,
        element);

    var errors = page.errors();
    t.check('the create tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * changeView and getView over the layout modes this build has.
 */
async function viewTests(t) {
    var page = await t.page(FIXTURE, `jQuery('#myGrid').data('grideditor')`);
    await page.eval(CAPTURE_WARNINGS);

    var byKey = await page.eval(`
        const set = jQuery('#myGrid');
        const seen = {};
        ['all', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'].forEach(function(key) {
            set.gridEditor('changeView', key);
            seen[key] = {
                view: set.gridEditor('getView'),
                canvasClass: jQuery('#myGrid').attr('class').match(/ge-layout-\\w+/g),
                dropdown: jQuery('.ge-layout-mode button').text(),
            };
        });
        return seen;
    `);
    t.check('changeView switches to every view and getView reports it',
        Object.keys(byKey).every(function(key) {
            return byKey[key].view === key && byKey[key].canvasClass.join() === 'ge-layout-' + key;
        }),
        byKey);
    t.check('the layout mode dropdown follows changeView',
        byKey.all.dropdown === 'All sizes' && byKey.lg.dropdown === 'Desktop' &&
        byKey.xxl.dropdown === 'Widescreen' && byKey.xs.dropdown === 'Phone',
        byKey);

    var dropdownDriven = await page.eval(`
        jQuery('#myGrid').gridEditor('changeView', 'lg');
        jQuery('.ge-layout-mode a[data-ge-view="sm"]').trigger('click');
        return {
            view: jQuery('#myGrid').gridEditor('getView'),
            dropdown: jQuery('.ge-layout-mode button').text(),
            items: jQuery('.ge-layout-mode a').map(function() { return jQuery(this).attr('data-ge-view'); }).get(),
        };
    `);
    t.check('the dropdown and the method are the same path',
        dropdownDriven.view === 'sm' && dropdownDriven.dropdown === 'Tablet' &&
        dropdownDriven.items.join(',') === 'all,xs,sm,md,lg,xl,xxl',
        dropdownDriven);

    var numeric = await page.eval(`
        const set = jQuery('#myGrid');
        const views = [0, 1, 2].map(function(index) {
            set.gridEditor('changeView', index);
            return set.gridEditor('getView');
        });
        return {
            views: views,
            warnings: window.warnings.filter(w => /changeView/.test(w)),
        };
    `);
    t.check('a 2.x numeric layout mode index still works, with one deprecation warning',
        numeric.views.join() === 'lg,sm,xs' && numeric.warnings.length === 1, numeric);

    var unknown = await page.eval(`
        const set = jQuery('#myGrid');
        set.gridEditor('changeView', 'lg');
        set.gridEditor('changeView', 'nonsense');
        return {
            view: set.gridEditor('getView'),
            warnings: window.warnings.filter(w => /no such layout mode/.test(w)),
        };
    `);
    t.check('an unknown breakpoint warns and leaves the view alone',
        unknown.view === 'lg' && unknown.warnings.length === 1, unknown);

    var errors = page.errors();
    t.check('the view tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * init, deinit, reset, destroy and the deprecated remove alias.
 */
async function lifecycleTests(t) {
    var page = await t.page(FIXTURE, `jQuery('#myGrid').data('grideditor')`);
    await page.eval(CAPTURE_WARNINGS);

    var idempotent = await page.eval(`
        const set = jQuery('#myGrid');
        const drawers = () => jQuery('#myGrid .ge-tools-drawer').length;
        const initial = drawers();
        set.gridEditor('init').gridEditor('init');
        const afterInits = drawers();
        set.gridEditor('deinit').gridEditor('deinit');
        const afterDeinits = drawers();
        set.gridEditor('reset').gridEditor('reset');
        return {
            initial: initial,
            afterInits: afterInits,
            afterDeinits: afterDeinits,
            afterResets: drawers(),
            editing: jQuery('#myGrid').hasClass('ge-editing'),
        };
    `);
    t.check('init, deinit and reset are idempotent and chain',
        idempotent.initial > 0 && idempotent.afterInits === idempotent.initial &&
        idempotent.afterDeinits === 0 && idempotent.afterResets === idempotent.initial &&
        idempotent.editing,
        idempotent);

    var roundTrip = await page.eval(STRUCTURE);
    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            drawers: /ge-tools-drawer/.test(html),
            sortable: /ui-sortable|ui-sortable-handle/.test(html),
            editing: /ge-editing/.test(html),
        };
    `);
    var reInitialized = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(html);
        window.fixture.init();
        ` + STRUCTURE);
    t.check('getHtml output carries no editor artifacts',
        !exported.drawers && !exported.sortable && !exported.editing, exported);
    t.check('feeding getHtml output back in reproduces the same editing state',
        JSON.stringify(roundTrip) === JSON.stringify(reInitialized),
        { before: roundTrip, after: reInitialized });

    var destroyed = await page.eval(`
        const set = jQuery('#myGrid');
        set.gridEditor('destroy');
        const afterDestroy = {
            instance: !!set.data('grideditor'),
            mainControls: jQuery('.ge-mainControls').length,
            sourceTextarea: jQuery('.ge-html-output').length,
            drawers: jQuery('#myGrid .ge-tools-drawer').length,
            editing: set.hasClass('ge-editing'),
            markup: set.find('h1').length,
        };
        set.gridEditor('reset');
        jQuery(window).trigger('scroll');
        set.find('.ge-content').first().trigger('click');
        return Object.assign(afterDestroy, {
            drawersAfterCalls: jQuery('#myGrid .ge-tools-drawer').length,
            rteActive: jQuery('#myGrid .ge-rte-active').length,
        });
    `);
    t.check('destroy leaves the markup, drops the controls and unbinds',
        !destroyed.instance && destroyed.mainControls === 0 && destroyed.sourceTextarea === 0 &&
        destroyed.drawers === 0 && !destroyed.editing && destroyed.markup === 1 &&
        destroyed.drawersAfterCalls === 0 && destroyed.rteActive === 0,
        destroyed);

    var deprecated = await page.eval(`
        window.fixture.init();
        const set = jQuery('#myGrid');
        set.gridEditor('remove');
        const first = window.warnings.filter(w => /deprecated/.test(w)).length;
        window.fixture.init();
        set.gridEditor('remove');
        return {
            firstWarnings: first,
            warningsPerInstance: window.warnings.filter(w => /deprecated/.test(w)).length,
            instance: !!set.data('grideditor'),
            mainControls: jQuery('.ge-mainControls').length,
        };
    `);
    t.check('remove destroys and warns once per instance',
        deprecated.firstWarnings === 1 && deprecated.warningsPerInstance === 2 &&
        !deprecated.instance && deprecated.mainControls === 0,
        deprecated);

    var errors = page.errors();
    t.check('the lifecycle tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Dispatch over a set of more than one canvas.
 */
async function multipleCanvasTests(t) {
    var page = await t.page(FIXTURE + '?init=manual', `window.fixture`);

    var state = await page.eval(`
        jQuery('<div id="second"><div class="row"><div class="col-lg-12"><p>second canvas</p></div></div></div>')
            .appendTo('.container');
        const both = jQuery('#myGrid, #second');
        both.gridEditor(window.fixture.settings);
        const initialized = {
            instances: both.filter(function() { return !!jQuery(this).data('grideditor'); }).length,
            canvases: jQuery('.ge-canvas').length,
            controls: jQuery('.ge-mainControls').length,
        };
        both.gridEditor('deinit');
        const afterDeinit = jQuery('.ge-tools-drawer').length;
        both.gridEditor('init');
        return Object.assign(initialized, {
            afterDeinit: afterDeinit,
            afterInit: jQuery('.ge-tools-drawer').length > 0,
            htmlIsFirstCanvas: jQuery('#myGrid, #second').gridEditor('getHtml').indexOf('Fixture heading') !== -1,
            viewOfFirst: both.gridEditor('getView'),
        });
    `);
    t.check('a method applies to every canvas in the set, and a value comes from the first',
        state.instances === 2 && state.canvases === 2 && state.controls === 2 &&
        state.afterDeinit === 0 && state.afterInit && state.htmlIsFirstCanvas &&
        state.viewOfFirst === 'all',
        state);

    var errors = page.errors();
    t.check('the multiple canvas tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'api',
    description: 'method dispatch and the instance handle',
    run: async function(t) {
        await dispatchTests(t);
        await createTests(t);
        await viewTests(t);
        await lifecycleTests(t);
        await multipleCanvasTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['api']);
}
