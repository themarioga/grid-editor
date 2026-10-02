/**
 * Browser tests for the autosave plugin: saving after a change and when the
 * page is left, offering the draft back to an editor that starts from the
 * same html, the methods and the events (spec autosave-plugin).
 *
 * The fixture does not load the plugin - a suite that uses every plugin
 * loaded would start saving drafts - so this suite loads it itself. Each test
 * starts with the storage empty.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    await new Promise(function(resolve) {
        const script = document.createElement('script');
        script.src = '../../dist/plugins/grideditor.autosave.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });

    window.KEY = 'grideditor.autosave:/test/fixtures/grid.html#myGrid';
    window.MARKUP = '<div class="row"><div class="col-md-12" id="only"><p>Start</p></div></div>';
    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };

    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.events = [];
    ['after-autosave', 'after-restore-draft', 'autosave-error'].forEach(function(name) {
        q('#myGrid').addEventListener('grideditor:' + name, function(e) {
            window.events.push({ name: name, source: e.detail.source, html: e.detail.html, error: e.detail.error && String(e.detail.error) });
        });
    });

    /** A fresh editor with the plugin, on markup, with the storage as it is unless cleared. */
    window.start = function(autosave, markup, overrides) {
        if (ge()) { ge().destroy(); }
        window.events.length = 0;
        window.warnings.length = 0;
        q('#myGrid').innerHTML = markup === undefined ? window.MARKUP : markup;
        return window.fixture.init(Object.assign({
            plugins: window.fixture.plugins(['autosave']),
            autosave: Object.assign({ delay: 100 }, autosave || {}),
        }, overrides || {}));
    };
    window.fresh = function(autosave, markup, overrides) {
        if (ge()) { ge().destroy(); }
        localStorage.clear();
        sessionStorage.clear();
        return start(autosave, markup, overrides);
    };
    window.stored = function(storage, key) {
        const raw = (storage || localStorage).getItem(key || window.KEY);
        try { return raw === null ? null : JSON.parse(raw); } catch (e) { return raw; }
    };
    window.change = function(id) {
        ge().createRow([12], { appendTo: q('#myGrid') }).id = id || 'added';
    };
    window.modalShown = function() {
        const modal = q('.ge-confirm');
        return !!modal && modal.classList.contains('show');
    };
    /** A draft as the plugin writes them, for a canvas that starts from MARKUP unless told. */
    window.writeDraft = function(fields) {
        localStorage.setItem(window.KEY, JSON.stringify(Object.assign({
            version: 1, html: '<div class="row"><div class="col-md-12 column"><div class="ge-content"><p>Draft</p></div></div></div>',
            savedAt: new Date().toISOString(), base: window.BASE,
        }, fields || {})));
    };
    /** The fingerprint an editor starting from markup takes: FNV-1a of what it reads at first. */
    window.baseOf = function(markup) {
        const running = ge();
        if (running) { running.destroy(); }
        q('#myGrid').innerHTML = markup;
        const probe = window.fixture.init({});
        const html = probe.getHtml({ keepEditing: true });
        probe.destroy();
        let hash = 0x811c9dc5;
        for (let i = 0; i < html.length; i++) { hash ^= html.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
        return (hash >>> 0).toString(16).padStart(8, '0');
    };
    window.BASE = window.baseOf(window.MARKUP);
    return true;
`;

async function saving(t, page) {
    // AC-25
    var timing = await page.eval(`
        fresh({ delay: 300 });
        await wait(50);
        change();
        await wait(150);
        const early = stored();
        await wait(300);
        const later = stored();
        return { early: early, later: later, html: ge().getHtml(), events: window.events };
    `);
    t.check('a change is saved delay ms after it, not before, as getHtml gives it (AC-25)',
        timing.early === null && timing.later && timing.later.version === 1 && timing.later.html === timing.html &&
            typeof timing.later.base === 'string' && !isNaN(Date.parse(timing.later.savedAt)) &&
            timing.events.length === 1 && timing.events[0].name === 'after-autosave' && timing.events[0].source === 'change',
        timing);

    // AC-26
    var debounce = await page.eval(`
        fresh({ delay: 300 });
        await wait(50);
        change('one');
        await wait(150);
        change('two');
        await wait(200);
        const between = stored();
        await wait(200);
        return { between: between, saved: window.events.length, html: (stored() || {}).html || '' };
    `);
    t.check('two changes 150 ms apart are saved once, delay after the second (AC-26)',
        debounce.between === null && debounce.saved === 1 && debounce.html.indexOf('id="two"') !== -1, debounce);

    // AC-27
    var typing = await page.eval(`
        window.tinymce = {
            init: function(config) {
                const area = config.target;
                const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {},
                    getContent: function() { return area.innerHTML; }, remove: function() { window.closed = true; } };
                config.init_instance_callback.call(editor, editor);
            },
        };
        window.closed = false;
        fresh({}, '<div class="row"><div class="col-md-12"><div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce" id="t"><p>Text</p></div></div></div>',
            { content_types: ['tinymce'], plugins: window.fixture.plugins(['autosave', 'tinymce']) });
        await wait(50);
        q('#t').click();
        q('#t p').textContent = 'Typed in it';
        await wait(250);
        return { saved: (stored() || {}).html || '', closed: window.closed, open: !!q('#t.ge-rte-active') };
    `);
    t.check('what is typed in an open text is saved, the editor left open (AC-27)',
        typing.saved.indexOf('Typed in it') !== -1 && !typing.closed && typing.open, typing);

    // AC-28
    var unchanged = await page.eval(`
        fresh();
        await wait(50);
        ge().changeView('md');
        await wait(250);
        ge().changeView('all');
        await wait(250);
        return { stored: stored(), events: window.events.length };
    `);
    t.check('a change the html does not show - a view change - writes nothing (AC-28)',
        unchanged.stored === null && unchanged.events === 0, unchanged);

    // AC-29
    var zero = await page.eval(`
        fresh({ delay: 0 });
        await wait(20);
        change();
        await wait(30);
        return !!stored();
    `);
    t.check('delay 0 saves on the next turn of the event loop (AC-29)', zero === true);

    // AC-30, AC-34, AC-51
    var invalid = await page.eval(`
        const found = {};
        [[{ delay: -1 }, 'delay'], [{ delay: 'x' }, 'delay'], [{ storage: 'other' }, 'storage'],
            [{ maxAge: 0 }, 'maxAge'], [{ maxAge: -5 }, 'maxAge'], [{ maxAge: 'x' }, 'maxAge']].forEach(function(each) {
            fresh(Object.assign({}, each[0], each[1] === 'delay' ? {} : { delay: 100 }));
            found[JSON.stringify(each[0])] = window.warnings.filter(function(w) { return w.indexOf('autosave.' + each[1]) !== -1; }).length;
        });
        return found;
    `);
    t.check('an invalid delay, storage or maxAge warns once and takes the default (AC-30, AC-34, AC-51)',
        Object.keys(invalid).every(function(name) { return invalid[name] === 1; }), invalid);

    var defaultDelay = await page.eval(`
        fresh({ delay: -1 });
        await wait(50);
        change();
        await wait(600);
        const early = stored();
        await wait(600);
        return { early: early, later: !!stored() };
    `);
    t.check('and an invalid delay is 1000 ms (AC-30)', defaultDelay.early === null && defaultDelay.later, defaultDelay);

    var otherStorage = await page.eval(`
        fresh({ storage: 'other' });
        await wait(50);
        change();
        await wait(250);
        return { local: !!stored(localStorage), session: !!stored(sessionStorage) };
    `);
    t.check('an unknown storage is localStorage (AC-34)', otherStorage.local && !otherStorage.session, otherStorage);

    // AC-31, AC-32
    var leaving = await page.eval(`
        fresh({ delay: 5000 });
        await wait(50);
        window.dispatchEvent(new Event('pagehide'));
        const nothing = stored();
        change();
        window.dispatchEvent(new Event('pagehide'));
        return { nothing: nothing, saved: !!stored(), source: (window.events[0] || {}).source };
    `);
    t.check('leaving the page with nothing changed writes nothing (AC-32)', leaving.nothing === null, leaving);
    t.check('leaving it with a change waiting saves it there and then (AC-31)',
        leaving.saved && leaving.source === 'pagehide', leaving);

    // AC-33
    var session = await page.eval(`
        fresh({ storage: 'session' });
        await wait(50);
        change();
        await wait(250);
        return { local: !!stored(localStorage), session: !!stored(sessionStorage) };
    `);
    t.check('storage session writes to sessionStorage, not localStorage (AC-33)', session.session && !session.local, session);

    // AC-35
    var key = await page.eval(`
        fresh();
        await wait(50);
        change();
        await wait(250);
        return Object.keys(localStorage);
    `);
    t.check('the default key is the page\u2019s path and the canvas\u2019s id (AC-35)',
        JSON.stringify(key) === JSON.stringify(['grideditor.autosave:/test/fixtures/grid.html#myGrid']), key);

    // AC-36
    var twice = await page.eval(`
        fresh();
        const other = document.createElement('div');
        other.id = 'other';
        other.innerHTML = '<div class="row"><div class="col-md-12"><p>Other</p></div></div>';
        document.body.appendChild(other);
        const second = GridEditor.create(other, { plugins: window.fixture.plugins(['autosave']),
            autosave: { key: window.KEY, delay: 100 } });
        const warned = window.warnings.filter(function(w) { return /already saves to/.test(w); }).length;
        await wait(50);
        second.createRow([12], { appendTo: other });
        change();
        await wait(250);
        const saved = (stored() || {}).html || '';
        const answers = { enable: second.enableAutosave(), save: second.saveDraft(), draft: second.getDraft() };
        second.destroy();
        other.remove();
        return { warned: warned, savedFirst: saved.indexOf('id="added"') !== -1, savedOther: saved.indexOf('Other') !== -1, answers: answers };
    `);
    t.check('a second editor with the same key warns once and saves nothing; the first goes on (AC-36)',
        twice.warned === 1 && twice.savedFirst && !twice.savedOther &&
            twice.answers.enable === false && twice.answers.save === false && twice.answers.draft === null, twice);
}

async function switching(t, page) {
    // AC-37, AC-38
    var off = await page.eval(`
        fresh();
        writeDraft();
        const before = localStorage.getItem(KEY);
        start({ enabled: false });
        await wait(100);
        const asked = modalShown();
        change('while-off');
        await wait(250);
        const untouched = localStorage.getItem(KEY) === before;
        const enabled = ge().enableAutosave();
        change('after-on');
        await wait(250);
        const saved = (stored() || {}).html || '';
        return { asked: asked, untouched: untouched, enabled: enabled, saved: saved.indexOf('after-on') !== -1, asking: modalShown() };
    `);
    t.check('enabled false: no question, nothing written, the draft left alone (AC-37)', !off.asked && off.untouched, off);
    t.check('enableAutosave then saves what there is, without asking (AC-38)',
        off.enabled === true && off.saved && !off.asking, off);

    // AC-39
    var disabled = await page.eval(`
        fresh({ delay: 300 });
        await wait(50);
        change('one');
        await wait(100);
        const answer = ge().disableAutosave();
        await wait(400);
        const pending = stored();
        change('two');
        await wait(400);
        const after = stored();
        writeDraft();
        const kept = ge().getDraft();
        return { answer: answer, pending: pending, after: after, kept: !!kept };
    `);
    t.check('disableAutosave: the change waiting is not written, nor any after, and the draft is kept (AC-39)',
        disabled.answer === true && disabled.pending === null && disabled.after === null && disabled.kept, disabled);

    // AC-40, AC-41
    var api = await page.eval(`
        fresh({ enabled: false });
        await wait(50);
        change();
        const first = ge().saveDraft();
        const source = (window.events[0] || {}).source;
        const second = ge().saveDraft();
        return { first: first, source: source, second: second, saved: !!stored() };
    `);
    t.check('saveDraft writes when the html changed, even disabled, with source api (AC-40)',
        api.first === true && api.source === 'api' && api.saved, api);
    t.check('and writes nothing when it did not (AC-41)', api.second === false, api);

    // AC-42
    var cleared = await page.eval(`
        fresh();
        writeDraft();
        const answer = ge().clearDraft();
        return { answer: answer, draft: ge().getDraft(), stored: stored() };
    `);
    t.check('clearDraft takes the draft away (AC-42)', cleared.answer === true && cleared.draft === null && cleared.stored === null, cleared);

    // AC-60
    var absent = await page.eval(`
        if (ge()) { ge().destroy(); }
        q('#myGrid').innerHTML = MARKUP;
        const plain = window.fixture.init({});
        return typeof plain.enableAutosave;
    `);
    t.check('without the plugin the instance has no autosave methods (AC-60)', absent === 'undefined', absent);
}

/** An editor made, edited and saved, then made again on the same markup: the question is up. */
var DRAFTED = `
    fresh({ delay: 50 });
    await wait(50);
    change('from-draft');
    await wait(150);
    const draft = stored();
    start({ delay: 50 });
    await wait(500);
    window.draftSaved = draft;
    return { draft: draft, shown: modalShown() };
