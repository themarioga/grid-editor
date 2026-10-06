/**
 * Tabs for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a tabs container. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.tabs.min.js"></script>
 *
 * A container's variant - its style, width, alignment and whether it is laid
 * out vertically, from a breakpoint up - is Bootstrap's classes on its strip
 * and on itself, and nothing else: it is read from the markup, chosen in the
 * container's settings panel, or given to createContainer and the tabs
 * setting for the ones made new.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'container.add_tabs': 'Tabs',
    'container.add_tab': 'Add tab',
    'container.tab_label': 'Tab {number}',
    'confirm.delete_tab': 'Delete this tab and everything in it?',
    'container.tabs_section': 'Tabs',
    'container.tabs_style': 'Style',
    'container.tabs_style_tabs': 'Tabs',
    'container.tabs_style_pills': 'Pills',
    'container.tabs_style_underline': 'Underline',
    'container.tabs_width': 'Width',
    'container.tabs_width_natural': 'Natural',
    'container.tabs_width_fill': 'Fill',
    'container.tabs_width_justified': 'Justified',
    'container.tabs_align': 'Alignment',
    'container.tabs_align_start': 'Start',
    'container.tabs_align_center': 'Center',
    'container.tabs_align_end': 'End',
    'container.tabs_layout': 'Layout',
    'container.tabs_layout_horizontal': 'Horizontal',
    'container.tabs_layout_vertical': 'Vertical',
    'container.tabs_layout_vertical_from': 'Vertical from {breakpoint}',
});

/** Each variant's values, the first its default, and the class each puts on the strip. */
var STYLES = { tabs: 'nav-tabs', pills: 'nav-pills', underline: 'nav-underline' };
var WIDTHS = { natural: null, fill: 'nav-fill', justified: 'nav-justified' };
var ALIGNS = { start: null, center: 'justify-content-center', end: 'justify-content-end' };
var DEFAULTS = { variant: 'tabs', width: 'natural', align: 'start', vertical: false };

/** Each variant's select in the panel: its label, and its choices'. */
var FIELDS = {
    variant: { labelKey: 'container.tabs_style', choices: [
        { value: 'tabs', labelKey: 'container.tabs_style_tabs' },
        { value: 'pills', labelKey: 'container.tabs_style_pills' },
        { value: 'underline', labelKey: 'container.tabs_style_underline' },
    ] },
    width: { labelKey: 'container.tabs_width', choices: [
        { value: 'natural', labelKey: 'container.tabs_width_natural' },
        { value: 'fill', labelKey: 'container.tabs_width_fill' },
        { value: 'justified', labelKey: 'container.tabs_width_justified' },
    ] },
    align: { labelKey: 'container.tabs_align', choices: [
        { value: 'start', labelKey: 'container.tabs_align_start' },
        { value: 'center', labelKey: 'container.tabs_align_center' },
        { value: 'end', labelKey: 'container.tabs_align_end' },
    ] },
    vertical: { labelKey: 'container.tabs_layout' },
};

var fieldCounter = 0;

/** Where the layout marks what the view being edited lays the tabs out as. */
var LAYOUT_ATTR = 'data-ge-tabs-layout';

function classValues(map) {
    return Object.keys(map).map(function(key) { return map[key]; }).filter(Boolean);
}

