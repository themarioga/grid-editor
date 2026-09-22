/**
 * Gutters for grid-editor.
 *
 * A utility plugin: load this file after the editor and a row's gutters can
 * differ per breakpoint, with Bootstrap's g-{breakpoint}-*, gx-{breakpoint}-*
 * and gy-{breakpoint}-* classes. What it can ask the editor for is the handle
 * its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.gutters.min.js"></script>
 *
 * The editor draws its own frame round every column, narrower than any
 * gutter, so a row with gutter classes is drawn with its real gutters instead.
 *
 * utilities.gutters.scale is what 0 to 5 come to, for a page that changed
 * Bootstrap's $spacers.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.gutters': 'Gutters',
    'utility.gutters_x': 'Horizontal gutters',
    'utility.gutters_y': 'Vertical gutters',
});

var VALUES = ['0', '1', '2', '3', '4', '5'];

/** Bootstrap's own: $spacers, and what a row's gutters are with no class. */
var SCALE = ['0', '.25rem', '.5rem', '1rem', '1.5rem', '3rem'];
var DEFAULT_X = '1.5rem';
var DEFAULT_Y = '0';

var INFIXES = ['', 'sm', 'md', 'lg', 'xl', 'xxl'];
var CLASS_PATTERN = /(?:^|\s)g[xy]?-(?:(?:sm|md|lg|xl|xxl)-)?[0-5](?:\s|$)/;

$.fn.gridEditor.utilities.gutters = function(ge) {

    var options = $.extend({ scale: SCALE }, ge.settings.utilities.gutters);

    /**
     * The class of a family that decides a row's gutters at a breakpoint:
     * the widest breakpoint up to it that has one, as { tier, value }.
     */
    function source(row, prefix, tier) {
        var classes = (row.attr('class') || '').split(/\s+/);

        for (var i = tier; i >= 0; i--) {
            for (var value = VALUES.length - 1; value >= 0; value--) {
                var name = prefix + (INFIXES[i] ? '-' + INFIXES[i] : '') + '-' + value;
                if (classes.indexOf(name) !== -1) { return { tier: i, value: value }; }
            }
        }

        return null;
    }

    /**
     * One axis the way Bootstrap's css settles it. g and gx (or gy) set the
     * same variable, every breakpoint's rules come after the smaller ones',
     * and within a breakpoint the bigger values come later. So the class
     * that wins is the one from the wider breakpoint, then the bigger one -
     * not the more specific family, whatever that would suggest.
     */
    function axis(row, prefix, fallback) {
        var tier = ge.breakpoints.indexOf(ge.view());
        var winner = [source(row, 'g', tier), source(row, prefix, tier)]
            .filter(Boolean)
            .sort(function(a, b) { return b.tier - a.tier || b.value - a.value; })[0];

        return winner ? options.scale[winner.value] : fallback;
    }

    function preview(axes) {
        return function(value, row) {
            var styles = {};

            if (axes.indexOf('x') !== -1) { styles['--bs-gutter-x'] = axis(row, 'gx', DEFAULT_X); }
            if (axes.indexOf('y') !== -1) { styles['--bs-gutter-y'] = axis(row, 'gy', DEFAULT_Y); }

            return styles;
        };
    }

    /**
     * Choosing g sets both axes, so a gx or gy the same breakpoint had is
     * taken off: left on, the bigger of the two would win, and the field the
     * user just chose would not be what the row shows.
     */
    function afterUtility(e, payload) {
        if (payload.family !== 'g') { return; }

        ['gx', 'gy'].forEach(function(family) {
            ge.setUtility(payload.node, family, null, { view: payload.breakpoint, source: payload.source });
        });
    }

    function mark(scope) {
        scope.find('.row').addBack('.row').each(function() {
            var row = $(this);
            row.toggleClass('ge-gutters', CLASS_PATTERN.test(row.attr('class') || ''));
        });
    }

    return {
        families: [
            {
                name: 'g',
                prefix: 'g',
                values: VALUES,
                appliesTo: ['row'],
                labelKey: 'utility.gutters',
                preview: preview(['x', 'y']),
            },
            {
                name: 'gx',
                prefix: 'gx',
                values: VALUES,
                appliesTo: ['row'],
                labelKey: 'utility.gutters_x',
                preview: preview(['x']),
            },
            {
                name: 'gy',
                prefix: 'gy',
                values: VALUES,
                appliesTo: ['row'],
                labelKey: 'utility.gutters_y',
                preview: preview(['y']),
            },
        ],

        onInit: function() {
            ge.canvas.off('grideditor:after-utility.ge-gutters').on('grideditor:after-utility.ge-gutters', afterUtility);
        },

        onRefresh: mark,

        onDeinit: function() {
            ge.canvas.off('grideditor:after-utility.ge-gutters');
            ge.canvas.find('.ge-gutters').removeClass('ge-gutters');
        },
    };
};

})(jQuery);
