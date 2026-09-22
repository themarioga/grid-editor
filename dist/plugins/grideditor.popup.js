/**
 * Popups for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a popup: a bootstrap modal and its trigger. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.popup.min.js"></script>
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'container.add_popup': 'Popup',
    'container.popup_title': 'Title',
    'container.popup_trigger': 'Open',
    'tool.toggle_popup': 'Fold this popup away while editing',
});

$.fn.gridEditor.containers.popup = function(ge) {

    function popupIdOf(container) {
        return container.attr('data-ge-popup-id');
    }

    function wirePopupTriggers() {
        ge.canvas.find('[data-ge-popup-target]').each(function() {
            var trigger = $(this).addClass('ge-popup-trigger');
            var wanted = trigger.attr('data-ge-popup-target');

            // Bootstrap's own attributes are written at getHtml time, not
            // while editing, so a click here cannot open a real modal
            trigger.removeAttr('data-bs-toggle').removeAttr('data-bs-target');

            if (ge.canvas.find('[data-ge-popup-id="' + wanted + '"]').length) {
                trigger.removeClass('ge-popup-orphan');
                return;
            }

            var nearby = trigger.closest('.column').find('[data-ge-popup-id]');

            if (nearby.length === 1) {
                trigger.attr('data-ge-popup-target', popupIdOf(nearby)).removeClass('ge-popup-orphan');
                return;
            }

            trigger.addClass('ge-popup-orphan');

            ge.operate(function() {
                ge.emit('popup-orphan', ge.payloadFor('popup', trigger, {
                    parent: trigger.parent(),
                    source: 'api',
                    missing: wanted,
                }));
            });
        });
    }

    function writePopupTriggerAttributes() {
        ge.canvas.find('[data-ge-popup-target]').each(function() {
            var trigger = $(this);
            var wanted = trigger.attr('data-ge-popup-target');

            // The warning marking is editing furniture, whether or not
            // the trigger can be wired up
            trigger.removeClass('ge-popup-orphan');
            if (!trigger.attr('class')) { trigger.removeAttr('class'); }

            if (!ge.canvas.find('[data-ge-popup-id="' + wanted + '"]').length) { return; }

            trigger.attr('data-bs-toggle', 'modal').attr('data-bs-target', '#' + wanted);
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
            var container = $('<div />')
                .attr('data-ge-container', 'popup')
                .attr('data-ge-popup-id', id)
            ;

            if (options.trigger !== false) {
                $('<button type="button" class="btn btn-primary ge-popup-trigger" />')
                    .attr('data-ge-popup-target', id)
                    .text(options.trigger_label || ge.t('container.popup_trigger'))
                    .appendTo(container)
                ;
            }

            var dialog = $('<div class="modal-dialog" />');
            if (options.size) { dialog.addClass('modal-' + options.size); }

            $('<div class="modal fade" tabindex="-1" aria-hidden="true" />')
                .attr('id', id)
                .append(dialog.append($('<div class="modal-content" />')
                    .append($('<div class="modal-header" />')
                        .append($('<h5 class="modal-title" />')
                            .append($('<span class="ge-pane-label" />')
                                .text(options.title || ge.t('container.popup_title'))))
                        .append('<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>'))
                    .append($('<div class="modal-body" />').append(ge.defaultRegion()))))
                .appendTo(container)
            ;

            return container;
        },

        mark: function(container) {
            // Nothing in a popup may reach Bootstrap while editing:
            // the modal is rendered unfolded and static, and a real
            // modal opening over it would be the editor fighting
            // itself
            ge.suspendToggles(container.find('[data-bs-dismiss]'));
            ge.makeLabelEditable(ge.labelIn(container.find('.modal-title')));
        },

        unmark: function(container) {
            ge.resumeToggles(container);
            container.removeClass('ge-popup-collapsed');
            ge.unwrapLabels(container);
        },

        /** A page of unfolded modals stays workable if they can be folded away. */
        tools: function(drawer, container) {
            ge.createTool(drawer, ge.t('tool.toggle_popup'), 'ge-toggle-popup', 'bi bi-chevron-bar-contract',
                function() {
                    container.toggleClass('ge-popup-collapsed');
                });
        },
    };
};

})(jQuery);
