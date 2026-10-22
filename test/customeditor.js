/**
 * Browser tests for example/text-editors.html?editor=simpletext: a text
 * editor written as a feature plugin of the page's own, on the core's
 * textTypes hook, with none of the shipped text editors offered.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

module.exports = {
    name: 'customeditor',
    description: 'example/text-editors.html, a text editor of the page\'s own',
    requiresNetwork: true,
    run: async function(t) {
        var page = await t.page('/example/text-editors.html?editor=simpletext', `window.GridEditor && GridEditor.get('#myGrid')`);

        var before = await page.eval(`
            return {
                shipped: GridEditor.get('#myGrid').settings.content_types.length,
                plains: document.querySelectorAll('#myGrid .ge-plain-block').length,
                ours: Array.from(document.querySelector('#myGrid [data-ge-content-type="simpletext"]').parentElement
                    .querySelectorAll(':scope > .ge-tools-drawer > a'), function(a) { return a.getAttribute('class').split(' ')[0]; }).join(','),
                button: document.querySelector('.ge-mainControls [data-ge-feature="simpletext"]').getAttribute('title'),
            };
        `);
        t.check('with no shipped text editor offered, the page\'s own declares its type: plain content, and its texts with its drawer',
            !before.shipped && before.plains === 1 && before.ours === 'ge-move,ge-delete-text' && before.button === 'Simple text', before);

        await page.click('#myGrid .ge-plain-block > .ge-content');
        await t.sleep(200);
        var edited = await page.eval(`
            document.querySelector('#myGrid .ge-content').focus();
            document.execCommand('insertText', false, ' TYPED-HERE ');
            const html = GridEditor.get('#myGrid').getHtml();
            const root = document.createElement('div');
            root.innerHTML = html;
            const first = root.querySelector('.ge-content');
            return {
                type: first.getAttribute('data-ge-content-type'),
                typed: first.textContent.indexOf('TYPED-HERE') !== -1,
                clean: !/contenteditable|ge-rte-active|ge-text-block|ge-tools-drawer/.test(html),
            };
        `);
        t.check('a click makes the plain content a text of that editor, and getHtml saves it with its type and what was typed',
            edited.type === 'simpletext' && edited.typed && edited.clean, edited);

        var errors = page.errors();
        t.check('example/text-editors.html?editor=simpletext logged no errors', errors.length === 0, errors.slice(0, 5));

        // All together: a Text button per shipped editor and the page's own, and
        // each saved text opens with the editor it was saved with
        var all = await t.page('/example/text-editors.html?editor=all',
            `window.tinymce && window.CKEDITOR && window.jQuery && jQuery.fn.summernote && GridEditor.get('#myGrid')`);
        var together = await all.eval(`
            return {
                offered: GridEditor.get('#myGrid').settings.content_types.join(','),
                buttons: document.querySelectorAll('.ge-mainControls .ge-add-text-button, .ge-mainControls [data-ge-feature="simpletext"]').length,
                texts: Array.from(document.querySelectorAll('#myGrid .ge-text-block > .ge-content[data-ge-content-type]'), function(a) {
                    return a.getAttribute('data-ge-content-type');
                }).join(','),
            };
        `);
        var allErrors = all.errors();
        t.check('all together: the three shipped editors and the page\'s own, a Text button each, and no errors',
            together.offered === 'tinymce,ckeditor,summernote' && together.buttons === 4 &&
            together.texts === 'tinymce,ckeditor,summernote,simpletext' && allErrors.length === 0,
            Object.assign(together, { errors: allErrors.slice(0, 5) }));
    },
};

if (require.main === module) {
    require('./run').main(['customeditor']);
}
