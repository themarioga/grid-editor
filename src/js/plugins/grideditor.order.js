/**
 * Column order for grid-editor.
 *
 * A utility plugin: load this file after the editor and a column's place in
 * its row can differ per breakpoint, with Bootstrap's order-{breakpoint}-*
 * classes. What it can ask the editor for is the handle its factory is called
 * with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.order.min.js"></script>
 *
 * Two arrows in each column's drawer move it one place earlier or later in
 * the view being edited, by numbering the row's columns; the markup does not
 * move. Dragging still moves the markup, as it always has.
 *
 * utilities.order.drawer: false leaves the arrows out, and the panel field is
 * the only control.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.order': 'Order',
    'utility.order_first': 'First',
    'utility.order_last': 'Last',
    'tool.order_earlier': 'Earlier in this view',
    'tool.order_later': 'Later in this view',
    'badge.order': 'Order: {value}',
});

var VALUES = ['first', '0', '1', '2', '3', '4', '5', 'last'];

/** Where each value puts a column, as Bootstrap's css has it. */
var RANK = { first: -1, last: 6 };

/** A column that carries any class of the family, at any breakpoint. */
var CLASS_PATTERN = /(?:^|\s)order-(?:(?:sm|md|lg|xl|xxl)-)?(?:first|last|[0-5])(?:\s|$)/;

$.fn.gridEditor.utilities.order = function(ge) {

    var options = $.extend({ drawer: true }, ge.settings.utilities.order);
    var warnedAboutDrag = false;

    function rank(value) {
        if (value === null) { return 0; }

        return RANK[value] !== undefined ? RANK[value] : parseInt(value, 10);
    }

    function label(value) {
        if (value === 'first') { return ge.t('utility.order_first'); }
        if (value === 'last') { return ge.t('utility.order_last'); }

        return value;
    }

    /** The columns of a row in the order a view shows them, given what each one's order is. */
    function visualOrder(columns, read) {
        return columns.get()
            .map(function(element, index) {
                return { element: element, index: index, rank: rank(read($(element))) };
            })
            .sort(function(a, b) { return a.rank - b.rank || a.index - b.index; })
            .map(function(entry) { return entry.element; });
    }

    function sameOrder(a, b) {
        return a.every(function(element, index) { return element === b[index]; });
    }

    /**
     * The values that put n columns in n places, or null past eight: that
     * is how many places Bootstrap's order classes have.
     */
    function slots(count) {
        if (count <= 6) { return VALUES.slice(1, 1 + count); }
        if (count === 7) { return VALUES.slice(1); }
        if (count === 8) { return VALUES.slice(); }

        return null;
    }

    /**
     * Move a column one place earlier or later in the view being edited.
     *
     * The row's columns are numbered in their new order. When that order is
     * the markup's own, the numbers are taken off instead - unless what is
     * left underneath, the breakpoint below, would then order them some other
     * way, and the numbers are what keep them in the markup's order.
     */
    function move(col, direction) {
        var view = ge.view();
        var columns = col.parent().children('.column');
        var shown = visualOrder(columns, function(column) { return ge.getUtility(column, 'order', view); });
        var from = shown.indexOf(col[0]);
        var to = from + direction;

        if (to < 0 || to >= shown.length) { return; }

        shown.splice(to, 0, shown.splice(from, 1)[0]);

        var values = null;
        if (!sameOrder(shown, columns.get()) || !inheritsMarkupOrder(columns, view)) {
            values = slots(shown.length);

            if (!values) {
                ge.warn('a row of ' + shown.length + ' columns cannot be reordered with Bootstrap\'s ' +
                    'order classes, which have eight places');
                return;
            }
        }

        ge.operate(function() {
            shown.forEach(function(element, index) {
                ge.setUtility($(element), 'order', values ? values[index] : null, { source: 'tool' });
            });
        });
    }

    /** Whether taking this view's classes off leaves the columns in the markup's order. */
    function inheritsMarkupOrder(columns, view) {
        var index = ge.breakpoints.indexOf(view);
        if (index <= 0) { return true; }

        var below = ge.breakpoints[index - 1];

        return sameOrder(visualOrder(columns, function(column) {
            return ge.getUtility(column, 'order', below);
        }), columns.get());
    }

    /** Whether a row's columns are ordered by class, rather than by the markup, in this view. */
    function ordered(row) {
        return row.children('.column').get().some(function(element) {
            return ge.getUtility($(element), 'order', ge.view()) !== null;
        });
    }

    /** The badge: a column ordered by class in this view says where. */
    function mark(scope) {
        scope.find('.column').addBack('.column').each(function() {
            var col = $(this);
            var value = CLASS_PATTERN.test(col.attr('class') || '')
                ? ge.getUtility(col, 'order', ge.view())
                : null;

            if (value === null) {
                col.removeAttr('data-ge-order');
            } else {
                col.attr('data-ge-order', ge.t('badge.order', { value: label(value) }));
            }
        });
    }

    /**
     * A column dropped in a row ordered by class lands where the markup puts
     * it, and shows up where its order does, which is worth saying once.
     */
    function afterMove(e, payload) {
        if (warnedAboutDrag || payload.kind !== 'column' || !payload.to) { return; }
        if (!ordered(payload.to.parent)) { return; }

        warnedAboutDrag = true;
        ge.warn('a column was dropped in a row whose columns carry order classes in this view: ' +
            'where it shows is set by those classes, not by where it sits in the markup');
    }

    return {
        families: [{
            name: 'order',
            prefix: 'order',
            values: VALUES,
            appliesTo: ['column'],
            labelKey: 'utility.order',
            label: label,
            preview: function(value) {
                return { order: rank(value) };
            },
        }],

        drawerTools: function(drawer, node, kind) {
            if (!options.drawer || kind !== 'column') { return; }

            ge.createTool(drawer, ge.t('tool.order_earlier'), 'ge-order-earlier', 'bi bi-chevron-left', function() {
                move(node, -1);
            });
            ge.createTool(drawer, ge.t('tool.order_later'), 'ge-order-later', 'bi bi-chevron-right', function() {
                move(node, 1);
            });
        },

        // init runs again whenever a node is added, without a deinit
        // between, so the listener is replaced rather than stacked
        onInit: function() {
            ge.canvas.off('grideditor:after-move.ge-order').on('grideditor:after-move.ge-order', afterMove);
        },

        onRefresh: mark,

        onDeinit: function() {
            ge.canvas.off('grideditor:after-move.ge-order');
            ge.canvas.find('[data-ge-order]').removeAttr('data-ge-order');
        },
    };
};

})(jQuery);
