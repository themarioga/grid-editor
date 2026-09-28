/**
 * Browser tests for text blocks and what the text editor plugins share: the
 * text feature every editor's file carries, its $.fn.gridEditor.texts
 * registry, and 5.x's $.fn.gridEditor.RTEs, which 6.0 removed.
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

    // Two texts of the first content type started with, as the editor saved
    // them: loose markup would be the host's plain content. With no content
    // types there is no type to give them, and they are plain.
    window.restart = function(overrides) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        const settings = Object.assign({}, window.fixture.settings, { content_types: ['tinymce'] }, overrides || {});
        // content_types: undefined is the editor's own default, every editor loaded
        if (settings.content_types === undefined) { delete settings.content_types; }
        const type = (settings.content_types || ['tinymce'])[0];
        const text = function(html) {
            return type ? '<div class="ge-content ge-content-type-' + type + '" data-ge-content-type="' + type + '">' + html + '</div>' : html;
        };
        jQuery('#myGrid').html(
            '<div class="row"><div class="col-lg-6">' + text('<p>Left</p>') + '</div>' +
            '<div class="col-lg-6">' + text('<p>Right</p>') + '</div></div>'
        );
        jQuery('#myGrid').gridEditor(settings);
    };
    return true;
`;

/** Up to 5.x, editing with the main bundle's copy of an editor warned about it. */
var BUNDLED = `return window.warnings.filter(function(w) { return /copy in the main bundle/.test(w); }).length;`;

