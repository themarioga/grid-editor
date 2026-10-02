/**
 * The drawer of a flex or grid node, a part of the inline-style plugin.
 *
 * A drawer is its node's first child, in the flow: in a row, which wraps,
 * it is a line of its own above the columns, but in anything else that
 * lays its children out - a column made flex, a row that does not wrap, a
 * grid - it would be one of the items, beside the content or in a cell of
 * its own. So on such a node the drawer leaves the flow: it sits on top, as
 * wide as the node, over a transparent top border as tall as it is, and
 * the content is laid out below as the page would lay it out.
 *
 * The node's own style is the host's, so what is written on it is an
 * attribute, and the border comes from a rule per height, here.
 */
import * as dom from '../dom.js';

var NODES = '.row, .column, .ge-element, [data-ge-container]';
var OUT_CLASS = 'ge-drawer-out';
var OUT_ATTR = 'data-ge-drawer-out';

/** The space left between the drawer and the content, as the editor's frame leaves it. */
var GAP = 5;

var LAYS_OUT = /^(?:inline-)?(?:flex|grid)$/;

export function drawerflowPart(ge) {

    var sheet = null;
    var heights = {};
    var observer = null;

    /** The rule for a node whose drawer takes this much room. */
    function rule(room) {
        if (heights[room]) { return; }
        heights[room] = true;

        if (!sheet) {
            sheet = document.head.appendChild(dom.element('style', { 'data-ge-drawer-flow': '' }));
        }

        var node = '.ge-canvas.ge-editing [' + OUT_ATTR + '="' + room + '"]';
        sheet.appendChild(document.createTextNode(
            node + ' { border-top-width: ' + room + 'px !important; }\n' +
            node + ' > .ge-tools-drawer { top: -' + room + 'px; }\n'
        ));
    }

    /** Whether the node lays its drawer out as an item of its own. */
    function laysOut(node) {
        var style = getComputedStyle(node);

        if (!LAYS_OUT.test(style.display)) { return false; }

        // A row as the grid has it: its drawer is a line of its own already
        return !(dom.hasClass(node, 'row') && style.flexDirection === 'row' && style.flexWrap === 'wrap');
    }

    function measure(node, drawer) {
        var room = Math.ceil(drawer.offsetHeight) + GAP;

        rule(room);
        node.setAttribute(OUT_ATTR, String(room));
    }

    /** A drawer that grows - its tools wrap, its settings unfold - takes more room. */
    function watch(drawer) {
        if (typeof ResizeObserver === 'undefined') { return; }

        if (!observer) {
            observer = new ResizeObserver(function(entries) {
                entries.forEach(function(entry) {
                    var node = entry.target.parentNode;
                    if (node && dom.hasClass(node, OUT_CLASS)) { measure(node, entry.target); }
                });
            });
        }
        observer.observe(drawer);
    }

    function mark(scope) {
        dom.selfAndAll(scope, NODES).forEach(function(node) {
            var drawer = dom.child(node, '.ge-tools-drawer');
            if (!drawer) { return; }

            if (laysOut(node)) {
                dom.addClass(node, OUT_CLASS);
                measure(node, drawer);
                watch(drawer);
            } else if (dom.hasClass(node, OUT_CLASS)) {
                dom.removeClass(node, OUT_CLASS);
                node.removeAttribute(OUT_ATTR);
                dom.dropEmptyClass(node);
                if (observer) { observer.unobserve(drawer); }
            }
        });
    }

    function unmarkNodes(root) {
        dom.all(root, '.' + OUT_CLASS).forEach(function(node) {
            dom.removeClass(node, OUT_CLASS);
            node.removeAttribute(OUT_ATTR);
            dom.dropEmptyClass(node);
        });
    }

    function unmark() {
        if (observer) { observer.disconnect(); }
        observer = null;

        unmarkNodes(ge.canvas);

        if (sheet) { sheet.remove(); }
        sheet = null;
        heights = {};
    }

    return {
        families: [],
        onRefresh: mark,
        onDeinit: unmark,
        cleanMarkup: unmarkNodes,
    };
}
