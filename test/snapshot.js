/**
 * Browser tests for getHtml({ keepEditing: true }): the markup getHtml gives,
 * read on a copy of the canvas, so the canvas never leaves editing - and for
 * the handle's snapshotHtml, setHtml and confirm, which the autosave plugin
 * is built on (spec autosave-plugin).
 *
 * These run offline, on the fixture, with a stand-in for tinyMCE. That the
 * real editors give the same is rte.js's business, and that every fixture
 * and scenario does is golden.js's.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';
var ADAPTER = '/test/fixtures/adapter.html?init=manual';

var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    window.fallbacks = function() { return window.warnings.filter(function(w) { return /leaves editing to be read/.test(w); }); };

    // A tinyMCE that opens at once, and whose content is what the content
    // area holds, as an inline editor's is
    window.fakeTinymce = {
        open: new Map(),
        init: function(config) {
            const area = config.target;
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                getContent: function() { return area.innerHTML; },
                remove: function() { editor.removed = true; window.fakeTinymce.open.delete(area); } };
            area.setAttribute('contenteditable', 'true');
            area.setAttribute('spellcheck', 'false');
            window.fakeTinymce.open.set(area, editor);
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };

    // The handle a plugin gets, kept by a plugin that does nothing else
    GridEditor.features.zzhandle = function(handle) { window.handle = handle; return {}; };

    window.MARKUP =
        '<div class="row" id="the-row"><div class="col-md-6" id="first">' +
            '<div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce" id="text"><p>Left</p></div></div>' +
        '<div class="col-md-6" id="second"><p>Plain</p></div></div>' +
        '<div class="row"><div class="col-md-12" id="third"><div data-ge-container="tabs"><ul class="nav nav-tabs">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1" type="button">One</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane fade show active" id="p1"><div class="row"><div class="col-md-12"><p>Pane</p></div></div></div></div>' +
        '</div></div></div>';

    window.restart = function(overrides, markup) {
        if (ge()) { ge().destroy(); }
        window.warnings.length = 0;
        q('#myGrid').innerHTML = markup || window.MARKUP;
        return window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            plugins: window.fixture.plugins(['zzhandle', 'tinymce']),
        }, overrides || {}));
    };

    /** Both reads, keepEditing first, and what keepEditing left open. */
    window.compare = function() {
        const kept = ge().getHtml({ keepEditing: true });
        const after = {
            textsOpen: window.fakeTinymce.open.size,
            active: qa('#myGrid .ge-rte-active').length,
            drawers: qa('#myGrid .ge-tools-drawer').length,
            editing: q('#myGrid').classList.contains('ge-editing'),
        };
        const left = ge().getHtml();
        return { same: kept === left, kept: kept, left: left, after: after };
    };
    return true;
