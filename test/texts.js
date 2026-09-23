/**
 * Browser tests for the text editor plugins' contract: $.fn.gridEditor.texts,
 * the copies the main bundle carries until 6.0, and the adapter for 5.x's
 * $.fn.gridEditor.RTEs.
 *
 * These run offline, on the fixture, with a stand-in for tinyMCE that has
 * only what the integration touches: the real editors are rte.js's business.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Warnings and errors, collected, and a tinyMCE that opens at once: init
 * hands its callback an editor with the methods the integration calls.
 */
var SETUP = `
    window.warnings = [];
    window.errorsLogged = [];
    const warn = console.warn, error = console.error;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    console.error = function() { window.errorsLogged.push(Array.prototype.join.call(arguments, ' ')); error.apply(console, arguments); };

    window.fakeTinymce = {
        started: 0,
        init: function(config) {
            window.fakeTinymce.started++;
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                remove: function() { editor.removed = true; } };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    // From markup with no content areas yet, so each start wraps its own,
    // of the content type it is started with: a content area keeps its type
    window.restart = function(overrides) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(
            '<div class="row"><div class="col-lg-6"><p>Left</p></div><div class="col-lg-6"><p>Right</p></div></div>'
        );
        window.fixture.init(Object.assign({ content_types: ['tinymce'] }, overrides || {}));
    };
    return true;
`;

var BUNDLED = `return window.warnings.filter(function(w) { return /copy in the main bundle/.test(w); }).length;`;

