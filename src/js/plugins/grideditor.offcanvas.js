/**
 * Offcanvases for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * an offcanvas, a bootstrap panel that slides in from an edge of the window,
 * and its trigger. What it can ask the editor for is the handle its factory
 * is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.offcanvas.min.js"></script>
 *
 * While editing the panel is rendered unfolded and in place, with its body as
 * an ordinary region, and nothing in it reaches Bootstrap's javascript. Its
 * options - placement, backdrop, body scroll, keyboard, responsive and dark
 * theme - are Bootstrap's classes and attributes and nothing else: they are
 * read from the markup, chosen in the container's settings panel, or given to
 * createContainer and the offcanvas setting for the ones made new.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';
import { triggersFor } from '../triggers/triggers.js';

Object.assign(GridEditor.locales.en, {
    'container.add_offcanvas': 'Offcanvas',
    'container.offcanvas_title': 'Title',
    'container.offcanvas_trigger': 'Open',
    'tool.toggle_offcanvas': 'Fold this offcanvas away while editing',
    'container.offcanvas_section': 'Offcanvas',
    'container.offcanvas_placement': 'Placement',
    'container.offcanvas_start': 'Start',
    'container.offcanvas_end': 'End',
    'container.offcanvas_top': 'Top',
    'container.offcanvas_bottom': 'Bottom',
    'container.offcanvas_backdrop': 'Backdrop',
    'container.offcanvas_backdrop_yes': 'Yes',
    'container.offcanvas_backdrop_no': 'No',
    'container.offcanvas_backdrop_static': 'Static',
    'container.offcanvas_scroll': 'Allow body scroll',
    'container.offcanvas_keyboard': 'Close with Esc',
    'container.offcanvas_responsive': 'Responsive',
    'container.offcanvas_responsive_never': 'Always offcanvas',
    'container.offcanvas_responsive_from': 'Inline from {breakpoint}',
    'container.offcanvas_dark': 'Dark theme',
});

/** What an offcanvas made new has when neither the call nor the setting says. */
var DEFAULTS = {
    placement: 'start',
    backdrop: true,
    scroll: false,
    keyboard: true,
    responsive: null,
    dark: false,
};

var KEYS = ['placement', 'backdrop', 'scroll', 'keyboard', 'responsive', 'dark'];
var PLACEMENTS = ['start', 'end', 'top', 'bottom'];
var BACKDROPS = [true, false, 'static'];

/** Each field's label, and each choice's, as keys the locale test can find. */
var LABELS = {
    placement: { labelKey: 'container.offcanvas_placement' },
    backdrop: { labelKey: 'container.offcanvas_backdrop' },
    responsive: { labelKey: 'container.offcanvas_responsive' },
    scroll: { labelKey: 'container.offcanvas_scroll' },
    keyboard: { labelKey: 'container.offcanvas_keyboard' },
    dark: { labelKey: 'container.offcanvas_dark' },
};
var PLACEMENT_CHOICES = [
    { value: 'start', labelKey: 'container.offcanvas_start' },
    { value: 'end', labelKey: 'container.offcanvas_end' },
    { value: 'top', labelKey: 'container.offcanvas_top' },
    { value: 'bottom', labelKey: 'container.offcanvas_bottom' },
];
var BACKDROP_CHOICES = [
    { value: 'true', labelKey: 'container.offcanvas_backdrop_yes' },
    { value: 'false', labelKey: 'container.offcanvas_backdrop_no' },
    { value: 'static', labelKey: 'container.offcanvas_backdrop_static' },
];

var fieldCounter = 0;

