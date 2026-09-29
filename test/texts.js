/**
 * Browser tests for text blocks and what the text editor plugins share: the
 * text feature every editor's file carries, its GridEditor.texts
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
        open: new Map(), // content area -> the editor open on it
        /** The editor open on a content area (an element), or null. */
        editorFor: function(area) {
            return window.fakeTinymce.open.get(area) || null;
        },
        init: function(config) {
            window.fakeTinymce.started++;
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                remove: function() {
                    editor.removed = true;
                    window.fakeTinymce.open.delete(config.target);
                } };
            window.fakeTinymce.open.set(config.target, editor);
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    // Two texts of the first content type started with, as the editor saved
    // them: loose markup would be the host's plain content. With no content
    // types there is no type to give them, and they are plain.
    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.firstArea = function() { return q('#myGrid .ge-content'); };
    /** The element children of a node, but the editor's drawers and handles. */
    window.blocksIn = function(node) {
        return Array.from(node.children).filter(function(child) { return !child.matches('.ge-tools-drawer, .ge-resize-handle'); });
    };

    window.restart = function(overrides) {
        if (ge()) { ge().destroy(); }
        const settings = Object.assign({}, window.fixture.settings, { content_types: ['tinymce'] }, overrides || {});
        // content_types: undefined is the editor's own default, every editor loaded
        if (settings.content_types === undefined) { delete settings.content_types; }
        const type = (settings.content_types || ['tinymce'])[0];
        const text = function(html) {
            return type ? '<div class="ge-content ge-content-type-' + type + '" data-ge-content-type="' + type + '">' + html + '</div>' : html;
        };
        q('#myGrid').innerHTML =
            '<div class="row"><div class="col-lg-6">' + text('<p>Left</p>') + '</div>' +
            '<div class="col-lg-6">' + text('<p>Right</p>') + '</div></div>';
        GridEditor.create('#myGrid', settings);
    };
    return true;
