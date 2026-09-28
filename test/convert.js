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
        init: function(config) {
            window.fakeTinymce.started++;
            const editor = { removed: false, ui: { show: function() {} }, on: function() {}, focus: function() {},
                remove: function() { editor.removed = true; } };
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
                        edit: function(block) { window.noteEdits.push(type + ':' + block.text()); },
                    }];
                },
            };
        };
    };

    window.events = [];
    window.payloads = [];
    window.start = function(html, settings) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(html);
        window.events = [];
        window.payloads = [];
        window.noteEdits = [];
        window.fakeTinymce.started = 0;
        jQuery('#myGrid').off('.test').on('grideditor:before-convert.test grideditor:after-convert.test', function(e, payload) {
            window.events.push(e.type.replace('grideditor:', '') + ':' + payload.kind);
            window.payloads.push({ from: payload.from, to: payload.to, source: payload.source, node: payload.node.is('.ge-content') });
        });
        window.fixture.init(Object.assign({ content_types: ['tinymce'] }, settings || {}));
        return jQuery('#myGrid').data('grideditor');
    };

    window.toolsOf = function(block) {
        return block.children('.ge-tools-drawer').children('a').map(function() {
            return jQuery(this).attr('class').split(' ')[0];
        }).get().join(',');
    };
    return true;