GridEditor.containers.offcanvas = function(ge) {

    // Bootstrap has no offcanvas-xs: below the smallest breakpoint is always a panel
    var RESPONSIVE = ge.breakpoints.filter(function(key) { return key !== 'xs'; });
    var sections = []; // { node, element, render } for every panel section built

    var triggers = triggersFor(ge, 'offcanvas', 'data-ge-offcanvas-id', 'data-ge-offcanvas-target', 'offcanvas');

    var CHECKS = {
        placement: function(value) { return PLACEMENTS.indexOf(value) !== -1; },
        backdrop: function(value) { return BACKDROPS.indexOf(value) !== -1; },
        responsive: function(value) { return value === null || RESPONSIVE.indexOf(value) !== -1; },
    };

    function isValid(key, value) {
        return CHECKS[key] ? CHECKS[key](value) : typeof value === 'boolean';
    }

    /** The values an option takes, as the warning lists them. */
    function takes(key) {
        if (key === 'placement') { return JSON.stringify(PLACEMENTS); }
        if (key === 'backdrop') { return JSON.stringify(BACKDROPS); }
        if (key === 'responsive') { return JSON.stringify([null].concat(RESPONSIVE)); }

        return '[true,false]';
    }

    /**
     * A value for a new offcanvas: the option, or the offcanvas setting, or
     * the default. One the option does not take is warned about and the
     * default used.
     */
    function chosen(options, key) {
        var setting = ge.settings.offcanvas || {};
        var value = options[key] !== undefined ? options[key] : setting[key];

        if (value === undefined) { return DEFAULTS[key]; }
        if (isValid(key, value)) { return value; }

        ge.warn('offcanvas: ' + JSON.stringify(value) + ' is not a ' + key + ', which takes ' +
            takes(key) + ': ' + JSON.stringify(DEFAULTS[key]) + ' is used');
        return DEFAULTS[key];
    }

    /** The class that makes a node a panel: `offcanvas`, or `offcanvas-{breakpoint}` for a responsive one. */
    function isPanelClass(name) {
        return name === 'offcanvas' || (/^offcanvas-/.test(name) && RESPONSIVE.indexOf(name.slice(10)) !== -1);
    }

    function isPanel(node) {
        return Array.prototype.some.call(node.classList, isPanelClass);
    }

    /** The panel, found by the id the container carries: with responsive it has no .offcanvas class. */
    function panelOf(container) {
        var id = container.getAttribute('data-ge-offcanvas-id');
        var own = dom.children(container);

        return own.filter(function(node) { return id && node.id === id; })[0] || own.filter(isPanel)[0] || null;
    }

    function triggerOf(container) {
        return dom.child(container, '[data-ge-offcanvas-target]');
    }

    /** The class that marks a trigger while editing is furniture: the page has no use for it. */
    function dropTriggerMarks(root) {
        dom.all(root, '.ge-offcanvas-trigger').forEach(function(trigger) {
            dom.removeClass(trigger, 'ge-offcanvas-trigger');
            dom.dropEmptyClass(trigger);
        });
    }

    function hideClass(responsive) {
        return 'd-' + responsive + '-none';
    }

    /** What a panel's classes and attributes say it is. */
    function read(container) {
        var panel = panelOf(container);
        var backdrop = panel.getAttribute('data-bs-backdrop');
        var responsive = null;

        Array.prototype.forEach.call(panel.classList, function(name) {
            if (name !== 'offcanvas' && isPanelClass(name)) { responsive = name.slice(10); }
        });

        return {
            placement: PLACEMENTS.filter(function(place) { return dom.hasClass(panel, 'offcanvas-' + place); })[0] || 'start',
            backdrop: backdrop === 'false' ? false : backdrop === 'static' ? 'static' : true,
            scroll: panel.getAttribute('data-bs-scroll') === 'true',
            keyboard: panel.getAttribute('data-bs-keyboard') !== 'false',
            responsive: responsive,
            dark: panel.getAttribute('data-bs-theme') === 'dark',
        };
    }

    function setAttribute(panel, name, value) {
        if (value === null) {
            panel.removeAttribute(name);
        } else {
            panel.setAttribute(name, value);
        }
    }

    function write(container, key, value) {
        var panel = panelOf(container);

        if (key === 'placement') {
            PLACEMENTS.forEach(function(place) { dom.removeClass(panel, 'offcanvas-' + place); });
            dom.addClass(panel, 'offcanvas-' + value);
        }

        if (key === 'backdrop') { setAttribute(panel, 'data-bs-backdrop', value === true ? null : String(value)); }
        if (key === 'scroll') { setAttribute(panel, 'data-bs-scroll', value ? 'true' : null); }
        if (key === 'keyboard') { setAttribute(panel, 'data-bs-keyboard', value ? null : 'false'); }

        if (key === 'responsive') {
            var before = read(container).responsive;
            var trigger = triggerOf(container);
            var rest = Array.prototype.filter.call(panel.classList, function(name) { return !isPanelClass(name); });

            // The one class that makes it a panel comes first, as Bootstrap writes it
            panel.className = [value === null ? 'offcanvas' : 'offcanvas-' + value].concat(rest).join(' ');

            if (trigger) {
                if (before !== null) { dom.removeClass(trigger, hideClass(before)); }
                if (value !== null) { dom.addClass(trigger, hideClass(value)); }
                dom.dropEmptyClass(trigger);
            }
        }

        if (key === 'dark') {
            if (value) {
                panel.setAttribute('data-bs-theme', 'dark');
            } else if (panel.getAttribute('data-bs-theme') === 'dark') {
                panel.removeAttribute('data-bs-theme');
            }
        }
    }

    function nextId() {
        return 'ge-offcanvas-option-' + (++fieldCounter);
    }

    function field(labelKey, control, id) {
        var box = dom.element('div', { 'class': 'ge-offcanvas-option mb-2' });

        box.appendChild(dom.element('label', { 'class': 'form-label', 'for': id }, ge.t(labelKey)));
        box.appendChild(control);

        return box;
    }

    function checkbox(labelKey, onChange) {
        var id = nextId();
        var box = dom.element('div', { 'class': 'form-check' });
        var input = box.appendChild(dom.element('input', { 'class': 'form-check-input', type: 'checkbox', id: id }));

        box.appendChild(dom.element('label', { 'class': 'form-check-label', 'for': id }, ge.t(labelKey)));
        input.addEventListener('change', function() { onChange(input.checked); });

        return { box: box, input: input };
    }

    /** A select over `choices`, each { value, label }, that calls `onChange` with the value chosen. */
    function select(choices, onChange) {
        var id = nextId();
        var control = dom.element('select', { 'class': 'form-select form-select-sm', id: id });

        choices.forEach(function(choice) {
            control.appendChild(dom.element('option', { value: choice.value }, choice.label));
        });
        control.addEventListener('change', function() { onChange(control.value); });

        return { id: id, control: control };
    }

    /** The Offcanvas section of an offcanvas's settings panel. */
    function createSection(container) {
        var body = dom.element('div', { 'class': 'ge-offcanvas-options' });

        function change(key, value) {
            write(container, key, value);
            render();
        }

        var translated = function(choice) { return { value: choice.value, label: ge.t(choice.labelKey) }; };

        var selects = {
            placement: select(PLACEMENT_CHOICES.map(translated), function(value) { change('placement', value); }),
            backdrop: select(BACKDROP_CHOICES.map(translated), function(value) {
                change('backdrop', value === 'static' ? 'static' : value === 'true');
            }),
            responsive: select([{ value: '', label: ge.t('container.offcanvas_responsive_never') }].concat(
                RESPONSIVE.map(function(key) {
                    return { value: key, label: ge.t('container.offcanvas_responsive_from', { breakpoint: key }) };
                })
            ), function(value) { change('responsive', value === '' ? null : value); }),
        };

        Object.keys(selects).forEach(function(key) {
            var box = field(LABELS[key].labelKey, selects[key].control, selects[key].id);

            box.setAttribute('data-ge-offcanvas-option', key);
            body.appendChild(box);
        });

        var inputs = {};
        ['scroll', 'keyboard', 'dark'].forEach(function(key) {
            var each = checkbox(LABELS[key].labelKey, function(on) { change(key, on); });

            inputs[key] = each.input;
            each.box.setAttribute('data-ge-offcanvas-option', key);
            body.appendChild(each.box);
        });

        /** Fill the fields from the markup. */
        function render() {
            var values = read(container);

            selects.placement.control.value = values.placement;
            selects.backdrop.control.value = String(values.backdrop);
            selects.responsive.control.value = values.responsive === null ? '' : values.responsive;
            Object.keys(inputs).forEach(function(key) { inputs[key].checked = values[key]; });
        }

        render();
        sections.push({ node: container, element: body, render: render });

        return body;
    }

    return {
        labelKey: 'container.add_offcanvas',
        paneKind: 'offcanvas',

        // The ids a copy of an offcanvas has to rename together
        references: ['data-ge-offcanvas-id', 'data-ge-offcanvas-target'],

        onInit: triggers.onInit,

        onDeinit: function() {
            sections = [];
            triggers.onDeinit();
            dropTriggerMarks(ge.canvas);
        },

        // The preview pressed, the triggers open the real thing; let go, it closes
        onPreviewChange: triggers.onPreviewChange,

        // What onDeinit and unmark do, on a copy of the canvas
        cleanMarkup: function(root) {
            var definition = this;
            triggers.write(root);
            dropTriggerMarks(root);
            dom.all(root, '[data-ge-container="offcanvas"]').forEach(function(container) { definition.unmark(container); });
        },

        create: function(options) {
            options = options || {};

            var id = ge.containerId('offcanvas');
            var container = dom.element('div', { 'data-ge-container': 'offcanvas', 'data-ge-offcanvas-id': id });

            if (options.trigger !== false) {
                container.appendChild(dom.element('button', {
                    type: 'button',
                    'class': 'btn btn-primary ge-offcanvas-trigger',
                    'data-ge-offcanvas-target': id,
                }, options.trigger_label || ge.t('container.offcanvas_trigger')));
            }

            var panel = container.appendChild(dom.element('div', {
                'class': 'offcanvas',
                tabindex: '-1',
                id: id,
                'aria-labelledby': id + '-label',
            }));
            var header = panel.appendChild(dom.element('div', { 'class': 'offcanvas-header' }));

            header.appendChild(dom.element('h5', { 'class': 'offcanvas-title', id: id + '-label' }))
                .appendChild(dom.element('span', { 'class': 'ge-pane-label' },
                    options.title || ge.t('container.offcanvas_title')));
            header.appendChild(dom.create('<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>'));
            panel.appendChild(dom.element('div', { 'class': 'offcanvas-body' })).appendChild(ge.defaultRegion());

            KEYS.forEach(function(key) { write(container, key, chosen(options, key)); });

            return container;
        },

        mark: function(container) {
            var header = dom.child(panelOf(container), '.offcanvas-header');

            // Nothing in an offcanvas may reach Bootstrap while editing:
            // the panel is rendered unfolded and static, and a real
            // one sliding in over it would be the editor fighting itself
            dom.all(header, '[data-bs-dismiss]').forEach(function(dismiss) {
                ge.suspendToggles(dismiss);
            });
            dom.all(header, '.offcanvas-title').forEach(function(title) {
                ge.makeLabelEditable(ge.labelIn(title));
            });
        },

        unmark: function(container) {
            var header = dom.child(panelOf(container), '.offcanvas-header');

            if (header) {
                ge.resumeToggles(header);
                ge.unwrapLabels(header);
            }
            dom.removeClass(container, 'ge-offcanvas-collapsed');
        },

        /** A page of unfolded panels stays workable if they can be folded away. */
        tools: function(drawer, container) {
            ge.createTool(drawer, ge.t('tool.toggle_offcanvas'), 'ge-toggle-offcanvas', 'bi bi-chevron-bar-contract',
                function() {
                    dom.toggleClass(container, 'ge-offcanvas-collapsed');
                });
        },

        panelSection: function(node, kind) {
            if (kind === 'offcanvas' && panelOf(node)) {
                return { labelKey: 'container.offcanvas_section', body: createSection(node) };
            }

            return null;
        },

        // After a view change or a change of classes: the sections follow
        onRefresh: function(scope) {
            sections = sections.filter(function(entry) { return entry.element.isConnected; });
            sections.forEach(function(entry) {
                if (entry.node === scope || scope.contains(entry.node)) { entry.render(); }
            });
        },
    };
};
