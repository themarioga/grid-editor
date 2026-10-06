/**
 * The public API's types, checked by `npm run test:types` (AC-28).
 *
 * Every line without an @ts-expect-error has to compile; every line with one
 * has to be an error, or tsc says the expectation is unused. So a type that
 * gets looser fails here as surely as one that gets wrong.
 */
import GridEditor, { AutosaveDraft, CarouselOptions, AutosavePayload, GridEditorOptions, TargetChangePayload, UtilityPayload } from '@themarioga/grid-editor';

const options: GridEditorOptions = {
    new_row_layouts: [[12], [6, 6], ['auto', 'equal'], { row_cols: { xs: 1, md: 3 }, columns: 6 }],
    content_types: ['tinymce'],
    plugins: ['tabs', 'elements'],
    settings_panel: 'modal',
    active_target: true,
    toolbar_groups: true,
    elements: { types: [{ type: 'quote', label: 'Quote', html: '<blockquote></blockquote>' }, { type: 'figure', labelKey: 'element.figure', group: 'media', html: function() { return document.createElement('figure'); } }] },
    resize: { enabled: true, tools: false, handles: 'e, w', balance: false },
    indent: { tools: false },
    row_tools: [{ title: 'Mine', on: function(event) { event.preventDefault(); this.classList.add('x'); } }],
    custom_filter: function(canvas, isInit) { canvas.classList.toggle('filtered', isInit); },
    callbacks: {
        before_add_row: function(payload) { return payload.node.classList.contains('row'); },
        after_utility: function(payload) { payload.tiers.forEach(function(tier) { tier.toUpperCase(); }); },
    },
    tinymce: { config: { toolbar: 'bold italic' } },
    style: {
        sections: { border: { properties: ['border-width'], catalog: false }, position: false, flex: { catalog: false } },
        spacing: { values: ['0', '2', '4'] },
        visibility: { drawer: false },
    },
    tabs: { variant: 'pills', vertical: 'md' },
    autosave: { enabled: true, storage: 'session', key: 'page-42', delay: 500, maxAge: null },
};

const ge = new GridEditor('#myGrid', options);
const same: GridEditor | null = GridEditor.get(document.querySelector('#myGrid'));
GridEditor.create(document.body).destroy();

const html: string = ge.getHtml();
const plain: string = ge.getPlainHtml();
const kept: string = ge.getHtml({ keepEditing: true });
ge.getPlainHtml({ keepEditing: true });

// The autosave plugin's, there when it is loaded
if (ge.enableAutosave) {
    const on: boolean = ge.enableAutosave();
    const draft: AutosaveDraft | null = ge.getDraft ? ge.getDraft() : null;
    if (draft) { draft.html.length; }
}
ge.canvas.addEventListener('grideditor:after-autosave', function(event) {
    const payload: AutosavePayload = event.detail;
    payload.source === 'pagehide';
});
// @ts-expect-error: the storage is local or session
const wrongStorage: GridEditorOptions = { autosave: { storage: 'indexeddb' } };
ge.changeView('md').reset().init();

const row: HTMLElement | null = ge.createRow([8, 4], { appendTo: ge.canvas });
ge.createColumn('equal', { appendTo: '#myGrid .row', content: '<p>Text</p>' });
ge.createText({ content: '<p>Hi</p>', appendTo: '#col' });
const tabs = ge.createContainer('tabs', { appendTo: '#col' });
ge.createContainer('tabs', { variant: 'underline', width: 'fill', vertical: 'xl' });
if (tabs) { ge.addTab(tabs, { label: 'More' }); }
const changed: boolean = ge.setUtility('#col', 'order', 2, 'md');
const value: string | null = ge.getUtility('#col', 'order');
const active: HTMLElement | null = ge.getActiveTarget();
ge.setActiveTarget('#col').setActiveTarget(active).setActiveTarget(null);
ge.canvas.addEventListener('grideditor:target-change', function(event) {
    const payload: TargetChangePayload = event.detail;
    if (payload.target) { payload.target.classList.contains('column'); }
});

ge.canvas.addEventListener('grideditor:before-delete', function(event) {
    if (event.detail.node.classList.contains('locked')) { event.preventDefault(); }
});
ge.canvas.addEventListener('grideditor:after-utility', function(event) {
    const payload: UtilityPayload = event.detail;
    payload.family.toUpperCase();
});

GridEditor.Sortable = {};
GridEditor.bootstrap = { Modal: function() {} };
GridEditor.containers.gallery = function() { return { labelKey: 'gallery.add' }; };

const carousel = ge.createContainer('carousel', { slides: 3, fade: true, ride: 'carousel', interval: 4000, controls: false });
if (carousel) { ge.addPane(carousel, { interval: 8000 }); }
new GridEditor('#other', { carousel: { dark: true, ride: 'true', pause: false }, carousel_tools: [] });
// @ts-expect-error ride is false, 'carousel' or 'true'
const autoplay: CarouselOptions = { ride: 'always' };

// @ts-expect-error a view is a breakpoint key or 'all'
ge.changeView('huge');
// @ts-expect-error createRow takes sizes, not a string
ge.createRow('8,4');
// @ts-expect-error there is no remove since 7.0: destroy()
ge.remove();
// @ts-expect-error the settings are read only
ge.settings.locale = 'es';
// @ts-expect-error a setting takes its own values
new GridEditor('#myGrid', { settings_panel: 'window' });
// @ts-expect-error the inline-style plugin has no such section
new GridEditor('#myGrid', { inline_style: { sections: { colours: true } } });
// @ts-expect-error an unknown callback name is a mistake
const wrong: GridEditorOptions = { callbacks: { before_add_rows: function() {} } };

export { html, plain, row, same, changed, value, wrong };
