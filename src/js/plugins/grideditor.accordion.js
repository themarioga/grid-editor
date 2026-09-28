/**
 * Accordions for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * an accordion. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.accordion.min.js"></script>
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'container.add_accordion': 'Accordion',
    'container.add_accordion_item': 'Add item',
    'container.accordion_label': 'Item {number}',
    'confirm.delete_accordion_item': 'Delete this item and everything in it?',
});

GridEditor.containers.accordion = function(ge) {

    // The buttons whose clicks the editor answers itself, bound once each
    var answered = new WeakSet();

    function collapseOf(item) {
        return dom.child(item, '.accordion-collapse');
    }

    function staysOpen(container, ignore) {
        var items = dom.all(container, ':scope > .accordion > .accordion-item > .accordion-collapse');

        if (ignore) {
            var ignored = collapseOf(ignore);
            items = items.filter(function(collapse) { return collapse !== ignored; });
        }

        return items.length > 0 && !items.filter(function(collapse) {
            return collapse.hasAttribute('data-bs-parent');
        }).length;
    }

    function addAccordionItemTo(container, options) {
        options = options || {};

        var accordion = dom.child(container, '.accordion');
        var id = ge.containerId('acc-item');
        var number = dom.children(accordion, '.accordion-item').length + 1;
        var open = options.open === undefined ? number === 1 : !!options.open;
        var stayOpen = options.stay_open === undefined ? staysOpen(container) : !!options.stay_open;

        var item = accordion.appendChild(dom.element('div', { 'class': 'accordion-item ge-accordion-item' }));

        var header = item.appendChild(dom.element('h2', { 'class': 'accordion-header' }));
        var button = header.appendChild(dom.element('button', {
            'class': 'accordion-button',
            type: 'button',
            'data-bs-toggle': 'collapse',
            'data-bs-target': '#' + id,
            'aria-expanded': open ? 'true' : 'false',
        }));
        dom.toggleClass(button, 'collapsed', !open);
        button.appendChild(dom.element('span', { 'class': 'ge-pane-label' },
            options.label || ge.t('container.accordion_label', { number: number })));

        var collapse = item.appendChild(dom.element('div', {
            'class': 'accordion-collapse collapse',
            id: id,
            'data-ge-open': open ? 'true' : 'false',
        }));
        dom.toggleClass(collapse, 'show', open);

        if (!stayOpen) { collapse.setAttribute('data-bs-parent', '#' + accordion.getAttribute('id')); }

        var body = collapse.appendChild(dom.element('div', { 'class': 'accordion-body' }));
        body.appendChild(ge.defaultRegion());
        return body;
    }

    function toggleAccordionItem(container, item) {
        var collapse = collapseOf(item);
        var opening = collapse.getAttribute('data-ge-open') !== 'true';

        if (opening && !staysOpen(container)) {
            dom.all(container, ':scope > .accordion > .accordion-item').forEach(function(other) {
                if (other !== item) { setAccordionItemOpen(other, false); }
            });
        }

        setAccordionItemOpen(item, opening);
    }

    function setAccordionItemOpen(item, open) {
        var collapse = collapseOf(item);
        if (collapse) {
            collapse.setAttribute('data-ge-open', open ? 'true' : 'false');
            dom.toggleClass(collapse, 'show', open);
        }

        dom.all(item, ':scope > .accordion-header .accordion-button').forEach(function(button) {
            dom.toggleClass(button, 'collapsed', !open);
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    function reparentAccordionItem(container, item) {
        var accordion = item.closest('.accordion');
        var collapse = collapseOf(item);
        if (!collapse) { return; }

        // The item that just arrived still carries the parent it had
        // where it came from, so it is not asked what this accordion does
        if (staysOpen(container, item)) {
            collapse.removeAttribute('data-bs-parent');
        } else {
            collapse.setAttribute('data-bs-parent', '#' + accordion.getAttribute('id'));
        }
    }

    return {
        labelKey: 'container.add_accordion',

        // Items sort within their accordion and into any other one
        onSortable: function(sortable) {
            sortable(dom.all(ge.canvas, '.ge-container-accordion > .accordion'), {
                draggable: '.ge-accordion-item',
                group: 'accordion',
            });
        },
        addPaneKey: 'container.add_accordion_item',
        paneKind: 'accordion-item',

        create: function(options) {
            var container = dom.element('div', { 'data-ge-container': 'accordion' });
            var labels = options.labels || [];
            var count = options.items || labels.length || 2;

            container.appendChild(dom.element('div', { 'class': 'accordion', id: ge.containerId('accordion') }));

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
            dom.all(container, ':scope > .accordion > .accordion-item').forEach(function(item) {
                dom.addClass(item, 'ge-accordion-item');
                var collapse = collapseOf(item);

                // What the author wanted, before Bootstrap's own
                // toggles get a chance to change it while editing.
                // Every item is shown while editing (the stylesheet
                // does that), so this is the only record of it.
                if (collapse && !collapse.hasAttribute('data-ge-open')) {
                    collapse.setAttribute('data-ge-open', dom.hasClass(collapse, 'show') ? 'true' : 'false');
                }

                var button = dom.one(item, ':scope > .accordion-header .accordion-button');

                if (button) {
                    // Bootstrap's collapse stays out of it, and the editor
                    // answers the click itself
                    ge.suspendToggles(button);
                    ge.makeLabelEditable(ge.labelIn(button));

                    if (!answered.has(button)) {
                        answered.add(button);
                        button.addEventListener('click', function(e) {
                            if (ge.labelIn(button).getAttribute('contenteditable') === 'true') { return; }

                            e.preventDefault();
                            toggleAccordionItem(container, item);
                        });
                    }
                }

                if (dom.child(item, '.ge-tools-drawer')) { return; }

                ge.createPaneControls(item, 'accordion-item', ge.settings.accordion_tools,
                    ge.t('confirm.delete_accordion_item'), function(removed) {
                        dom.slideUp(item, 200, removed);
                    });
            });
        },

        unmark: function(container) {
            ge.resumeToggles(container);

            // What the canvas was showing is what the page ships
            dom.all(container, ':scope > .accordion > .accordion-item').forEach(function(item) {
                var collapse = collapseOf(item);
                setAccordionItemOpen(item, !!collapse && collapse.getAttribute('data-ge-open') === 'true');
            });

            dom.all(container, '.ge-accordion-item').forEach(function(item) {
                dom.removeClass(item, 'ge-accordion-item');
            });
            ge.unwrapLabels(container);
        },

        afterPaneMove: function(container, item) {
            reparentAccordionItem(container, item);
        },
    };
};
