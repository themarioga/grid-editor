/**
 * Element level controls for grid-editor.
 *
 * A feature plugin: load this file after the editor and the nodes a host
 * marked inside a content area become elements - one movable, deletable thing
 * each, instead of rich text. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.elements.min.js"></script>
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'tool.delete_element': 'Remove element',
    'tool.element_info': 'Element: {name}',
    'confirm.delete_element': 'Delete element?',
});

$.fn.gridEditor.features.elements = function(ge) {

    function elementsEnabled() {
        if (ge.settings.elements.enabled !== 'auto') { return !!ge.settings.elements.enabled; }

        return ge.settings.elements.auto || ge.canvas.find(ge.settings.elements.selector).length > 0;
    }

    function elementsIn(contentArea) {
        return ge.settings.elements.auto
            ? contentArea.children()
            : contentArea.children(ge.settings.elements.selector);
    }

    function markElements() {
        if (!elementsEnabled()) { return; }

        ge.canvas.find('.ge-content').each(function() {
            elementsIn($(this)).each(function() {
                var element = $(this).addClass('ge-element').attr('contenteditable', 'false');

                if (element.find('> .ge-tools-drawer').length) { return; }

                createElementControls(element);
            });
        });
    }

    function unmarkElements() {
        ge.canvas.find('.ge-element').each(function() {
            var element = $(this).removeClass('ge-element').removeAttr('contenteditable');

            // A host element that had no class of its own should not come
            // back from getHtml carrying an empty one
            if (!element.attr('class')) { element.removeAttr('class'); }
        });
    }

    function createElementControls(element) {
        // data-mce-bogus="all" is how tinyMCE is told that a node is the
        // editor's furniture rather than content: it leaves the subtree
        // alone and keeps it out of what it serializes. Without it the
        // drawer's tools are inline elements with no text, which is
        // exactly what its cleanup removes, so an element inside an open
        // editor would lose its move and delete tools.
        var drawer = $('<div class="ge-tools-drawer ge-element-drawer" />')
            .attr('data-mce-bogus', 'all')
            .prependTo(element)
        ;

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
                element.animate({ opacity: 'hide', height: 'hide' }, 300, removed);
            });
        });
    }

    function elementName(element) {
        var type = element.attr('data-ge-element');
        var label = element.attr('data-ge-label');

        if (label && type) { return label + ' (' + type + ')'; }

        return label || type || element[0].tagName.toLowerCase();
    }

    function apiCreateElement(content, options) {
        options = options || {};

        var element = $('<div class="ge-element" />')
            .attr('data-ge-element', options.type || 'element')
            .append(content)
        ;
        if (options.label !== undefined) {
            element.attr('data-ge-label', options.label);
        }

        return ge.place(element, 'element', options);
    }

    return {
        methods: {
            createElement: apiCreateElement,
        },

        /** A node this plugin marked is an element, whatever else it is. */
        kindOf: function(node) {
            return node.hasClass('ge-element') ? 'element' : null;
        },

        onInit: markElements,
        onDeinit: unmarkElements,

        /**
         * An editor rewrites the content area as it takes it over, drawers
         * included, so they go back in when it says it is ready.
         */
        onContentReady: markElements,

        /** Elements move within a content area and between them. */
        onSortable: function(shared) {
            if (!elementsEnabled()) { return; }

            ge.canvas.find('.ge-content').sortable($.extend({
                items: '> .ge-element',
                connectWith: '.ge-canvas .ge-content',
            }, shared, ge.settings.sortable_options));
        },
    };
};

})(jQuery);