`;

var ONE = '<div class="row"><div class="col-12" id="col"><p>Mine</p></div></div>';

async function convertTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var made = await page.eval(`
        start(${JSON.stringify(ONE)});
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        const block = area.parent('.ge-text-block');
        return {
            events: window.events.slice(),
            payloads: window.payloads.slice(),
            type: area.attr('data-ge-content-type'),
            classed: area.hasClass('ge-content-type-tinymce'),
            started: window.fakeTinymce.started,
            attached: !!area.data('ge-tinymce'),
            plainBlock: block.hasClass('ge-plain-block'),
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
        jQuery('#myGrid').on('grideditor:after-convert.test', function(e, payload) {
            seen = { html: payload.node.html(), id: payload.node.attr('id'), lead: payload.node.hasClass('lead') };
        });
        jQuery('#x').trigger('click');
        return seen;
    `);
    t.check('nothing else about the node changes: its content, no initial content, its id and its classes',
        !!kept && kept.html === '<p>Mío</p>' && kept.id === 'x' && kept.lead, kept);

    var canceled = await page.eval(`
        start(${JSON.stringify(ONE)});
        jQuery('#myGrid').on('grideditor:before-convert.test', function(e) { e.preventDefault(); });
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        const first = { events: window.events.slice(), type: area.attr('data-ge-content-type') || null, started: window.fakeTinymce.started };
        area.trigger('click');
        return { first: first, second: window.events.slice() };
    `);
    t.check('a canceled before-convert leaves it plain, opens nothing, and the next click asks again',
        canceled.first.events.join(' ') === 'before-convert:plain' && canceled.first.type === null &&
        canceled.first.started === 0 && canceled.second.join(' ') === 'before-convert:plain before-convert:plain', canceled);

    var callback = await page.eval(`
        start(${JSON.stringify(ONE)}, { callbacks: { before_convert: function() { return false; } } });
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        return { events: window.events.slice(), type: area.attr('data-ge-content-type') || null, started: window.fakeTinymce.started };
    `);
    t.check('and so does a before_convert callback returning false',
        callback.events.join(' ') === 'before-convert:plain' && callback.type === null && callback.started === 0, callback);

    var missing = await page.eval(`
        start(${JSON.stringify(ONE)});
        window.tinymce = undefined;
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        const without = {
            events: window.events.slice(),
            type: area.attr('data-ge-content-type') || null,
            error: window.errorsLogged.some(function(e) { return /tinyMCE not available/.test(e); }),
        };
        window.tinymce = window.fakeTinymce;
        area.trigger('click');
        return { without: without, later: area.attr('data-ge-content-type'), attached: !!area.data('ge-tinymce') };
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
        const area = jQuery('#p2 .ge-content');
        area.trigger('click');
        return { areas: area.length, events: window.events.slice(), type: area.attr('data-ge-content-type') || null };
    `);
    t.check('plain content nobody can see - a tab that is not the open one - is left alone',
        hidden.areas === 1 && hidden.events.length === 0 && hidden.type === null, hidden);

    var saved = await page.eval(`
        start(${JSON.stringify(ONE)});
        jQuery('#col .ge-content').trigger('click');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        start(html);
        const block = jQuery('#col > .ge-text-block');
        return {
            saved: /data-ge-content-type="tinymce"/.test(html) && /ge-content-type-tinymce/.test(html),
            text: !block.hasClass('ge-plain-block') && toolsOf(block) === 'ge-move,ge-settings,ge-delete-text',
        };
    `);
    t.check('getHtml saves it as a text, and a text it is when the page comes back',
        saved.saved && saved.text, saved);

    var again = await page.eval(`
        start(${JSON.stringify(ONE)});
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        area.trigger('click');
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
        $.fn.gridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete $.fn.gridEditor.features.note;
        jQuery('#col .ge-content').trigger('click');
        const choices = jQuery('#col .ge-convert-picker > a');
        return {
            offered: choices.map(function() { return jQuery(this).text(); }).get(),
            titles: choices.map(function() { return jQuery(this).attr('title'); }).get(),
            events: window.events.slice(),
            type: jQuery('#col .ge-content').attr('data-ge-content-type') || null,
        };
    `);
    t.check('with several types offered a click offers them, the plugins\' in the order they were registered',
        offered.offered.join('|') === 'tinyMCE|Note' && offered.titles[1] === 'Edit as Note text', offered);
    t.check('and converts nothing until one is chosen',
        offered.events.length === 0 && offered.type === null, offered);

    var chosen = await page.eval(`
        jQuery('#col .ge-convert-picker > a').last().trigger('click');
        const area = jQuery('#col .ge-content');
        return {
            type: area.attr('data-ge-content-type'),
            events: window.events.slice(),
            to: window.payloads.map(function(p) { return p.to; }),
            edits: window.noteEdits.slice(),
            closed: jQuery('.ge-convert-picker').length === 0,
            orphan: area.parent().find('> .ge-tools-drawer > .ge-text-missing').length,
        };
    `);
    t.check('the one chosen converts it, through the events, and its plugin\'s edit takes it over',
        chosen.type === 'note' && chosen.events.join(' ') === 'before-convert:plain after-convert:plain' &&
        chosen.to.join(',') === 'note,note' && chosen.edits.join(',') === 'note:Mine' && chosen.closed, chosen);

    var tinymce = await page.eval(`
        $.fn.gridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete $.fn.gridEditor.features.note;
        jQuery('#col .ge-content').trigger('click');
        jQuery('#col .ge-convert-picker > a').first().trigger('click');
        return { type: jQuery('#col .ge-content').attr('data-ge-content-type'), started: window.fakeTinymce.started };
    `);
    t.check('choosing tinyMCE opens tinyMCE on it',
        tinymce.type === 'tinymce' && tinymce.started === 1, tinymce);

    var withdrawn = await page.eval(`
        $.fn.gridEditor.features.note = notePlugin('note', 'Note');
        start(${JSON.stringify(ONE)}, { plugins: window.fixture.plugins(['note']) });
        delete $.fn.gridEditor.features.note;
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        const open = jQuery('.ge-convert-picker').length;
        area.trigger('click');
        const afterClick = jQuery('.ge-convert-picker').length;
        area.trigger('click');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            open: open,
            afterClick: afterClick,
            afterGetHtml: jQuery('.ge-convert-picker').length,
            events: window.events.length,
            type: area.attr('data-ge-content-type') || null,
            typedInHtml: /data-ge-content-type/.test(html),
        };
    `);
    t.check('closed without a choice - another click, getHtml - nothing is converted and nothing announced',
        withdrawn.open === 1 && withdrawn.afterClick === 0 && withdrawn.afterGetHtml === 0 &&
        withdrawn.events === 0 && withdrawn.type === null && !withdrawn.typedInHtml, withdrawn);

    var owned = await page.eval(`
        $.fn.gridEditor.features.note = notePlugin('note', 'Note');
        start('<div class="row"><div class="col-12" id="col"><div class="ge-content" data-ge-content-type="note"><p>N</p></div></div></div>',
            { plugins: window.fixture.plugins(['note']) });
        delete $.fn.gridEditor.features.note;
        const block = jQuery('#col > .ge-text-block');
        return { missing: block.find('.ge-text-missing').length, plain: block.hasClass('ge-plain-block'), drawers: block.children('.ge-tools-drawer').length };
    `);
    t.check('a text of a type a plugin declares is that plugin\'s: the core gives it no drawer of its own',
        owned.missing === 0 && !owned.plain && owned.drawers === 0, owned);

    var twice = await page.eval(`
        window.warnings = [];
        $.fn.gridEditor.features.note = notePlugin('note', 'Note');
        $.fn.gridEditor.features.note2 = notePlugin('note', 'Another note');
        start(${JSON.stringify(ONE)}, { content_types: [], plugins: window.fixture.plugins(['note', 'note2']) });
        delete $.fn.gridEditor.features.note;
        delete $.fn.gridEditor.features.note2;
        const area = jQuery('#col .ge-content');
        area.trigger('click');
        jQuery('#myGrid').gridEditor('getHtml');
        return {
            picker: jQuery('.ge-convert-picker').length,
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
