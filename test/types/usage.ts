/**
 * The public API's types, checked by `npm run test:types` (AC-28).
 *
 * Every line without an @ts-expect-error has to compile; every line with one
 * has to be an error, or tsc says the expectation is unused. So a type that
 * gets looser fails here as surely as one that gets wrong.
 */
import GridEditor, { GridEditorOptions, UtilityPayload } from '@themarioga/grid-editor';

const options: GridEditorOptions = {
    new_row_layouts: [[12], [6, 6], ['auto', 'equal'], { row_cols: { xs: 1, md: 3 }, columns: 6 }],
    content_types: ['tinymce'],
    plugins: ['tabs', 'elements'],
    settings_panel: 'modal',
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
};

const ge = new GridEditor('#myGrid', options);
const same: GridEditor | null = GridEditor.get(document.querySelector('#myGrid'));
GridEditor.create(document.body).destroy();

const html: string = ge.getHtml();
const plain: string = ge.getPlainHtml();
ge.changeView('md').reset().init();

const row: HTMLElement | null = ge.createRow([8, 4], { appendTo: ge.canvas });
ge.createColumn('equal', { appendTo: '#myGrid .row', content: '<p>Text</p>' });
ge.createText({ content: '<p>Hi</p>', appendTo: '#col' });
const tabs = ge.createContainer('tabs', { appendTo: '#col' });
ge.createContainer('tabs', { variant: 'underline', width: 'fill', vertical: 'xl' });
if (tabs) { ge.addTab(tabs, { label: 'More' }); }
const changed: boolean = ge.setUtility('#col', 'order', 2, 'md');
const value: string | null = ge.getUtility('#col', 'order');

ge.canvas.addEventListener('grideditor:before-delete', function(event) {
    if (event.detail.node.classList.contains('locked')) { event.preventDefault(); }
});
ge.canvas.addEventListener('grideditor:after-utility', function(event) {
    const payload: UtilityPayload = event.detail;
    payload.family.toUpperCase();
});

GridEditor.Sortable = {};
GridEditor.bootstrap = { Modal: function() {} };
GridEditor.containers.carousel = function() { return { labelKey: 'carousel.add' }; };

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
// @ts-expect-error the style plugin has no such section
new GridEditor('#myGrid', { style: { sections: { colours: true } } });
// @ts-expect-error an unknown callback name is a mistake
const wrong: GridEditorOptions = { callbacks: { before_add_rows: function() {} } };

export { html, plain, row, same, changed, value, wrong };
