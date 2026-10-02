/**
 * Sections for grid-editor.
 *
 * A feature plugin: load this file after the editor and the canvas can hold
 * sections - Bootstrap's .container, .container-fluid and .container-{bp} -
 * each grouping rows at a width of its own. What it can ask the editor for is
 * the handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.sections.min.js"></script>
 *
 * Called sections, not containers, because a container is what the tabs,
 * accordion, popup and card plugins make. A section is recognised by its
 * Bootstrap class alone, and only as a child of the canvas: a .container
 * somewhere inside an element's markup is that element's business.
 *
 * sections.widths narrows the widths the field offers.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'section.add': 'Section',
    'section.width': 'Width',
    'section.fixed': 'Fixed',
    'section.fluid': 'Full width',
    'section.from': 'Fixed from {breakpoint}',
    'tool.add_row_to_section': 'Add row',
    'tool.delete_section': 'Remove section',
    'confirm.delete_section': 'Delete this section and everything in it?',
});

/** Each width, and the class that gives it. */
var WIDTHS = {
    fixed: 'container',
    fluid: 'container-fluid',
    sm: 'container-sm',
    md: 'container-md',
    lg: 'container-lg',
    xl: 'container-xl',
    xxl: 'container-xxl',
};

var ORDER = ['fixed', 'sm', 'md', 'lg', 'xl', 'xxl', 'fluid'];

GridEditor.features.sections = function(ge) {

    var options = Object.assign({ widths: ORDER }, ge.settings.sections);

    function widthOf(section) {
        var found = null;

        Object.keys(WIDTHS).forEach(function(width) {
            if (!found && dom.hasClass(section, WIDTHS[width])) { found = width; }
        });

        return found;
    }

    function isSection(node) {
        return node.parentElement === ge.canvas && widthOf(node) !== null;
    }

    function sections() {
        return dom.children(ge.canvas).filter(isSection);
    }

    function label(width) {
        if (width === 'fixed') { return ge.t('section.fixed'); }
        if (width === 'fluid') { return ge.t('section.fluid'); }

        return ge.t('section.from', { breakpoint: width });
    }

    /**
     * Change a section's width, announced like a utility: the width is its
     * one container class, the same at every breakpoint.
     */
    function setWidth(section, width, source) {
        var from = widthOf(section);
        if (from === width || !WIDTHS[width]) { return false; }

        return ge.operate(function() {
            var payload = ge.payloadFor('section', section, {
                family: 'section',
                breakpoint: 'all',
                tiers: [],
                from: from,
                to: width,
                source: source || 'api',
            });

            if (!ge.emit('before-utility', payload)) {
                var select = dom.one(ge.detailsOf(section), '.ge-section-width select');
                if (select) { select.value = from; }
                return false;
            }

            dom.removeClass(section, WIDTHS[from]);
            dom.addClass(section, WIDTHS[width]);
            ge.emit('after-utility', payload);

            return true;
        });
    }

    function widthField(section) {
        var select = dom.element('select', { 'class': 'form-select form-select-sm' });
        var current = widthOf(section);
        var offered = options.widths.indexOf(current) === -1 ? options.widths.concat([current]) : options.widths;

        ORDER.forEach(function(width) {
            if (offered.indexOf(width) === -1) { return; }
            select.appendChild(dom.element('option', { value: width }, label(width)));
        });

        select.value = current;
        select.addEventListener('change', function() { setWidth(section, this.value, 'panel'); });

        var field = dom.element('label', { 'class': 'ge-utility ge-section-width' });
        field.appendChild(dom.element('span', { 'class': 'ge-utility-label' }, ge.t('section.width')));
        field.appendChild(select);

        return field;
    }

    function createControls(section) {
        var drawer = dom.element('div', { 'class': 'ge-tools-drawer ge-section-drawer' });
        section.insertBefore(drawer, section.firstChild);

        ge.createMoveTool(drawer);
        ge.addSettingsTool(drawer, section, ge.settings.section_classes || []).appendChild(widthField(section));

        ge.createTool(drawer, ge.t('tool.delete_section'), 'ge-delete-section', 'bi bi-trash', function() {
            ge.deleteNode('section', section, ge.t('confirm.delete_section'), function(removed) {
                dom.slideUp(section, removed);
            });
        });

        ge.createTool(drawer, ge.t('tool.add_row_to_section'), 'ge-add-row', 'bi bi-plus-circle', function() {
            ge.place(ge.rowFromLayout([12]), 'row', { appendTo: section });
        });
    }

    function mark() {
        sections().forEach(function(section) {
            dom.addClass(section, 'ge-section');
            if (!dom.child(section, '.ge-tools-drawer')) { createControls(section); }
        });
    }

    function unmark(root) {
        dom.children(root || ge.canvas, '.ge-section').forEach(function(section) {
            dom.removeClass(section, 'ge-section');
        });
    }

    /** createSection(options): a section, detached unless a placement is given. */
    function createSection(settings) {
        settings = settings || {};

        var section = dom.element('div', { 'class': WIDTHS[settings.width] || WIDTHS.fixed });

        (settings.rows || [[12]]).forEach(function(layout) {
            section.appendChild(ge.rowFromLayout(layout));
        });

        return ge.place(section, 'section', settings);
    }

    return {
        methods: {
            createSection: createSection,
        },

        kindOf: function(node) {
            return dom.hasClass(node, 'ge-section') ? 'section' : null;
        },

        // A section is a block the canvas moves, and a region rows move in
        blocks: '.ge-section',
        regions: '.ge-section',

        /** A section goes on the canvas and nowhere else, and holds rows and nothing else. */
        accepts: function(region, node) {
            if (dom.hasClass(node, 'ge-section') || isSectionMade(node)) { return region === ge.canvas; }
            if (dom.hasClass(region, 'ge-section')) { return dom.hasClass(node, 'row'); }

            return true;
        },

        toolbar: [{
            labelKey: 'section.add',
            kind: 'section',
            group: 'content',
            create: function() { return createSection(); },
        }],

        onInit: mark,
        onDeinit: function() { unmark(); },
        cleanMarkup: unmark,
    };

    /** A section the toolbar just made, before init has marked it. */
    function isSectionMade(node) {
        return !node.parentElement && widthOf(node) !== null;
    }
};
