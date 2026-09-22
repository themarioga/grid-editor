/**
 * Tabs for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a tabs container. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.tabs.min.js"></script>
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'container.add_tabs': 'Tabs',
    'container.add_tab': 'Add tab',
    'container.tab_label': 'Tab {number}',
    'confirm.delete_tab': 'Delete this tab and everything in it?',
});

$.fn.gridEditor.containers.tabs = function(ge) {

    function addTabTo(container, options) {
        options = options || {};

        var strip = container.find('> .nav-tabs');
        var content = container.find('> .tab-content');
        var id = ge.containerId('tab');
        var number = strip.children('.nav-item').length + 1;

        $('<li class="nav-item ge-tab" role="presentation" />')
            .append($('<button class="nav-link" type="button" role="tab" data-bs-toggle="tab" />')
                .attr('data-bs-target', '#' + id)
                .attr('aria-controls', id)
                .append($('<span class="ge-pane-label" />')
                    .text(options.label || ge.t('container.tab_label', { number: number })))
            )
            .appendTo(strip)
        ;

        var pane = $('<div class="tab-pane fade" role="tabpanel" tabindex="0" />')
            .attr('id', id)
            .append(ge.defaultRegion())
            .appendTo(content)
        ;

        if (options.activate || number === 1) { activatePane(container, pane); }

        return pane;
    }

    function activatePane(container, pane) {
        var id = pane.attr('id');

        container.find('> .tab-content > .tab-pane').removeClass('show active');
        pane.addClass('show active');

        container.find('> .nav-tabs .nav-link').each(function() {
            var button = $(this);
            var active = button.attr('data-bs-target') === '#' + id;

            button.toggleClass('active', active).attr('aria-selected', active ? 'true' : 'false');
        });
    }

    function tabOf(container, pane) {
        return container.find('> .nav-tabs .nav-link[data-bs-target="#' + pane.attr('id') + '"]')
            .closest('.nav-item');
    }

    function paneOf(container, tab) {
        return container.find(tab.find('.nav-link').attr('data-bs-target'));
    }

    return {
        labelKey: 'container.add_tabs',

        // A tab strip sorts its own tabs, and the panes follow them. No
        // group: a tab belongs to the strip it was made in.
        onSortable: function(sortable) {
            sortable(ge.canvas.find('.ge-container-tabs > .nav-tabs'), {
                draggable: '.ge-tab',
            });
        },
        addPaneKey: 'container.add_tab',
        paneKind: 'tab',

        create: function(options) {
            var container = $('<div />').attr('data-ge-container', 'tabs');
            var labels = options.labels || [];
            var count = options.tabs || labels.length || 2;

            $('<ul class="nav nav-tabs" role="tablist" />').appendTo(container);
            $('<div class="tab-content" />').appendTo(container);

            for (var i = 0; i < count; i++) {
                addTabTo(container, { label: labels[i] });
            }

            return container;
        },

        addPane: addTabTo,

        mark: function(container) {
            container.find('> .tab-content > .tab-pane').addClass('ge-tab-pane');

            container.find('> .nav-tabs > .nav-item').each(function() {
                var tab = $(this).addClass('ge-tab');


                ge.makeLabelEditable(ge.labelIn(tab.find('.nav-link')));

                if (tab.find('> .ge-tools-drawer').length) { return; }

                ge.createPaneControls(tab, 'tab', ge.settings.tab_tools, ge.t('confirm.delete_tab'),
                    function(removed) {
                        var pane = paneOf(container, tab);
                        var wasActive = pane.hasClass('active');

                        tab.fadeOut(200, function() {
                            pane.remove();
                            removed();

                            var first = container.find('> .tab-content > .tab-pane').first();
                            if (wasActive && first.length) { activatePane(container, first); }
                        });
                    });
            });
        },

        unmark: function(container) {
            ge.resumeToggles(container);
            container.find('.ge-tab-pane').removeClass('ge-tab-pane');
            ge.unwrapLabels(container);
        },

        /** Panes read in tab order, whatever order they were dropped in. */
        afterPaneMove: function(container) {
            var content = container.find('> .tab-content');

            container.find('> .nav-tabs > .nav-item').each(function() {
                content.append(paneOf(container, $(this)));
            });
        },
    };
};

})(jQuery);
