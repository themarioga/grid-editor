/**
 * Display, a part of the style plugin: how a node is displayed per
 * breakpoint, hidden included, with Bootstrap's d-{breakpoint}-* classes,
 * and the eye in the drawers that hides and shows it.
 *
 * Its families, and whatever it does on the canvas, as a function of the
 * handle and its options: grideditor.style.js puts them in its sections.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'utility.display': 'Display',
    'utility.visibility_hidden': 'Hidden',
    'tool.hide_in_view': 'Hide in this view',
    'tool.show_in_view': 'Show in this view',
    'badge.hidden_in': 'Hidden at {breakpoints}',
});

/** Bootstrap's display values, less its table ones. */
var VALUES = ['none', 'inline', 'inline-block', 'block', 'grid', 'inline-grid', 'flex', 'inline-flex'];

/** A node that carries any class of the family, at any breakpoint. */
var CLASS_PATTERN = new RegExp('(?:^|\\s)d-(?:(?:sm|md|lg|xl|xxl)-)?(?:' + VALUES.join('|') + ')(?:\\s|$)');
var NONE_PATTERN = /^d-(?:(?:sm|md|lg|xl|xxl)-)?none$/;

var NODES = '.row, .column, .ge-content, .ge-element, [data-ge-container]';

/** What the canvas shows a hidden node as, in a view where Bootstrap hides it. */
var SHOWN_ATTR = 'data-ge-display';

export function displayPart(ge, given) {

    var options = Object.assign({ drawer: true }, given);

    /**
     * What a kind of node is offered: a row is a flex container or it is no
     * grid, and a text is a block of text.
     */
    function choices(kind) {
        if (kind === 'row') { return ['none', 'flex']; }
        if (kind === 'text' || kind === 'plain') { return ['none', 'block']; }

        return VALUES;
    }

    /** What "shown" is written as on this kind of node, when nothing below says. */
    function shownByDefault(kind) {
        return kind === 'row' ? 'flex' : 'block';
    }

    function applies(node, kind) {
        return kind === 'row' || kind === 'column' || kind === 'element' || kind === 'text' || kind === 'plain' ||
            dom.is(node, '[data-ge-container]');
    }

    function hiddenAt(node, view) {
        return ge.getUtility(node, 'display', view) === 'none';
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
     * How the nearest breakpoint below this one that shows the node shows
     * it, or null when none below does.
     */
    function shownBelow(node, view) {
        for (var i = ge.breakpoints.indexOf(view) - 1; i >= 0; i--) {
            var value = ge.getUtility(node, 'display', ge.breakpoints[i]);

            if (value === null) { return null; }
            if (value !== 'none') { return value; }
        }

        return null;
    }

    /**
     * Hide or show the node in the view being edited, with as few classes as
     * that takes. In a breakpoint view that is often none at all: showing a
     * node the breakpoint below shows removes this breakpoint's d-*-none
     * rather than writing another class on top of it. Showing one that the
     * breakpoint below hides writes the display it had further down, so a
     * flex column comes back flex. In the all view a node is hidden
     * everywhere or shown everywhere, and shown is no class.
     */
    function toggle(node, kind) {
        var hide = !hiddenHere(node);
        var value;

        if (ge.view() === 'all') {
            value = hide ? 'none' : null;
        } else if (hide) {
            value = hiddenBelow(node) ? null : 'none';
        } else {
            value = hiddenBelow(node) ? (shownBelow(node, ge.view()) || shownByDefault(kind)) : null;
        }

        ge.setUtility(node, 'display', value, { source: 'tool' });
    }

    /**
     * A node Bootstrap hides in this view stays on the canvas, shown as it
     * would be if it were not hidden: with its classes' none taken off for
     * the moment it takes to ask the browser.
     */
    function shownAs(node) {
        var original = node.getAttribute('class');

        node.setAttribute('class', original.split(/\s+/).filter(function(name) {
            return !NONE_PATTERN.test(name);
        }).join(' '));

        var display = getComputedStyle(node).display;
        node.setAttribute('class', original);

        // The canvas has a rule for each of Bootstrap's values, and a block for anything else
        return display !== 'none' && VALUES.indexOf(display) !== -1 ? display : 'block';
    }

    /**
     * The canvas shows each node as the view sees it. A node Bootstrap would
     * hide is kept on the canvas with the display it would have, and
     * ge-hidden-in-view fades it; data-ge-hidden-in carries the badge text
     * for the all view.
     */
    function mark(scope) {
        dom.selfAndAll(scope, NODES).forEach(function(node) {
            var kind = ge.kindOf(node);
            var carries = applies(node, kind) && CLASS_PATTERN.test(node.getAttribute('class') || '');
            var tiers = carries ? hiddenTiers(node) : [];
            var here = carries && hiddenHere(node);
            var partly = carries && ge.view() === 'all' && tiers.length > 0 && !here;

            node.removeAttribute(SHOWN_ATTR);
            if (carries && getComputedStyle(node).display === 'none') {
                node.setAttribute(SHOWN_ATTR, shownAs(node));
            }

            dom.toggleClass(node, 'ge-hidden-in-view', here);

            if (partly) {
                node.setAttribute('data-ge-hidden-in', ge.t('badge.hidden_in', { breakpoints: tiers.join(', ') }));
            } else {
                node.removeAttribute('data-ge-hidden-in');
            }

            dom.children(node, '.ge-tools-drawer').forEach(function(drawer) {
                dom.children(drawer, '.ge-visibility-tool').forEach(function(tool) {
                    tool.setAttribute('title', here ? ge.t('tool.show_in_view') : ge.t('tool.hide_in_view'));
                    dom.all(tool, 'i').forEach(function(icon) {
                        icon.setAttribute('class', here ? 'bi bi-eye-slash' : 'bi bi-eye');
                    });
                });
            });
        });
    }

    function unmark() {
        dom.all(ge.canvas, '.ge-hidden-in-view, [data-ge-hidden-in], [' + SHOWN_ATTR + ']').forEach(function(node) {
            dom.removeClass(node, 'ge-hidden-in-view');
            node.removeAttribute('data-ge-hidden-in');
            node.removeAttribute(SHOWN_ATTR);
            dom.dropEmptyClass(node);
        });
    }

    return {
        families: [{
            name: 'display',
            prefix: 'd',
            values: VALUES,
            appliesTo: ['row', 'column', 'text', 'element', 'container'],
            labelKey: 'utility.display',

            choices: function(node, kind) {
                return choices(kind);
            },

            label: function(value) {
                return value === 'none' ? ge.t('utility.visibility_hidden') : value;
            },

            /**
             * What the view being edited displays the node as. Hidden is
             * shown the way the breakpoints below show it, since the canvas
             * keeps a hidden node, faded; with no class applying, it is what
             * the node is without any.
             */
            preview: function(value, node) {
                if (value === 'none') { value = shownBelow(node, ge.view()); }

                return { display: value === null ? ge.bareStyle(node, 'display', 'display') : value };
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
}
