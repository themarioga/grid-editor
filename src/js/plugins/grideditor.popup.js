/**
 * Popups for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a popup: a bootstrap modal and its trigger. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.popup.min.js"></script>
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';
import { triggersFor } from '../triggers/triggers.js';

Object.assign(GridEditor.locales.en, {
    'container.add_popup': 'Popup',
    'container.popup_title': 'Title',
    'container.popup_trigger': 'Open',
    'tool.toggle_popup': 'Fold this popup away while editing',
});

GridEditor.containers.popup = function(ge) {

    var triggers = triggersFor(ge, 'popup', 'data-ge-popup-id', 'data-ge-popup-target', 'modal');

    return {
        labelKey: 'container.add_popup',
        paneKind: 'popup',

        // The ids a copy of a popup has to rename together
        references: ['data-ge-popup-id', 'data-ge-popup-target'],

        onInit: triggers.onInit,
        onDeinit: triggers.onDeinit,
        // The preview pressed, the triggers open the real thing; let go, it closes
        onPreviewChange: triggers.onPreviewChange,

        // What onDeinit and unmark do, on a copy of the canvas
        cleanMarkup: function(root) {
            var definition = this;
            triggers.write(root);
            dom.all(root, '[data-ge-container="popup"]').forEach(function(container) { definition.unmark(container); });
        },

        create: function(options) {
            var id = ge.containerId('popup');
            var container = dom.element('div', { 'data-ge-container': 'popup', 'data-ge-popup-id': id });

            if (options.trigger !== false) {
                container.appendChild(dom.element('button', {
                    type: 'button',
                    'class': 'btn btn-primary ge-popup-trigger',
                    'data-ge-popup-target': id,
                }, options.trigger_label || ge.t('container.popup_trigger')));
            }

            var modal = container.appendChild(dom.element('div', {
                'class': 'modal fade',
                tabindex: '-1',
                'aria-hidden': 'true',
                id: id,
            }));
            var dialog = modal.appendChild(dom.element('div', { 'class': 'modal-dialog' }));
            if (options.size) { dom.addClass(dialog, 'modal-' + options.size); }

            var content = dialog.appendChild(dom.element('div', { 'class': 'modal-content' }));
            var header = content.appendChild(dom.element('div', { 'class': 'modal-header' }));
            header.appendChild(dom.element('h5', { 'class': 'modal-title' }))
                .appendChild(dom.element('span', { 'class': 'ge-pane-label' },
                    options.title || ge.t('container.popup_title')));
            header.appendChild(dom.create('<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'));
            content.appendChild(dom.element('div', { 'class': 'modal-body' })).appendChild(ge.defaultRegion());

            return container;
        },

        mark: function(container) {
            // Nothing in a popup may reach Bootstrap while editing:
            // the modal is rendered unfolded and static, and a real
            // modal opening over it would be the editor fighting
            // itself
            dom.all(container, '[data-bs-dismiss]').forEach(function(dismiss) {
                ge.suspendToggles(dismiss);
            });
            dom.all(container, '.modal-title').forEach(function(title) {
                ge.makeLabelEditable(ge.labelIn(title));
            });
        },

        unmark: function(container) {
            ge.resumeToggles(container);
            dom.removeClass(container, 'ge-popup-collapsed');
            ge.unwrapLabels(container);
        },

        /** A page of unfolded modals stays workable if they can be folded away. */
        tools: function(drawer, container) {
            ge.createTool(drawer, ge.t('tool.toggle_popup'), 'ge-toggle-popup', 'bi bi-chevron-bar-contract',
                function() {
                    dom.toggleClass(container, 'ge-popup-collapsed');
                });
        },
    };
};