`;

async function restoring(t, page) {
    // AC-43
    var asked = await page.eval(DRAFTED + '');
    var texts = await page.eval(`
        const modal = q('.ge-confirm');
        return {
            title: modal.querySelector('.modal-title').textContent,
            message: modal.querySelector('.ge-confirm-message').textContent,
            ok: modal.querySelector('.ge-confirm-ok').textContent,
            cancel: modal.querySelector('.ge-confirm-cancel').textContent,
        };
    `);
    await page.eval(`change('while-asking'); await wait(200); return true;`);
    var whileAsking = await page.eval(`return JSON.stringify(stored()) === JSON.stringify(window.draftSaved);`);
    t.check('a draft of the same html, different from it, is offered in the modal with its date (AC-43)',
        asked.draft && asked.shown && texts.title === 'Restore the draft?' && texts.ok === 'Restore' &&
            texts.cancel === 'Discard' && texts.message.indexOf(new Date(asked.draft.savedAt).getFullYear()) !== -1, { asked: asked, texts: texts });
    t.check('nothing is written while it asks (AC-43)', whileAsking === true);

    // AC-44
    await page.click('.ge-confirm .ge-confirm-ok');
    await sleep(500);
    var restored = await page.eval(`
        const has = !!q('#from-draft') && !!q('#from-draft > .ge-tools-drawer');
        const event = window.events.filter(function(e) { return e.name === 'after-restore-draft'; })[0];
        change('after-restore');
        await wait(150);
        const saved = stored();
        return { has: has, event: !!event, saved: saved.html.indexOf('from-draft') !== -1 && saved.html.indexOf('after-restore') !== -1,
            base: saved.base === window.draftSaved.base };
    `);
    t.check('Restore: the canvas is the draft, being edited, after-restore-draft fired, and saving goes on from there (AC-44)',
        restored.has && restored.event && restored.saved, restored);
    t.check('the draft keeps the base of the html the editor started from (AC-65)', restored.base, restored);

    // AC-65: made again on the same markup, it is offered again
    var again = await page.eval(`
        start({ delay: 50 });
        await wait(500);
        return modalShown();
    `);
    t.check('made again on the same html, that draft is offered again (AC-65)', again === true);
    await page.click('.ge-confirm .ge-confirm-cancel');
    await sleep(500);

    // AC-45
    for (var way of ['discard', 'close', 'escape']) {
        await page.eval(DRAFTED);
        if (way === 'discard') { await page.click('.ge-confirm .ge-confirm-cancel'); }
        if (way === 'close') { await page.click('.ge-confirm .btn-close'); }
        if (way === 'escape') {
            await page.eval(`q('.ge-confirm').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
        }
        await sleep(500);
        var discarded = await page.eval(`
            const state = { draft: stored(), restored: !!q('#from-draft'), start: !!q('#only') };
            change('after-discard');
            await wait(150);
            state.savedAfter = !!stored();
            return state;
        `);
        t.check(way + ': the html it started from stays, the draft goes, autosave goes on (AC-45)',
            discarded.draft === null && !discarded.restored && discarded.start && discarded.savedAfter, discarded);
    }

    // AC-46
    var same = await page.eval(`
        fresh();
        await wait(50);
        const html = ge().getHtml({ keepEditing: true });
        writeDraft({ html: html });
        start();
        await wait(300);
        const shown = modalShown();
        change();
        await wait(250);
        return { shown: shown, saving: (stored() || {}).html !== html };
    `);
    t.check('a draft the same as the html it starts from: no question, and autosave goes on (AC-46)', !same.shown && same.saving, same);

    // AC-47
    var empty = await page.eval(`
        fresh();
        writeDraft({ html: '' });
        start();
        await wait(600);
        return modalShown();
    `);
    t.check('an empty draft is offered like any other (AC-47)', empty === true);

    await page.click('.ge-confirm .ge-confirm-ok');
    await sleep(500);
    var emptied = await page.eval(`return q('#myGrid').querySelectorAll('.row').length;`);
    t.check('and restoring it leaves the canvas empty (AC-47)', emptied === 0, emptied);

    // AC-48..AC-50: maxAge, with savedAt set in the past
    var ages = {};
    for (var age of [59999, 60000, 60001]) {
        ages[age] = await page.eval(`
            fresh();
            const now = Date.now();
            const realNow = Date.now;
            writeDraft({ savedAt: new Date(now - ${age}).toISOString() });
            Date.now = function() { return now; };
            start({ maxAge: 60000 });
            Date.now = realNow;
            await wait(400);
            return { shown: modalShown(), stored: !!stored() };
        `);
        if (ages[age].shown) {
            await page.click('.ge-confirm .ge-confirm-cancel');
            await sleep(500);
        }
    }
    t.check('maxAge 60000: a draft 59999 ms old is offered (AC-48)', ages[59999].shown, ages);
    t.check('one exactly 60000 ms old is offered too (AC-49)', ages[60000].shown, ages);
    t.check('one 60001 ms old is not, and is taken away (AC-50)', !ages[60001].shown && !ages[60001].stored, ages);

    // AC-52
    var corrupt = {};
    var values = {
        'not json': '"{nope',
        'version 2': JSON.stringify({ version: 2, html: 'x', savedAt: new Date().toISOString(), base: 'x' }),
        'no html': JSON.stringify({ version: 1, savedAt: new Date().toISOString(), base: 'x' }),
        'bad date': JSON.stringify({ version: 1, html: 'x', savedAt: 'yesterday', base: 'x' }),
        'no base': JSON.stringify({ version: 1, html: 'x', savedAt: new Date().toISOString() }),
    };
    for (var name of Object.keys(values)) {
        corrupt[name] = await page.eval(`
            fresh();
            localStorage.setItem(KEY, ${JSON.stringify(values[name])}.replace(/^"\\{nope$/, '{nope'));
            start();
            await wait(300);
            return { shown: modalShown(), stored: localStorage.getItem(KEY), warned: window.warnings.filter(function(w) { return /not a draft/.test(w); }).length };
        `);
    }
    t.check('a value that is not a draft - not json, another version, no html, a bad date, no base - is taken away, ' +
        'with one word and no question (AC-52)',
        Object.keys(corrupt).every(function(each) { return !corrupt[each].shown && corrupt[each].stored === null && corrupt[each].warned === 1; }),
        corrupt);
}

