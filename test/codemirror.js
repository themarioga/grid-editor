/**
 * Browser tests for example/codemirror.html: the source view in the real
 * CodeMirror 5, from its CDN. test/source.js has the offline ones.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

module.exports = {
    name: 'codemirror',
    description: 'example/codemirror.html, the source view in CodeMirror 5',
    requiresNetwork: true,
    run: async function(t) {
        var page = await t.page('/example/codemirror.html',
            `window.CodeMirror && jQuery('#myGrid').data('grideditor')`);

        await page.click('.gm-edit-mode');
        await t.sleep(300);
        var opened = await page.eval(`
            const wrapper = document.querySelector('.ge-code-editor');
            const editor = wrapper && wrapper.CodeMirror;
            return {
                editor: !!editor,
                holds: !!editor && /Edit me as html/.test(editor.getValue()),
                highlighted: !!wrapper && wrapper.querySelectorAll('.cm-tag').length > 0,
                lineNumbers: !!wrapper && wrapper.querySelectorAll('.CodeMirror-linenumber').length > 0,
                tall: !!wrapper && wrapper.getBoundingClientRect().height > 200,
            };
        `);
        t.check('the source button opens the canvas\'s html in CodeMirror, highlighted, with line numbers',
            opened.editor && opened.holds && opened.highlighted && opened.lineNumbers && opened.tall, opened);

        var closed = await page.eval(`
            const editor = document.querySelector('.ge-code-editor').CodeMirror;
            editor.setValue(editor.getValue().replace('Edit me as html', 'Edited in CodeMirror'));
            jQuery('.gm-edit-mode').trigger('click');
            return {
                canvas: jQuery('#myGrid h3').text(),
                gone: jQuery('.ge-code-editor').length === 0,
                editing: jQuery('#myGrid').hasClass('ge-editing'),
            };
        `);
        t.check('closing it brings the canvas back with what was written',
            closed.canvas === 'Edited in CodeMirror' && closed.gone && closed.editing, closed);

        var inline = await page.eval(`
            jQuery('#myGrid .ge-plain-block').first().children('.ge-tools-drawer').children('.ge-edit-html').trigger('click');
            await new Promise(function(r) { setTimeout(r, 200); });
            const wrapper = document.querySelector('#myGrid .ge-code-inline .ge-code-editor');
            const editor = wrapper && wrapper.CodeMirror;
            const opened = { editor: !!editor, holds: !!editor && /Edited in CodeMirror/.test(editor.getValue()) };
            editor.setValue(editor.getValue().replace('Edited in CodeMirror', 'Edited in place'));
            jQuery('#myGrid .ge-code-apply').trigger('click');
            opened.applied = jQuery('#myGrid h3').text();
            opened.closed = jQuery('#myGrid .ge-code-inline').length === 0;
            return opened;
        `);
        t.check('the </> tool opens a block\'s html in CodeMirror in place, and Apply puts it back',
            inline.editor && inline.holds && inline.applied === 'Edited in place' && inline.closed, inline);

        var off = await page.eval(`
            jQuery('#editSource').prop('checked', false).trigger('change');
            return jQuery('.ge-mainControls .gm-edit-mode').length;
        `);
        t.check('edit_source unchecked leaves the source button out', off === 0, off);

        var errors = page.errors([/version is not secure/]);
        t.check('example/codemirror.html logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['codemirror']);
}
