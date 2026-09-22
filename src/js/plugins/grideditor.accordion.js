/**
 * Accordions for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * an accordion. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.accordion.min.js"></script>
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'container.add_accordion': 'Accordion',
    'container.add_accordion_item': 'Add item',
    'container.accordion_label': 'Item {number}',
    'confirm.delete_accordion_item': 'Delete this item and everything in it?',
});

$.fn.gridEditor.containers.accordion = function(ge) {

    function staysOpen(container, ignore) {
        var items = container.find('> .accordion > .accordion-item > .accordion-collapse');

        if (ignore) { items = items.not(ignore.find('> .accordion-collapse')); }

        return items.length > 0 && !items.filter('[data-bs-parent]').length;
    }

    function addAccordionItemTo(container, options) {
        options = options || {};

        var accordion = container.find('> .accordion');
        var id = ge.containerId('acc-item');
        var number = accordion.children('.accordion-item').length + 1;
        var open = options.open === undefined ? number === 1 : !!options.open;
        var stayOpen = options.stay_open === undefined ? staysOpen(container) : !!options.stay_open;

        var item = $('<div class="accordion-item ge-accordion-item" />').appendTo(accordion);

        $('<h2 class="accordion-header" />')
            .append($('<button class="accordion-button" type="button" data-bs-toggle="collapse" />')
                .attr('data-bs-target', '#' + id)
                .attr('aria-expanded', open ? 'true' : 'false')
                .toggleClass('collapsed', !open)
                .append($('<span class="ge-pane-label" />')
                    .text(options.label || ge.t('container.accordion_label', { number: number }))))
            .appendTo(item)
        ;

        var collapse = $('<div class="accordion-collapse collapse" />')
            .attr('id', id)
            .attr('data-ge-open', open ? 'true' : 'false')
            .toggleClass('show', open)
            .appendTo(item)
        ;

        if (!stayOpen) { collapse.attr('data-bs-parent', '#' + accordion.attr('id')); }

        return $('<div class="accordion-body" />').append(ge.defaultRegion()).appendTo(collapse);
    }

    function toggleAccordionItem(container, item) {
        var collapse = item.find('> .accordion-collapse');
        var opening = collapse.attr('data-ge-open') !== 'true';

        if (opening && !staysOpen(container)) {
            container.find('> .accordion > .accordion-item').not(item).each(function() {
                setAccordionItemOpen($(this), false);
            });
        }

        setAccordionItemOpen(item, opening);
    }

    function setAccordionItemOpen(item, open) {
        item.find('> .accordion-collapse')
            .attr('data-ge-open', open ? 'true' : 'false')
            .toggleClass('show', open)
        ;
        item.find('> .accordion-header .accordion-button')
            .toggleClass('collapsed', !open)
            .attr('aria-expanded', open ? 'true' : 'false')
        ;
    }

    function reparentAccordionItem(container, item) {
        var accordion = item.closest('.accordion');
        var collapse = item.find('> .accordion-collapse');

        // The item that just arrived still carries the parent it had
        // where it came from, so it is not asked what this accordion does
        if (staysOpen(container, item)) {
            collapse.removeAttr('data-bs-parent');
        } else {
            collapse.attr('data-bs-parent', '#' + accordion.attr('id'));
        }
    }

    return {
        labelKey: 'container.add_accordion',

        // Items sort within their accordion and into any other one
        onSortable: function(sortable) {
            sortable(ge.canvas.find('.ge-container-accordion > .accordion'), {
                draggable: '> .ge-accordion-item',
                group: 'accordion',
            });
        },
        addPaneKey: 'container.add_accordion_item',
        paneKind: 'accordion-item',

        create: function(options) {
            var container = $('<div />').attr('data-ge-container', 'accordion');
            var labels = options.labels || [];
            var count = options.items || labels.length || 2;

            $('<div class="accordion" />')
                .attr('id', ge.containerId('accordion'))
                .appendTo(container)
            ;

            for (var i = 0; i < count; i++) {
                addAccordionItemTo(container, {
                    label: labels[i],
                    open: i === 0,
                    stay_open: options.stay_open,
                });
            }

            return container;
        },

        addPane: addAccordionItemTo,

        mark: function(container) {
            container.find('> .accordion > .accordion-item').each(function() {
                var item = $(this).addClass('ge-accordion-item');
                var collapse = item.find('> .accordion-collapse');

                // What the author wanted, before Bootstrap's own
                // toggles get a chance to change it while editing.
                // Every item is shown while editing (the stylesheet
                // does that), so this is the only record of it.
                if (collapse.attr('data-ge-open') === undefined) {
                    collapse.attr('data-ge-open', collapse.hasClass('show') ? 'true' : 'false');
                }

                var button = item.find('> .accordion-header .accordion-button');

                // Bootstrap's collapse stays out of it, and the editor
                // answers the click itself
                ge.suspendToggles(button);
                ge.makeLabelEditable(ge.labelIn(button));

                if (!button.data('ge-toggles')) {
                    button.data('ge-toggles', true).on('click', function(e) {
                        if (ge.labelIn(button).attr('contenteditable') === 'true') { return; }

                        e.preventDefault();
                        toggleAccordionItem(container, item);
                    });
                }

                if (item.find('> .ge-tools-drawer').length) { return; }

                ge.createPaneControls(item, 'accordion-item', ge.settings.accordion_tools,
                    ge.t('confirm.delete_accordion_item'), function(removed) {
                        item.slideUp(200, removed);
                    });
            });
        },

        unmark: function(container) {
            ge.resumeToggles(container);

            // What the ge.canvas was showing is what the page ships
            container.find('> .accordion > .accordion-item').each(function() {
                setAccordionItemOpen($(this),
                    $(this).find('> .accordion-collapse').attr('data-ge-open') === 'true');
            });

            container.find('.ge-accordion-item').removeClass('ge-accordion-item');
            ge.unwrapLabels(container);
        },

        afterPaneMove: function(container, item) {
            reparentAccordionItem(container, item);
        },
    };
};

})(jQuery);