async function documents(t, page) {
    // AC-62, AC-63, AC-64
    var other = await page.eval(`
        const A = MARKUP;
        const B = '<div class="row"><div class="col-md-12"><p>Document B</p></div></div>';
        fresh({ delay: 50 }, A);
        await wait(50);
        change('edit-of-a');
        await wait(150);
        const draftOfA = stored();
        start({ delay: 50 }, B);
        await wait(400);
        const askedOnB = modalShown();
        const keptOnB = ge().getDraft();
        start({ delay: 50 }, A);
        await wait(400);
        const askedOnA = modalShown();
        return { askedOnB: askedOnB, keptOnB: !!keptOnB && keptOnB.html === draftOfA.html, askedOnA: askedOnA, baseOfA: draftOfA.base };
    `);
    t.check('a draft made from html A is not offered to an editor made on html B, and is left alone (AC-62)',
        !other.askedOnB && other.keptOnB, other);
    t.check('made again on A, it is offered (AC-63)', other.askedOnA, other);
    await page.click('.ge-confirm .ge-confirm-cancel');
    await sleep(500);

    var overwritten = await page.eval(`
        const B = '<div class="row"><div class="col-md-12"><p>Document B</p></div></div>';
        fresh({ delay: 50 });
        await wait(50);
        change('edit-of-a');
        await wait(150);
        const baseOfA = stored().base;
        start({ delay: 50 }, B);
        await wait(300);
        change('edit-of-b');
        await wait(150);
        const now = stored();
        return { html: now.html.indexOf('edit-of-b') !== -1, base: now.base !== baseOfA, baseOfB: now.base === baseOf(B) };
    `);
    t.check('a change on B overwrites it, with the base of B (AC-64)',
        overwritten.html && overwritten.base && overwritten.baseOfB, overwritten);

    // AC-66
    var keyed = await page.eval(`
        const A = MARKUP;
        const B = '<div class="row"><div class="col-md-12"><p>Document B</p></div></div>';
        fresh({ delay: 50, key: 'doc-A' }, A);
        await wait(50);
        change('edit-of-a');
        await wait(150);
        start({ delay: 50, key: 'doc-B' }, B);
        await wait(300);
        change('edit-of-b');
        await wait(150);
        start({ delay: 50, key: 'doc-A' }, A);
        await wait(400);
        const shown = modalShown();
        const draft = ge().getDraft();
        return { shown: shown, intact: !!draft && draft.html.indexOf('edit-of-a') !== -1 && draft.html.indexOf('edit-of-b') === -1 };
    `);
    t.check('a key per document: A\u2019s draft survives editing B, and is offered on A (AC-66)', keyed.shown && keyed.intact, keyed);
    await page.click('.ge-confirm .ge-confirm-cancel');
    await sleep(500);

    // AC-67
    var empty = await page.eval(`
        fresh({ delay: 50 });
        await wait(50);
        change('edit-of-a');
        await wait(150);
        start({ delay: 50 }, '');
        await wait(400);
        return { shown: modalShown(), kept: !!ge().getDraft() };
    `);
    t.check('an editor that starts empty, before the page loads anything, is not asked (AC-67)', !empty.shown && empty.kept, empty);
}

