/**
 * Tabs for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a tabs container. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.tabs.min.js"></script>
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'container.add_tabs': 'Tabs',
    'container.add_tab': 'Add tab',
    'container.tab_label': 'Tab {number}',
    'confirm.delete_tab': 'Delete this tab and everything in it?',
});

GridEditor.containers.tabs = function(ge) {

    function addTabTo(container, options) {
        options = options || {};

        var strip = dom.one(container, ':scope > .nav-tabs');
        var content = dom.one(container, ':scope > .tab-content');
        var id = ge.containerId('tab');
        var number = dom.children(strip, '.nav-item').length + 1;

        var tab = strip.appendChild(dom.element('li', { 'class': 'nav-item ge-tab', role: 'presentation' }));
        var button = tab.appendChild(dom.element('button', {
            'class': 'nav-link',
            type: 'button',
            role: 'tab',
            'data-bs-toggle': 'tab',
            'data-bs-target': '#' + id,
            'aria-controls': id,
        }));
        button.appendChild(dom.element('span', { 'class': 'ge-pane-label' },
            options.label || ge.t('container.tab_label', { number: number })));

        var pane = content.appendChild(dom.element('div', {
            'class': 'tab-pane fade',
            role: 'tabpanel',
            tabindex: '0',
            id: id,
        }));
        pane.appendChild(ge.defaultRegion());

        if (options.activate || number === 1) { activatePane(container, pane); }

        return pane;
    }

    function activatePane(container, pane) {
        var id = pane.getAttribute('id');

        dom.all(container, ':scope > .tab-content > .tab-pane').forEach(function(each) {
            dom.removeClass(each, 'show active');
        });
        dom.addClass(pane, 'show active');

        dom.all(container, ':scope > .nav-tabs .nav-link').forEach(function(button) {
            var active = button.getAttribute('data-bs-target') === '#' + id;

            dom.toggleClass(button, 'active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function paneOf(container, tab) {
        var link = dom.one(tab, '.nav-link');
        var target = link ? link.getAttribute('data-bs-target') : null;

        return target ? dom.one(container, target) : null;
    }

    return {
        labelKey: 'container.add_tabs',

        // A tab strip sorts its own tabs, and the panes follow them. No
        // group: a tab belongs to the strip it was made in.
        onSortable: function(sortable) {
            sortable(dom.all(ge.canvas, '.ge-container-tabs > .nav-tabs'), {
                draggable: '.ge-tab',
            });
        },
        addPaneKey: 'container.add_tab',
        paneKind: 'tab',

        create: function(options) {
            var container = dom.element('div', { 'data-ge-container': 'tabs' });
            var labels = options.labels || [];
            var count = options.tabs || labels.length || 2;

            container.appendChild(dom.element('ul', { 'class': 'nav nav-tabs', role: 'tablist' }));
            container.appendChild(dom.element('div', { 'class': 'tab-content' }));

            for (var i = 0; i < count; i++) {
                addTabTo(container, { label: labels[i] });
            }

            return container;
        },

        addPane: addTabTo,

        mark: function(container) {
            dom.all(container, ':scope > .tab-content > .tab-pane').forEach(function(pane) {
                dom.addClass(pane, 'ge-tab-pane');
            });

            dom.all(container, ':scope > .nav-tabs > .nav-item').forEach(function(tab) {
                dom.addClass(tab, 'ge-tab');

                var link = dom.one(tab, '.nav-link');
                if (link) { ge.makeLabelEditable(ge.labelIn(link)); }

                if (dom.child(tab, '.ge-tools-drawer')) { return; }

                ge.createPaneControls(tab, 'tab', ge.settings.tab_tools, ge.t('confirm.delete_tab'),
                    function(removed) {
                        var pane = paneOf(container, tab);
                        var wasActive = dom.hasClass(pane, 'active');

                        dom.fadeOut(tab, 200, function() {
                            if (pane) { pane.remove(); }
                            removed();

                            var first = dom.one(container, ':scope > .tab-content > .tab-pane');
                            if (wasActive && first) { activatePane(container, first); }
                        });
                    });
            });
        },

        unmark: function(container) {
            ge.resumeToggles(container);
            dom.all(container, '.ge-tab-pane').forEach(function(pane) {
                dom.removeClass(pane, 'ge-tab-pane');
            });
            ge.unwrapLabels(container);
        },

        /** Panes read in tab order, whatever order they were dropped in. */
        afterPaneMove: function(container) {
            var content = dom.one(container, ':scope > .tab-content');

            dom.all(container, ':scope > .nav-tabs > .nav-item').forEach(function(tab) {
                var pane = paneOf(container, tab);
                if (pane) { content.appendChild(pane); }
            });
        },
    };
};
