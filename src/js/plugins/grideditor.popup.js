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

Object.assign(GridEditor.locales.en, {
    'container.add_popup': 'Popup',
    'container.popup_title': 'Title',
    'container.popup_trigger': 'Open',
    'tool.toggle_popup': 'Fold this popup away while editing',
});

GridEditor.containers.popup = function(ge) {

    function popupIdOf(container) {
        return container.getAttribute('data-ge-popup-id');
    }

    /** Whether a popup with this id is on the canvas. */
    function popupExists(id) {
        return dom.all(ge.canvas, '[data-ge-popup-id]').some(function(popup) {
            return popupIdOf(popup) === id;
        });
    }

    function wirePopupTriggers() {
        dom.all(ge.canvas, '[data-ge-popup-target]').forEach(function(trigger) {
            dom.addClass(trigger, 'ge-popup-trigger');
            var wanted = trigger.getAttribute('data-ge-popup-target');

            // Bootstrap's own attributes are written at getHtml time, not
            // while editing, so a click here cannot open a real modal
            trigger.removeAttribute('data-bs-toggle');
            trigger.removeAttribute('data-bs-target');

            if (popupExists(wanted)) {
                dom.removeClass(trigger, 'ge-popup-orphan');
                return;
            }

            var column = trigger.closest('.column');
            var nearby = column ? dom.all(column, '[data-ge-popup-id]') : [];

            if (nearby.length === 1) {
                trigger.setAttribute('data-ge-popup-target', popupIdOf(nearby[0]));
                dom.removeClass(trigger, 'ge-popup-orphan');
                return;
            }

            dom.addClass(trigger, 'ge-popup-orphan');

            ge.operate(function() {
                ge.emit('popup-orphan', ge.payloadFor('popup', trigger, {
                    parent: trigger.parentElement,
                    source: 'api',
                    missing: wanted,
                }));
            });
        });
    }

    function writePopupTriggerAttributes() {
        dom.all(ge.canvas, '[data-ge-popup-target]').forEach(function(trigger) {
            var wanted = trigger.getAttribute('data-ge-popup-target');

            // The warning marking is editing furniture, whether or not
            // the trigger can be wired up
            dom.removeClass(trigger, 'ge-popup-orphan');
            dom.dropEmptyClass(trigger);

            if (!popupExists(wanted)) { return; }

            trigger.setAttribute('data-bs-toggle', 'modal');
            trigger.setAttribute('data-bs-target', '#' + wanted);
        });
    }

    return {
        labelKey: 'container.add_popup',
        paneKind: 'popup',

        // Triggers are markup the host owns, anywhere in the canvas, so they
        // are looked at whenever the canvas is initialized rather than only
        // when a popup is touched
        onInit: wirePopupTriggers,
        onDeinit: writePopupTriggerAttributes,

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
