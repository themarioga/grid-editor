/**
 * Spacing for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * element and container can have its padding and margin set per breakpoint,
 * with Bootstrap's p-{breakpoint}-*, pt-, px- … and m-{breakpoint}-*, mt-, mx-
 * … classes. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.spacing.min.js"></script>
 *
 * Fourteen families would be fourteen fields, so the panel has two, padding
 * and margin, each a choice of side and a value for that side.
 *
 * utilities.spacing.values narrows the values offered, and
 * utilities.spacing.scale is what 0 to 5 come to, for a page that changed
 * Bootstrap's $spacers.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.padding': 'Padding',
    'utility.margin': 'Margin',
    'utility.side_all': 'All sides',
    'utility.side_x': 'Left and right',
    'utility.side_y': 'Top and bottom',
    'utility.side_t': 'Top',
    'utility.side_b': 'Bottom',
    'utility.side_s': 'Start',
    'utility.side_e': 'End',
    'utility.spacing_gutter': 'A column\'s side padding is its gutter: changing it changes the gutter',
});

var VALUES = ['0', '1', '2', '3', '4', '5'];

/** Bootstrap's $spacers. */
var SCALE = ['0', '.25rem', '.5rem', '1rem', '1.5rem', '3rem'];

/**
 * The sides, in the order Bootstrap's css writes their rules: within one
 * breakpoint a later rule wins, so p-3 pt-1 has a top of .25rem.
 */
var SIDES = ['', 'x', 'y', 't', 'e', 'b', 's'];

/** What each side sets. Start and end are left and right: Bootstrap's css is left to right. */
var SET = {
    '': ['top', 'right', 'bottom', 'left'],
    x: ['left', 'right'],
    y: ['top', 'bottom'],
    t: ['top'],
    e: ['right'],
    b: ['bottom'],
    s: ['left'],
};

var INFIXES = ['', 'sm', 'md', 'lg', 'xl', 'xxl'];

var PROPERTIES = { p: 'padding', m: 'margin' };

/** Every class of the plugin's, padding or margin. */
function pattern(key) {
    return new RegExp('^' + key + '[xytbse]?-(?:(?:sm|md|lg|xl|xxl)-)?(?:[0-5]|auto)$');
}