async function lifecycle(t, page) {
    // AC-53
    var blocked = await page.eval(`
        if (ge()) { ge().destroy(); }
        localStorage.clear();
        const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
        Object.defineProperty(window, 'localStorage', { configurable: true, get: function() { throw new Error('blocked'); } });
        let result;
        try {
            const errors = [];
            const onError = function(e) { errors.push(String(e.message)); };
            window.addEventListener('error', onError);
            start();
            await wait(50);
            change();
            await wait(250);
            result = {
                warned: window.warnings.filter(function(w) { return /will not give this page/.test(w); }).length,
                methods: [ge().enableAutosave(), ge().disableAutosave(), ge().saveDraft(), ge().getDraft(), ge().clearDraft()],
                events: window.events.length,
                errors: errors,
            };
            window.removeEventListener('error', onError);
        } finally {
            Object.defineProperty(window, 'localStorage', descriptor);
        }
        return result;
    `);
    t.check('a browser that will not give the page its storage: one word, no errors, the methods false or null (AC-53)',
        blocked.warned === 1 && JSON.stringify(blocked.methods) === '[false,false,false,null,false]' &&
            blocked.events === 0 && blocked.errors.length === 0, blocked);

    // AC-54
    var full = await page.eval(`
        fresh();
        writeDraft({ base: 'other' });
        const before = localStorage.getItem(KEY);
        await wait(50);
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function() { throw new Error('QuotaExceededError'); };
        change('one');
        await wait(250);
        const failed = { error: window.events.filter(function(e) { return e.name === 'autosave-error'; }).length,
            kept: localStorage.getItem(KEY) === before };
        change('two');
        await wait(250);
        failed.secondError = window.events.filter(function(e) { return e.name === 'autosave-error'; }).length;
        failed.warned = window.warnings.filter(function(w) { return /could not be saved/.test(w); }).length;
        Storage.prototype.setItem = setItem;
        change('three');
        await wait(250);
        failed.retried = ((stored() || {}).html || '').indexOf('three') !== -1;
        return failed;
    `);
    t.check('a write that fails: autosave-error, one word, the draft before kept, and the next change tries again (AC-54)',
        full.error === 1 && full.kept && full.secondError === 2 && full.warned === 1 && full.retried, full);

    // AC-55
    await page.eval(DRAFTED);
    var destroyedAsking = await page.eval(`
        const before = localStorage.getItem(KEY);
        ge().destroy();
        await wait(500);
        return { shown: modalShown(), restored: !!q('#from-draft'), kept: localStorage.getItem(KEY) === before };
    `);
    t.check('destroy with the question up: it goes, nothing restored, the draft kept (AC-55)',
        !destroyedAsking.shown && !destroyedAsking.restored && destroyedAsking.kept, destroyedAsking);

    // AC-56
    var destroyed = await page.eval(`
        fresh({ delay: 5000 });
        await wait(50);
        const instance = ge();
        change('pending');
        instance.destroy();
        const saved = stored();
        const source = (window.events[0] || {}).source;
        window.dispatchEvent(new Event('pagehide'));
        q('#myGrid').innerHTML = '<p>after</p>';
        await wait(100);
        return { saved: !!saved && saved.html.indexOf('pending') !== -1, source: source,
            unchanged: JSON.stringify(stored()) === JSON.stringify(saved), events: window.events.length };
    `);
    t.check('destroy with a change waiting saves it with source destroy, and nothing writes after (AC-56)',
        destroyed.saved && destroyed.source === 'destroy' && destroyed.unchanged && destroyed.events === 1, destroyed);

    // AC-57
    var legacy = await page.eval(`
        GridEditor.features.zzlegacy = function(handle) {
            return {
                onInit: function() { handle.canvas.querySelectorAll('.row').forEach(function(row) { row.classList.add('zz-mark'); }); },
                onDeinit: function() { handle.canvas.querySelectorAll('.zz-mark').forEach(function(row) { row.classList.remove('zz-mark'); }); },
            };
        };
        fresh({ delay: 50 }, undefined, { plugins: window.fixture.plugins(['autosave', 'zzlegacy']) });
        await wait(50);
        change();
        await wait(500);
        return window.events.filter(function(e) { return e.name === 'after-autosave'; }).length;
    `);
    t.check('a plugin that makes it fall back on getHtml: one save, the read\u2019s own changes do not schedule another (AC-57)',
        legacy === 1, legacy);

    // AC-58
    await page.eval(`fresh({ delay: 50 }); await wait(50); return true;`);
    await page.click('.gm-edit-mode');
    var source = await page.eval(`
        const textarea = q('.ge-html-output');
        textarea.value = textarea.value + '<div class="row" id="typed-in-source"><div class="col-md-12"><p>Source</p></div></div>';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(200);
        return { whileOpen: stored() };
    `);
    await page.click('.gm-edit-mode');
    var closed = await page.eval(`await wait(200); return ((stored() || {}).html || '').indexOf('typed-in-source') !== -1;`);
    t.check('the source view open: nothing saved; closed, the canvas it makes is (AC-58)',
        source.whileOpen === null && closed === true, { source: source, closed: closed });

    // AC-61, AC-69
    await page.eval(DRAFTED);
    await page.eval(`ge().setLocale('es'); return true;`);
    await sleep(800);
    var spanish = await page.eval(`
        const modal = q('.ge-confirm');
        return { shown: modalShown(), title: modal && modal.querySelector('.modal-title').textContent,
            ok: modal && modal.querySelector('.ge-confirm-ok').textContent,
            restored: !!q('#from-draft'), stored: JSON.stringify(stored()) === JSON.stringify(window.draftSaved) };
    `);
    t.check('setLocale with the question up asks it again, in the new language, nothing restored or taken away (AC-69)',
        spanish.shown && spanish.title === '¿Recuperar el borrador?' && spanish.ok === 'Recuperar' && !spanish.restored && spanish.stored,
        spanish);
    await page.click('.ge-confirm .ge-confirm-ok');
    await sleep(500);
    var afterLocale = await page.eval(`
        const restored = !!q('#from-draft');
        change('in-spanish');
        await wait(200);
        return { restored: restored, saved: ((stored() || {}).html || '').indexOf('in-spanish') !== -1 };
    `);
    t.check('answering it works as before, and saving goes on after setLocale (AC-61, AC-69)',
        afterLocale.restored && afterLocale.saved, afterLocale);
    await page.eval(`ge().setLocale('en'); return true;`);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(`
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '../../dist/locales/grideditor.es.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        return true;
    `);
    await page.eval(SETUP);

    await saving(t, page);
    await switching(t, page);
    await restoring(t, page);
    await documents(t, page);
    await lifecycle(t, page);

    await page.eval(`if (ge()) { ge().destroy(); } localStorage.clear(); sessionStorage.clear(); return true;`);
    t.check('the autosave suite logged no page errors', page.errors().length === 0, page.errors().slice(0, 5));
}

module.exports = {
    name: 'autosave',
    description: 'the autosave plugin: saving, offering the draft back, the methods and the events',
    run: run,
};
