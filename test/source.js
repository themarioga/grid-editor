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
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html('<div class="row"><div class="col-12"><p>Before</p></div></div>');
        window.fixture.init(settings || {});
        return jQuery('#myGrid').data('grideditor');
    };
    return true;
`;

async function buttonTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var shown = await page.eval(`
        start();
        return {
            byDefault: jQuery('.ge-mainControls .gm-edit-mode').length,
            preview: jQuery('.ge-mainControls .gm-preview').length,
        };
    `);
    t.check('the source button is in the toolbar by default', shown.byDefault === 1 && shown.preview === 1, shown);

    var hidden = await page.eval(`
        const ge = start({ edit_source: false });
        return {
            button: jQuery('.ge-mainControls .gm-edit-mode').length,
            preview: jQuery('.ge-mainControls .gm-preview').length,
            setting: ge.settings.edit_source,
        };
    `);
    t.check('edit_source: false leaves it out, and the preview button in',
        hidden.button === 0 && hidden.preview === 1 && hidden.setting === false, hidden);

    var relocaled = await page.eval(`
        start();
        jQuery('.gm-edit-mode').trigger('click');
        jQuery('#myGrid').gridEditor('setLocale', 'en');
        const state = { active: jQuery('.gm-edit-mode').hasClass('active'), canvasHidden: !jQuery('#myGrid').is(':visible') };
        jQuery('.gm-edit-mode').trigger('click');
        state.back = jQuery('#myGrid').is(':visible') && jQuery('#myGrid').hasClass('ge-editing');
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
        jQuery('.gm-edit-mode').trigger('click');
        const editor = window.fakeCodeMirror.made[0];
        return {
            made: window.fakeCodeMirror.made.length,
            holds: !!editor && /Before/.test(editor.value),
            mode: editor && editor.options.mode,
            theme: editor && editor.options.theme,
            lineNumbers: editor && editor.options.lineNumbers,
            sized: !!editor && editor.size > 0,
            wrapper: jQuery('.ge-code-editor').length,
            textareaHidden: jQuery('.ge-html-output').css('display') === 'none',
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
        jQuery('.gm-edit-mode').trigger('click');
        return {
            canvas: jQuery('#myGrid').text().indexOf('Written in CodeMirror') !== -1,
            editing: jQuery('#myGrid').hasClass('ge-editing') && jQuery('#myGrid').is(':visible'),
            gone: editor.gone === true && jQuery('.ge-code-editor').length === 0,
            textareaHidden: jQuery('.ge-html-output').css('display') === 'none',
        };
    `);
    t.check('closing it makes the canvas of what was written in CodeMirror, and CodeMirror goes',
        closed.canvas && closed.editing && closed.gone && closed.textareaHidden, closed);

    var destroyed = await page.eval(`
        jQuery('.gm-edit-mode').trigger('click');
        const editor = window.fakeCodeMirror.made[1];
        editor.setValue('<div class="row"><div class="col-12"><p>Kept on destroy</p></div></div>');
        jQuery('#myGrid').gridEditor('destroy');
        return {
            kept: jQuery('#myGrid').text().indexOf('Kept on destroy') !== -1,
            visible: jQuery('#myGrid').is(':visible'),
            gone: jQuery('.ge-code-editor').length === 0 && jQuery('.ge-html-output').length === 0,
        };
    `);
    t.check('destroy with the source open leaves the canvas with what was being written, and no editor behind',
        destroyed.kept && destroyed.visible && destroyed.gone, destroyed);

    var missing = await page.eval(`
        window.CodeMirror = undefined;
        window.warnings = [];
        start({ plugins: window.fixture.plugins(['codemirror']) });
        jQuery('.gm-edit-mode').trigger('click');
        const state = {
            textarea: jQuery('.ge-html-output').is(':visible') && /Before/.test(jQuery('.ge-html-output').val()),
            warned: window.warnings.filter(function(w) { return /CodeMirror not available/.test(w); }).length,
        };
        jQuery('.gm-edit-mode').trigger('click');
        jQuery('.gm-edit-mode').trigger('click');
        state.warnedOnce = window.warnings.filter(function(w) { return /CodeMirror not available/.test(w); }).length;
        jQuery('.gm-edit-mode').trigger('click');
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