$.fn.gridEditor.utilities.spacing = function(ge) {

    var options = $.extend({ values: VALUES, scale: SCALE }, ge.settings.utilities.spacing);
    var patterns = { p: pattern('p'), m: pattern('m') };

    function applies(node, kind) {
        return kind === 'row' || kind === 'column' || kind === 'element' ||
            node.is('[data-ge-container]');
    }

    function classes(node) {
        return (node.attr('class') || '').split(/\s+/);
    }

    function carries(node, key) {
        return classes(node).some(function(name) { return patterns[key].test(name); });
    }

    /**
     * The class of one family that decides a side at a breakpoint: the
     * widest breakpoint up to it that has one, as { tier, value }.
     */
    function source(node, family, tier) {
        var names = classes(node);
        var values = family.charAt(0) === 'm' ? VALUES.concat(['auto']) : VALUES;

        for (var i = tier; i >= 0; i--) {
            for (var v = 0; v < values.length; v++) {
                var name = family + (INFIXES[i] ? '-' + INFIXES[i] : '') + '-' + values[v];
                if (names.indexOf(name) !== -1) { return { tier: i, value: values[v] }; }
            }
        }

        return null;
    }

    /**
     * What padding or margin is on each side with none of the plugin's
     * classes: the editor's frame for a row or a column, the host's css
     * for anything else. Read by taking the classes off for a moment,
     * since that is the only way to ask the browser.
     */
    function without(node, key) {
        var original = node.attr('class');
        var style;
        var bare = {};

        node.attr('class', classes(node).filter(function(name) { return !patterns[key].test(name); }).join(' '));
        style = getComputedStyle(node[0]);
        ['top', 'right', 'bottom', 'left'].forEach(function(side) {
            bare[side] = style.getPropertyValue(PROPERTIES[key] + '-' + side);
        });
        node.attr('class', original);

        return bare;
    }

    /**
     * Each side the way Bootstrap's css settles it: the class from the
     * widest breakpoint wins, and within one breakpoint the side written
     * later in the css. A side no class reaches shows what it is without
     * any, over a wider breakpoint's class that is live in a wide window.
     */
    function sides(node, key, breakpoint) {
        var tier = ge.breakpoints.indexOf(breakpoint);
        var winners = {};
        var styles = {};
        var neutral = null;

        SIDES.forEach(function(side, order) {
            var found = source(node, key + side, tier);
            if (!found) { return; }

            SET[side].forEach(function(set) {
                var current = winners[set];
                if (!current || found.tier > current.tier || (found.tier === current.tier && order > current.order)) {
                    winners[set] = { tier: found.tier, order: order, value: found.value };
                }
            });
        });

        ['top', 'right', 'bottom', 'left'].forEach(function(set) {
            var winner = winners[set];

            if (!winner) {
                neutral = neutral || without(node, key);
                styles[PROPERTIES[key] + '-' + set] = neutral[set];
            } else {
                styles[PROPERTIES[key] + '-' + set] = winner.value === 'auto' ? 'auto' : options.scale[winner.value];
            }
        });

        return styles;
    }

    /** The side a group's select starts on: the first that has a class, or all. */
    function startingSide(node, key) {
        var names = classes(node).filter(function(name) { return patterns[key].test(name); });
        var found = SIDES.filter(function(side) {
            return names.some(function(name) { return name.indexOf(key + side + '-') === 0; });
        });

        return found.length ? found[0] : '';
    }

    function sideLabel(side) {
        switch (side) {
            case 'x': return ge.t('utility.side_x');
            case 'y': return ge.t('utility.side_y');
            case 't': return ge.t('utility.side_t');
            case 'b': return ge.t('utility.side_b');
            case 's': return ge.t('utility.side_s');
            case 'e': return ge.t('utility.side_e');
            default: return ge.t('utility.side_all');
        }
    }

    /** A padding or margin group: its name, the side, and the field of that side's family. */
    function group(node, key, labelText) {
        var box = $('<div class="ge-spacing-group" />').attr('data-ge-spacing', key);
        var side = $('<select class="ge-spacing-side" />');

        $('<span class="ge-utility-label" />').text(labelText).appendTo(box);

        SIDES.forEach(function(value) {
            $('<option />').attr('value', value).text(sideLabel(value)).appendTo(side);
        });

        var field = ge.utilityField(node, key + startingSide(node, key));

        side.val(field.attr('data-ge-family').slice(1))
            .on('change', function() {
                var next = ge.utilityField(node, key + this.value);
                field.replaceWith(next);
                field = next;
            })
            .appendTo(box)
        ;
        field.appendTo(box);

        return box;
    }

    var NODES = '.row, .column, .ge-element, [data-ge-container]';

    /**
     * Keep each drawer on its node's edges. A drawer is pulled out over the
     * editor's frame by as much as the frame pads the node, and a padding
     * class replaces the frame, so a padded node's drawer is pulled out by
     * its real padding instead. And a column padded at the sides gets a word
     * about what that does to its gutter.
     */
    function mark(scope) {
        scope.find(NODES).addBack(NODES).each(function() {
            var node = $(this);
            var drawer = node.children('.ge-tools-drawer');

            if (!drawer.length || !applies(node, ge.kindOf(node))) { return; }

            if (carries(node, 'p')) {
                var style = getComputedStyle(node[0]);

                drawer.css({
                    marginTop: '-' + style.paddingTop,
                    marginLeft: '-' + style.paddingLeft,
                    marginRight: '-' + style.paddingRight,
                    width: 'calc(100% + ' + style.paddingLeft + ' + ' + style.paddingRight + ')',
                });
            } else {
                drawer.css({ marginTop: '', marginLeft: '', marginRight: '', width: '' });
            }

            if (node.hasClass('column')) {
                drawer.find('.ge-spacing-gutter').toggle(classes(node).some(function(name) {
                    return /^p[xse]?-/.test(name) && patterns.p.test(name);
                }));
            }
        });
    }

    function families(key, labelKey) {
        var values = key === 'm' ? VALUES.concat(['auto']) : VALUES;
        var offered = options.values.concat(key === 'm' ? ['auto'] : []);

        return SIDES.map(function(side) {
            return {
                name: key + side,
                prefix: key + side,
                values: values,
                appliesTo: ['row', 'column', 'element', 'container'],
                labelKey: labelKey,
                panel: false,
                choices: function() {
                    return values.filter(function(value) { return offered.indexOf(value) !== -1; });
                },
            };
        });
    }

    return {
        families: families('p', 'utility.padding').concat(families('m', 'utility.margin')),

        panel: function(node, kind) {
            if (!applies(node, kind)) { return null; }

            var box = $('<div class="ge-spacing" />')
                .append(group(node, 'p', ge.t('utility.padding')))
                .append(group(node, 'm', ge.t('utility.margin')))
            ;

            if (kind === 'column') {
                $('<small class="ge-spacing-gutter" />').text(ge.t('utility.spacing_gutter')).appendTo(box);
            }

            return box;
        },

        preview: function(node, kind, breakpoint) {
            if (!applies(node, kind)) { return {}; }

            var styles = {};

            ['p', 'm'].forEach(function(key) {
                if (carries(node, key)) { $.extend(styles, sides(node, key, breakpoint)); }
            });

            return styles;
        },

        onRefresh: mark,
    };
};

})(jQuery);
