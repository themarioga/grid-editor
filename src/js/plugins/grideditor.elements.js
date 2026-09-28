/**
 * Element level controls for grid-editor.
 *
 * A feature plugin: load this file after the editor and the nodes a host
 * marked become elements - one movable, deletable block each, in the column
 * beside the texts, instead of rich text. What it can ask the editor for is
 * the handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.elements.min.js"></script>
 *
 * Up to 5.x an element lived inside a content area, among the text. Markup
 * saved that way still loads: the editor takes each element out of the text
 * it sits in, which is what `cuts` is for.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'tool.delete_element': 'Remove element',
    'tool.element_info': 'Element: {name}',
    'confirm.delete_element': 'Delete element?',
});

/** A column's children that are something else than an element, whatever elements.auto says. */
var NOT_ELEMENTS = '.row, .ge-content, .ge-text-block, [data-ge-container], .ge-tools-drawer, .ge-resize-handle';

GridEditor.features.elements = function(ge) {

    var warnedIntoText = false;

    function elementsEnabled() {
        if (ge.settings.elements.enabled !== 'auto') { return !!ge.settings.elements.enabled; }

        return ge.settings.elements.auto || !!ge.canvas.querySelector(ge.settings.elements.selector);
    }

    /** Whether a child of a column is an element. */
    function isElement(node) {
        return ge.settings.elements.auto
            ? !node.matches(NOT_ELEMENTS)
            : node.matches(ge.settings.elements.selector);
    }

    function markElements() {
        if (!elementsEnabled()) { return; }

        dom.all(ge.canvas, '.column').forEach(function(column) {
            dom.children(column).forEach(function(element) {
                if (!dom.hasClass(element, 'ge-element') && !isElement(element)) { return; }

                dom.addClass(element, 'ge-element');
                if (!dom.child(element, '.ge-tools-drawer')) { createElementControls(element); }
            });
        });
    }

    function unmarkElements() {
        dom.all(ge.canvas, '.ge-element').forEach(function(element) {
            dom.removeClass(element, 'ge-element');

            // A host element that had no class of its own should not come
            // back from getHtml carrying an empty one
            dom.dropEmptyClass(element);
        });
    }

    function createElementControls(element) {
        var drawer = dom.element('div', { 'class': 'ge-tools-drawer ge-element-drawer' });
        element.insertBefore(drawer, element.firstChild);

        ge.createMoveTool(drawer);
        ge.createTool(drawer, ge.t('tool.element_info', { name: elementName(element) }),
            'ge-element-info', 'bi bi-info-circle');
        ge.addSettingsTool(drawer, element, ge.settings.element_classes);

        ge.settings.element_tools.forEach(function(hostTool) {
            ge.createTool(drawer, hostTool.title || '', hostTool.className || '',
                hostTool.iconClass || 'bi bi-wrench', hostTool.on);
        });

        ge.createTool(drawer, ge.t('tool.delete_element'), 'ge-delete-element', 'bi bi-trash', function() {
            ge.deleteNode('element', element, ge.t('confirm.delete_element'), function(removed) {
                dom.shrinkAway(element, 300, removed);
            });
        });
    }

    function elementName(element) {
        var type = element.getAttribute('data-ge-element');
        var label = element.getAttribute('data-ge-label');

        if (label && type) { return label + ' (' + type + ')'; }

        return label || type || element.tagName.toLowerCase();
    }

    /**
     * Placed into a content area, as 5.x did, an element would be text
     * again, and the next init would cut it out. So it goes beside that
     * content area instead - after it for appendTo, before it for
     * prependTo - with a word to the host.
     */
    function placementBesideText(options) {
        var placed = Object.assign({}, options);

        [['appendTo', 'insertAfter'], ['prependTo', 'insertBefore']].forEach(function(pair) {
            var target = options[pair[0]] !== undefined ? nodeFrom(options[pair[0]]) : null;
            if (!target || !target.matches('.ge-content')) { return; }

            if (!warnedIntoText) {
                warnedIntoText = true;
                ge.warn('createElement: an element is a block of the column since 6.0, not part of a ' +
                    'content area\'s text; it goes beside the content area. Place it in a column instead.');
            }

            delete placed[pair[0]];
            placed[pair[1]] = dom.hasClass(target.parentElement, 'ge-text-block') ? target.parentElement : target;
        });

        return placed;
    }

    /** A place a caller named: an element, or the first one a selector matches. */
    function nodeFrom(node) {
        if (typeof node === 'string') { return document.querySelector(node); }
        return node && node.nodeType === 1 ? node : null;
    }

    /**
     * What the element holds: html, which is parsed as innerHTML parses so
     * no <script> in it runs, or a node, or a list of nodes.
     */
    function fill(element, content) {
        if (content === undefined || content === null) { return; }

        if (typeof content === 'string') {
            dom.parse(content).forEach(function(node) { element.appendChild(node); });
        } else if (content.nodeType) {
            element.appendChild(content);
        } else if (typeof content.length === 'number') {
            Array.prototype.slice.call(content).forEach(function(node) { element.appendChild(node); });
        }
    }

    function apiCreateElement(content, options) {
        options = options || {};

        var element = dom.element('div', {
            'class': 'ge-element',
            'data-ge-element': options.type || 'element',
        });
        fill(element, content);
        if (options.label !== undefined) {
            element.setAttribute('data-ge-label', options.label);
        }

        return ge.place(element, 'element', placementBesideText(options));
    }

    return {
        methods: {
            createElement: apiCreateElement,
        },

        /** A node this plugin marked is an element, whatever else it is. */
        kindOf: function(node) {
            return dom.hasClass(node, 'ge-element') ? 'element' : null;
        },

        /**
         * An element cuts the text it sits in: 5.x's markup, or markup a host
         * wrote the same way, has it inside a content area, and it comes out.
         */
        cuts: function() {
            if (!elementsEnabled()) { return null; }

            return ge.settings.elements.auto ? '*' : ge.settings.elements.selector;
        },

        // A block the columns move, beside the texts, the rows and the
        // containers - and only the columns
        blocks: '.ge-element',
        accepts: function(region, node) {
            if (dom.hasClass(node, 'ge-element')) { return dom.is(region, '.column'); }

            return true;
        },

        onInit: markElements,
        onDeinit: unmarkElements,
    };
};
