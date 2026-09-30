/**
 * Browser tests for the codemirror-inline plugin: a </> tool in each block's
 * drawer, the block's html edited where the block was, and Apply putting what
 * was written in its place, through the edit-html events.
 *
 * Offline, on the fixture, with a stand-in for CodeMirror that has only what
 * the plugin calls; test/codemirror.js drives the real one.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.fakeCodeMirror = {
        made: [],
        fromTextArea: function(textarea, options) {
            const wrapper = document.createElement('div');
            textarea.parentNode.insertBefore(wrapper, textarea.nextSibling);
            textarea.style.display = 'none';
            const editor = {
                options: options,
                value: textarea.value,
                getWrapperElement: function() { return wrapper; },
                focus: function() {},
                refresh: function() { editor.refreshed = (editor.refreshed || 0) + 1; },
                getValue: function() { return editor.value; },
                setValue: function(value) { editor.value = value; },
                toTextArea: function() { wrapper.remove(); textarea.style.display = ''; editor.gone = true; },
            };
            window.fakeCodeMirror.made.push(editor);
            return editor;
        },
    };
    window.CodeMirror = window.fakeCodeMirror;

    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.kids = function(node, selector) {
        return node ? Array.from(node.children).filter(function(child) { return !selector || child.matches(selector); }) : [];
    };
    window.visible = function(node) { return !!node && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length); };
    /** Whether the element just before node matches the selector. */
    window.afterOne = function(node, selector) {
        return !!node && !!node.previousElementSibling && node.previousElementSibling.matches(selector);
    };
    window.press = function(selector) { qa(selector).forEach(function(node) { node.click(); }); };

    window.events = [];
    window.listening = [];
    window.listen = function(name, handler) {
        q('#myGrid').addEventListener(name, handler);
        window.listening.push([name, handler]);
    };
    window.start = function(html, settings) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        q('#myGrid').innerHTML = html;
        window.events = [];
        window.fakeCodeMirror.made = [];
        window.listening.forEach(function(entry) { q('#myGrid').removeEventListener(entry[0], entry[1]); });
        window.listening = [];
        ['before-edit-html', 'after-edit-html'].forEach(function(name) {
            listen('grideditor:' + name, function(e) {
                const payload = e.detail;
                window.events.push({ type: e.type.replace('grideditor:', ''), kind: payload.kind, source: payload.source,
                    from: payload.from, to: payload.to, node: payload.nodes ? payload.nodes.length : (payload.node ? 1 : 0) });
            });
        });
        return window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            confirm_delete: false,
            plugins: window.fixture.plugins(['codemirror-inline', 'sections', 'clipboard', 'inline-style']),
        }, settings || {}));
    };

    window.hasTool = function(node) {
        node = typeof node === 'string' ? q(node) : node;
        return kids(kids(node, '.ge-tools-drawer')[0], '.ge-edit-html').length;
    };
    return true;
