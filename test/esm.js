/**
 * Browser tests for the ES module build: imported, with nothing on window,
 * a plugin registered by importing it, and SortableJS handed over by the app.
 *
 * Spec remove-jquery: AC-14, AC-15 and AC-41.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

async function run(t) {
    var bare = await t.page('/test/fixtures/esm.html', `window.ready`);

    var core = await bare.eval(`
        const ge = await window.start(false);
        return {
            global: typeof window.GridEditor,
            jquery: typeof window.jQuery,
            sortableGlobal: typeof window.Sortable,
            instance: ge instanceof window.ModuleEditor,
            rows: document.querySelectorAll('#myGrid > .row > .ge-tools-drawer').length,
            containers: document.querySelectorAll('.ge-add-container').length,
            added: ge.createRow([6, 6], { appendTo: '#myGrid' }) instanceof HTMLElement,
            sortable: !!window.SortableModule.get(document.querySelector('#myGrid .row')),
        };
    `);
    t.check('the ES module build edits rows and columns with nothing on window, and no plugin offers nothing more',
        core.global === 'undefined' && core.jquery === 'undefined' && core.instance && core.rows === 1 &&
        core.containers === 0 && core.added, core);
    t.check('SortableJS handed over as GridEditor.Sortable is the one used, with no window.Sortable',
        core.sortableGlobal === 'undefined' && core.sortable, core);
    t.check('the ES module page logged no errors', bare.errors().length === 0, bare.errors().slice(0, 5));

    var withTabs = await t.page('/test/fixtures/esm.html', `window.ready`);

    var tabs = await withTabs.eval(`
        const ge = await window.start(true);
        const button = document.querySelector('.ge-add-container[data-ge-container-type="tabs"]');
        const made = ge.createContainer('tabs', { appendTo: '#myGrid .column' });
        return {
            registered: typeof window.ModuleEditor.containers.tabs,
            button: !!button,
            made: made instanceof HTMLElement && made.getAttribute('data-ge-container') === 'tabs',
            global: typeof window.GridEditor,
        };
    `);
    t.check('importing a plugin module registers it: the tabs container is offered, as with the classic script',
        tabs.registered === 'function' && tabs.button && tabs.made && tabs.global === 'undefined', tabs);
    t.check('the ES module page with a plugin logged no errors', withTabs.errors().length === 0, withTabs.errors().slice(0, 5));
}

module.exports = {
    name: 'esm',
    description: 'the ES module build: imported, a plugin registered on import, SortableJS handed over',
    run: run,
};

if (require.main === module) {
    require('./run').main(['esm']);
}
