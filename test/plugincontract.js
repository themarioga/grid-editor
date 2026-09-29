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
        window.contract.handles.push({
            plugin: plugin,
            canvas: isNode(ge.canvas),
            tool: isNode(tool) && tool.parentNode === drawer,
            region: isNode(region),
            row: isNode(row) && row.children.length === 2,
            toolbarItems: Array.isArray(ge.toolbarItems(plugin)),
            detailsOfNothing: ge.detailsOf(drawer) === null,
            drawerOf: ge.drawerOf(drawer) === null,
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
            'gutters', 'order', 'popup', 'sections', 'style', 'summernote', 'tabs', 'text', 'tinymce']
            .every(function(name) { return plugins.indexOf(name) !== -1; }),
        plugins);
    t.check('the handle gives elements: the canvas, a tool, a region, a row; an array of toolbar items; null for no panel or drawer',
        exercised.handles.every(function(handle) {
            return handle.canvas && handle.tool && handle.region && handle.row && handle.toolbarItems &&
                handle.detailsOfNothing && handle.drawerOf;
        }), exercised.handles.filter(function(handle) {
            return !(handle.canvas && handle.tool && handle.region && handle.row && handle.toolbarItems && handle.detailsOfNothing && handle.drawerOf);
        }));
    t.check('every hook of every shipped plugin was handed elements, and every one that makes a node handed one back',
        exercised.wrong.length === 0 && exercised.calls > 20, { wrong: exercised.wrong, calls: exercised.calls, loaded: exercised.loaded });

    var errors = page.errors();
    t.check('the plugin contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'plugincontract',
    description: 'what every shipped plugin is handed and hands back is DOM',
    run: run,
};

if (require.main === module) {
    require('./run').main(['plugincontract']);
}