`;

var CANVAS = '<div class="container" id="section"><div class="row" id="row">' +
    '<div class="col-6" id="col">' +
        '<p>Plain</p>' +
        '<div class="ge-content" data-ge-content-type="tinymce" id="text"><p>Text</p></div>' +
        '<blockquote data-ge-element="quote" id="element">Quote</blockquote>' +
    '</div>' +
    '<div class="col-6" id="other"><div data-ge-container="tabs"><ul class="nav nav-tabs">' +
        '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' +
        '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="col-12"><p>In the tab</p></div></div></div></div>' +
    '</div></div></div></div>';

async function toolTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var tools = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        return {
            row: hasTool('#row'),
            column: hasTool('#col'),
            section: hasTool('#section'),
            element: hasTool('#element'),
            container: hasTool('#myGrid [data-ge-container="tabs"]'),
            text: hasTool(q('#text').parentElement.matches('.ge-text-block') ? q('#text').parentElement : null),
            plain: qa('#col > .ge-plain-block > .ge-tools-drawer > a').map(function(tool) {
                return tool.getAttribute('class').split(' ')[0];
            }).join(','),
            panes: qa('#myGrid .ge-pane-drawer .ge-edit-html').length + qa('#myGrid .ge-tab .ge-edit-html').length,
        };
    `);
    t.check('rows, columns, sections, elements, containers and texts have the </> tool; panes do not',
        tools.row === 1 && tools.column === 1 && tools.section === 1 && tools.element === 1 &&
        tools.container === 1 && tools.text === 1 && tools.panes === 0, tools);
    t.check('plain content has it too, between move and delete, and still nothing else',
        tools.plain === 'ge-move,ge-edit-html,ge-delete-plain', tools);

    var without = await page.eval(`
        start(${JSON.stringify(CANVAS)}, { plugins: window.fixture.plugins(['sections']) });
        return qa('#myGrid .ge-edit-html').length;
    `);
    t.check('without the plugin there is no </> tool anywhere', without === 0, without);

    var errors = page.errors();
    t.check('the tool tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function editTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var opened = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        press('#element > .ge-tools-drawer > .ge-edit-html');
        const editor = window.fakeCodeMirror.made[0];
        const wrapper = q('#myGrid .ge-code-inline');
        return {
            made: window.fakeCodeMirror.made.length,
            value: editor && editor.value,
            mode: editor && editor.options.mode,
            hidden: !visible(q('#element')),
            where: afterOne(wrapper, '#element'),
            buttons: wrapper ? wrapper.querySelectorAll('.ge-code-apply, .ge-code-cancel').length : 0,
        };
    `);
    t.check('the </> tool opens the block\'s html - the block itself, as getHtml gives it - in CodeMirror where the block was',
        opened.made === 1 && opened.value === '<blockquote data-ge-element="quote" id="element">Quote</blockquote>' &&
        opened.mode === 'htmlmixed' && opened.hidden && opened.where && opened.buttons === 2, opened);

    var clean = await page.eval(`
        const html = window.fixture.editor().getHtml();
        const editor = window.fakeCodeMirror.made[0];
        return {
            marks: /ge-code-inline|ge-code-hidden|ge-code-editor/.test(html),
            element: /<blockquote data-ge-element="quote" id="element">Quote<\\/blockquote>/.test(html),
            stillOpen: afterOne(q('#myGrid .ge-code-inline'), '#element') && !visible(q('#element')),
            refreshed: editor.refreshed > 0,
            gone: !!editor.gone,
        };
    `);
    t.check('getHtml while it is open has none of it, and the editor is back in place afterwards, what it held kept',
        !clean.marks && clean.element && clean.stillOpen && clean.refreshed && !clean.gone, clean);

    var applied = await page.eval(`
        const editor = window.fakeCodeMirror.made[0];
        editor.setValue('<blockquote data-ge-element="quote" id="element" class="changed">Changed</blockquote><p>And a paragraph</p>');
        press('#myGrid .ge-code-apply');
        const element = q('#element');
        return {
            changed: element.classList.contains('changed') && element.textContent.indexOf('Changed') !== -1,
            marked: element.classList.contains('ge-element') && kids(element, '.ge-tools-drawer').length === 1,
            paragraph: q('#col').textContent.indexOf('And a paragraph') !== -1,
            closed: qa('#myGrid .ge-code-inline').length === 0 && !!editor.gone,
            events: window.events.map(function(e) { return e.type + ':' + e.kind + ':' + e.source; }),
            to: window.events[0] && /Changed/.test(window.events[0].to) && /Quote/.test(window.events[0].from),
            afterNodes: window.events[1] && window.events[1].node,
        };
    `);
    t.check('Apply puts what was written in the block\'s place, read as the editor reads any markup',
        applied.changed && applied.marked && applied.paragraph && applied.closed, applied);
    t.check('announced as before-edit-html and after-edit-html, of the block\'s kind, from and to',
        applied.events.join(' ') === 'before-edit-html:element:tool after-edit-html:element:tool' &&
        applied.to && applied.afterNodes === 2, applied);

    var canceled = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        listen('grideditor:before-edit-html', function(e) { e.preventDefault(); });
        press('#row > .ge-tools-drawer > .ge-edit-html');
        window.fakeCodeMirror.made[0].setValue('<p>Nothing left</p>');
        press('#myGrid .ge-code-apply');
        return {
            row: qa('#row').length,
            open: qa('#myGrid .ge-code-inline').length,
            events: window.events.map(function(e) { return e.type; }),
        };
    `);
    t.check('a canceled before-edit-html changes nothing and leaves the editor open with what was written',
        canceled.row === 1 && canceled.open === 1 && canceled.events.join(' ') === 'before-edit-html', canceled);

    var cancel = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        press('#col > .ge-tools-drawer > .ge-edit-html');
        window.fakeCodeMirror.made[0].setValue('<p>Not kept</p>');
        press('#myGrid .ge-code-cancel');
        return {
            visible: visible(q('#col')),
            kept: q('#col').textContent.indexOf('Not kept') === -1,
            closed: qa('#myGrid .ge-code-inline').length === 0,
            events: window.events.length,
        };
    `);
    t.check('Cancel closes it and leaves the block as it was, with nothing announced',
        cancel.visible && cancel.kept && cancel.closed && cancel.events === 0, cancel);

    var plain = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        press('#col > .ge-plain-block > .ge-tools-drawer > .ge-edit-html');
        const editor = window.fakeCodeMirror.made[0];
        const value = editor.value;
        const where = afterOne(q('#myGrid .ge-code-inline'), '.ge-plain-block');
        editor.setValue('<div class="ge-content"><p>Plain, edited</p></div>');
        press('#myGrid .ge-code-apply');
        const edited = q('#col > .ge-plain-block');
        return {
            value: value,
            where: where,
            edited: kids(edited, '.ge-content').map(function(area) { return area.textContent; }).join(''),
            kind: window.events[0] && window.events[0].kind,
        };
    `);
    t.check('plain content\'s html is edited the same way, announced as plain',
        plain.value === '<div class="ge-content"><p>Plain</p></div>' && plain.where &&
        plain.edited === 'Plain, edited' && plain.kind === 'plain', plain);

    var text = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        kids(kids(q('#text').parentElement, '.ge-tools-drawer')[0], '.ge-edit-html').forEach(function(tool) { tool.click(); });
        return {
            value: window.fakeCodeMirror.made[0].value,
            hidden: !visible(q('#text').parentElement.matches('.ge-text-block') ? q('#text').parentElement : null),
            where: afterOne(q('#myGrid .ge-code-inline'), '.ge-text-block'),
        };
    `);
    t.check('a text\'s html is its content area, typed; its text block is hidden behind the editor',
        text.value === '<div class="ge-content" data-ge-content-type="tinymce" id="text"><p>Text</p></div>' &&
        text.hidden && text.where, text);

    var gone = await page.eval(`
        start(${JSON.stringify(CANVAS)});
        press('#element > .ge-tools-drawer > .ge-edit-html');
        press('#row > .ge-tools-drawer > .ge-edit-html');
        window.fakeCodeMirror.made[1].setValue('<div class="row" id="row"><div class="col-12"><p>Replaced</p></div></div>');
        const inline = qa('#myGrid .ge-code-inline');
        inline[inline.length - 1].querySelectorAll('.ge-code-apply').forEach(function(button) { button.click(); });
        return {
            replaced: q('#row').textContent.indexOf('Replaced') !== -1,
            editors: qa('#myGrid .ge-code-inline').length,
            innerGone: !!window.fakeCodeMirror.made[0].gone,
        };
    `);
    t.check('an editor open inside a block whose html is applied goes with the block',
        gone.replaced && gone.editors === 0 && gone.innerGone, gone);

    var bare = await page.eval(`
        window.CodeMirror = undefined;
        start(${JSON.stringify(CANVAS)});
        press('#element > .ge-tools-drawer > .ge-edit-html');
        const textarea = q('#myGrid .ge-code-inline > .ge-code-inline-source');
        const state = { textarea: visible(textarea), value: textarea.value };
        textarea.value = '<blockquote data-ge-element="quote" id="element">From the textarea</blockquote>';
        press('#myGrid .ge-code-apply');
        state.applied = q('#element').textContent.indexOf('From the textarea') !== -1;
        window.CodeMirror = window.fakeCodeMirror;
        return state;
    `);
    t.check('without CodeMirror the html is edited in a textarea, the same way',
        bare.textarea && /Quote/.test(bare.value) && bare.applied, bare);

    var errors = page.errors();
    t.check('the editing tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'codeinline',
    description: 'the codemirror-inline plugin: a block\'s html, edited in place',
    run: async function(t) {
        await toolTests(t);
        await editTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['codeinline']);
}
