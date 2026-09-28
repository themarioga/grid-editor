/**
 * Cards for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a card, a bootstrap card whose body is an editable region. What it can ask
 * the editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.card.min.js"></script>
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'container.add_card': 'Card',
    'container.card_title': 'Card title',
    'container.card_footer': 'Card footer',
});

GridEditor.containers.card = function(ge) {

    /** A header's or a footer's text, editable in place, when the card has one. */
    function editable(part) {
        if (part) { ge.makeLabelEditable(ge.labelIn(part)); }
    }

    return {
        labelKey: 'container.add_card',

        /**
         * A card is a header, a body and an optional footer. `header: false`
         * leaves the title out, `footer: true` or a string adds one; both are
         * plain text the editor makes editable, not regions, so a card holds
         * exactly one region and nests like any other container.
         */
        create: function(options) {
            var card = dom.element('div', { 'class': 'card' });

            if (options.header !== false) {
                var header = card.appendChild(dom.element('div', { 'class': 'card-header' }));
                header.appendChild(dom.element('span', { 'class': 'ge-pane-label' },
                    options.title || ge.t('container.card_title')));
            }

            card.appendChild(dom.element('div', { 'class': 'card-body' })).appendChild(ge.defaultRegion());

            if (options.footer) {
                var footer = card.appendChild(dom.element('div', { 'class': 'card-footer text-body-secondary' }));
                footer.appendChild(dom.element('span', { 'class': 'ge-pane-label' },
                    typeof options.footer === 'string' ? options.footer : ge.t('container.card_footer')));
            }

            var container = dom.element('div', { 'data-ge-container': 'card' });
            container.appendChild(card);
            return container;
        },

        mark: function(container) {
            editable(dom.one(container, ':scope > .card > .card-header'));
            editable(dom.one(container, ':scope > .card > .card-footer'));
        },

        unmark: function(container) {
            ge.unwrapLabels(container);
        },
    };
};