async function bundleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var bundle = await page.eval(`
        const source = await (await fetch('/dist/jquery.grideditor.js')).text();
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        return {
            carries: /texts\\.(tinymce|ckeditor|summernote)\\s*=/.test(source),
            marked: !!$.fn.gridEditor.texts.tinymce.bundled,
            started: window.fakeTinymce.started,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the main bundle carries no text editor: each is its plugin\'s file, as the fixture loads them',
        !bundle.carries && !bundle.marked && bundle.started === 1 && bundle.attached && bundle.warned === 0, bundle);

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
        $.fn.gridEditor.texts.simple = function(ge) {
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
        // A plugin that puts something of its own inside the text, and needs
        // telling when an editor has rewritten it
        window.readyFor = [];
        $.fn.gridEditor.features.probe = function() {
            return { onContentReady: function(area) { window.readyFor.push(area.attr('data-ge-content-type')); } };
        };
        restart({ content_types: ['simple'], plugins: window.fixture.plugins(['probe']) });
        delete $.fn.gridEditor.features.probe;

        const area = jQuery('#myGrid .ge-content').eq(0);
        const ge = jQuery('#myGrid').data('grideditor');
        area.trigger('click');
        const drawerBack = window.readyFor.join(',') === 'simple' ? 1 : 0;

        const column = ge.createColumn(6, { appendTo: jQuery('#myGrid .row').first() });
        const empty = column.children().not('.ge-tools-drawer, .ge-resize-handle').length;
        const withContent = ge.createColumn(6, { content: '<p>Given</p>', appendTo: jQuery('#myGrid .row').first() })
            .children('.ge-text-block').children('.ge-content');
        const fresh = { empty: empty, type: withContent.attr('data-ge-content-type'), html: withContent.html() };

        jQuery('#myGrid').gridEditor('getHtml');
        return { calls: window.calls.slice(), drawerBack: drawerBack, fresh: fresh, warnings: window.warnings.slice() };
    `);
    t.check('a text editor registered under texts is started on a click and stopped on deinit',
        own.calls.join(',') === 'start,stop', own);
    t.check('ge.textReady tells the plugins the editor rewrote the content area, through onContentReady',
        own.drawerBack === 1, own);
    t.check('a new column starts empty; one made with content holds it as a text of the first editor offered',
        own.fresh.empty === 0 && own.fresh.type === 'simple' && own.fresh.html === '<p>Given</p>', own);
    t.check('a text editor under texts is not deprecated',
        !own.warnings.some(function(w) { return /deprecated/.test(w); }), own.warnings);

    var legacy = await page.eval(`
        window.warnings = [];
        window.legacyCalls = [];
        $.fn.gridEditor.RTEs.legacy = {
            init: function() { window.legacyCalls.push('init'); },
            deinit: function() { window.legacyCalls.push('deinit'); },
            initialContent: '<p>Legacy</p>',
        };
        $.fn.gridEditor.RTEs.tinymce = { init: function() { window.legacyCalls.push('shadow'); }, deinit: function() {} };
        restart({ content_types: ['legacy', 'tinymce'] });
        const legacyArea = jQuery('#myGrid .ge-content').eq(0);
        legacyArea.trigger('click');
        const orphan = legacyArea.parent().find('> .ge-tools-drawer > .ge-text-missing').length;
        jQuery('#myGrid').gridEditor('getHtml');
        restart();
        jQuery('#myGrid .ge-content').eq(0).trigger('click');
        delete $.fn.gridEditor.RTEs.legacy;
        delete $.fn.gridEditor.RTEs.tinymce;
        return {
            calls: window.legacyCalls.slice(),
            orphan: orphan,
            attached: !!jQuery('#myGrid .ge-content').eq(0).data('ge-tinymce'),
            removed: window.warnings.filter(function(w) { return /RTEs was removed in 6\.0/.test(w); }).length,
        };
    `);
    t.check('an integration registered under 5.x\'s RTEs is ignored: its texts are a type nobody edits',
        legacy.calls.length === 0 && legacy.orphan === 1 && legacy.attached, legacy);
    t.check('and each editor says once that RTEs was removed in 6.0',
        legacy.removed === 2, legacy);

    var errors = page.errors();
    t.check('the contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A second text editor, for the choices that only exist with more than one:
 * it opens by marking the content area and closes by unmarking it.
 */
var SIMPLE_EDITOR = `
    $.fn.gridEditor.texts.simple = function(ge) {
        return {
            labelKey: 'text.simple_label',
            initialContent: '<p>Simple</p>',
            start: function(block) { block.addClass('active'); ge.textReady(block); },
            stop: function(block) { block.removeClass('active'); },
        };
    };
    $.fn.gridEditor.locales.en['text.simple_label'] = 'Simple';

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
    await page.eval(SIMPLE_EDITOR);
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
            info: first.find('> .ge-tools-drawer > .ge-text-info').length,
            editor: first.find('> .ge-tools-drawer .ge-details .ge-text-editor').text(),
            drawerOutside: first.children('.ge-content').find('.ge-tools-drawer').length === 0,
        };
    `);
    t.check('each content area in a column is a text block while editing, its drawer beside it and not inside',
        drawer.blocks === 2 && drawer.areas === 2 && drawer.everyWrapped && drawer.drawerOutside, drawer);
    t.check('a text block\'s drawer: move, settings, delete; which editor edits it is in its settings',
        drawer.tools === 'ge-move,ge-settings,ge-delete-text' && drawer.info === 0 && drawer.editor === 'EditortinyMCE', drawer);

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
            buttons: jQuery('.ge-mainControls .ge-add-text-button').length,
            blocks: jQuery('#myGrid .ge-text-block').length,
            info: jQuery('#myGrid .ge-text-info').length,
        };
    `);
    t.check('with no text editor offered there is no add text tool and no text button; plain content is still a block',
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
    await page.eval(SIMPLE_EDITOR);

    var one = await page.eval(`
        restart();
        return jQuery('.ge-mainControls .ge-add-text-button').map(function() { return jQuery(this).attr('title'); }).get();
    `);
    t.check('with one text editor offered, the toolbar has one Text button', one.join('|') === 'Text', one);

    var two = await page.eval(`
        restart({ content_types: ['tinymce', 'simple', 'nothing-loaded'] });
        return {
            buttons: jQuery('.ge-mainControls .ge-add-text-button').map(function() { return jQuery(this).attr('title'); }).get(),
        };
    `);
    t.check('with two, one button each, named after its editor; a type with no plugin is not offered',
        two.buttons.join('|') === 'Text (tinyMCE)|Text (Simple)', two);

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
        picker.offered.join('|') === 'tinyMCE|Simple' && picker.type === 'simple' && picker.html === '<p>Simple</p>' && picker.closed,
        picker);

    var clicked = await page.eval(`
        window.events = [];
        listen();
        const before = jQuery('#myGrid').children('.row').length;
        jQuery('.ge-mainControls .ge-add-text-button').last().trigger('click');
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
        clicked.rows === 1 && clicked.columns === 1 && clicked.blocks === 1 && clicked.type === 'simple' &&
        clicked.events.join(',') === 'text:tool', clicked);

    var api = await page.eval(`
        window.warnings = [];
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();
        const detached = ge.createText();
        const placed = ge.createText('simple', { content: '<p>From the API</p>', appendTo: column });
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
    await page.eval(SIMPLE_EDITOR);

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
    t.check('and the move is announced for the content area, as a text',
        moved.events.join(' ') === 'before-move:text:true after-move:text:true', moved.events);

    await page.drag('.ge-mainControls .ge-add-text-button', '#left', { yRatio: 0.9 });
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

/**
 * The text feature each editor's file carries: installed once however many
 * are loaded, every editor loaded offered when content_types is not given,
 * and nothing at all with none loaded.
 */
async function loadingTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var all = await page.eval(`
        restart({ content_types: undefined });
        const columns = jQuery('#myGrid .column');
        return {
            buttons: jQuery('.ge-mainControls .ge-add-text-button').map(function() { return jQuery(this).attr('title'); }).get(),
            addTextPerColumn: columns.get().map(function(col) { return jQuery(col).find('> .ge-tools-drawer > .ge-add-text').length; }),
            features: Object.keys($.fn.gridEditor.features).filter(function(name) { return name === 'text'; }).length,
        };
    `);
    t.check('with no content_types, every editor loaded is offered, in the order the page loaded them',
        all.buttons.join('|') === 'Text (tinyMCE)|Text (CKEditor)|Text (Summernote)', all);
    t.check('three editors loaded install the text feature once: one add text tool per column',
        all.features === 1 && all.addTextPerColumn.join(',') === '1,1', all);

    var none = await page.eval(`
        window.warnings = [];
        const feature = $.fn.gridEditor.features.text;
        delete $.fn.gridEditor.features.text;
        restart({ content_types: undefined });
        const ge = jQuery('#myGrid').data('grideditor');
        const first = ge.createText();
        const second = ge.createText();
        const result = {
            buttons: jQuery('.ge-mainControls .ge-add-text-button').length,
            addText: jQuery('#myGrid .ge-add-text').length,
            first: first,
            second: second,
            warned: window.warnings.filter(function(w) { return /createText needs a text editor plugin/.test(w); }).length,
            orphans: jQuery('#myGrid .ge-text-missing').length,
        };
        jQuery('#myGrid').gridEditor('destroy');
        $.fn.gridEditor.features.text = feature;
        return result;
    `);
    t.check('with no text editor loaded there is no Text button and no add text tool; createText warns once and makes nothing',
        none.buttons === 0 && none.addText === 0 && none.first === null && none.second === null && none.warned === 1, none);
    t.check('and a text saved with an editor\'s type is a block that says its editor is not loaded',
        none.orphans === 2, none);

    var errors = page.errors();
    t.check('the loading tests logged no errors', errors.length === 0, errors.slice(0, 5));
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
            opacity: parseFloat(style.opacity),
            position: style.position,
            blockHeight: Math.round(block[0].getBoundingClientRect().height),
            areaHeight: Math.round(block.children('.ge-content')[0].getBoundingClientRect().height),
            spans: Math.round(drawer.getBoundingClientRect().width) === Math.round(block[0].getBoundingClientRect().width),
        };
    `;

    // The settings unfold in the drawer here, which is what makes it span
    await page.eval(`
        restart({ settings_panel: 'inline' });
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
    t.check('but faint, so it does not hide the end of the line being typed', editing.opacity === 0.35, editing);

    await page.hover('#over > .ge-content');
    await t.sleep(300);
    var typing = await page.eval(STATE);
    t.check('the pointer on the text being edited leaves it faint', typing.opacity === 0.35, typing);

    await page.hover('#over > .ge-tools-drawer');
    await t.sleep(300);
    var reaching = await page.eval(STATE);
    t.check('the pointer on the drawer itself brings it back whole', reaching.opacity === 1, reaching);

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

    await page.eval(`jQuery('#over > .ge-content').trigger('click'); return true;`);
    await page.hover('.ge-mainControls');
    await t.sleep(300);
    var settingsWhileEditing = await page.eval(STATE);
    t.check('with its settings open while the text is edited, it stays whole', settingsWhileEditing.opacity === 1, settingsWhileEditing);

    var errors = page.errors();
    t.check('the overlay tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A drag by hand, point to point, with a look at the page half way: what
 * page.drag does, but it only knows elements' centres, and the grip on a
 * text's drawer is a few pixels at its start.
 */
async function dragBetween(page, from, to, midway) {
    var press = { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 };
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
    await page.send('Input.dispatchMouseEvent', press);

    var seen = null;
    for (var step = 1; step <= 16; step++) {
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved', button: 'left', buttons: 1,
            x: from.x + (to.x - from.x) * step / 16,
            y: from.y + (to.y - from.y) * step / 16,
        });
        await new Promise(function(resolve) { setTimeout(resolve, 30); });
        if (step === 8 && midway) { seen = await page.eval(midway); }
    }

    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
    await new Promise(function(resolve) { setTimeout(resolve, 300); });

    return seen;
}

/** Where to press on a node, and where to let go over another. */
var POINTS = `
    window.pointsFor = async function(from, fromX, to) {
        const source = document.querySelector(from);
        source.scrollIntoView({ block: 'center' });
        await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });
        const a = source.getBoundingClientRect();
        const b = document.querySelector(to).getBoundingClientRect();
        return {
            from: { x: a.left + (fromX === undefined ? a.width / 2 : fromX), y: a.top + a.height / 2 },
            to: { x: b.left + b.width / 2, y: b.top + b.height * 0.9 },
        };
    };
    return true;
