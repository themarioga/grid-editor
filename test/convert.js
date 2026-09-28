/**
 * Browser tests for making the host's plain content a text: a click, the
 * choice of editor when there are several, the convert events, and the
 * core's textTypes hook, which is how any plugin offers a type.
 *
 * Offline, on the fixture: tinyMCE is a stand-in with only what the
 * integration touches, and a second editor is a feature plugin written here.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.warnings = [];
    window.errorsLogged = [];
    const warn = console.warn, error = console.error;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    console.error = function() { window.errorsLogged.push(Array.prototype.join.call(arguments, ' ')); error.apply(console, arguments); };

    window.fakeTinymce = {
        started: 0,
        targets: [], // The content areas an editor is open on
        init: function(config) {
            window.fakeTinymce.started++;
            window.fakeTinymce.targets.push(config.target);
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                remove: function() {
                    editor.removed = true;
                    window.fakeTinymce.targets.splice(window.fakeTinymce.targets.indexOf(config.target), 1);
                } };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    // An editor of the page's own: a feature plugin that declares a type
    window.noteEdits = [];
    window.notePlugin = function(type, label) {
        return function(ge) {
            return {
                textTypes: function() {
                    return [{
                        type: type,
                        label: label,
                        edit: function(block) { window.noteEdits.push(type + ':' + block.textContent); },
                    }];
                },
            };
        };
    };

    window.events = [];
    window.payloads = [];
    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.typeOf = function(area) { return area.getAttribute('data-ge-content-type'); };
    window.grid = function() { return q('#myGrid'); };

    // A test's listeners on the canvas, taken off again by the next start()
    window.listeners = [];
    window.listen = function(name, handler) {
        grid().addEventListener('grideditor:' + name, handler);
        window.listeners.push([name, handler]);
    };

    window.start = function(html, settings) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        grid().innerHTML = html;
        window.events = [];
        window.payloads = [];
        window.noteEdits = [];
        window.fakeTinymce.started = 0;
        window.listeners.forEach(function(entry) { grid().removeEventListener('grideditor:' + entry[0], entry[1]); });
        window.listeners = [];
        ['before-convert', 'after-convert'].forEach(function(name) {
            listen(name, function(e) {
                const payload = e.detail;
                window.events.push(e.type.replace('grideditor:', '') + ':' + payload.kind);
                window.payloads.push({ from: payload.from, to: payload.to, source: payload.source, node: payload.node.matches('.ge-content') });
            });
        });
        return window.fixture.init(Object.assign({ content_types: ['tinymce'] }, settings || {}));
    };

    window.toolsOf = function(block) {
        return Array.from(block.querySelectorAll(':scope > .ge-tools-drawer > a')).map(function(tool) {
            return tool.getAttribute('class').split(' ')[0];
        }).join(',');
    };
    return true;
`;

var ONE = '<div class="row"><div class="col-12" id="col"><p>Mine</p></div></div>';

async function convertTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var made = await page.eval(`
        start(${JSON.stringify(ONE)});
        const area = q('#col .ge-content');
        area.click();
        const block = area.parentElement;
        return {
            events: window.events.slice(),
            payloads: window.payloads.slice(),
            type: typeOf(area),
            classed: area.classList.contains('ge-content-type-tinymce'),
            started: window.fakeTinymce.started,
            attached: window.fakeTinymce.targets.indexOf(area) !== -1,
            plainBlock: block.classList.contains('ge-plain-block'),
            tools: toolsOf(block),
        };
    `);
    t.check('with one editor offered, a click on plain content makes it a text of that editor and opens it',
        made.type === 'tinymce' && made.classed && made.started === 1 && made.attached, made);
    t.check('announced as before-convert and after-convert, from plain to the type, from a tool',
        made.events.join(' ') === 'before-convert:plain after-convert:plain' &&
        made.payloads.every(function(p) { return p.from === 'plain' && p.to === 'tinymce' && p.source === 'tool' && p.node; }), made);
    t.check('and its drawer is a text\'s now',
        !made.plainBlock && made.tools === 'ge-move,ge-settings,ge-delete-text', made);

    var kept = await page.eval(`
        start('<div class="row"><div class="col-12" id="col"><div class="ge-content lead" id="x"><p>Mío</p></div></div></div>');
        let seen = null;
        listen('after-convert', function(e) {
            const node = e.detail.node;
            seen = { html: node.innerHTML, id: node.getAttribute('id'), lead: node.classList.contains('lead') };
        });
        q('#x').click();
        return seen;
    `);
    t.check('nothing else about the node changes: its content, no initial content, its id and its classes',
        !!kept && kept.html === '<p>Mío</p>' && kept.id === 'x' && kept.lead, kept);

    var canceled = await page.eval(`
        start(${JSON.stringify(ONE)});
        listen('before-convert', function(e) { e.preventDefault(); });
        const area = q('#col .ge-content');
        area.click();
        const first = { events: window.events.slice(), type: typeOf(area) || null, started: window.fakeTinymce.started };
        area.click();
        return { first: first, second: window.events.slice() };
    `);
    t.check('a canceled before-convert leaves it plain, opens nothing, and the next click asks again',
        canceled.first.events.join(' ') === 'before-convert:plain' && canceled.first.type === null &&
        canceled.first.started === 0 && canceled.second.join(' ') === 'before-convert:plain before-convert:plain', canceled);

    var callback = await page.eval(`
        start(${JSON.stringify(ONE)}, { callbacks: { before_convert: function() { return false; } } });
        const area = q('#col .ge-content');
        area.click();
        return { events: window.events.slice(), type: typeOf(area) || null, started: window.fakeTinymce.started };
    `);
    t.check('and so does a before_convert callback returning false',
        callback.events.join(' ') === 'before-convert:plain' && callback.type === null && callback.started === 0, callback);

    var missing = await page.eval(`
        start(${JSON.stringify(ONE)});
        window.tinymce = undefined;
        const area = q('#col .ge-content');
        area.click();
        const without = {
            events: window.events.slice(),
            type: typeOf(area) || null,
            error: window.errorsLogged.some(function(e) { return /tinyMCE not available/.test(e); }),
        };
        window.tinymce = window.fakeTinymce;
        area.click();
        return { without: without, later: typeOf(area), attached: window.fakeTinymce.targets.indexOf(area) !== -1 };
    `);
    t.check('with the library missing a click says so and converts nothing; a later click, once it is there, does',
        missing.without.events.length === 0 && missing.without.type === null && missing.without.error &&
        missing.later === 'tinymce' && missing.attached, missing);

    var hidden = await page.eval(`
        start('<div class="row"><div class="col-12"><div data-ge-container="tabs"><ul class="nav nav-tabs">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li>' +
            '<li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#p2">Two</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="col-12"><p>shown</p></div></div></div>' +
            '<div class="tab-pane" id="p2"><div class="row"><div class="col-12"><p>hidden</p></div></div></div></div></div></div></div>');
        const areas = qa('#p2 .ge-content');
        areas.forEach(function(area) { area.click(); });
        return { areas: areas.length, events: window.events.slice(), type: typeOf(areas[0]) || null };
    `);
    t.check('plain content nobody can see - a tab that is not the open one - is left alone',
        hidden.areas === 1 && hidden.events.length === 0 && hidden.type === null, hidden);

    var saved = await page.eval(`
        start(${JSON.stringify(ONE)});
        q('#col .ge-content').click();
        const html = window.fixture.editor().getHtml();
        start(html);
        const block = q('#col > .ge-text-block');
        return {
            saved: /data-ge-content-type="tinymce"/.test(html) && /ge-content-type-tinymce/.test(html),
            text: !block.classList.contains('ge-plain-block') && toolsOf(block) === 'ge-move,ge-settings,ge-delete-text',
        };
    `);
    t.check('getHtml saves it as a text, and a text it is when the page comes back',
        saved.saved && saved.text, saved);

    var again = await page.eval(`
        start(${JSON.stringify(ONE)});
        const area = q('#col .ge-content');
        area.click();
        area.click();
        return { started: window.fakeTinymce.started, events: window.events.length };
    `);
    t.check('a click on the text it became, its editor open, opens nothing more and converts nothing',
        again.started === 1 && again.events === 2, again);

    var errors = page.errors([/tinyMCE not available/]);
    t.check('the conversion tests logged no other errors', errors.length === 0, errors.slice(0, 5));
}

async function choiceTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var offered = await page.eval(`
        GridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete GridEditor.features.note;
        q('#col .ge-content').click();
        const choices = qa('#col .ge-convert-picker > a');
        return {
            offered: choices.map(function(choice) { return choice.textContent; }),
            titles: choices.map(function(choice) { return choice.getAttribute('title'); }),
            events: window.events.slice(),
            type: typeOf(q('#col .ge-content')) || null,
        };
    `);
    t.check('with several types offered a click offers them, the plugins\' in the order they were registered',
        offered.offered.join('|') === 'tinyMCE|Note' && offered.titles[1] === 'Edit as Note text', offered);
    t.check('and converts nothing until one is chosen',
        offered.events.length === 0 && offered.type === null, offered);

    var chosen = await page.eval(`
        qa('#col .ge-convert-picker > a').pop().click();
        const area = q('#col .ge-content');
        return {
            type: typeOf(area),
            events: window.events.slice(),
            to: window.payloads.map(function(p) { return p.to; }),
            edits: window.noteEdits.slice(),
            closed: qa('.ge-convert-picker').length === 0,
            orphan: area.parentElement.querySelectorAll(':scope > .ge-tools-drawer > .ge-text-missing').length,
        };
    `);
    t.check('the one chosen converts it, through the events, and its plugin\'s edit takes it over',
        chosen.type === 'note' && chosen.events.join(' ') === 'before-convert:plain after-convert:plain' &&
        chosen.to.join(',') === 'note,note' && chosen.edits.join(',') === 'note:Mine' && chosen.closed, chosen);

    var tinymce = await page.eval(`
        GridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete GridEditor.features.note;
        q('#col .ge-content').click();
        q('#col .ge-convert-picker > a').click();
        return { type: typeOf(q('#col .ge-content')), started: window.fakeTinymce.started };
    `);
    t.check('choosing tinyMCE opens tinyMCE on it',
        tinymce.type === 'tinymce' && tinymce.started === 1, tinymce);

    var withdrawn = await page.eval(`
        GridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete GridEditor.features.note;
        const area = q('#col .ge-content');
        area.click();
        const open = qa('.ge-convert-picker').length;
        area.click();
        const afterClick = qa('.ge-convert-picker').length;
        area.click();
        const html = window.fixture.editor().getHtml();
        return {
            open: open,
            afterClick: afterClick,
            afterGetHtml: qa('.ge-convert-picker').length,
            events: window.events.length,
            type: typeOf(area) || null,
            typedInHtml: /data-ge-content-type/.test(html),
        };
    `);
    t.check('closed without a choice - another click, getHtml - nothing is converted and nothing announced',
        withdrawn.open === 1 && withdrawn.afterClick === 0 && withdrawn.afterGetHtml === 0 &&
        withdrawn.events === 0 && withdrawn.type === null && !withdrawn.typedInHtml, withdrawn);

    var owned = await page.eval(`
        GridEditor.features.note = notePlugin('note', 'Note');
        start('<div class="row"><div class="col-12" id="col"><div class="ge-content" data-ge-content-type="note"><p>N</p></div></div></div>',
            { plugins: window.fixture.plugins(['note']) });
        delete GridEditor.features.note;
        const block = q('#col > .ge-text-block');
        return { missing: block.querySelectorAll('.ge-text-missing').length, plain: block.classList.contains('ge-plain-block'), drawers: block.querySelectorAll(':scope > .ge-tools-drawer').length };
    `);
    t.check('a text of a type a plugin declares is that plugin\'s: the core gives it no drawer of its own',
        owned.missing === 0 && !owned.plain && owned.drawers === 0, owned);

    var twice = await page.eval(`
        window.warnings = [];
        GridEditor.features.note = notePlugin('note', 'Note');
        GridEditor.features.note2 = notePlugin('note', 'Another note');
        start(${JSON.stringify(ONE)}, { content_types: [], plugins: window.fixture.plugins(['note', 'note2']) });
        delete GridEditor.features.note;
        delete GridEditor.features.note2;
        const area = q('#col .ge-content');
        area.click();
        window.fixture.editor().getHtml();
        return {
            picker: qa('.ge-convert-picker').length,
            edits: window.noteEdits.slice(),
            warned: window.warnings.filter(function(w) { return /"note2" plugin declares the text type "note"/.test(w); }).length,
        };
    `);
    t.check('two plugins declaring one type: the first one has it, and the second is warned about once',
        twice.picker === 0 && twice.edits.join(',') === 'note:Mine' && twice.warned === 1, twice);

    var errors = page.errors();
    t.check('the choice tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'convert',
    description: 'plain content made a text: the click, the choice, the convert events and textTypes',
    run: async function(t) {
        await convertTests(t);
        await choiceTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['convert']);
}