async function bundleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var copy = await page.eval(`
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        jQuery('#myGrid .ge-content').eq(1).trigger('click');
        return {
            marked: !!$.fn.gridEditor.texts.tinymce.bundled,
            started: window.fakeTinymce.started,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the main bundle carries tinyMCE, marked as its copy, and it still edits',
        copy.marked && copy.started === 2 && copy.attached, copy);
    t.check('editing with the bundle\'s copy warns once that 6.0 leaves it out',
        copy.warned === 1, copy);

    await page.eval(`
        const script = document.createElement('script');
        script.src = '/dist/plugins/grideditor.tinymce.js';
        script.onload = function() { window.pluginLoaded = true; };
        document.head.appendChild(script);
        return true;
    `);
    await page.waitFor(`window.pluginLoaded`, { label: 'the tinyMCE plugin file' });

    var plugin = await page.eval(`
        window.warnings = [];
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        return {
            marked: !!$.fn.gridEditor.texts.tinymce.bundled,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the plugin\'s own file replaces the copy, and edits without a warning',
        !plugin.marked && plugin.attached && plugin.warned === 0, plugin);

    var filtered = await page.eval(`
        restart({ plugins: ['tabs'] });
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        return { attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce') };
    `);
    t.check('the plugins setting does not turn a text editor off: content_types chooses it',
        filtered.attached, filtered);

    var missing = await page.eval(`
        restart();
        window.tinymce = undefined;
        const area = jQuery('#myGrid .ge-content').eq(0);
        area.trigger('click');
        const without = {
            active: area.hasClass('ge-rte-active'),
            error: window.errorsLogged.some(function(e) { return /tinyMCE not available/.test(e); }),
        };
        window.tinymce = window.fakeTinymce;
        area.trigger('click');
        return { without: without, laterAttached: !!area.data('ge-tinymce') };
    `);
    t.check('with no tinyMCE, a click says so and starts nothing; a later click, once it is there, does',
        !missing.without.active && missing.without.error && missing.laterAttached, missing);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return { clean: !/ge-rte-active|contenteditable|class="active/.test(html), detached: !jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce') };
    `);
    t.check('getHtml stops the editor and leaves the content area clean', exported.clean && exported.detached, exported);

    var errors = page.errors([/tinyMCE not available/]);
    t.check('the bundle tests logged no other errors', errors.length === 0, errors.slice(0, 5));
}

async function contractTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var own = await page.eval(`
        window.calls = [];
        $.fn.gridEditor.texts.plain = function(ge) {
            return {
                initialContent: '<p>Write here</p>',
                start: function(block) {
                    window.calls.push('start');
                    block.addClass('active');
                    // An editor rewrites what it takes over, drawers and all
                    block.find('.ge-tools-drawer').remove();
                    ge.textReady(block);
                },
                stop: function(block) {
                    if (block.hasClass('active')) { window.calls.push('stop'); }
                    block.removeClass('active');
                },
            };
        };
        restart({ content_types: ['plain'] });

        const area = jQuery('#myGrid .ge-content').eq(0);
        const ge = jQuery('#myGrid').data('grideditor');
        ge.createElement('<p>An element</p>', { appendTo: area });
        area.trigger('click');
        const drawerBack = area.find('.ge-element > .ge-tools-drawer').length;

        const column = ge.createColumn(6, { appendTo: jQuery('#myGrid .row').first() });
        const fresh = column.children('.ge-text-block').children('.ge-content').html();

        jQuery('#myGrid').gridEditor('getHtml');
        return { calls: window.calls.slice(), drawerBack: drawerBack, fresh: fresh, warnings: window.warnings.slice() };
    `);
    t.check('a text editor registered under texts is started on a click and stopped on deinit',
        own.calls.join(',') === 'start,stop', own);
    t.check('ge.textReady puts the elements\' drawers back after the editor rewrote the content area',
        own.drawerBack === 1, own);
    t.check('a new column starts with the text editor\'s initial content',
        own.fresh === '<p>Write here</p>', own);
    t.check('a text editor under texts is not deprecated',
        !own.warnings.some(function(w) { return /deprecated/.test(w); }), own.warnings);

    var legacy = await page.eval(`
        window.warnings = [];
        window.legacyCalls = [];
        $.fn.gridEditor.RTEs.legacy = {
            init: function(settings, areas) {
                window.legacyCalls.push('init:' + areas.length + ':' + (settings.content_types[0]));
                areas.addClass('active');
            },
            deinit: function(settings, areas) {
                if (areas.filter('.active').length) { window.legacyCalls.push('deinit'); }
                areas.removeClass('active');
            },
            initialContent: '<p>Legacy</p>',
        };
        restart({ content_types: ['legacy'] });
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        jQuery('#myGrid').gridEditor('getHtml');
        restart({ content_types: ['legacy'] });
        return {
            calls: window.legacyCalls.slice(),
            deprecations: window.warnings.filter(function(w) { return /RTEs is deprecated/.test(w); }).length,
            fresh: jQuery('#myGrid').data('grideditor').createColumn(6).children('.ge-content').html(),
        };
    `);
    t.check('an integration written to 5.x\'s RTEs contract still edits, with settings and the content area',
        legacy.calls.join(',') === 'init:1:legacy,deinit' && legacy.fresh === '<p>Legacy</p>', legacy);
    t.check('and warns, once per editor, that RTEs is deprecated',
        legacy.deprecations === 2, legacy);

    var shadowed = await page.eval(`
        window.warnings = [];
        $.fn.gridEditor.RTEs.tinymce = { init: function() { window.oldOneUsed = true; }, deinit: function() {}, initialContent: '' };
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        delete $.fn.gridEditor.RTEs.tinymce;
        return {
            oldOneUsed: !!window.oldOneUsed,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            deprecations: window.warnings.filter(function(w) { return /register "tinymce"/.test(w); }).length,
        };
    `);
    t.check('an RTEs entry a text plugin already provides is left unused, without a warning',
        !shadowed.oldOneUsed && shadowed.attached && shadowed.deprecations === 0, shadowed);

    var errors = page.errors();
    t.check('the contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A second text editor, for the choices that only exist with more than one:
 * it opens by marking the content area and closes by unmarking it.
 */
var PLAIN_EDITOR = `
    $.fn.gridEditor.texts.plain = function(ge) {
        return {
            labelKey: 'text.plain_label',
            initialContent: '<p>Plain</p>',
            start: function(block) { block.addClass('active'); ge.textReady(block); },
            stop: function(block) { block.removeClass('active'); },
        };
    };
    $.fn.gridEditor.locales.en['text.plain_label'] = 'Plain';

    window.events = [];
    window.listen = function() {
        jQuery('#myGrid').on('grideditor:before-add grideditor:after-add grideditor:before-add-text grideditor:after-add-text ' +
            'grideditor:before-delete grideditor:after-delete grideditor:before-move grideditor:after-move', function(e, payload) {
            window.events.push({ type: e.type.replace('grideditor:', ''), kind: payload.kind, source: payload.source,
                isContent: payload.node.is('.ge-content') });
        });
    };
    return true;
`;

/** The tools in a text block's drawer, by their first class. */
var TOOLS = `
    window.toolsOf = function(block) {
        return block.children('.ge-tools-drawer').children('a').map(function() {
            return jQuery(this).attr('class').split(' ')[0];
        }).get().join(',');
    };
    return true;
`;

async function blockTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);
    await page.eval(PLAIN_EDITOR);
    await page.eval(TOOLS);

    var drawer = await page.eval(`
        restart({ confirm_delete: false });
        const blocks = jQuery('#myGrid .column > .ge-text-block');
        const first = blocks.first();
        return {
            blocks: blocks.length,
            areas: jQuery('#myGrid .ge-content').length,
            everyWrapped: jQuery('#myGrid .ge-content').get().every(function(area) { return jQuery(area).parent().is('.ge-text-block'); }),
            tools: toolsOf(first),
            info: first.find('> .ge-tools-drawer > .ge-text-info').attr('title'),
            drawerOutside: first.children('.ge-content').find('.ge-tools-drawer').length === 0,
        };
    `);
    t.check('each content area in a column is a text block while editing, its drawer beside it and not inside',
        drawer.blocks === 2 && drawer.areas === 2 && drawer.everyWrapped && drawer.drawerOutside, drawer);
    t.check('a text block\'s drawer: move, which editor, settings, delete',
        drawer.tools === 'ge-move,ge-text-info,ge-settings,ge-delete-text' && drawer.info === 'Text: tinyMCE', drawer);

    var exported = await page.eval(`
        const block = jQuery('#myGrid .ge-text-block').first();
        block.find('> .ge-tools-drawer .ge-details .ge-id').val('intro').trigger('change');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        const root = document.createElement('div');
        root.innerHTML = html;
        return {
            wrappers: /ge-text-block|ge-text-drawer/.test(html),
            direct: Array.from(root.querySelectorAll('.column > .ge-content')).length,
            id: root.querySelector('.ge-content').id,
            rewrapped: jQuery('#myGrid .ge-text-block').length,
        };
    `);
    t.check('getHtml has no text block: the content area is back in its column, with the id its panel gave it',
        !exported.wrappers && exported.direct === 2 && exported.id === 'intro' && exported.rewrapped === 2, exported);

    var added = await page.eval(`
        window.events = [];
        listen();
        const column = jQuery('#myGrid .column').first();
        column.find('> .ge-tools-drawer > .ge-add-text').trigger('click');
        const last = column.children().last();
        return {
            last: last.is('.ge-text-block'),
            html: last.children('.ge-content').html(),
            type: last.children('.ge-content').attr('data-ge-content-type'),
            events: window.events.map(function(e) { return e.type + ':' + e.kind + ':' + e.source + ':' + e.isContent; }),
        };
    `);
    t.check('the column\'s add text tool puts a text block of the first editor at its end',
        added.last && added.type === 'tinymce' && added.html === '<p>Lorem ipsum dolores</p>', added);
    t.check('and announces it as a text: before-add-text, before-add, after-add-text, after-add',
        added.events.join(' ') === 'before-add-text:text:tool:true before-add:text:tool:true after-add-text:text:tool:true after-add:text:tool:true',
        added.events);

    var deleted = await page.eval(`
        window.events = [];
        const block = jQuery('#myGrid .ge-text-block').first();
        const area = block.children('.ge-content');
        area.trigger('click');
        const editor = area.data('ge-tinymce');
        block.find('> .ge-tools-drawer > .ge-delete-text').trigger('click');
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve({
                    gone: !jQuery.contains(document, block[0]),
                    stopped: !!editor && editor.removed,
                    events: window.events.map(function(e) { return e.type + ':' + e.kind + ':' + e.isContent; }),
                });
            }, 700);
        });
    `);
    t.check('the delete tool closes the text\'s editor, removes it and announces a text',
        deleted.gone && deleted.stopped && deleted.events.join(' ') === 'before-delete:text:true after-delete:text:true', deleted);

    var empty = await page.eval(`
        const column = jQuery('#myGrid .column').first();
        column.children('.ge-text-block').remove();
        return {
            children: column.children().not('.ge-tools-drawer, .ge-resize-handle').length,
            room: getComputedStyle(column[0], '::after').minHeight,
        };
    `);
    t.check('a column with nothing in it keeps room to drop a block into',
        empty.children === 0 && empty.room === '40px', empty);

    var none = await page.eval(`
        restart({ content_types: [] });
        return {
            addText: jQuery('#myGrid .ge-add-text').length,
            buttons: jQuery('.ge-mainControls [data-ge-toolbar="text"]').length,
            blocks: jQuery('#myGrid .ge-text-block').length,
            info: jQuery('#myGrid .ge-text-info').length,
        };
    `);
    t.check('with no text editor offered there is no add text tool and no text button; content areas are still blocks',
        none.addText === 0 && none.buttons === 0 && none.blocks === 2 && none.info === 0, none);

    var missing = await page.eval(`
        restart();
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid .ge-content').first().attr('data-ge-content-type', 'ghost').removeClass('ge-content-type-tinymce');
        window.fixture.init({ content_types: ['tinymce'] });
        const area = jQuery('#myGrid .ge-content').first();
        area.trigger('click');
        const tool = area.parent().find('> .ge-tools-drawer > .ge-text-missing');
        return { tool: tool.length, title: tool.attr('title'), active: area.hasClass('ge-rte-active') };
    `);
    t.check('a text whose editor is not loaded says so in its drawer, and a click starts nothing',
        missing.tool === 1 && /No text editor "ghost"/.test(missing.title) && !missing.active, missing);

    var errors = page.errors();
    t.check('the text block tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function choiceTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);
    await page.eval(PLAIN_EDITOR);

    var one = await page.eval(`
        restart();
        return jQuery('.ge-mainControls [data-ge-toolbar="text"]').map(function() { return jQuery(this).attr('title'); }).get();
    `);
    t.check('with one text editor offered, the toolbar has one Text button', one.join('|') === 'Text', one);

    var two = await page.eval(`
        restart({ content_types: ['tinymce', 'plain', 'nothing-loaded'] });
        return {
            buttons: jQuery('.ge-mainControls [data-ge-toolbar="text"]').map(function() { return jQuery(this).attr('title'); }).get(),
        };
    `);
    t.check('with two, one button each, named after its editor; a type with no plugin is not offered',
        two.buttons.join('|') === 'Text (tinyMCE)|Text (Plain)', two);

    // Held, the add text tool offers each editor
    var tool = '#myGrid .column:first > .ge-tools-drawer > .ge-add-text';
    await page.eval(`jQuery(${JSON.stringify(tool)}).trigger('mouseenter'); return true;`);
    await t.sleep(900);
    var picker = await page.eval(`
        const choices = jQuery('.ge-text-picker > a');
        const offered = choices.map(function() { return jQuery(this).text(); }).get();
        choices.last().trigger('click');
        const last = jQuery('#myGrid .column').first().children().last().children('.ge-content');
        return { offered: offered, type: last.attr('data-ge-content-type'), html: last.html(), closed: jQuery('.ge-text-picker').length === 0 };
    `);
    t.check('held, the add text tool offers every editor, and a choice adds a text of that one',
        picker.offered.join('|') === 'tinyMCE|Plain' && picker.type === 'plain' && picker.html === '<p>Plain</p>' && picker.closed,
        picker);

    var clicked = await page.eval(`
        window.events = [];
        listen();
        const before = jQuery('#myGrid').children('.row').length;
        jQuery('.ge-mainControls [data-ge-toolbar="text"]').last().trigger('click');
        const row = jQuery('#myGrid').children('.row').last();
        return {
            rows: jQuery('#myGrid').children('.row').length - before,
            columns: row.children('.column').length,
            type: row.find('.ge-content').attr('data-ge-content-type'),
            blocks: row.find('.ge-content').length,
            events: window.events.filter(function(e) { return e.type === 'after-add-text'; }).map(function(e) { return e.kind + ':' + e.source; }),
        };
    `);
    t.check('a Text button adds a row with a column holding one text of its editor, announced as a text',
        clicked.rows === 1 && clicked.columns === 1 && clicked.blocks === 1 && clicked.type === 'plain' &&
        clicked.events.join(',') === 'text:tool', clicked);

    var api = await page.eval(`
        window.warnings = [];
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();
        const detached = ge.createText();
        const placed = ge.createText('plain', { content: '<p>From the API</p>', appendTo: column });
        const unknown = ge.createText('nothing-loaded');
        const viaMethod = jQuery('#myGrid').gridEditor('createText', { content: '<p>Method</p>' });
        return {
            detached: detached.is('.ge-content') && !detached.parent().length && detached.attr('data-ge-content-type') === 'tinymce',
            detachedHtml: detached.html(),
            placed: placed.parent().is('.ge-text-block') && placed.closest('.column')[0] === column[0] && placed.html() === '<p>From the API</p>',
            unknown: unknown,
            warned: window.warnings.some(function(w) { return /createText: no text editor "nothing-loaded"/.test(w); }),
            viaMethod: viaMethod && viaMethod.html(),
        };
    `);
    t.check('createText makes a content area of the first editor, or the one named, detached or placed',
        api.detached && api.detachedHtml === '<p>Lorem ipsum dolores</p>' && api.placed && api.viaMethod === '<p>Method</p>', api);
    t.check('createText with an editor that is not loaded warns and makes nothing',
        api.unknown === null && api.warned, api);

    var errors = page.errors();
    t.check('the choice tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function dragTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);
    await page.eval(PLAIN_EDITOR);

    await page.eval(`
        restart({ toolbar_drag: true });
        jQuery('#myGrid .column').eq(0).attr('id', 'left');
        jQuery('#myGrid .column').eq(1).attr('id', 'right');
        jQuery('#left > .ge-text-block').attr('id', 'moving');
        window.events = [];
        listen();
        return true;
    `);
    // The drawer shows over the text once the pointer is on it, as a
    // person's would be before they reached for the handle
    await page.hover('#moving');
    await t.sleep(200);
    await page.drag('#moving > .ge-tools-drawer .ge-move', '#right', { yRatio: 0.9, steps: 16 });
    var moved = await page.eval(`
        return {
            inRight: jQuery('#right').children('#moving').length,
            left: jQuery('#left').children('.ge-text-block').length,
            events: window.events.filter(function(e) { return /move/.test(e.type); })
                .map(function(e) { return e.type + ':' + e.kind + ':' + e.isContent; }),
        };
    `);
    t.check('a text block drags from one column to another',
        moved.inRight === 1 && moved.left === 0, moved);
    t.check('and the move is announced for the content area, as kind content, as in 5.x',
        moved.events.join(' ') === 'before-move:content:true after-move:content:true', moved.events);

    await page.drag('.ge-mainControls [data-ge-toolbar="text"]', '#left', { yRatio: 0.9 });
    var dropped = await page.eval(`
        return {
            inLeft: jQuery('#left').children('.ge-text-block').length,
            rows: jQuery('#myGrid').children('.row').length,
            events: window.events.filter(function(e) { return e.type === 'after-add-text'; }).map(function(e) { return e.kind + ':' + e.source; }),
        };
    `);
    t.check('the Text button dropped in a column puts a text block there, not a new row',
        dropped.inLeft === 1 && dropped.rows === 1 && dropped.events.join(',') === 'text:dragdrop', dropped);

    var errors = page.errors();
    t.check('the text drag tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function utilityTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var aligned = await page.eval(`
        restart({ plugins: window.fixture.plugins(['textalign']) });
        const ge = jQuery('#myGrid').data('grideditor');
        const area = jQuery('#myGrid .ge-content').first();
        const field = area.parent().find('> .ge-tools-drawer .ge-utility[data-ge-family="text-align"]').length;
        const written = ge.setUtility(area, 'text-align', 'center', 'all');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return { field: field, written: written, classed: area.hasClass('text-center'), inHtml: /class="ge-content[^"]*text-center/.test(html) };
    `);
    t.check('a utility that applies to text has a field in the text\'s panel, and writes on the content area',
        aligned.field === 1 && aligned.written && aligned.classed && aligned.inHtml, aligned);

    var errors = page.errors();
    t.check('the text utility tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** The text drawer sits over the text and shows only while it is wanted. */
async function overlayTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var STATE = `
        const block = jQuery('#over');
        const drawer = block.children('.ge-tools-drawer')[0];
        const style = getComputedStyle(drawer);
        return {
            visibility: style.visibility,
            position: style.position,
            blockHeight: Math.round(block[0].getBoundingClientRect().height),
            areaHeight: Math.round(block.children('.ge-content')[0].getBoundingClientRect().height),
            spans: Math.round(drawer.getBoundingClientRect().width) === Math.round(block[0].getBoundingClientRect().width),
        };
    `;

    await page.eval(`
        restart();
        jQuery('#myGrid .ge-text-block').first().attr('id', 'over');
        return true;
    `);
    await page.hover('.ge-mainControls');
    await t.sleep(300);
    var away = await page.eval(STATE);
    t.check('a text\'s drawer takes no room: the text block is as tall as its content area',
        away.position === 'absolute' && away.blockHeight === away.areaHeight, away);
    t.check('and is hidden while the pointer is elsewhere', away.visibility === 'hidden', away);

    await page.hover('#over');
    await t.sleep(200);
    var over = await page.eval(STATE);
    t.check('the pointer over the text shows it', over.visibility === 'visible' && !over.spans, over);

    await page.eval(`jQuery('#over > .ge-content').trigger('click'); return true;`);
    await page.hover('.ge-mainControls');
    await t.sleep(300);
    var editing = await page.eval(STATE);
    t.check('it stays while the text is being edited, wherever the pointer is', editing.visibility === 'visible', editing);

    await page.eval(`
        jQuery('#myGrid').gridEditor('deinit');
        jQuery('#myGrid').gridEditor('init');
        jQuery('#myGrid .ge-text-block').first().attr('id', 'over');
        jQuery('#over > .ge-tools-drawer > .ge-settings').trigger('click');
        return true;
    `);
    await t.sleep(300);
    var settings = await page.eval(STATE);
    t.check('and while its settings are open, across the text so the panel has room',
        settings.visibility === 'visible' && settings.spans, settings);

    var errors = page.errors();
    t.check('the overlay tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'texts',
    description: 'text blocks, and the text editor plugins\' contract, the bundle\'s copies and the RTEs adapter',
    run: async function(t) {
        await bundleTests(t);
        await contractTests(t);
        await blockTests(t);
        await choiceTests(t);
        await dragTests(t);
        await overlayTests(t);
        await utilityTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['texts']);
}