`;

async function drawerDragTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);
    await page.eval(POINTS);

    var MARK = `
        jQuery('#myGrid .column').eq(0).attr('id', 'left');
        jQuery('#myGrid .column').eq(1).attr('id', 'right');
        jQuery('#left > .ge-text-block').attr('id', 'moving');
        return true;
    `;

    // The copy following the pointer, half way through a drag
    var HELPER = `
        const helper = document.querySelector('.ge-drag-helper');
        if (!helper) { return null; }
        return {
            inCanvas: !!helper.closest('#myGrid'),
            position: getComputedStyle(helper).position,
            panelsOpen: Array.from(helper.querySelectorAll('.ge-details')).filter(function(panel) {
                return getComputedStyle(panel).display !== 'none';
            }).length,
        };
    `;

    await page.eval(`restart(); ` + MARK);
    await page.hover('#moving');
    await t.sleep(200);
    var points = await page.eval(`return pointsFor('#moving > .ge-tools-drawer .ge-move', undefined, '#right');`);
    var helper = await dragBetween(page, points.from, points.to, HELPER);
    t.check('the copy that follows the pointer is in the canvas, and looks like what it copies: no settings panel open',
        !!helper && helper.inCanvas && helper.position === 'fixed' && helper.panelsOpen === 0, helper);

    await page.eval(`restart({ drag_handle: 'drawer' }); ` + MARK);
    await page.hover('#moving');
    await t.sleep(200);
    points = await page.eval(`return pointsFor('#moving > .ge-tools-drawer', 5, '#right');`);
    await dragBetween(page, points.from, points.to);
    var byGrip = await page.eval(`return { inRight: jQuery('#right').children('#moving').length, move: jQuery('#moving > .ge-tools-drawer .ge-move').length };`);
    t.check('with drag_handle drawer, a text drags by the grip at the start of its drawer',
        byGrip.inRight === 1 && byGrip.move === 0, byGrip);

    await page.eval(`restart({ drag_handle: 'drawer' }); ` + MARK);
    await page.hover('#moving');
    await t.sleep(200);
    points = await page.eval(`return pointsFor('#moving > .ge-tools-drawer > .ge-settings', undefined, '#right');`);
    await dragBetween(page, points.from, points.to);
    var bySettings = await page.eval(`return { inRight: jQuery('#right').children('#moving').length };`);
    t.check('but not by a tool that does something', bySettings.inRight === 0, bySettings);

    var errors = page.errors();
    t.check('the drawer drag tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'texts',
    description: 'text blocks, the text feature the editor plugins share, and RTEs removed',
    run: async function(t) {
        await bundleTests(t);
        await contractTests(t);
        await blockTests(t);
        await choiceTests(t);
        await dragTests(t);
        await drawerDragTests(t);
        await overlayTests(t);
        await utilityTests(t);
        await loadingTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['texts']);
}
