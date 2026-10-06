/**
 * Browser tests for the public API: the GridEditor instance, its methods and
 * what each returns. The 6.x dispatch over jQuery sets is the jQuery
 * adapter's, and test/adapter.js holds it to 6.x.
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
    const grid = document.getElementById('myGrid');
    return {
        rows: grid.querySelectorAll('.row').length,
        columns: grid.querySelectorAll('.column').length,
        contentAreas: grid.querySelectorAll('.ge-content').length,
        classes: Array.from(grid.querySelectorAll('.column')).map(function(column) {
            return column.getAttribute('class').split(/\\s+/).filter(c => /^col-/.test(c)).sort().join(' ');
        }),
        text: grid.textContent.replace(/\\s+/g, ' ').trim(),
    };
`;

var READY = `window.fixture && window.fixture.editor()`;

/**
 * What the instance is: its methods, its settings, what each method returns,
 * and what there is when an element has no editor.
 */
async function dispatchTests(t) {
    var page = await t.page(FIXTURE, READY);
    await page.eval(CAPTURE_WARNINGS);

    var handle = await page.eval(`
        const ge = window.fixture.editor();
        const names = ['getHtml', 'getPlainHtml', 'init', 'deinit', 'reset', 'destroy', 'changeView',
            'getView', 'createRow', 'createColumn', 'createElement', 'createContainer',
            'addTab', 'addAccordionItem', 'setLocale'];
        return {
            missing: names.filter(name => typeof ge[name] !== 'function'),
            canvasIsTheElement: ge.canvas === document.getElementById('myGrid'),
            settingsFrozen: Object.isFrozen(ge.settings),
            settingsCopied: ge.settings.new_row_layouts !== GridEditor.get('#myGrid').settings.new_row_layouts
                ? 'handle rebuilt' : 'same object',
            contentTypes: ge.settings.content_types,
            layouts: ge.settings.new_row_layouts.length,
        };
    `);
    t.check('the instance exposes every method plus settings and canvas',
        handle.missing.length === 0 && handle.canvasIsTheElement && handle.settingsFrozen,
        handle);

    var writeAttempt = await page.eval(`
        'use strict';
        const ge = window.fixture.editor();
        let threw = false;
        try { ge.settings.content_types = ['tinymce']; } catch (error) { threw = true; }
        return { threw: threw, unchanged: ge.settings.content_types.length === 0 };
    `);
    t.check('the settings copy cannot be written through', writeAttempt.unchanged, writeAttempt);

    var returns = await page.eval(`
        const ge = window.fixture.editor();
        return {
            html: typeof ge.getHtml(),
            view: ge.getView(),
            viewAfterChange: (ge.changeView('md'), ge.getView()),
            init: ge.init() === ge,
            deinit: ge.deinit() === ge,
            reset: ge.reset() === ge,
            changeView: ge.changeView('lg') === ge,
            createRow: ge.createRow([6, 6]) instanceof Element,
            createColumn: ge.createColumn(6) instanceof Element,
            createElement: ge.createElement('<span>x</span>') instanceof Element,
        };
    `);
    t.check('each method returns what the spec says it returns',
        returns.html === 'string' && returns.view === 'all' && returns.viewAfterChange === 'md' &&
        returns.init && returns.deinit &&
        returns.reset && returns.changeView && returns.createRow && returns.createColumn &&
        returns.createElement,
        returns);

    var noInstance = await page.eval(`
        const plain = document.createElement('div');
        plain.id = 'plain';
        plain.innerHTML = '<p>plain markup</p>';
        document.body.appendChild(plain);
        return {
            instance: GridEditor.get(plain),
            bySelector: GridEditor.get('#plain'),
            nothing: GridEditor.get('#no-such-element'),
            untouched: plain.getAttribute('class') === null && plain.querySelectorAll('.ge-tools-drawer').length === 0,
        };
    `);
    t.check('an element with no editor has none to hand back, and is left alone',
        noInstance.instance === null && noInstance.bySelector === null && noInstance.nothing === null &&
        noInstance.untouched,
        noInstance);

    var wrongArguments = await page.eval(`
        const ge = window.fixture.editor();
        return {
            unknownType: ge.createContainer('gallery'),
            wrongContainer: ge.addTab(document.querySelector('#myGrid .row')),
            warnings: window.warnings.filter(w => /container/.test(w)),
        };
    `);
    t.check('a create call that cannot be honoured says so and returns null',
        wrongArguments.unknownType === null && wrongArguments.wrongContainer === null &&
        wrongArguments.warnings.length === 2,
        wrongArguments);

    var errors = page.errors();
    t.check('the dispatch tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * createRow, createColumn, createElement: detached by default, placed when
 * asked, and the canvas reset around the placement.
 */
async function createTests(t) {
    var page = await t.page(FIXTURE, READY);
    await page.eval(CAPTURE_WARNINGS);
    await page.eval(`
        window.own = function(node, selector) {
            return Array.from(node.children).filter(child => child.matches(selector));
        };
        return true;
    `);

    var detached = await page.eval(`
        const ge = window.fixture.editor();
        const before = own(ge.canvas, '.row').length;
        const row = ge.createRow([8, 4]);
        return {
            detached: row.parentNode === null,
            rowsOnCanvas: own(ge.canvas, '.row').length === before,
            columns: row.children.length,
            classes: Array.from(row.children).map(child => child.getAttribute('class')),
            drawers: row.querySelectorAll('.ge-tools-drawer').length,
            contentAreas: row.querySelectorAll('.ge-content').length,
        };
    `);
    t.check('createRow returns a detached row with its columns, empty, and no drawers',
        detached.detached && detached.rowsOnCanvas && detached.columns === 2 &&
        detached.drawers === 0 && detached.contentAreas === 0 &&
        /(^|\s)col-8(\s|$)/.test(detached.classes[0]) && /(^|\s)col-4(\s|$)/.test(detached.classes[1]),
        detached);

    var placedByHost = await page.eval(`
        const ge = window.fixture.editor();
        const row = ge.createRow([12]);
        ge.canvas.appendChild(row);
        const beforeReset = own(row, '.ge-tools-drawer').length;
        ge.reset();
        const rows = own(ge.canvas, '.row');
        return {
            beforeReset: beforeReset,
            afterReset: own(row, '.ge-tools-drawer').length,
            columnClass: own(row, 'div.column').length,
            lastRowIsOurs: rows[rows.length - 1] === row,
        };
    `);
    t.check('a row the host places itself gets its controls from reset()',
        placedByHost.beforeReset === 0 && placedByHost.afterReset === 1 &&
        placedByHost.columnClass === 1 && placedByHost.lastRowIsOurs,
        placedByHost);

    var placements = await page.eval(`
        const ge = window.fixture.editor();
        const first = own(ge.canvas, '.row')[0];
        const appended = ge.createRow([6, 6], { appendTo: ge.canvas });
        const prepended = ge.createRow([12], { prependTo: ge.canvas });
        const after = ge.createRow([12], { insertAfter: first });
        const before = ge.createRow([12], { insertBefore: first });
        const rows = own(ge.canvas, '.row');
        return {
            appendedLast: rows[rows.length - 1] === appended,
            prependedFirst: rows[0] === prepended,
            afterFirst: rows.indexOf(after) === rows.indexOf(first) + 1,
            beforeFirst: rows.indexOf(before) === rows.indexOf(first) - 1,
            drawers: [appended, prepended, after, before]
                .map(row => own(row, '.ge-tools-drawer').length),
            columnsMarked: own(appended, 'div.column').length,
        };
    `);
    t.check('appendTo, prependTo, insertAfter and insertBefore place the node and reset',
        placements.appendedLast && placements.prependedFirst && placements.afterFirst &&
        placements.beforeFirst && placements.drawers.every(count => count === 1) &&
        placements.columnsMarked === 2,
        placements);

    var column = await page.eval(`
        const ge = window.fixture.editor();
        const column = ge.createColumn(4, { content: '<p>column content</p>' });
        const blank = ge.createColumn(4, { content: '' });
        const sized = ge.createColumn(3, { appendTo: own(ge.canvas, '.row')[0] });
        const area = column.querySelector('.ge-content');
        const blankArea = own(blank, '.ge-content');
        return {
            detached: column.parentNode === null,
            classes: column.getAttribute('class'),
            content: area.innerHTML,
            // The fixture offers no text editor: what it is given is plain
            type: area.getAttribute('data-ge-content-type') || null,
            blank: blankArea.length === 1 && blankArea[0].innerHTML === '' &&
                !blankArea[0].getAttribute('data-ge-content-type'),
            placedClasses: sized.getAttribute('class'),
            placedDrawer: own(sized, '.ge-tools-drawer').length,
            placedEmpty: Array.from(sized.children).filter(c => !c.matches('.ge-tools-drawer, .ge-resize-handle')).length,
        };
    `);
    t.check('createColumn writes the column classes and takes content, as plain content with no editor offered',
        column.detached && column.classes === 'column col-4' &&
        column.content === '<p>column content</p>' && column.type === null && column.blank &&
        /(^|\s)col-3(\s|$)/.test(column.placedClasses) && column.placedDrawer === 1 && column.placedEmpty === 0,
        column);

    var offered = await page.eval(`
        const ge = window.fixture.init({ content_types: ['tinymce', 'ckeditor'] });
        const column = ge.createColumn(6, { content: '<p>C</p>' });
        const area = own(column, '.ge-content')[0];
        const result = {
            type: area.getAttribute('data-ge-content-type'),
            classed: area.classList.contains('ge-content-type-tinymce'),
            html: area.innerHTML,
        };
        window.fixture.init();
        return result;
    `);
    t.check('with editors offered, createColumn\'s content is a text of the first one',
        offered.type === 'tinymce' && offered.classed && offered.html === '<p>C</p>', offered);

    var noSize = await page.eval(`
        const ge = window.fixture.editor();
        const column = ge.createColumn();
        return {
            classes: column.getAttribute('class'),
            warnings: window.warnings.filter(w => /createColumn/.test(w)),
        };
    `);
    t.check('createColumn without a size warns and falls back to a full width column',
        /(^|\s)col-12(\s|$)/.test(noSize.classes) && noSize.warnings.length === 1, noSize);

    var badLayout = await page.eval(`
        const ge = window.fixture.editor();
        const row = ge.createRow(12);
        return {
            columns: row.children.length,
            isRow: row.classList.contains('row'),
            warnings: window.warnings.filter(w => /createRow/.test(w)),
        };
    `);
    t.check('createRow given something that is not a layout array warns and makes an empty row',
        badLayout.columns === 0 && badLayout.isRow && badLayout.warnings.length === 1, badLayout);

    var element = await page.eval(`
        const ge = window.fixture.editor();
        const column = document.querySelector('#myGrid .column');
        const element = ge.createElement('<span class="my-app-tag">Analytics tag</span>', {
            type: 'analytics-tag',
            label: 'Analytics',
            appendTo: column,
        });
        const plain = ge.createElement('<span>no type</span>');
        const tag = element.querySelectorAll('.my-app-tag');
        return {
            placed: element.parentNode === column,
            type: element.getAttribute('data-ge-element'),
            label: element.getAttribute('data-ge-label'),
            cssClass: element.getAttribute('class'),
            // The element carries its drawer now that it is on the canvas,
            // so what matters is that the host's own markup is still in there
            keptHostMarkup: tag.length === 1 && tag[0].textContent === 'Analytics tag',
            plainDetached: plain.parentNode === null,
            plainType: plain.getAttribute('data-ge-element'),
            plainLabel: plain.getAttribute('data-ge-label'),
            canvasStillEditing: ge.canvas.classList.contains('ge-editing'),
        };
    `);
    t.check('createElement wraps host markup, marks it and places it',
        element.placed && element.type === 'analytics-tag' && element.label === 'Analytics' &&
        element.cssClass === 'ge-element' &&
        element.keptHostMarkup &&
        element.plainDetached && element.plainType === 'element' &&
        element.plainLabel === null && element.canvasStillEditing,
        element);

    var errors = page.errors();
    t.check('the create tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * changeView and getView over the layout modes this build has.
 */
async function viewTests(t) {
    var page = await t.page(FIXTURE, READY);
    await page.eval(CAPTURE_WARNINGS);

    var byKey = await page.eval(`
        const ge = window.fixture.editor();
        const seen = {};
        ['all', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'].forEach(function(key) {
            ge.changeView(key);
            seen[key] = {
                view: ge.getView(),
                canvasClass: ge.canvas.getAttribute('class').match(/ge-layout-\\w+/g),
                dropdown: document.querySelector('.ge-layout-mode button').textContent,
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
        const ge = window.fixture.editor();
        ge.changeView('lg');
        document.querySelector('.ge-layout-mode a[data-ge-view="sm"]').click();
        return {
            view: ge.getView(),
            dropdown: document.querySelector('.ge-layout-mode button').textContent,
            items: Array.from(document.querySelectorAll('.ge-layout-mode a')).map(a => a.getAttribute('data-ge-view')),
        };
    `);
    t.check('the dropdown and the method are the same path',
        dropdownDriven.view === 'sm' && dropdownDriven.dropdown === 'Tablet' &&
        dropdownDriven.items.join(',') === 'all,xs,sm,md,lg,xl,xxl',
        dropdownDriven);

    var numeric = await page.eval(`
        const ge = window.fixture.editor();
        ge.changeView('all');
        window.warnings = [];
        const col = document.querySelector('#myGrid .column');
        const views = [0, 1, 2].map(function(index) {
            ge.changeView(index);
            return ge.getView();
        });
        const before = col.getAttribute('class');
        const read = ge.getUtility(col, 'col', 1);
        ge.setUtility(col, 'col', 6, { view: 2 });
        return {
            views: views,
            read: read,
            written: col.getAttribute('class') === before,
            warnings: window.warnings.filter(w => /no such layout mode/.test(w)),
        };
    `);
    t.check('a numeric view is a view that does not exist: changeView warns and stays (AC-07)',
        numeric.views.join() === 'all,all,all' &&
        ['changeView(0)', 'changeView(1)', 'changeView(2)'].every(function(call) {
            return numeric.warnings.some(function(w) { return w.indexOf(call + ': no such layout mode') !== -1; });
        }), numeric);
    t.check('getUtility with a numeric view warns and gives null (AC-08)',
        numeric.read === null && numeric.warnings.some(function(w) { return /getUtility\(1\): no such layout mode/.test(w); }), numeric);
    t.check('setUtility with a numeric view warns and writes nothing (AC-09)',
        numeric.written && numeric.warnings.some(function(w) { return /setUtility\(2\): no such layout mode/.test(w); }), numeric);

    var unknown = await page.eval(`
        const ge = window.fixture.editor();
        ge.changeView('lg');
        window.warnings = [];
        ge.changeView('nonsense');
        return {
            view: ge.getView(),
            warnings: window.warnings.filter(w => /no such layout mode/.test(w)),
        };
    `);
    t.check('an unknown breakpoint warns and leaves the view alone',
        unknown.view === 'lg' && unknown.warnings.length === 1, unknown);

    var errors = page.errors();
    t.check('the view tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * init, deinit, reset and destroy; remove, the 6.x alias of destroy, is gone.
 */
async function lifecycleTests(t) {
    var page = await t.page(FIXTURE, READY);
    await page.eval(CAPTURE_WARNINGS);

    var idempotent = await page.eval(`
        const ge = window.fixture.editor();
        const drawers = () => document.querySelectorAll('#myGrid .ge-tools-drawer').length;
        const initial = drawers();
        ge.init().init();
        const afterInits = drawers();
        ge.deinit().deinit();
        const afterDeinits = drawers();
        ge.reset().reset();
        return {
            initial: initial,
            afterInits: afterInits,
            afterDeinits: afterDeinits,
            afterResets: drawers(),
            editing: ge.canvas.classList.contains('ge-editing'),
        };
    `);
    t.check('init, deinit and reset are idempotent and chain',
        idempotent.initial > 0 && idempotent.afterInits === idempotent.initial &&
        idempotent.afterDeinits === 0 && idempotent.afterResets === idempotent.initial &&
        idempotent.editing,
        idempotent);

    var dropped = await page.eval(`
        window.warnings = [];
        const ge = window.fixture.init({ sortable_options: {}, resizable_options: {} });
        const result = {
            warnings: window.warnings.slice(),
            editing: ge.canvas.classList.contains('ge-editing'),
            drawers: document.querySelectorAll('#myGrid .ge-tools-drawer').length,
        };
        window.fixture.init();
        return result;
    `);
    t.check('sortable_options and resizable_options are options like any other the editor does not know: no warning (AC-10)',
        dropped.warnings.length === 0 && dropped.editing && dropped.drawers > 0, dropped);

    var roundTrip = await page.eval(STRUCTURE);
    var exported = await page.eval(`
        const html = window.fixture.editor().getHtml();
        return {
            html: html,
            drawers: /ge-tools-drawer/.test(html),
            sortable: /ui-sortable|ge-drag-|ge-resize-handle/.test(html),
            editing: /ge-editing/.test(html),
        };
    `);
    var reInitialized = await page.eval(`
        const html = window.fixture.editor().getHtml();
        window.fixture.editor().destroy();
        document.getElementById('myGrid').innerHTML = html;
        window.fixture.init();
        ` + STRUCTURE);
    t.check('getHtml output carries no editor artifacts',
        !exported.drawers && !exported.sortable && !exported.editing, exported);
    t.check('feeding getHtml output back in reproduces the same editing state',
        JSON.stringify(roundTrip) === JSON.stringify(reInitialized),
        { before: roundTrip, after: reInitialized });

    var destroyed = await page.eval(`
        const ge = window.fixture.editor();
        const grid = document.getElementById('myGrid');
        ge.destroy();
        const afterDestroy = {
            instance: !!GridEditor.get(grid),
            mainControls: document.querySelectorAll('.ge-mainControls').length,
            sourceTextarea: document.querySelectorAll('.ge-html-output').length,
            drawers: grid.querySelectorAll('.ge-tools-drawer').length,
            editing: grid.classList.contains('ge-editing'),
            markup: grid.querySelectorAll('h1').length,
        };
        ge.reset();
        window.dispatchEvent(new Event('scroll'));
        const area = grid.querySelector('.ge-content');
        if (area) { area.click(); }
        return Object.assign(afterDestroy, {
            drawersAfterCalls: grid.querySelectorAll('.ge-tools-drawer').length,
            rteActive: grid.querySelectorAll('.ge-rte-active').length,
        });
    `);
    t.check('destroy leaves the markup, drops the controls and unbinds',
        !destroyed.instance && destroyed.mainControls === 0 && destroyed.sourceTextarea === 0 &&
        destroyed.drawers === 0 && !destroyed.editing && destroyed.markup === 1 &&
        destroyed.drawersAfterCalls === 0 && destroyed.rteActive === 0,
        destroyed);

    var removed = await page.eval(`
        const ge = window.fixture.init();
        return {
            method: typeof ge.remove,
            instance: GridEditor.get('#myGrid') === ge,
            mainControls: document.querySelectorAll('.ge-mainControls').length,
        };
    `);
    t.check('remove, deprecated in 6.x, is gone: the instance has no such method, and the editor stays',
        removed.method === 'undefined' && removed.instance && removed.mainControls === 1,
        removed);

    var errors = page.errors();
    t.check('the lifecycle tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Two canvases on one page, an editor on each.
 */
async function multipleCanvasTests(t) {
    var page = await t.page(FIXTURE + '?init=manual', `window.fixture`);

    var state = await page.eval(`
        const holder = document.createElement('div');
        holder.innerHTML = '<div id="second"><div class="row"><div class="col-lg-12"><p>second canvas</p></div></div></div>';
        document.querySelector('.container').appendChild(holder.firstChild);
        const editors = ['#myGrid', '#second'].map(id => GridEditor.create(id, window.fixture.settings));
        const initialized = {
            instances: ['#myGrid', '#second'].filter(id => !!GridEditor.get(id)).length,
            distinct: editors[0] !== editors[1],
            canvases: document.querySelectorAll('.ge-canvas').length,
            controls: document.querySelectorAll('.ge-mainControls').length,
        };
        editors[0].deinit();
        const afterFirstDeinit = {
            first: document.querySelectorAll('#myGrid .ge-tools-drawer').length,
            second: document.querySelectorAll('#second .ge-tools-drawer').length,
        };
        editors.forEach(ge => ge.deinit());
        const afterDeinit = document.querySelectorAll('.ge-tools-drawer').length;
        editors.forEach(ge => ge.init());
        return Object.assign(initialized, {
            afterFirstDeinit: afterFirstDeinit,
            afterDeinit: afterDeinit,
            afterInit: document.querySelectorAll('.ge-tools-drawer').length > 0,
            htmlOfFirst: editors[0].getHtml().indexOf('Fixture heading') !== -1 &&
                editors[0].getHtml().indexOf('second canvas') === -1,
            htmlOfSecond: editors[1].getHtml().indexOf('second canvas') !== -1,
            viewOfFirst: editors[0].getView(),
        });
    `);
    t.check('two canvases get an editor each, and each editor\'s methods act on its own canvas',
        state.instances === 2 && state.distinct && state.canvases === 2 && state.controls === 2 &&
        state.afterFirstDeinit.first === 0 && state.afterFirstDeinit.second > 0 &&
        state.afterDeinit === 0 && state.afterInit && state.htmlOfFirst && state.htmlOfSecond &&
        state.viewOfFirst === 'all',
        state);

    var groups = await page.eval(`
        const groupOf = function(selector) {
            const instance = Sortable.get(document.querySelector(selector));
            return instance ? instance.options.group.name : null;
        };
        return {
            first: groupOf('#myGrid .row'),
            second: groupOf('#second .row'),
        };
    `);
    t.check('each editor puts its lists in groups of its own',
        groups.first && groups.second && groups.first !== groups.second, groups);

    // The drag that used to work by accident: a column out of one editor and
    // into the other, which took the first editor's drawer with it and fired
    // its events over someone else's canvas
    await page.eval(`
        document.querySelector('#myGrid .column').id = 'first-column';
        document.querySelector('#second .column').id = 'second-column';
        return true;
    `);
    await page.drag('#first-column > .ge-tools-drawer .ge-move', '#second-column', { yRatio: 0.2 });
    var across = await page.eval(`
        return {
            stayed: document.querySelectorAll('#myGrid #first-column').length,
            leaked: document.querySelectorAll('#second #first-column').length,
        };
    `);
    t.check('a column cannot be dragged from one editor into another',
        across.stayed === 1 && across.leaked === 0, across);

    var errors = page.errors();
    t.check('the multiple canvas tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'api',
    description: 'the GridEditor instance and its methods',
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
