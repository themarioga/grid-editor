/**
 * Browser tests for grideditor.jquery.js: a page written for grid-editor 6,
 * run unchanged on 7.0 through the jQuery adapter.
 *
 * What 6.x gave host code as jQuery objects it gets again; what it handed in
 * as jQuery objects is taken; the dispatch rules of $(el).gridEditor('method')
 * are 6.x's. A plugin written for 6.x is the exception, on purpose: it is
 * warned about and left out.
 *
 * Spec remove-jquery: AC-05, AC-18 to AC-25, AC-31, AC-35, AC-37, AC-40 and
 * AC-43, and D24.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/adapter.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    window.fresh = function(settings) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(
            '<div class="row" id="first"><div class="col-6" id="left"><p>Left</p></div><div class="col-6" id="right"><p>Right</p></div></div>' +
            '<div class="row" id="second"><div class="col-12" id="below"><p>Below</p></div></div>'
        );
        jQuery('#myGrid').off('.test');
        jQuery(document).off('.test');
        window.warnings = [];
        return jQuery('#myGrid').gridEditor(jQuery.extend({ confirm_delete: false }, window.fixture.settings, settings || {}));
    };
    window.settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
    return true;
`;

async function hostTests(t, page) {
    var started = await page.eval(`
        const set = fresh({ new_row_layouts: [[12]] });
        return {
            chained: set.is('#myGrid'),
            html: jQuery('#myGrid').gridEditor('getHtml') === GridEditor.get('#myGrid').getHtml(),
            view: jQuery('#myGrid').gridEditor('getView'),
            buttons: jQuery('.ge-addRowGroup a').length,
        };
    `);
    t.check("$(el).gridEditor(options) builds the editor, and getHtml through it is the editor's getHtml",
        started.chained && started.html && started.view === 'all' && started.buttons === 1, started);

    var twice = await page.eval(`
        fresh({ new_row_layouts: [[12]] });
        window.warnings = [];
        const set = jQuery('#myGrid').gridEditor({ new_row_layouts: [[6, 6], [4, 4, 4]] });
        return {
            chained: set.is('#myGrid'),
            layouts: jQuery('#myGrid').data('grideditor').settings.new_row_layouts.length,
            controls: jQuery('.ge-mainControls').length,
            warnings: window.warnings.filter(function(w) { return /already has an editor/.test(w); }).length,
        };
    `);
    t.check('a second $(el).gridEditor(options) keeps the editor it has, and its options, and warns once',
        twice.chained && twice.layouts === 1 && twice.controls === 1 && twice.warnings === 1, twice);

    var listened = await page.eval(`
        fresh();
        const calls = [];
        jQuery('#myGrid').on('grideditor:before-delete.test', function(e, payload) {
            calls.push({
                node: payload.node instanceof jQuery && payload.node.is('#first'),
                parent: payload.parent instanceof jQuery && payload.parent.is('#myGrid'),
                canvas: payload.canvas instanceof jQuery,
                event: e instanceof jQuery.Event,
            });
            e.preventDefault();
        });
        const after = [];
        jQuery('#myGrid').on('grideditor:after-delete.test', function() { after.push(1); });
        jQuery('#first > .ge-tools-drawer .ge-delete-row')[0].click();
        await settle(700);
        return { calls: calls, after: after.length, stays: jQuery('#first').length };
    `);
    t.check('a jQuery listener runs once, with (event, payload) and jQuery objects in it, and preventDefault() cancels',
        listened.calls.length === 1 && listened.calls[0].node && listened.calls[0].parent &&
        listened.calls[0].canvas && listened.calls[0].event && listened.after === 0 && listened.stays === 1, listened);

    var delegated = await page.eval(`
        fresh();
        const calls = [];
        jQuery(document).on('grideditor:after-add-row.test', '#myGrid', function(e, payload) {
            calls.push(payload && payload.node instanceof jQuery && payload.node.is('.row'));
        });
        jQuery(document).on('grideditor:after-add-row.test', function(e, payload) {
            calls.push(payload && payload.kind === 'row');
        });
        jQuery('#myGrid').gridEditor('createRow', [12], { appendTo: jQuery('#myGrid') });
        return calls;
    `);
    t.check('a listener delegated from the document runs once too, with the payload as its second argument',
        delegated.length === 2 && delegated[0] === true && delegated[1] === true, delegated);

    var created = await page.eval(`
        fresh();
        const row = jQuery('#myGrid').gridEditor('createRow', [8, 4]);
        const placed = jQuery('#myGrid').gridEditor('createColumn', 3, { appendTo: jQuery('#first') });
        return {
            row: row instanceof jQuery && row.length === 1 && row.is('.row') && !row.parent().length,
            columns: row.children('.column').length,
            placed: placed instanceof jQuery && placed.parent().is('#first'),
        };
    `);
    t.check('the create* methods hand back jQuery objects, and take one as the place',
        created.row && created.columns === 2 && created.placed, created);

    var targeted = await page.eval(`
        fresh({ active_target: true });
        const chained = jQuery('#myGrid').gridEditor('setActiveTarget', jQuery('#right'));
        const got = jQuery('#myGrid').gridEditor('getActiveTarget');
        const result = {
            chained: chained.is('#myGrid'),
            got: got instanceof jQuery && got.is('#right'),
            same: GridEditor.get('#myGrid').getActiveTarget() === document.querySelector('#right'),
        };
        jQuery('#myGrid').gridEditor('setActiveTarget', null);
        result.cleared = jQuery('#myGrid').gridEditor('getActiveTarget');
        return result;
    `);
    t.check('getActiveTarget and setActiveTarget go through $(el).gridEditor(), with jQuery objects (AC-30)',
        targeted.chained && targeted.got && targeted.same && targeted.cleared === null, targeted);

    var selection = await page.eval(`
        fresh({ settings_panel: 'sidebar' });
        const chained = jQuery('#myGrid').gridEditor('setSelected', jQuery('#right'));
        const got = jQuery('#myGrid').gridEditor('getSelected');
        const result = {
            chained: chained.is('#myGrid'),
            got: got instanceof jQuery && got.is('#right'),
            same: GridEditor.get('#myGrid').getSelected() === document.querySelector('#right'),
        };
        jQuery('#myGrid').gridEditor('setSelected', null);
        result.cleared = jQuery('#myGrid').gridEditor('getSelected');
        return result;
    `);
    t.check('getSelected and setSelected go through $(el).gridEditor(), with jQuery objects',
        selection.chained && selection.got && selection.same && selection.cleared === null, selection);

    var handle = await page.eval(`
        fresh();
        const ge = jQuery('#myGrid').data('grideditor');
        const tabs = ge.createContainer('tabs', { appendTo: jQuery('#left') });
        const pane = ge.addTab(tabs, { label: 'More' });
        return {
            canvas: ge.canvas instanceof jQuery && ge.canvas.is('#myGrid'),
            row: ge.createRow([12]) instanceof jQuery,
            tabs: tabs instanceof jQuery && tabs.is('[data-ge-container="tabs"]'),
            pane: pane instanceof jQuery && pane.is('.tab-pane'),
            settings: Object.isFrozen(ge.settings),
            utility: ge.getUtility(jQuery('#left'), 'col'),
        };
    `);
    t.check("$(el).data('grideditor') is the 6.x handle: a jQuery canvas, and create* giving jQuery objects",
        handle.canvas && handle.row && handle.tabs && handle.pane && handle.settings && handle.utility === '6', handle);

    var callbacks = await page.eval(`
        const seen = {};
        fresh({
            callbacks: {
                after_add_row: function(payload) { seen.add = payload.node instanceof jQuery && payload.parent instanceof jQuery; },
                before_delete: function(payload) { seen.del = payload.node instanceof jQuery; return false; },
            },
            custom_filter: function(canvas, isInit) { (seen.filters = seen.filters || []).push(canvas instanceof jQuery && canvas.is('#myGrid') && isInit); },
        });
        jQuery('#myGrid').gridEditor('createRow', [12], { appendTo: '#myGrid' });
        jQuery('#first > .ge-tools-drawer .ge-delete-row')[0].click();
        await settle(100);
        return { add: seen.add, del: seen.del, filters: seen.filters, stays: jQuery('#first').length };
    `);
    t.check('callbacks and custom_filter get jQuery objects, and a callback returning false still cancels',
        callbacks.add && callbacks.del && callbacks.stays === 1 && callbacks.filters.length > 0 &&
        callbacks.filters.every(function(each) { return each === true; }), callbacks);

    var moved = await page.eval(`
        window.moves = [];
        fresh({ callbacks: { after_move: function(payload) {
            window.moves.push({
                node: payload.node instanceof jQuery && payload.node.is('#right'),
                from: payload.from.parent instanceof jQuery && payload.from.parent.is('#first'),
                to: payload.to.parent instanceof jQuery && payload.to.parent.is('#second'),
            });
        } } });
        return true;
    `);
    await page.drag('#right > .ge-tools-drawer .ge-move', '#below', { yRatio: 0.5 });
    await page.eval(`return settle(300);`);
    moved = await page.eval(`return window.moves;`);
    t.check("after_move's node, from.parent and to.parent are jQuery objects",
        moved.length === 1 && moved[0].node && moved[0].from && moved[0].to, moved);

    var tools = await page.eval(`
        const seen = [];
        fresh({ row_tools: [{ title: 'Mine', className: 'my-tool', on: { click: function(e) {
            seen.push({ jquery: e instanceof jQuery.Event, native: e.originalEvent instanceof MouseEvent, self: jQuery(this).is('.my-tool') });
        } } }] });
        jQuery('#first > .ge-tools-drawer .my-tool')[0].click();
        return seen;
    `);
    t.check("a host tool's handler gets a jQuery event, with `this` the tool",
        tools.length === 1 && tools[0].jquery && tools[0].native && tools[0].self, tools);
}

async function dispatchTests(t, page) {
    var sets = await page.eval(`
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        const holder = jQuery('<div id="holder"></div>').appendTo('body');
        ['a', 'b', 'c'].forEach(function(name) {
            holder.append('<div class="g" id="g-' + name + '"><div class="row"><div class="col-12"><p>' + name + '</p></div></div></div>');
        });
        const set = jQuery('.g').gridEditor({ content_types: [] });
        const result = {
            chained: set.length === 3,
            editors: jQuery('.g').filter(function() { return !!GridEditor.get(this); }).length,
            html: /<p>a<\\/p>/.test(jQuery('.g').gridEditor('getHtml')) && !/<p>b<\\/p>/.test(jQuery('.g').gridEditor('getHtml')),
        };
        jQuery('.g').gridEditor('changeView', 'md');
        result.views = jQuery('.g').map(function() { return GridEditor.get(this).getView(); }).get().join(',');
        jQuery('.g').gridEditor('destroy');
        result.destroyed = jQuery('.g').filter(function() { return !!GridEditor.get(this); }).length;

        const bare = jQuery('<div id="bare"><div class="row column">plain</div></div>').appendTo('body');
        result.noEditorHtml = bare.gridEditor('getHtml') === bare.html();
        result.noEditorPlain = !/column/.test(bare.gridEditor('getPlainHtml'));
        result.noEditorChains = bare.gridEditor('reset').is('#bare');
        result.noEditorValue = bare.gridEditor('getView');
        result.empty = jQuery('.nothing').gridEditor('getHtml');
        holder.remove();
        bare.remove();
        return result;
    `);
    t.check('$(set).gridEditor(options) makes an editor on each element, and a value method answers from the first',
        sets.chained && sets.editors === 3 && sets.html, sets);
    t.check('a method with no value runs on each and chains', sets.views === 'md,md,md' && sets.destroyed === 0, sets);
    t.check('on an element with no editor a method does nothing and chains, and getHtml reads it, getPlainHtml cleaned',
        sets.noEditorHtml && sets.noEditorPlain && sets.noEditorChains && sets.noEditorValue === null && sets.empty === null, sets);

    var removed = await page.eval(`
        fresh();
        window.warnings = [];
        const set = jQuery('#myGrid').gridEditor('remove');
        return {
            chained: set.is('#myGrid'),
            unknown: window.warnings.filter(function(w) { return /unknown method "remove"/.test(w); }).length,
            stays: !!GridEditor.get('#myGrid'),
            rtes: typeof jQuery.fn.gridEditor.RTEs,
        };
    `);
    t.check('remove, deprecated in 6.x, is an unknown method now: a warning, and the editor stays',
        removed.chained && removed.unknown === 1 && removed.stays, removed);
    t.check("and 5.x's $.fn.gridEditor.RTEs is gone", removed.rtes === 'undefined', removed);
}

async function legacyTests(t, page) {
    var legacy = await page.eval(`
        let threw = null;
        try {
            jQuery.fn.gridEditor.containers.legacy = function() { return {}; };
        } catch (error) {
            threw = error.constructor.name;
        }
        fresh();
        return {
            registries: ['containers', 'features', 'utilities', 'texts'].map(function(name) {
                return typeof jQuery.fn.gridEditor[name];
            }).join(','),
            threw: threw,
            editing: jQuery('#myGrid').hasClass('ge-editing'),
        };
    `);
    t.check('the adapter has no 6.x plugin registries: a plugin registering there throws, and the editor goes on (AC-12)',
        legacy.registries === 'undefined,undefined,undefined,undefined' && legacy.threw === 'TypeError' && legacy.editing, legacy);

    var locale = await page.eval(`
        jQuery.fn.gridEditor.locales.fr = { 'tool.move': 'Déplacer' };
        fresh({ locale: 'fr' });
        const title = jQuery('#first > .ge-tools-drawer .ge-move').attr('title');
        delete jQuery.fn.gridEditor.locales.fr;
        return { title: title, same: jQuery.fn.gridEditor.locales === GridEditor.locales, t: jQuery.fn.gridEditor.t === GridEditor.t };
    `);
    t.check('a 6.x locale file registering on $.fn.gridEditor.locales works: it is the same registry',
        locale.title === 'Déplacer' && locale.same && locale.t, locale);

    var errors = page.errors();
    t.check('the adapter tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function loadingTests(t) {
    var withoutJquery = await t.page('/test/fixtures/grid.html?init=manual', `window.fixture`);
    var warned = await withoutJquery.eval(`
        const warnings = [];
        const warn = console.warn;
        console.warn = function() { warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/grideditor.jquery.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        console.warn = warn;
        return { warnings: warnings.filter(function(w) { return /needs jQuery 4/.test(w); }).length, dollar: typeof window.$, jquery: typeof window.jQuery };
    `);
    t.check('the adapter on a page with no jQuery warns once and defines nothing',
        warned.warnings === 1 && warned.dollar === 'undefined' && warned.jquery === 'undefined', warned);

    var tools = await withoutJquery.eval(`
        const seen = [];
        window.fixture.init({ row_tools: [{ title: 'Mine', className: 'my-tool', on: { click: function(e) {
            seen.push({ native: e instanceof MouseEvent, self: this.classList.contains('my-tool') });
        } } }] });
        document.querySelector('#myGrid .row > .ge-tools-drawer .my-tool').click();
        return seen;
    `);
    t.check("natively, a host tool's handler gets the DOM event, with `this` the tool",
        tools.length === 1 && tools[0].native && tools[0].self, tools);

    var beforeCore = await t.page('/test/fixtures/esm.html', `window.ready`);
    var thrown = await beforeCore.eval(`
        return await new Promise(function(resolve) {
            window.addEventListener('error', function(e) { e.preventDefault(); resolve(String(e.message)); }, { once: true });
            const script = document.createElement('script');
            script.src = '/dist/plugins/grideditor.tabs.js';
            document.head.appendChild(script);
            setTimeout(function() { resolve(null); }, 2000);
        });
    `);
    t.check('a plugin loaded before the editor throws an error that says to load grideditor.js first',
        typeof thrown === 'string' && /load grideditor\.js/.test(thrown), thrown);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    await hostTests(t, page);
    await dispatchTests(t, page);
    await legacyTests(t, page);
    await loadingTests(t);
}

module.exports = {
    name: 'adapter',
    description: 'grideditor.jquery.js: a 6.x page on 7.0, unchanged',
    run: run,
};

if (require.main === module) {
    require('./run').main(['adapter']);
}
