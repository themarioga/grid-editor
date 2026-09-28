/**
 * Browser tests for the source view: the toolbar's button that edits the
 * canvas as html, the edit_source setting that leaves it out, and the
 * onSourceOpen / onSourceClose hooks the codemirror plugin is made of.
 *
 * Offline, on the fixture, with a stand-in for CodeMirror that has only what
 * the plugin calls; the real one is test/codemirror.js's business.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    // Enough of CodeMirror 5 for the plugin: an editor over a textarea that
    // holds its own copy of the value until save() puts it back
    window.fakeCodeMirror = {
        made: [],
        fromTextArea: function(textarea, options) {
            const wrapper = document.createElement('div');
            textarea.parentNode.insertBefore(wrapper, textarea.nextSibling);
            textarea.style.display = 'none';
            const editor = {
                options: options,
                value: textarea.value,
                size: null,
                getWrapperElement: function() { return wrapper; },
                setSize: function(width, height) { editor.size = height; },
                focus: function() {},
                setValue: function(value) { editor.value = value; },
                save: function() { textarea.value = editor.value; },
                toTextArea: function() { wrapper.remove(); textarea.style.display = ''; editor.gone = true; },
            };
            window.fakeCodeMirror.made.push(editor);
            return editor;
        },
    };

    window.start = function(settings) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="col-12"><p>Before</p></div></div>';
        return window.fixture.init(settings || {});
    };

    window.q = function(selector) { return document.querySelector(selector); };
    window.count = function(selector) { return document.querySelectorAll(selector).length; };
    window.shown = function(node) { return !!node && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length); };
    /** The toolbar's source button, clicked. */
    window.source = function() { q('.gm-edit-mode').click(); };
    return true;
`;

async function buttonTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var shown = await page.eval(`
        start();
        return {
            byDefault: count('.ge-mainControls .gm-edit-mode'),
            preview: count('.ge-mainControls .gm-preview'),
        };
    `);
    t.check('the source button is in the toolbar by default', shown.byDefault === 1 && shown.preview === 1, shown);

    var hidden = await page.eval(`
        const ge = start({ edit_source: false });
        return {
            button: count('.ge-mainControls .gm-edit-mode'),
            preview: count('.ge-mainControls .gm-preview'),
            setting: ge.settings.edit_source,
        };
    `);
    t.check('edit_source: false leaves it out, and the preview button in',
        hidden.button === 0 && hidden.preview === 1 && hidden.setting === false, hidden);

    var relocaled = await page.eval(`
        start();
        source();
        window.fixture.editor().setLocale('en');
        const state = { active: q('.gm-edit-mode').classList.contains('active'), canvasHidden: !shown(q('#myGrid')) };
        source();
        state.back = shown(q('#myGrid')) && q('#myGrid').classList.contains('ge-editing');
        return state;
    `);
    t.check('the toolbar built again with the source open says it is open, and closes it',
        relocaled.active && relocaled.back, relocaled);

    var errors = page.errors();
    t.check('the source button tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function codemirrorTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var opened = await page.eval(`
        window.CodeMirror = window.fakeCodeMirror;
        start({ plugins: window.fixture.plugins(['codemirror']), codemirror: { config: { theme: 'dark', lineNumbers: false } } });
        source();
        const editor = window.fakeCodeMirror.made[0];
        return {
            made: window.fakeCodeMirror.made.length,
            holds: !!editor && /Before/.test(editor.value),
            mode: editor && editor.options.mode,
            theme: editor && editor.options.theme,
            lineNumbers: editor && editor.options.lineNumbers,
            sized: !!editor && editor.size > 0,
            wrapper: count('.ge-code-editor'),
            textareaHidden: getComputedStyle(q('.ge-html-output')).display === 'none',
        };
    `);
    t.check('with the codemirror plugin the source opens in CodeMirror, holding the canvas\'s html, as tall as the textarea',
        opened.made === 1 && opened.holds && opened.mode === 'htmlmixed' && opened.sized &&
        opened.wrapper === 1 && opened.textareaHidden, opened);
    t.check('codemirror.config goes over the plugin\'s defaults',
        opened.theme === 'dark' && opened.lineNumbers === false, opened);

    var closed = await page.eval(`
        const editor = window.fakeCodeMirror.made[0];
        editor.setValue('<div class="row"><div class="col-12"><p>Written in CodeMirror</p></div></div>');
        source();
        return {
            canvas: q('#myGrid').textContent.indexOf('Written in CodeMirror') !== -1,
            editing: q('#myGrid').classList.contains('ge-editing') && shown(q('#myGrid')),
            gone: editor.gone === true && count('.ge-code-editor') === 0,
            textareaHidden: getComputedStyle(q('.ge-html-output')).display === 'none',
        };
    `);
    t.check('closing it makes the canvas of what was written in CodeMirror, and CodeMirror goes',
        closed.canvas && closed.editing && closed.gone && closed.textareaHidden, closed);

    var destroyed = await page.eval(`
        source();
        const editor = window.fakeCodeMirror.made[1];
        editor.setValue('<div class="row"><div class="col-12"><p>Kept on destroy</p></div></div>');
        window.fixture.editor().destroy();
        return {
            kept: q('#myGrid').textContent.indexOf('Kept on destroy') !== -1,
            visible: shown(q('#myGrid')),
            gone: count('.ge-code-editor') === 0 && count('.ge-html-output') === 0,
        };
    `);
    t.check('destroy with the source open leaves the canvas with what was being written, and no editor behind',
        destroyed.kept && destroyed.visible && destroyed.gone, destroyed);

    var missing = await page.eval(`
        window.CodeMirror = undefined;
        window.warnings = [];
        start({ plugins: window.fixture.plugins(['codemirror']) });
        source();
        const state = {
            textarea: shown(q('.ge-html-output')) && /Before/.test(q('.ge-html-output').value),
            warned: window.warnings.filter(function(w) { return /CodeMirror not available/.test(w); }).length,
        };
        source();
        source();
        state.warnedOnce = window.warnings.filter(function(w) { return /CodeMirror not available/.test(w); }).length;
        source();
        return state;
    `);
    t.check('without CodeMirror the source is the textarea, as before, and the console says so once',
        missing.textarea && missing.warned === 1 && missing.warnedOnce === 1, missing);

    var errors = page.errors();
    t.check('the codemirror tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'source',
    description: 'the source button, edit_source, and the codemirror plugin\'s hooks',
    run: async function(t) {
        await buttonTests(t);
        await codemirrorTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['source']);
}