GridEditor.containers.tabs = function(ge) {

    var sections = []; // { container, render } for every panel section built

    /** The strip: the container's first .nav, whatever its style. */
    function stripOf(container) {
        return dom.child(container, '.nav');
    }

    /** The breakpoints a layout can go vertical from; xs is always. */
    function fromBreakpoints() {
        return ge.breakpoints.slice(1);
    }

    /** The infix of a vertical layout's classes: none for always. */
    function infix(vertical) {
        return vertical === true ? '' : '-' + vertical;
    }

    function verticalClasses(vertical) {
        var at = infix(vertical);

        return {
            container: ['d' + at + '-flex', 'align-items' + at + '-start'],
            strip: ['flex' + at + '-column', 'me' + at + '-3'],
        };
    }

    /** Every vertical value: always, and from each breakpoint. */
    function verticals() {
        return [true].concat(fromBreakpoints());
    }

    /**
     * What a container's classes say it is. Vertical is read only when the
     * container's flex and the strip's column are of the same breakpoint;
     * anything else is horizontal, and is left as it is.
     */
    function read(container) {
        var strip = stripOf(container);
        var has = function(node, name) { return !!node && dom.hasClass(node, name); };
        var found = function(map, fallback) {
            return Object.keys(map).filter(function(key) { return map[key] && has(strip, map[key]); })[0] || fallback;
        };

        var vertical = verticals().filter(function(each) {
            var classes = verticalClasses(each);
            return has(container, classes.container[0]) && has(strip, classes.strip[0]);
        })[0];

        return {
            variant: found(STYLES, 'tabs'),
            width: found(WIDTHS, 'natural'),
            align: found(ALIGNS, 'start'),
            vertical: vertical === undefined ? false : vertical,
        };
    }

    /**
     * Write one variant, and take off what it makes meaningless: a vertical
     * layout has no width or alignment, and a full width no alignment.
     * Choosing a layout clears every layout class, at any breakpoint, the
     * user's own included.
     */
    function write(container, key, value) {
        var strip = stripOf(container);
        if (!strip) { return; }

        if (key === 'variant') {
            dom.removeClass(strip, classValues(STYLES).join(' '));
            dom.addClass(strip, STYLES[value]);
        }

        if (key === 'width' || key === 'vertical') {
            dom.removeClass(strip, classValues(WIDTHS).join(' '));
            if (key === 'width' && WIDTHS[value]) { dom.addClass(strip, WIDTHS[value]); }
        }

        if (key === 'align' || key === 'vertical' || (key === 'width' && value !== 'natural')) {
            dom.removeClass(strip, classValues(ALIGNS).join(' '));
            if (key === 'align' && ALIGNS[value]) { dom.addClass(strip, ALIGNS[value]); }
        }

        if (key === 'vertical') {
            verticals().forEach(function(each) {
                var classes = verticalClasses(each);
                dom.removeClass(container, classes.container.join(' '));
                dom.removeClass(strip, classes.strip.join(' '));
            });
            strip.removeAttribute('aria-orientation');

            if (value !== false) {
                var layout = verticalClasses(value);
                dom.addClass(container, layout.container.join(' '));
                dom.addClass(strip, layout.strip.join(' '));
                strip.setAttribute('aria-orientation', 'vertical');
            }
        }

        dom.dropEmptyClass(container);
    }

    /** The values a variant takes, as the warning lists them. */
    function valuesOf(key) {
        if (key === 'variant') { return Object.keys(STYLES); }
        if (key === 'width') { return Object.keys(WIDTHS); }
        if (key === 'align') { return Object.keys(ALIGNS); }

        return [false].concat(verticals());
    }

    /**
     * A variant for a new container: the option, or the tabs setting, or the
     * default. A value it does not take is warned about and the default used.
     */
    function chosen(options, key) {
        var setting = ge.settings.tabs || {};
        var value = options[key] !== undefined ? options[key] : setting[key];

        if (value === undefined) { return DEFAULTS[key]; }
        if (valuesOf(key).indexOf(value) !== -1) { return value; }

        ge.warn('tabs: ' + JSON.stringify(value) + ' is not a ' + key + ', which takes ' +
            JSON.stringify(valuesOf(key)) + ': ' + JSON.stringify(DEFAULTS[key]) + ' is used');
        return DEFAULTS[key];
    }

    /**
     * What the view being edited lays a container out as. A breakpoint view
     * narrows the canvas, not the window, and Bootstrap's classes answer to
     * the window: so the view says it, from the breakpoint the container
     * goes vertical at. The all view shows what the window gives.
     */
    function layoutHere(container) {
        var vertical = read(container).vertical;
        if (vertical === false) { return null; }

        if (ge.view() === 'all') {
            container.removeAttribute(LAYOUT_ATTR);
            return /flex$/.test(getComputedStyle(container).display) ? 'vertical' : 'horizontal';
        }
        if (vertical === true) { return 'vertical'; }

        return ge.breakpoints.indexOf(ge.view()) >= ge.breakpoints.indexOf(vertical) ? 'vertical' : 'horizontal';
    }

    function markLayout(container) {
        var layout = layoutHere(container);

        if (layout) {
            container.setAttribute(LAYOUT_ATTR, layout);
        } else {
            container.removeAttribute(LAYOUT_ATTR);
        }
    }

    function select(labelKey, options, onChange) {
        var box = dom.element('div', { 'class': 'ge-tabs-variant' });
        var id = 'ge-tabs-variant-' + (++fieldCounter);

        box.appendChild(dom.element('label', { 'class': 'form-label', 'for': id }, ge.t(labelKey)));
        var field = box.appendChild(dom.element('select', { 'class': 'form-select form-select-sm', id: id }));

        options.forEach(function(option) {
            field.appendChild(dom.element('option', { value: option.value }, option.label));
        });
        field.addEventListener('change', function() { onChange(field.value); });

        return { box: box, field: field };
    }

    /** The Tabs section of a tabs container's settings panel: a select per variant. */
    function createSection(container) {
        var body = dom.element('div', { 'class': 'ge-tabs-variants' });
        var fields = {};

        function change(key, value) {
            write(container, key, value);
            markLayout(container);
            render();
        }

        function options(key) {
            return FIELDS[key].choices.map(function(choice) {
                return { value: choice.value, label: ge.t(choice.labelKey) };
            });
        }

        ['variant', 'width', 'align'].forEach(function(key) {
            fields[key] = select(FIELDS[key].labelKey, options(key), function(value) { change(key, value); });
        });
        fields.vertical = select(FIELDS.vertical.labelKey, [
            { value: 'false', label: ge.t('container.tabs_layout_horizontal') },
            { value: 'true', label: ge.t('container.tabs_layout_vertical') },
        ].concat(fromBreakpoints().map(function(key) {
            return { value: key, label: ge.t('container.tabs_layout_vertical_from', { breakpoint: key }) };
        })), function(value) {
            change('vertical', value === 'true' ? true : value === 'false' ? false : value);
        });

        ['variant', 'width', 'align', 'vertical'].forEach(function(key) {
            fields[key].box.setAttribute('data-ge-tabs-variant', key);
            body.appendChild(fields[key].box);
        });

        /** Fill the selects from the classes, and turn off what does not apply. */
        function render() {
            var values = read(container);

            fields.variant.field.value = values.variant;
            fields.width.field.value = values.width;
            fields.align.field.value = values.align;
            fields.vertical.field.value = String(values.vertical);
            fields.width.field.disabled = values.vertical !== false;
            fields.align.field.disabled = values.vertical !== false || values.width !== 'natural';
        }

        render();
        sections.push({ container: container, element: body, render: render });

        return body;
    }

    function addTabTo(container, options) {
        options = options || {};

        var strip = stripOf(container);
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

        dom.all(stripOf(container) || container, '.nav-link').forEach(function(button) {
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
            sortable(dom.all(ge.canvas, '.ge-container-tabs').map(stripOf).filter(Boolean), {
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

            // The layout last: it takes off what a vertical strip has no use for
            ['variant', 'width', 'align', 'vertical'].forEach(function(key) {
                write(container, key, chosen(options, key));
            });

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

            dom.children(stripOf(container) || container, '.nav-item').forEach(function(tab) {
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
            container.removeAttribute(LAYOUT_ATTR);
            dom.all(container, '.ge-tab-pane').forEach(function(pane) {
                dom.removeClass(pane, 'ge-tab-pane');
            });
            dom.all(container, '.ge-tab').forEach(function(tab) {
                dom.removeClass(tab, 'ge-tab');
                dom.dropEmptyClass(tab);
            });
            ge.unwrapLabels(container);
        },

        // The same, on a copy of the canvas: unmark only touches markup
        cleanMarkup: function(root) {
            var definition = this;
            dom.all(root, '[data-ge-container="tabs"]').forEach(function(container) { definition.unmark(container); });
        },

        panelSection: function(node, kind) {
            if (kind !== 'tabs' || !stripOf(node)) { return null; }

            return { labelKey: 'container.tabs_section', body: createSection(node) };
        },

        // After a view change or a change of classes: the layout marks and the
        // sections follow
        onRefresh: function(scope) {
            dom.selfAndAll(scope, '[data-ge-container="tabs"]').forEach(markLayout);

            sections = sections.filter(function(entry) { return entry.element.isConnected; });
            sections.forEach(function(entry) {
                if (entry.container === scope || scope.contains(entry.container)) { entry.render(); }
            });
        },

        onDeinit: function() {
            sections = [];
        },

        /** Panes read in tab order, whatever order they were dropped in. */
        afterPaneMove: function(container) {
            var content = dom.one(container, ':scope > .tab-content');

            dom.children(stripOf(container) || container, '.nav-item').forEach(function(tab) {
                var pane = paneOf(container, tab);
                if (pane) { content.appendChild(pane); }
            });
        },
    };
};
