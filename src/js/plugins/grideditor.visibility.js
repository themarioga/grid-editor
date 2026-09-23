/**
 * Visibility for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * element and container can be hidden at some breakpoints and shown at
 * others, with Bootstrap's d-{breakpoint}-none and d-{breakpoint}-block (or
 * -flex, for a row, which is a flex container and stops being a grid as a
 * block). What it can ask the editor for is the handle its factory is called
 * with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.visibility.min.js"></script>
 *
 * A hidden node is never hidden from the editor, which would leave nothing to
 * click to show it again. It stays on the canvas, faded and striped in a view
 * where it is hidden, and in the all view says at which breakpoints it is.
 *
 * utilities.visibility.drawer: false leaves the eye out of the drawers, and
 * the panel field is the only control.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.visibility': 'Visibility',
    'utility.visibility_hidden': 'Hidden',
    'utility.visibility_shown': 'Shown',
    'tool.hide_in_view': 'Hide in this view',
    'tool.show_in_view': 'Show in this view',
    'badge.hidden_in': 'Hidden at {breakpoints}',
});

/** A node that carries any class of the family, at any breakpoint. */
var CLASS_PATTERN = /(?:^|\s)d-(?:(?:sm|md|lg|xl|xxl)-)?(?:none|block|flex)(?:\s|$)/;

var NODES = '.row, .column, .ge-content, .ge-element, [data-ge-container]';

$.fn.gridEditor.utilities.visibility = function(ge) {

    var options = $.extend({ drawer: true }, ge.settings.utilities.visibility);

    /** What "shown" is written as on this kind of node. */
    function shown(kind) {
        return kind === 'row' ? 'flex' : 'block';
    }

    function applies(node, kind) {
        return kind === 'row' || kind === 'column' || kind === 'element' || kind === 'text' ||
            node.is('[data-ge-container]');
    }

    function hiddenAt(node, view) {
        return ge.getUtility(node, 'visibility', view) === 'none';
    }

    /** The breakpoints at which the node is hidden, smallest first. */
    function hiddenTiers(node) {
        return ge.breakpoints.filter(function(key) { return hiddenAt(node, key); });
    }

    /**
     * Whether the node is hidden in the view being edited. In the all view
     * that means hidden at every breakpoint, since "hidden at some" is what
     * the badge is for.
     */
    function hiddenHere(node) {
        return ge.view() === 'all'
            ? hiddenTiers(node).length === ge.breakpoints.length
            : hiddenAt(node, ge.view());
    }

    /** What the breakpoint below the view shows, which an inherit falls back to. */
    function hiddenBelow(node) {
        var index = ge.breakpoints.indexOf(ge.view());

        return index > 0 && hiddenAt(node, ge.breakpoints[index - 1]);
    }

    /**
     * Hide or show the node in the view being edited, with as few classes as
     * that takes. In a breakpoint view that is often none at all: showing a
     * node the breakpoint below shows removes this breakpoint's d-*-none
     * rather than writing a d-*-block on top of it. In the all view a node
     * is hidden everywhere or shown everywhere, and shown is no class.
     */
    function toggle(node, kind) {
        var hide = !hiddenHere(node);
        var value;

        if (ge.view() === 'all') {
            value = hide ? 'none' : null;
        } else if (hide) {
            value = hiddenBelow(node) ? null : 'none';
        } else {
            value = hiddenBelow(node) ? shown(kind) : null;
        }

        ge.setUtility(node, 'visibility', value, { source: 'tool' });
    }

    /**
     * The canvas shows each node as the view sees it. ge-visibility keeps a
     * node Bootstrap would hide on the canvas, ge-hidden-in-view fades it,
     * and data-ge-hidden-in carries the badge text for the all view.
     */
    function mark(scope) {
        scope.find(NODES).addBack(NODES).each(function() {
            var node = $(this);
            var kind = ge.kindOf(node);
            var carries = applies(node, kind) && CLASS_PATTERN.test(node.attr('class') || '');
            var tiers = carries ? hiddenTiers(node) : [];
            var here = carries && hiddenHere(node);
            var partly = carries && ge.view() === 'all' && tiers.length > 0 && !here;

            node.toggleClass('ge-visibility', carries).toggleClass('ge-hidden-in-view', here);

            if (partly) {
                node.attr('data-ge-hidden-in', ge.t('badge.hidden_in', { breakpoints: tiers.join(', ') }));
            } else {
                node.removeAttr('data-ge-hidden-in');
            }

            node.children('.ge-tools-drawer').children('.ge-visibility-tool').each(function() {
                $(this)
                    .attr('title', here ? ge.t('tool.show_in_view') : ge.t('tool.hide_in_view'))
                    .find('i').attr('class', here ? 'bi bi-eye-slash' : 'bi bi-eye');
            });
        });
    }

    function unmark() {
        ge.canvas.find('.ge-visibility, .ge-hidden-in-view, [data-ge-hidden-in]').each(function() {
            var node = $(this)
                .removeClass('ge-visibility ge-hidden-in-view')
                .removeAttr('data-ge-hidden-in')
            ;

            if (!node.attr('class')) { node.removeAttr('class'); }
        });
    }

    return {
        families: [{
            name: 'visibility',
            prefix: 'd',
            values: ['none', 'block', 'flex'],
            appliesTo: ['row', 'column', 'text', 'element', 'container'],
            labelKey: 'utility.visibility',

            /** Hidden, or shown the way this kind of node is shown. */
            choices: function(node, kind) {
                return ['none', shown(kind)];
            },

            label: function(value) {
                return value === 'none' ? ge.t('utility.visibility_hidden') : ge.t('utility.visibility_shown');
            },
        }],

        drawerTools: function(drawer, node, kind) {
            if (!options.drawer || !applies(node, kind)) { return; }

            ge.createTool(drawer, ge.t('tool.hide_in_view'), 'ge-visibility-tool', 'bi bi-eye', function() {
                toggle(node, kind);
            });
        },

        onRefresh: mark,
        onDeinit: unmark,
    };
};

})(jQuery);
