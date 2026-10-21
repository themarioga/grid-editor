/**
 * Browser tests for the plugin contract of 7.0: what every shipped plugin is
 * handed, and what it hands back, is DOM - elements, and arrays of them where
 * 6.x handed out a jQuery set of several.
 *
 * Each factory the page registered is wrapped before the editor starts: the
 * handle it is called with is looked at, and every hook it returns records
 * what it was called with and what it returned. Then the editor is taken
 * through the operations that call the hooks.
 *
 * Spec remove-jquery: AC-13, D9.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** Hooks that are handed nodes, or hand one back. The argument positions that are nodes. */
var WRAP = `
    window.contract = { handles: [], wrong: [], calls: {} };

    const isNode = function(value) { return value instanceof Element; };
    const nodeish = function(value) {
        if (value === null || value === undefined) { return true; }
        if (Array.isArray(value)) { return value.every(isNode); }
        return isNode(value);
    };
    const note = function(plugin, hook, what, value) {
        window.contract.calls[plugin + '.' + hook] = (window.contract.calls[plugin + '.' + hook] || 0) + 1;
        if (!nodeish(value)) {
            window.contract.wrong.push(plugin + '.' + hook + ' ' + what + ': ' + Object.prototype.toString.call(value));
        }
    };

    const NODE_ARGUMENTS = {
        mark: [0], unmark: [0], tools: [0, 1], afterPaneMove: [0, 1], addPane: [0],
        drawerTools: [0, 1], plainTools: [0, 1], kindOf: [0], accepts: [0, 1],
        onContentReady: [0], onSourceOpen: [0], onSourceClose: [0], onRefresh: [0],
        panel: [0], preview: [0], edit: [0],
    };
    const NODE_RESULTS = ['create', 'addPane', 'panel'];

    const wrapHooks = function(plugin, definition) {
        Object.keys(definition).forEach(function(hook) {
            const original = definition[hook];
            if (typeof original !== 'function') { return; }

            definition[hook] = function() {
                const args = arguments;
                (NODE_ARGUMENTS[hook] || []).forEach(function(index) {
                    // A utility's family preview is (value, node, kind): its node is the second
                    note(plugin, hook, 'argument ' + index, args[index]);
                });
                const result = original.apply(this, args);
                if (NODE_RESULTS.indexOf(hook) !== -1) { note(plugin, hook, 'result', result); }
                return result;
            };
        });
        (definition.families || []).forEach(function(family) {
            if (typeof family.preview !== 'function') { return; }
            const preview = family.preview;
            family.preview = function(value, node) {
                note(plugin, 'family preview', 'node', node);
                return preview.apply(this, arguments);
            };
        });
        (definition.toolbar || []).forEach(function(item) {
            const create = item.create;
            item.create = function() {
                const made = create.apply(this, arguments);
                note(plugin, 'toolbar create', 'result', made);
                return made;
            };
        });
        return definition;
    };

    const lookAt = function(plugin, ge) {
        const drawer = document.createElement('div');
        const tool = ge.createTool(drawer, 'Probe', 'ge-probe', 'bi bi-star');
        const region = ge.defaultRegion();
        const row = ge.rowFromLayout([6, 6]);
        const fresh = ge.freshNode('<div id="' + ge.canvas.id + '"><a href="#' + ge.canvas.id + '">Up</a></div>');
        window.contract.handles.push({
            plugin: plugin,
            canvas: isNode(ge.canvas),
            tool: isNode(tool) && tool.parentNode === drawer,
            region: isNode(region),
            row: isNode(row) && row.children.length === 2,
            toolbarItems: Array.isArray(ge.toolbarItems(plugin)),
            detailsOfNothing: ge.detailsOf(drawer) === null,
            drawerOf: ge.drawerOf(drawer) === null,
            freshNode: isNode(fresh) && fresh.id === ge.canvas.id + '-2' &&
                fresh.firstChild.getAttribute('href') === '#' + ge.canvas.id + '-2',
        });
    };

    ['containers', 'features', 'utilities', 'texts'].forEach(function(registry) {
        Object.keys(GridEditor[registry]).forEach(function(name) {
            const factory = GridEditor[registry][name];
            const wrapped = function(ge) {
                lookAt(name, ge);
                return wrapHooks(name, factory.apply(this, arguments));
            };
            wrapped.always = factory.always;
            GridEditor[registry][name] = wrapped;
        });
    });
    return true;
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(WRAP);

    var exercised = await page.eval(`
        const settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
        document.querySelector('#myGrid').innerHTML =
            '<div class="row"><div class="col-6" id="left"><p>Left</p><div data-ge-element="quote"><blockquote>Q</blockquote></div></div>' +
            '<div class="col-6 order-md-2 d-md-none" id="right"><p>Right</p></div></div>';
        const ge = window.fixture.init({ plugins: null, elements: { enabled: true }, confirm_delete: false });

        ge.createContainer('tabs', { appendTo: '#left' });
        ge.createContainer('accordion', { appendTo: '#left' });
        ge.createContainer('popup', { appendTo: '#right' });
        ge.createContainer('offcanvas', { appendTo: '#right' });
        ge.createContainer('card', { appendTo: '#right' });
        ge.createSection({ appendTo: '#myGrid' });
        const tabs = document.querySelector('[data-ge-container="tabs"]');
        ge.addTab(tabs, { label: 'Two' });
        ge.changeView('md');
        ge.setUtility('#right', 'order', '1');
        ge.changeView('all');
        document.querySelector('.gm-edit-mode').click();
        document.querySelector('.gm-edit-mode').click();
        document.querySelectorAll('.ge-add-feature').forEach(function(button) {
            if (button.offsetParent) { button.click(); }
        });
        ge.getHtml();
        ge.reset();
        await settle(100);

        const loaded = Object.keys(window.contract.calls).map(function(key) { return key.split('.')[0]; })
            .filter(function(name, i, all) { return all.indexOf(name) === i; }).sort();
        return { handles: window.contract.handles, wrong: window.contract.wrong, loaded: loaded, calls: Object.keys(window.contract.calls).length };
    `);

    var plugins = exercised.handles.map(function(handle) { return handle.plugin; }).sort();
    t.check('every plugin the fixture loads was made with a handle',
        ['accordion', 'alignment', 'card', 'ckeditor', 'clipboard', 'codemirror', 'codemirror-inline', 'elements',
            'gutters', 'inline-style', 'offcanvas', 'order', 'popup', 'sections', 'summernote', 'tabs', 'text', 'tinymce']
            .every(function(name) { return plugins.indexOf(name) !== -1; }),
        plugins);
    t.check('the handle gives elements: the canvas, a tool, a region, a row; an array of toolbar items; null for no panel or drawer; a fresh node, its ids renamed',
        exercised.handles.every(function(handle) {
            return handle.canvas && handle.tool && handle.region && handle.row && handle.toolbarItems &&
                handle.detailsOfNothing && handle.drawerOf && handle.freshNode;
        }), exercised.handles.filter(function(handle) {
            return !(handle.canvas && handle.tool && handle.region && handle.row && handle.toolbarItems && handle.detailsOfNothing && handle.drawerOf && handle.freshNode);
        }));
    t.check('every hook of every shipped plugin was handed elements, and every one that makes a node handed one back',
        exercised.wrong.length === 0 && exercised.calls > 20, { wrong: exercised.wrong, calls: exercised.calls, loaded: exercised.loaded });

    var errors = page.errors();
    t.check('the plugin contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * The handle's view of the selection, the target, what is open and what is
 * the editor's own (spec clipboard-shortcuts, AC-41 to AC-43). A probe
 * plugin keeps the handle it is given.
 */
async function handleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    // In the background a page's transitions do not run, and the confirmation fades out
    await page.send('Page.bringToFront');

    var state = await page.eval(`
        const settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
        GridEditor.features.probe = function(handle) { window.probe = handle; return {}; };
        const q = function(selector) { return document.querySelector(selector); };
        const canvas = '<div class="row" id="r1"><div class="column col-6" id="a"><p>A</p></div><div class="column col-6" id="b"><p>B</p></div></div>';

        q('#myGrid').innerHTML = canvas;
        let ge = window.fixture.init({ settings_panel: 'sidebar', confirm_delete: false, plugins: window.fixture.plugins(['probe']) });
        q('#a > .ge-tools-drawer').click();
        const mirrors = {
            gone: window.probe.getSelected === undefined && window.probe.setSelected === undefined,
            target: window.probe.getActiveTarget() === ge.getActiveTarget() && !!ge.getActiveTarget(),
        };

        const other = document.body.appendChild(document.createElement('div'));
        other.innerHTML = '<div class="row"><div class="column col-12" id="oc"><p>Other</p></div></div>';
        const second = GridEditor.create(other, { plugins: [] });
        const contains = {
            canvas: window.probe.contains(q('#a')),
            toolbar: window.probe.contains(q('#myGrid').previousElementSibling.previousElementSibling.querySelector('button')),
            sidebar: window.probe.contains(q('.ge-settings-sidebar')),
            otherCanvas: window.probe.contains(q('#oc')),
            body: window.probe.contains(document.body),
        };
        second.destroy();
        other.remove();

        q('#myGrid').innerHTML = canvas;
        ge = window.fixture.init({ settings_panel: 'popover', confirm_delete: true, plugins: window.fixture.plugins(['probe']) });
        const open = { none: window.probe.panelOpen() };
        q('#a > .ge-tools-drawer > .ge-settings').click();
        open.panel = window.probe.panelOpen();
        q('#a > .ge-tools-drawer > .ge-settings').click();
        open.panelClosed = window.probe.panelOpen();
        const body = document.createElement('div');
        window.probe.openDialog('Probe', body);
        open.dialog = window.probe.panelOpen();
        window.probe.closeDialog();
        await settle(400);
        open.dialogClosed = window.probe.panelOpen();
        q('#a > .ge-tools-drawer > .ge-delete-column').click();
        // Bootstrap does not hide a modal still fading in
        await settle(800);
        open.confirm = window.probe.panelOpen();
        q('.ge-confirm .ge-confirm-cancel').click();
        await settle(800);
        open.confirmClosed = window.probe.panelOpen();
        ge.destroy();
        delete GridEditor.features.probe;
        return { mirrors: mirrors, contains: contains, open: open };
    `);
    t.check('getActiveTarget on the handle gives what the public method gives, and getSelected/setSelected are gone (AC-41; active-target-selection §5)',
        state.mirrors.gone && state.mirrors.target, state.mirrors);

    var placed = await page.eval(`
        GridEditor.features.probe = function(handle) { window.probe = handle; return {}; };
        // A container of a third party, with no regionOf: as a target, it adds to its column
        GridEditor.containers.box = function(handle) {
            return {
                labelKey: 'container.add_box',
                create: function() {
                    const box = document.createElement('div');
                    box.setAttribute('data-ge-container', 'box');
                    box.appendChild(handle.defaultRegion());
                    return box;
                },
                mark: function() {},
                unmark: function() {},
                cleanMarkup: function() {},
            };
        };
        const q = function(selector) { return document.querySelector(selector); };
        q('#myGrid').innerHTML = '<div class="row" id="r1"><div class="column col-6" id="a"><p>A</p></div><div class="column col-6" id="b"><p>B</p></div></div>';
        const ge = window.fixture.init({ active_target: true, plugins: window.fixture.plugins(['probe', 'box']) });
        const adds = [];
        q('#myGrid').addEventListener('grideditor:after-add', function(e) { adds.push(e.detail.kind + ':' + e.detail.source + ':' + (e.detail.parent && e.detail.parent.id)); });
        const before = window.probe.placeInTarget(GridEditor.get('#myGrid').createRow([12]), 'row', 'api');
        ge.setActiveTarget('#r1');
        const row = document.createElement('div');
        row.className = 'row';
        const made = window.probe.placeInTarget(row, 'row', 'paste');
        const last = Array.from(q('#r1').children).filter(function(c) { return c.matches('.column'); }).pop();
        const result = { before: before, made: made === row, inColumn: row.parentElement === last, columns: q('#r1').querySelectorAll(':scope > .column').length, adds: adds.slice() };

        const box = ge.createContainer('box', { appendTo: '#a' });
        ge.setActiveTarget(box);
        const text = window.probe.placeInTarget(GridEditor.get('#myGrid').createRow([6]), 'row', 'api');
        result.boxAddsToColumn = !!text && text.parentElement === q('#a');
        ge.destroy();
        delete GridEditor.features.probe;
        delete GridEditor.containers.box;
        return result;
    `);
    t.check('placeInTarget on the handle adds a node to the target as the toolbar would, wrapped in the column it lacks (active-target-selection §5, AC-11)',
        placed.before === null && placed.made && placed.inColumn && placed.columns === 3 &&
        JSON.stringify(placed.adds.slice(-1)) === JSON.stringify(['row:paste:r1']), placed);
    t.check('a container with no regionOf adds to its column when it is the target (active-target-selection D14)',
        placed.boxAddsToColumn, placed);

    var removed = await page.eval(`
        GridEditor.features.probe = function(handle) { window.probe = handle; return {}; };
        const q = function(selector) { return document.querySelector(selector); };
        const settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 900); }); };
        window.tinymce = { init: function(config) { const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {}, remove: function() {} }; config.init_instance_callback.call(editor, editor); } };
        q('#myGrid').innerHTML = '<div class="row" id="r1"><div class="column col-6" id="a"><div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce"><p>A</p></div></div>' +
            '<div class="column col-6" id="b"><p>B</p></div></div><div class="row" id="r2"><div class="column col-12" id="c"><p>C</p></div></div>';
        const ge = window.fixture.init({ content_types: ['tinymce'], active_target: true, confirm_delete: true, plugins: window.fixture.plugins(['probe']) });
        const log = [];
        q('#myGrid').addEventListener('grideditor:before-delete', function(e) { log.push('before:' + e.detail.kind + ':' + e.detail.source); });
        q('#myGrid').addEventListener('grideditor:after-delete', function(e) { log.push('after:' + e.detail.kind + ':' + e.detail.source); });
        const out = {};

        let called = 0;
        out.column = window.probe.removeNode(q('#b'), { source: 'probe', confirm: false, before: function() { called++; log.push('before()'); } });
        out.asked = !!q('.ge-confirm.show');
        await settle();
        out.columnGone = !q('#b');

        out.text = window.probe.removeNode(q('#a .ge-content'), { source: 'probe', confirm: false });
        await settle();
        out.textGone = !q('#a .ge-content');

        const cancel = function(e) { e.preventDefault(); };
        q('#myGrid').addEventListener('grideditor:before-delete', cancel);
        out.canceled = window.probe.removeNode(q('#c'), { confirm: false, before: function() { called++; } });
        q('#myGrid').removeEventListener('grideditor:before-delete', cancel);
        out.cKept = !!q('#c');

        out.noTool = window.probe.removeNode(q('#myGrid'), {});
        out.called = called;

        // Asked by default, as the tool asks
        out.byDefault = window.probe.removeNode(q('#c'));
        // Bootstrap does not show a modal until it has begun to fade in
        await settle(400);
        out.defaultAsked = !!q('.ge-confirm.show');
        q('.ge-confirm .ge-confirm-cancel').click();
        await settle(800);
        out.cStill = !!q('#c');

        ge.setActiveTarget('#c');
        out.cleared = window.probe.setActiveTarget(null);
        out.target = ge.getActiveTarget();
        out.log = log;
        ge.destroy();
        delete GridEditor.features.probe;
        return out;
    `);
    t.check('removeNode removes a node as its delete tool does, with no question, its source in the events, and before() once let through (clipboard-cut §5)',
        removed.column === true && !removed.asked && removed.columnGone && removed.called === 1 &&
        JSON.stringify(removed.log.slice(0, 3)) === JSON.stringify(['before:column:probe', 'before()', 'after:column:probe']), removed);
    t.check('removeNode works through a plugin’s delete tool too: the text’s (clipboard-cut §5)', removed.text === true && removed.textGone, removed);
    t.check('removeNode answers false, with no before(), when a before-delete turns it away or the node has no delete tool (clipboard-cut A2)',
        removed.canceled === false && removed.cKept && removed.noTool === false && removed.called === 1, removed);
    t.check('without confirm: false, removeNode asks as the tool does (clipboard-cut §5)', removed.defaultAsked && removed.cStill, removed);
    t.check('setActiveTarget(null) on the handle takes the target away and answers true (clipboard-cut A3)',
        removed.cleared === true && removed.target === null, removed);
    t.check('panelOpen is true with a popover panel, a dialog or the delete confirmation open, and false with none (AC-42)',
        !state.open.none && state.open.panel && !state.open.panelClosed && state.open.dialog && !state.open.dialogClosed &&
        state.open.confirm && !state.open.confirmClosed, state.open);
    t.check('contains says what is the editor’s: its canvas, its toolbar, its sidebar, not another editor nor the page (AC-43)',
        state.contains.canvas && state.contains.toolbar && state.contains.sidebar && !state.contains.otherCanvas && !state.contains.body,
        state.contains);

    var errors = page.errors();
    t.check('the handle tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** The handle choosing the selection and the target (spec history, AC-44). */
async function chooseTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var chosen = await page.eval(`
        GridEditor.features.probe = function(handle) { window.probe = handle; return {}; };
        const q = function(selector) { return document.querySelector(selector); };
        const warnings = [];
        const warn = console.warn;
        console.warn = function() { warnings.push(Array.prototype.join.call(arguments, ' ')); };
        const changes = [];
        q('#myGrid').innerHTML = '<div class="row" id="r1"><div class="column col-6" id="a"><p>A</p></div><div class="column col-6" id="b"><p>B</p></div></div>';
        q('#myGrid').addEventListener('grideditor:target-change', function(e) { changes.push(e.detail.target && e.detail.target.id); });
        let ge = window.fixture.init({ settings_panel: 'sidebar', plugins: window.fixture.plugins(['probe']) });

        const result = {
            selected: window.probe.setActiveTarget(q('#b')),
            same: ge.getActiveTarget() === q('#b'),
            shown: q('.ge-settings-sidebar .ge-id') && q('.ge-settings-sidebar .ge-id').value,
            target: window.probe.setActiveTarget(q('#a')),
            targetSame: ge.getActiveTarget() === q('#a'),
            notOne: window.probe.setActiveTarget(document.body),
            row: window.probe.setActiveTarget(q('#r1')),
            changes: changes.slice(),
        };
        ge = window.fixture.init({ plugins: window.fixture.plugins(['probe']) });
        result.withoutSidebar = window.probe.setActiveTarget(q('#a'));
        result.withoutTarget = window.probe.setActiveTarget(q('#a'));
        result.warnings = warnings;
        console.warn = warn;
        ge.destroy();
        delete GridEditor.features.probe;
        return result;
    `);
    t.check('setActiveTarget on the handle chooses as the public method does: target-change, the sidebar shows it (AC-44; active-target-selection §5)',
        chosen.selected === true && chosen.same && chosen.shown === 'b' && chosen.changes.indexOf('b') !== -1, chosen);
    t.check('setActiveTarget on the handle makes the target', chosen.target === true && chosen.targetSame, chosen);
    t.check('a row is a target too; a node that is not one, or no active_target, answers false without a warning (active-target-selection AC-32)',
        chosen.notOne === false && chosen.row === true && chosen.withoutSidebar === false &&
            chosen.withoutTarget === false && chosen.warnings.length === 0, chosen);

    var errors = page.errors();
    t.check('the choose tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'plugincontract',
    description: 'what every shipped plugin is handed and hands back is DOM',
    run: async function(t) {
        await run(t);
        await handleTests(t);
        await chooseTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['plugincontract']);
}
