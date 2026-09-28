/**
 * Browser tests for example/custom_editor.html: a text editor written as a
 * feature plugin of the page's own, on the core's textTypes hook, with none
 * of the shipped text editors loaded.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

module.exports = {
    name: 'customeditor',
    description: 'example/custom_editor.html, a text editor of the page\'s own',
    requiresNetwork: true,
    run: async function(t) {
        var page = await t.page('/example/custom_editor.html', `jQuery('#myGrid').data('grideditor')`);

        var before = await page.eval(`
            return {
                shipped: !!$.fn.gridEditor.features.text,
                plains: jQuery('#myGrid .ge-plain-block').length,
                ours: jQuery('#myGrid [data-ge-content-type="simpletext"]').parent().children('.ge-tools-drawer').children('a')
                    .map(function() { return jQuery(this).attr('class').split(' ')[0]; }).get().join(','),
                button: jQuery('.ge-mainControls [data-ge-feature="simpletext"]').attr('title'),
            };
        `);
        t.check('with no shipped text editor, the page\'s own declares its type: plain content, and its texts with its drawer',
            !before.shipped && before.plains === 1 && before.ours === 'ge-move,ge-delete-text' && before.button === 'Simple text', before);

        await page.click('#myGrid .ge-plain-block > .ge-content');
        await t.sleep(200);
        var edited = await page.eval(`
            const area = jQuery('#myGrid .ge-content').first();
            area.trigger('focus');
            document.execCommand('insertText', false, ' TYPED-HERE ');
            const html = jQuery('#myGrid').gridEditor('getHtml');
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
        t.check('example/custom_editor.html logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['customeditor']);
}