`;

/** Up to 5.x, editing with the main bundle's copy of an editor warned about it. */
var BUNDLED = `return window.warnings.filter(function(w) { return /copy in the main bundle/.test(w); }).length;`;

async function bundleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var bundle = await page.eval(`
        const source = await (await fetch('/dist/grideditor.js')).text();
        restart();
        firstArea().click();
        return {
            carries: /texts\\.(tinymce|ckeditor|summernote)\\s*=/.test(source),
            marked: !!GridEditor.texts.tinymce.bundled,
            started: window.fakeTinymce.started,
            attached: !!window.fakeTinymce.editorFor(firstArea()),
            warned: (function() { ${BUNDLED} })(),
        };
    `);
    t.check('the main bundle carries no text editor: each is its plugin\'s file, as the fixture loads them',
        !bundle.carries && !bundle.marked && bundle.started === 1 && bundle.attached && bundle.warned === 0, bundle);

    var filtered = await page.eval(`
        restart({ plugins: ['tabs'] });
        firstArea().click();
        return { attached: !!window.fakeTinymce.editorFor(firstArea()) };
    `);
    t.check('the plugins setting does not turn a text editor off: content_types chooses it',
        filtered.attached, filtered);

    var missing = await page.eval(`
        restart();
        window.tinymce = undefined;
        const area = firstArea();
        area.click();
        const without = {
            active: area.classList.contains('ge-rte-active'),
            error: window.errorsLogged.some(function(e) { return /tinyMCE not available/.test(e); }),
        };
        window.tinymce = window.fakeTinymce;
        area.click();
        return { without: without, laterAttached: !!window.fakeTinymce.editorFor(area) };
    `);
    t.check('with no tinyMCE, a click says so and starts nothing; a later click, once it is there, does',
        !missing.without.active && missing.without.error && missing.laterAttached, missing);

    var exported = await page.eval(`
        const html = ge().getHtml();
        return { clean: !/ge-rte-active|contenteditable|class="active/.test(html), detached: !window.fakeTinymce.editorFor(firstArea()) };
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
        GridEditor.texts.simple = function(ge) {
            return {
                initialContent: '<p>Write here</p>',
                start: function(blocks) {
                    blocks.forEach(function(block) {
                        window.calls.push('start');
                        block.classList.add('active');
                        // An editor rewrites what it takes over, drawers and all
                        block.querySelectorAll('.ge-tools-drawer').forEach(function(drawer) { drawer.remove(); });
                        ge.textReady(block);
                    });
                },
                stop: function(blocks) {
                    blocks.forEach(function(block) {
                        if (block.classList.contains('active')) { window.calls.push('stop'); }
                        block.classList.remove('active');
                    });
                },
            };
        };
        // A plugin that puts something of its own inside the text, and needs
        // telling when an editor has rewritten it
        window.readyFor = [];
        GridEditor.features.probe = function() {
            return { onContentReady: function(area) { window.readyFor.push(area.getAttribute('data-ge-content-type')); } };
        };
        restart({ content_types: ['simple'], plugins: window.fixture.plugins(['probe']) });
        delete GridEditor.features.probe;

        const area = firstArea();
        area.click();
        const drawerBack = window.readyFor.join(',') === 'simple' ? 1 : 0;

        const column = ge().createColumn(6, { appendTo: q('#myGrid .row') });
        const empty = blocksIn(column).length;
        const withContent = ge().createColumn(6, { content: '<p>Given</p>', appendTo: q('#myGrid .row') })
            .querySelector(':scope > .ge-text-block > .ge-content');
        const fresh = { empty: empty, type: withContent.getAttribute('data-ge-content-type'), html: withContent.innerHTML };

        ge().getHtml();
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
        // No jQuery on this page, so no $.fn.gridEditor.RTEs either; the
        // adapter's side is test/adapter.js's
        return { rtes: window.jQuery ? typeof window.jQuery.fn.gridEditor.RTEs : 'undefined', registry: typeof GridEditor.RTEs };
    `);
    t.check('5.x\'s RTEs registry, deprecated since 6.0, is gone in 7.0',
        legacy.rtes === 'undefined' && legacy.registry === 'undefined', legacy);

    var errors = page.errors();
    t.check('the contract tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A second text editor, for the choices that only exist with more than one:
 * it opens by marking the content area and closes by unmarking it.
 */
var SIMPLE_EDITOR = `
    GridEditor.texts.simple = function(ge) {
        return {
            labelKey: 'text.simple_label',
            initialContent: '<p>Simple</p>',
            start: function(blocks) { blocks.forEach(function(block) { block.classList.add('active'); ge.textReady(block); }); },
            stop: function(blocks) { blocks.forEach(function(block) { block.classList.remove('active'); }); },
        };
    };
    GridEditor.locales.en['text.simple_label'] = 'Simple';

    window.events = [];
    window.listen = function() {
        ['before-add', 'after-add', 'before-add-text', 'after-add-text',
            'before-delete', 'after-delete', 'before-move', 'after-move'].forEach(function(name) {
            document.querySelector('#myGrid').addEventListener('grideditor:' + name, function(e) {
                const payload = e.detail;
                window.events.push({ type: e.type.replace('grideditor:', ''), kind: payload.kind, source: payload.source,
                    isContent: payload.node.matches('.ge-content') });
            });
        });
    };
    return true;
`;

/** The tools in a text block's drawer, by their first class. */
var TOOLS = `
    window.toolsOf = function(block) {
        return Array.from(block.querySelectorAll(':scope > .ge-tools-drawer > a')).map(function(tool) {
            return tool.getAttribute('class').split(' ')[0];
        }).join(',');
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
        const blocks = qa('#myGrid .column > .ge-text-block');
        const first = blocks[0];
        return {
            blocks: blocks.length,
            areas: qa('#myGrid .ge-content').length,
            everyWrapped: qa('#myGrid .ge-content').every(function(area) { return area.parentElement.matches('.ge-text-block'); }),
            tools: toolsOf(first),
            info: first.querySelectorAll(':scope > .ge-tools-drawer > .ge-text-info').length,
            editor: first.querySelector(':scope > .ge-tools-drawer .ge-details .ge-text-editor').textContent,
            drawerOutside: first.querySelector(':scope > .ge-content').querySelectorAll('.ge-tools-drawer').length === 0,
        };
    `);
    t.check('each content area in a column is a text block while editing, its drawer beside it and not inside',
        drawer.blocks === 2 && drawer.areas === 2 && drawer.everyWrapped && drawer.drawerOutside, drawer);
    t.check('a text block\'s drawer: move, settings, delete; which editor edits it is in its settings',
        drawer.tools === 'ge-move,ge-settings,ge-delete-text' && drawer.info === 0 && drawer.editor === 'EditortinyMCE', drawer);

    var exported = await page.eval(`
        const block = q('#myGrid .ge-text-block');
        const id = block.querySelector(':scope > .ge-tools-drawer .ge-details .ge-id');
        id.value = 'intro';
        id.dispatchEvent(new Event('change', { bubbles: true }));
        const html = ge().getHtml();
        const root = document.createElement('div');
        root.innerHTML = html;
        return {
            wrappers: /ge-text-block|ge-text-drawer/.test(html),
            direct: Array.from(root.querySelectorAll('.column > .ge-content')).length,
            id: root.querySelector('.ge-content').id,
            rewrapped: qa('#myGrid .ge-text-block').length,
        };
    `);
    t.check('getHtml has no text block: the content area is back in its column, with the id its panel gave it',
        !exported.wrappers && exported.direct === 2 && exported.id === 'intro' && exported.rewrapped === 2, exported);

    var added = await page.eval(`
        window.events = [];
        listen();
        const column = q('#myGrid .column');
        ge().createText({ appendTo: column });
        const last = column.lastElementChild;
        const lastArea = last.querySelector(':scope > .ge-content');
        return {
            tools: qa('#myGrid .column > .ge-tools-drawer > .ge-add-text').length,
            last: last.matches('.ge-text-block'),
            html: lastArea.innerHTML,
            type: lastArea.getAttribute('data-ge-content-type'),
            events: window.events.map(function(e) { return e.type + ':' + e.kind + ':' + e.source + ':' + e.isContent; }),
        };
    `);
    t.check('a column\'s drawer has no add text tool; createText into it puts a text block of the first editor at its end',
        added.tools === 0 && added.last && added.type === 'tinymce' && added.html === '<p>Lorem ipsum dolores</p>', added);
    t.check('and announces it as a text: before-add-text, before-add, after-add-text, after-add',
        added.events.join(' ') === 'before-add-text:text:api:true before-add:text:api:true after-add-text:text:api:true after-add:text:api:true',
        added.events);

    var deleted = await page.eval(`
        window.events = [];
        const block = q('#myGrid .ge-text-block');
        const area = block.querySelector(':scope > .ge-content');
        area.click();
        const editor = window.fakeTinymce.editorFor(area);
        block.querySelector(':scope > .ge-tools-drawer > .ge-delete-text').click();
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve({
                    gone: !document.contains(block),
                    stopped: !!editor && editor.removed,
                    events: window.events.map(function(e) { return e.type + ':' + e.kind + ':' + e.isContent; }),
                });
            }, 700);
        });
    `);
    t.check('the delete tool closes the text\'s editor, removes it and announces a text',
        deleted.gone && deleted.stopped && deleted.events.join(' ') === 'before-delete:text:true after-delete:text:true', deleted);

    var empty = await page.eval(`
        const column = q('#myGrid .column');
        column.querySelectorAll(':scope > .ge-text-block').forEach(function(block) { block.remove(); });
        return {
            children: blocksIn(column).length,
            room: getComputedStyle(column, '::after').minHeight,
        };
    `);
    t.check('a column with nothing in it keeps room to drop a block into',
        empty.children === 0 && empty.room === '40px', empty);

    var none = await page.eval(`
        restart({ content_types: [] });
        return {
            addText: qa('#myGrid .ge-add-text').length,
            buttons: qa('.ge-mainControls .ge-add-text-button').length,
            blocks: qa('#myGrid .ge-text-block').length,
            info: qa('#myGrid .ge-text-info').length,
        };
    `);
    t.check('with no text editor offered there is no add text tool and no text button; plain content is still a block',
        none.addText === 0 && none.buttons === 0 && none.blocks === 2 && none.info === 0, none);

    var missing = await page.eval(`
        restart();
        ge().destroy();
        firstArea().setAttribute('data-ge-content-type', 'ghost');
        firstArea().classList.remove('ge-content-type-tinymce');
        window.fixture.init({ content_types: ['tinymce'] });
        const area = firstArea();
        area.click();
        const tools = area.parentElement.querySelectorAll(':scope > .ge-tools-drawer > .ge-text-missing');
        return { tool: tools.length, title: tools[0] && tools[0].getAttribute('title'), active: area.classList.contains('ge-rte-active') };
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
        return qa('.ge-mainControls .ge-add-text-button').map(function(button) { return button.getAttribute('title'); });
    `);
    t.check('with one text editor offered, the toolbar has one Text button', one.join('|') === 'Text', one);

    var two = await page.eval(`
        restart({ content_types: ['tinymce', 'simple', 'nothing-loaded'] });
        return {
            buttons: qa('.ge-mainControls .ge-add-text-button').map(function(button) { return button.getAttribute('title'); }),
        };
    `);
    t.check('with two, one button each, named after its editor; a type with no plugin is not offered',
        two.buttons.join('|') === 'Text (tinyMCE)|Text (Simple)', two);

    var clicked = await page.eval(`
        window.events = [];
        listen();
        const before = qa('#myGrid > .row').length;
        qa('.ge-mainControls .ge-add-text-button').pop().click();
        const row = qa('#myGrid > .row').pop();
        return {
            rows: qa('#myGrid > .row').length - before,
            columns: row.querySelectorAll(':scope > .column').length,
            type: row.querySelector('.ge-content').getAttribute('data-ge-content-type'),
            blocks: row.querySelectorAll('.ge-content').length,
            events: window.events.filter(function(e) { return e.type === 'after-add-text'; }).map(function(e) { return e.kind + ':' + e.source; }),
        };
    `);
    t.check('a Text button adds a row with a column holding one text of its editor, announced as a text',
        clicked.rows === 1 && clicked.columns === 1 && clicked.blocks === 1 && clicked.type === 'simple' &&
        clicked.events.join(',') === 'text:tool', clicked);

    var api = await page.eval(`
        window.warnings = [];
        const column = q('#myGrid .column');
        const detached = ge().createText();
        const placed = ge().createText('simple', { content: '<p>From the API</p>', appendTo: column });
        const unknown = ge().createText('nothing-loaded');
        const viaMethod = GridEditor.get('#myGrid').createText({ content: '<p>Method</p>' });
        return {
            detached: detached.matches('.ge-content') && !detached.parentElement && detached.getAttribute('data-ge-content-type') === 'tinymce',
            detachedHtml: detached.innerHTML,
            placed: placed.parentElement.matches('.ge-text-block') && placed.closest('.column') === column && placed.innerHTML === '<p>From the API</p>',
            unknown: unknown,
            warned: window.warnings.some(function(w) { return /createText: no text editor "nothing-loaded"/.test(w); }),
            viaMethod: viaMethod && viaMethod.innerHTML,
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
        qa('#myGrid .column')[0].id = 'left';
        qa('#myGrid .column')[1].id = 'right';
        q('#left > .ge-text-block').id = 'moving';
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
            inRight: qa('#right > #moving').length,
            left: qa('#left > .ge-text-block').length,
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
            inLeft: qa('#left > .ge-text-block').length,
            rows: qa('#myGrid > .row').length,
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
        const columns = qa('#myGrid .column');
        return {
            buttons: qa('.ge-mainControls .ge-add-text-button').map(function(button) { return button.getAttribute('title'); }),
            addTextPerColumn: columns.map(function(col) { return col.querySelectorAll(':scope > .ge-tools-drawer > .ge-add-text').length; }),
            features: Object.keys(GridEditor.features).filter(function(name) { return name === 'text'; }).length,
        };
    `);
    t.check('with no content_types, every editor loaded is offered, in the order the page loaded them',
        all.buttons.join('|') === 'Text (tinyMCE)|Text (CKEditor)|Text (Summernote)', all);
    t.check('three editors loaded install the text feature once: one Text button per editor, and no add text tool in the columns',
        all.features === 1 && all.buttons.length === 3 && all.addTextPerColumn.join(',') === '0,0', all);

    var none = await page.eval(`
        window.warnings = [];
        const feature = GridEditor.features.text;
        delete GridEditor.features.text;
        restart({ content_types: undefined });
        const first = ge().createText();
        const second = ge().createText();
        const result = {
            buttons: qa('.ge-mainControls .ge-add-text-button').length,
            addText: qa('#myGrid .ge-add-text').length,
            first: first,
            second: second,
            warned: window.warnings.filter(function(w) { return /createText needs a text editor plugin/.test(w); }).length,
            orphans: qa('#myGrid .ge-text-missing').length,
        };
        ge().destroy();
        GridEditor.features.text = feature;
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
        restart({ plugins: window.fixture.plugins(['style']) });
        const area = firstArea();
        const field = area.parentElement.querySelectorAll(':scope > .ge-tools-drawer .ge-utility[data-ge-family="text-align"]').length;
        const written = ge().setUtility(area, 'text-align', 'center', 'all');
        const html = ge().getHtml();
        return { field: field, written: written, classed: area.classList.contains('text-center'), inHtml: /class="ge-content[^"]*text-center/.test(html) };
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
        const block = document.querySelector('#over');
        const drawer = block.querySelector(':scope > .ge-tools-drawer');
        const style = getComputedStyle(drawer);
        return {
            visibility: style.visibility,
            opacity: parseFloat(style.opacity),
            position: style.position,
            blockHeight: Math.round(block.getBoundingClientRect().height),
            areaHeight: Math.round(block.querySelector(':scope > .ge-content').getBoundingClientRect().height),
            spans: Math.round(drawer.getBoundingClientRect().width) === Math.round(block.getBoundingClientRect().width),
        };
    `;

    // The settings unfold in the drawer here, which is what makes it span
    await page.eval(`
        restart({ settings_panel: 'inline' });
        q('#myGrid .ge-text-block').id = 'over';
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

    await page.eval(`document.querySelector('#over > .ge-content').click(); return true;`);
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
        ge().deinit();
        ge().init();
        q('#myGrid .ge-text-block').id = 'over';
        q('#over > .ge-tools-drawer > .ge-settings').click();
        return true;
    `);
    await t.sleep(300);
    var settings = await page.eval(STATE);
    t.check('and while its settings are open, across the text so the panel has room',
        settings.visibility === 'visible' && settings.spans, settings);

    await page.eval(`document.querySelector('#over > .ge-content').click(); return true;`);
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
        qa('#myGrid .column')[0].id = 'left';
        qa('#myGrid .column')[1].id = 'right';
        q('#left > .ge-text-block').id = 'moving';
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
    var byGrip = await page.eval(`return { inRight: qa('#right > #moving').length, move: qa('#moving > .ge-tools-drawer .ge-move').length };`);
    t.check('with drag_handle drawer, a text drags by the grip at the start of its drawer',
        byGrip.inRight === 1 && byGrip.move === 0, byGrip);

    await page.eval(`restart({ drag_handle: 'drawer' }); ` + MARK);
    await page.hover('#moving');
    await t.sleep(200);
    points = await page.eval(`return pointsFor('#moving > .ge-tools-drawer > .ge-settings', undefined, '#right');`);
    await dragBetween(page, points.from, points.to);
    var bySettings = await page.eval(`return { inRight: qa('#right > #moving').length };`);
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
