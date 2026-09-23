/**
 * Sections for grid-editor.
 *
 * A feature plugin: load this file after the editor and the canvas can hold
 * sections - Bootstrap's .container, .container-fluid and .container-{bp} -
 * each grouping rows at a width of its own. What it can ask the editor for is
 * the handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.sections.min.js"></script>
 *
 * Called sections, not containers, because a container is what the tabs,
 * accordion, popup and card plugins make. A section is recognised by its
 * Bootstrap class alone, and only as a child of the canvas: a .container
 * somewhere inside an element's markup is that element's business.
 *
 * sections.widths narrows the widths the field offers.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
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

$.fn.gridEditor.features.sections = function(ge) {

    var options = $.extend({ widths: ORDER }, ge.settings.sections);

    function widthOf(section) {
        var found = null;

        $.each(WIDTHS, function(width, className) {
            if (!found && section.hasClass(className)) { found = width; }
        });

        return found;
    }

    function isSection(node) {
        return node.parent()[0] === ge.canvas[0] && widthOf(node) !== null;
    }

    function sections() {
        return ge.canvas.children().filter(function() { return isSection($(this)); });
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
                ge.detailsOf(section).find('.ge-section-width select').val(from);
                return false;
            }

            section.removeClass(WIDTHS[from]).addClass(WIDTHS[width]);
            ge.emit('after-utility', payload);

            return true;
        });
    }

    function widthField(section) {
        var select = $('<select class="form-select form-select-sm" />');
        var current = widthOf(section);
        var offered = options.widths.indexOf(current) === -1 ? options.widths.concat([current]) : options.widths;

        ORDER.forEach(function(width) {
            if (offered.indexOf(width) === -1) { return; }
            $('<option />').attr('value', width).text(label(width)).appendTo(select);
        });

        select.val(current).on('change', function() { setWidth(section, this.value, 'panel'); });

        return $('<label class="ge-utility ge-section-width" />')
            .append($('<span class="ge-utility-label" />').text(ge.t('section.width')))
            .append(select);
    }

    function createControls(section) {
        var drawer = $('<div class="ge-tools-drawer ge-section-drawer" />').prependTo(section);

        ge.createMoveTool(drawer);
        ge.addSettingsTool(drawer, section, ge.settings.section_classes || []).append(widthField(section));

        ge.createTool(drawer, ge.t('tool.delete_section'), 'ge-delete-section', 'bi bi-trash', function() {
            ge.deleteNode('section', section, ge.t('confirm.delete_section'), function(removed) {
                section.slideUp(removed);
            });
        });

        ge.createTool(drawer, ge.t('tool.add_row_to_section'), 'ge-add-row', 'bi bi-plus-circle', function() {
            ge.place(ge.rowFromLayout([12]), 'row', { appendTo: section });
        });
    }

    function mark() {
        sections().each(function() {
            var section = $(this).addClass('ge-section');
            if (!section.children('.ge-tools-drawer').length) { createControls(section); }
        });
    }

    function unmark() {
        ge.canvas.children('.ge-section').removeClass('ge-section');
    }

    /** createSection(options): a section, detached unless a placement is given. */
    function createSection(settings) {
        settings = settings || {};

        var section = $('<div />').addClass(WIDTHS[settings.width] || WIDTHS.fixed);

        (settings.rows || [[12]]).forEach(function(layout) {
            ge.rowFromLayout(layout).appendTo(section);
        });

        return ge.place(section, 'section', settings);
    }

    return {
        methods: {
            createSection: createSection,
        },

        kindOf: function(node) {
            return node.hasClass('ge-section') ? 'section' : null;
        },

        // A section is a block the canvas moves, and a region rows move in
        blocks: '.ge-section',
        regions: '.ge-section',

        /** A section goes on the canvas and nowhere else, and holds rows and nothing else. */
        accepts: function(region, node) {
            if (node.hasClass('ge-section') || isSectionMade(node)) { return region[0] === ge.canvas[0]; }
            if (region.hasClass('ge-section')) { return node.hasClass('row'); }

            return true;
        },

        toolbar: [{
            labelKey: 'section.add',
            kind: 'section',
            create: function() { return createSection(); },
        }],

        onInit: mark,
        onDeinit: unmark,
    };

    /** A section the toolbar just made, before init has marked it. */
    function isSectionMade(node) {
        return !node.parent().length && widthOf(node) !== null;
    }
};

})(jQuery);