`;

async function equivalence(t, page) {
    // AC-03 / AC-04 with the stand-in: an open text is read as its editor
    // holds it, and stays open
    var open = await page.eval(`
        restart();
        q('#text').click();
        q('#text').querySelector('p').textContent = 'Typed';
        const before = window.fakeTinymce.open.size;
        const result = compare();
        return { before: before, result: result };
    `);
    t.check('an open text is read as its editor holds it, the editor still open and still marked (AC-03)',
        open.before === 1 && open.result.after.textsOpen === 1 && open.result.after.active === 1 &&
            open.result.kept.indexOf('Typed') !== -1 && !/contenteditable|spellcheck|ge-rte-active|mce-/.test(open.result.kept),
        open);
    t.check('and that is what getHtml gives once it closes the editor (AC-04)', open.result.same, open.result.same ? undefined : open.result);

    var focus = await page.eval(`
        restart();
        q('#text').click();
        const field = document.createElement('input');
        q('#text').appendChild(field);
        field.focus();
        ge().getHtml({ keepEditing: true });
        const stillFocused = document.activeElement === field;
        field.remove();
        return stillFocused;
    `);
    t.check('the focus stays where it was (AC-03)', focus === true);

    // AC-06: each settings panel
    for (var mode of ['offcanvas', 'popover', 'modal', 'inline']) {
        var panel = await page.eval(`
            restart({ settings_panel: '${mode}' });
            q('#first > .ge-tools-drawer > .ge-settings').click();
            await new Promise(function(resolve) { setTimeout(resolve, 400); });
            const target = !!q('#first.ge-settings-target') || !!q('#first > .ge-tools-drawer > .ge-details:not([style*="none"])');
            const kept = ge().getHtml({ keepEditing: true });
            const stillOpen = !!q('#first.ge-settings-target') || !!q('#first > .ge-tools-drawer > .ge-details:not([style*="none"])');
            const left = ge().getHtml();
            return { target: target, stillOpen: stillOpen, same: kept === left, details: /ge-details|ge-settings/.test(kept) };
        `);
        t.check('with the ' + mode + ' settings panel open, it stays open and the html has none of it (AC-06)',
            panel.target && panel.stillOpen && panel.same && !panel.details, panel);
    }

    // AC-07, AC-08
    var quiet = await page.eval(`
        restart();
        q('#text').click();
        const records = [];
        const observer = new MutationObserver(function(list) { records.push.apply(records, list); });
        observer.observe(q('#myGrid'), { subtree: true, childList: true, attributes: true, characterData: true });
        const events = [];
        const dispatch = q('#myGrid').dispatchEvent;
        q('#myGrid').dispatchEvent = function(event) { events.push(event.type); return dispatch.call(this, event); };
        ge().getHtml({ keepEditing: true });
        ge().getPlainHtml({ keepEditing: true });
        const flushed = observer.takeRecords();
        observer.disconnect();
        q('#myGrid').dispatchEvent = dispatch;
        return { records: records.length + flushed.length, events: events };
    `);
    t.check('the canvas does not change: no mutation at all (AC-07)', quiet.records === 0, quiet);
    t.check('and no event is fired (AC-08)', quiet.events.length === 0, quiet);

    // AC-09
    var view = await page.eval(`
        restart({ plugins: window.fixture.plugins(['zzhandle', 'tinymce', 'order']) },
            '<div class="row"><div class="col-md-6 order-md-2" id="a"><p>A</p></div><div class="col-md-6 order-lg-1" id="b"><p>B</p></div></div>');
        ge().changeView('md');
        const previewing = qa('#myGrid [data-ge-preview]').length;
        const result = compare();
        return { previewing: previewing, same: result.same, preview: /data-ge-preview|!important/.test(result.kept),
            stillPreviewing: qa('#myGrid [data-ge-preview]').length };
    `);
    t.check('in a breakpoint view: no preview styles in the html, the same as getHtml (AC-09)',
        view.previewing > 0 && view.same && !view.preview, view);

    // AC-10
    var target = await page.eval(`
        restart({ active_target: true });
        ge().setActiveTarget('#second');
        const kept = ge().getHtml({ keepEditing: true });
        return { kept: /ge-active-target/.test(kept), marked: q('#second').classList.contains('ge-active-target') };
    `);
    t.check('the active target: not in the html, still marked on the canvas (AC-10)', !target.kept && target.marked, target);

    // AC-68
    var filtered = await page.eval(`
        const seen = [];
        window.hostFilter = function(canvas, isInit) {
            seen.push(canvas === q('#myGrid') ? 'canvas' : 'copy');
            canvas.querySelectorAll('.host-mark').forEach(function(node) {
                if (isInit) { return; }
                node.classList.remove('host-mark');
            });
        };
        restart({ custom_filter: window.hostFilter },
            '<div class="row"><div class="col-md-12"><p class="host-mark">Marked</p></div></div>');
        seen.length = 0;
        const kept = ge().getHtml({ keepEditing: true });
        const onCopy = seen.slice();
        const stillMarked = !!q('#myGrid .host-mark');
        const left = ge().getHtml();
        return { onCopy: onCopy, kept: /host-mark/.test(kept), stillMarked: stillMarked, same: kept === left };
    `);
    t.check('custom_filter is run on the copy: the html loses what it takes off, the canvas keeps it (AC-68)',
        filtered.onCopy.join() === 'copy' && !filtered.kept && filtered.stillMarked && filtered.same, filtered);
}

async function fallbacks(t, page) {
    // AC-11
    var legacy = await page.eval(`
        GridEditor.features.zzlegacy = function(handle) {
            return {
                onInit: function() { handle.canvas.querySelectorAll('.row').forEach(function(row) { row.classList.add('zz-mark'); }); },
                onDeinit: function() { handle.canvas.querySelectorAll('.zz-mark').forEach(function(row) { row.classList.remove('zz-mark'); }); },
            };
        };
        restart({ plugins: window.fixture.plugins(['zzhandle', 'tinymce', 'zzlegacy']) });
        q('#text').click();
        const kept = ge().getHtml({ keepEditing: true });
        const textsOpen = window.fakeTinymce.open.size;
        const first = fallbacks().length;
        ge().getHtml({ keepEditing: true });
        return { mark: /zz-mark/.test(kept), textsOpen: textsOpen, first: first, second: fallbacks().length,
            names: fallbacks().join(' ') };
    `);
    t.check('a feature plugin with onDeinit and no cleanMarkup: getHtml after all, the text closed, told once (AC-11)',
        !legacy.mark && legacy.textsOpen === 0 && legacy.first === 1 && legacy.second === 1 && /zzlegacy/.test(legacy.names), legacy);

    // AC-12
    var container = await page.eval(`
        GridEditor.containers.zzbox = function(handle) {
            return {
                labelKey: 'container.add_card',
                create: function() { const box = document.createElement('div'); box.setAttribute('data-ge-container', 'zzbox'); return box; },
                mark: function(box) { box.classList.add('zz-boxed'); },
                unmark: function(box) { box.classList.remove('zz-boxed'); },
            };
        };
        restart({ plugins: window.fixture.plugins(['zzhandle', 'tinymce', 'zzbox']) },
            window.MARKUP + '<div class="row"><div class="col-md-12"><div data-ge-container="zzbox"><p>Box</p></div></div></div>');
        q('#text').click();
        const kept = ge().getHtml({ keepEditing: true });
        return { boxed: /zz-boxed/.test(kept), textsOpen: window.fakeTinymce.open.size, warned: fallbacks().join(' ') };
    `);
    t.check('a container plugin with unmark and no cleanMarkup: the same (AC-12)',
        !container.boxed && container.textsOpen === 0 && /zzbox/.test(container.warned), container);

    // AC-13
    var quietPlugin = await page.eval(`
        GridEditor.features.zzquiet = function() { return { drawerTools: function() {} }; };
        restart({ plugins: window.fixture.plugins(['zzhandle', 'tinymce', 'zzquiet']) });
        q('#text').click();
        ge().getHtml({ keepEditing: true });
        return { textsOpen: window.fakeTinymce.open.size, warned: fallbacks().length };
    `);
    t.check('a feature plugin that puts nothing on the canvas needs no cleanMarkup (AC-13)',
        quietPlugin.textsOpen === 1 && quietPlugin.warned === 0, quietPlugin);

    // AC-14, AC-15: a text editor of the shared registry with no read
    var noRead = await page.eval(`
        GridEditor.texts.zzplain = function() {
            return {
                labelKey: 'text.tinymce',
                start: function(areas) { areas.forEach(function(area) { area.classList.add('active'); area.setAttribute('contenteditable', 'true'); }); },
                stop: function(areas) { areas.forEach(function(area) { area.classList.remove('active'); area.removeAttribute('contenteditable'); }); },
            };
        };
        const markup = '<div class="row"><div class="col-md-12"><div class="ge-content ge-content-type-zzplain" data-ge-content-type="zzplain" id="z"><p>Z</p></div></div></div>';
        restart({ content_types: ['zzplain'], plugins: window.fixture.plugins(['zzhandle']) }, markup);
        ge().getHtml({ keepEditing: true });
        const closedWarned = fallbacks().length;
        q('#z').click();
        const opened = q('#z').classList.contains('ge-rte-active');
        ge().getHtml({ keepEditing: true });
        return { closedWarned: closedWarned, opened: opened, openWarned: fallbacks().length,
            closedAfter: !q('#z').classList.contains('ge-rte-active') };
    `);
    t.check('an editor with no read, none of its texts open: read on the copy, no word (AC-15)', noRead.closedWarned === 0, noRead);
    t.check('one of its texts open: getHtml after all, with a word (AC-14)',
        noRead.opened && noRead.openWarned === 1 && noRead.closedAfter, noRead);

    // AC-16
    var mapped = await page.eval(`
        const found = {};
        GridEditor.features.zzmap = function() {
            return {
                onDeinit: function() {},
                cleanMarkup: function(root, liveOf) {
                    const copied = root.querySelector('#second');
                    found.live = liveOf(copied) === q('#second');
                    found.copyIsNotLive = copied !== q('#second');
                    const made = document.createElement('div');
                    copied.appendChild(made);
                    found.made = liveOf(made);
                    made.remove();
                },
            };
        };
        restart({ plugins: window.fixture.plugins(['zzhandle', 'tinymce', 'zzmap']) });
        ge().getHtml({ keepEditing: true });
        return found;
    `);
    t.check('cleanMarkup is handed liveOf: a copied node’s live one, null for one made on the copy (AC-16)',
        mapped.live === true && mapped.copyIsNotLive === true && mapped.made === null, mapped);
}

async function states(t, page) {
    // AC-17
    var destroyed = await page.eval(`
        restart();
        const instance = ge();
        instance.destroy();
        return { kept: instance.getHtml({ keepEditing: true }), plain: q('#myGrid').innerHTML };
    `);
    t.check('destroyed: what getHtml gives then, the element as it is (AC-17)', destroyed.kept === destroyed.plain);

    // AC-18
    var source = await page.eval(`
        restart();
        q('.gm-edit-mode').click();
        const kept = ge().getHtml({ keepEditing: true });
        const stillOpen = q('.ge-html-output').style.display !== 'none';
        const left = ge().getHtml();
        q('.gm-edit-mode').click();
        return { same: kept === left, stillOpen: stillOpen };
    `);
    t.check('with the source view open: what getHtml gives, the source view still open (AC-18)',
        source.same && source.stillOpen, source);
}

async function handleTests(t, page) {
    // AC-20
    var accepted = await page.eval(`
        restart();
        window.answers = [];
        handle.confirm('Keep going?', { title: 'A question', ok: 'Yes', cancel: 'No' }, function(answer) { window.answers.push(answer); });
        return true;
    `);
    await sleep(500);
    var shown = await page.eval(`
        const modal = q('.ge-confirm');
        return {
            visible: !!modal && modal.classList.contains('show'),
            title: modal && modal.querySelector('.modal-title').textContent,
            message: modal && modal.querySelector('.ge-confirm-message').textContent,
            ok: modal && modal.querySelector('.ge-confirm-ok').textContent,
            cancel: modal && modal.querySelector('.ge-confirm-cancel').textContent,
            danger: modal && modal.querySelector('.ge-confirm-ok').classList.contains('btn-danger'),
        };
    `);
    await page.click('.ge-confirm .ge-confirm-ok');
    await sleep(500);
    var answered = await page.eval(`return window.answers;`);
    t.check('ge.confirm shows the modal with the texts it is given, ok not red (AC-20)',
        accepted && shown.visible && shown.title === 'A question' && shown.message === 'Keep going?' &&
            shown.ok === 'Yes' && shown.cancel === 'No' && !shown.danger, shown);
    t.check('and accepting answers true, once (AC-20)', JSON.stringify(answered) === '[true]', answered);

    // AC-21
    var ways = {};
    for (var way of ['cancel', 'close', 'escape']) {
        await page.eval(`
            window.answers = [];
            handle.confirm('Again?', {}, function(answer) { window.answers.push(answer); });
            return true;
        `);
        await sleep(500);
        if (way === 'cancel') { await page.click('.ge-confirm .ge-confirm-cancel'); }
        if (way === 'close') { await page.click('.ge-confirm .btn-close'); }
        if (way === 'escape') {
            await page.eval(`q('.ge-confirm').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
        }
        await sleep(500);
        ways[way] = await page.eval(`return window.answers;`);
    }
    t.check('cancel, the close button and Escape answer false, once each (AC-21)',
        JSON.stringify(ways) === JSON.stringify({ cancel: [false], close: [false], escape: [false] }), ways);

    // AC-22
    var plain = await page.eval(`
        const bootstrap = window.bootstrap;
        const confirm = window.confirm;
        window.bootstrap = undefined;
        const asked = [];
        window.confirm = function(message) { asked.push(message); return true; };
        const answers = [];
        handle.confirm('Plain?', {}, function(answer) { answers.push(answer); });
        window.bootstrap = bootstrap;
        window.confirm = confirm;
        return { asked: asked, answers: answers };
    `);
    t.check('without Bootstrap’s javascript, the browser asks (AC-22)',
        JSON.stringify(plain) === JSON.stringify({ asked: ['Plain?'], answers: [true] }), plain);

    // AC-23
    await page.eval(`restart(); return true;`);
    await page.eval(`q('#the-row .ge-delete-row').click(); return true;`);
    await sleep(500);
    var deleting = await page.eval(`
        const modal = q('.ge-confirm');
        return {
            visible: !!modal && modal.classList.contains('show'),
            title: modal && modal.querySelector('.modal-title').textContent,
            ok: modal && modal.querySelector('.ge-confirm-ok').textContent,
            danger: modal && modal.querySelector('.ge-confirm-ok').classList.contains('btn-danger'),
        };
    `);
    if (deleting.visible) {
        await page.click('.ge-confirm .ge-confirm-ok');
        await sleep(800);
    }
    var gone = await page.eval(`return !q('#the-row');`);
    t.check('deleting still asks as it did: Confirm, a red Delete, and the row goes (AC-23)',
        deleting.visible && deleting.title === 'Confirm' && deleting.ok === 'Delete' && deleting.danger && gone,
        { deleting: deleting, gone: gone });

    // AC-24, AC-59
    var replaced = await page.eval(`
        restart();
        q('.gm-edit-mode').click();
        const events = [];
        ['before-add', 'after-add', 'before-delete', 'after-delete'].forEach(function(name) {
            q('#myGrid').addEventListener('grideditor:' + name, function() { events.push(name); });
        });
        window.ran = false;
        handle.setHtml('<div class="row" id="new"><div class="col-md-12"><p>New</p><script>window.ran = true;<\\/script></div></div>');
        return {
            sourceClosed: q('.ge-html-output').style.display === 'none',
            canvasShown: q('#myGrid').style.display !== 'none',
            button: q('.gm-edit-mode').classList.contains('active'),
            drawer: !!q('#new > .ge-tools-drawer'),
            old: !!q('#the-row'),
            events: events,
            ran: window.ran,
        };
    `);
    t.check('ge.setHtml closes the source view and edits the new markup, with no add or delete event (AC-24)',
        replaced.sourceClosed && replaced.canvasShown && !replaced.button && replaced.drawer && !replaced.old &&
            replaced.events.length === 0, replaced);
    t.check('a <script> in it does not run in the editor (AC-59)', replaced.ran === false, replaced);
}

async function adapterTests(t) {
    var page = await t.page(ADAPTER, `window.fixture && window.jQuery`);
    // AC-19
    var adapted = await page.eval(`
        window.fixture.init();
        const grid = window.jQuery(window.fixture.grid);
        const kept = grid.gridEditor('getHtml', { keepEditing: true });
        const left = grid.gridEditor('getHtml');
        return { same: kept === left, length: kept.length };
    `);
    t.check('through the jQuery adapter too (AC-19)', adapted.same && adapted.length > 0, adapted);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    await equivalence(t, page);
    await fallbacks(t, page);
    await states(t, page);
    await handleTests(t, page);
    await adapterTests(t);

    t.check('the snapshot suite logged no page errors', page.errors().length === 0, page.errors().slice(0, 5));
}

module.exports = {
    name: 'snapshot',
    description: 'getHtml({ keepEditing: true }), and the handle\'s snapshotHtml, setHtml and confirm',
    run: run,
};
