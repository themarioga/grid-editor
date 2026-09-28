/**
 * A block's html, edited in place with CodeMirror.
 *
 * A feature plugin: load this file after the editor, and CodeMirror 5 with
 * its html mode after or before it, and every drawer of a row, a column, a
 * text, the host's plain content, an element, a section or a container has a
 * </> tool. It opens the block's html - the block itself and everything in
 * it, as getHtml would give it - in CodeMirror where the block was, and
 * Apply puts what was written in the block's place. What it can ask the
 * editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <link rel="stylesheet" href="codemirror/lib/codemirror.css">
 *   <script src="codemirror/lib/codemirror.js"></script>
 *   <script src="codemirror/mode/xml/xml.js"></script>
 *   <script src="codemirror/mode/javascript/javascript.js"></script>
 *   <script src="codemirror/mode/css/css.js"></script>
 *   <script src="codemirror/mode/htmlmixed/htmlmixed.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.codemirror-inline.min.js"></script>
 *
 * Without CodeMirror on the page the html is edited in a plain textarea.
 * CodeMirror's options are the codemirror plugin's, codemirror.config.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'tool.edit_html': 'Edit html',
    'codemirror.apply': 'Apply',
    'codemirror.cancel': 'Cancel',
});

/** What has html of its own to edit: a pane's is split between its button and its body. */
var KINDS = ['row', 'column', 'text', 'plain', 'element', 'section'];

GridEditor.features['codemirror-inline'] = function(ge) {

    var open = []; // The blocks being edited: { node, kind, from, wrapper, textarea, editor }

    function options() {
        var own = (ge.settings.codemirror && ge.settings.codemirror.config) || {};

        return Object.assign({
            mode: 'htmlmixed',
            lineNumbers: true,
            lineWrapping: true,
            tabSize: 2,
            indentUnit: 2,
            // As tall as what it holds, up to the css's limit
            viewportMargin: Infinity,
        }, own);
    }

    /** What stands for the node in its column: a text's text block, or the node. */
    function anchorOf(node) {
        var textBlock = node.parentElement;
        return dom.hasClass(textBlock, 'ge-text-block') ? textBlock : node;
    }

    function entryOf(node) {
        return open.filter(function(entry) { return entry.node === node; })[0] || null;
    }

    function editable(node, kind) {
        return KINDS.indexOf(kind) !== -1 || dom.is(node, '[data-ge-container]');
    }

    /** The editor where the block was, the block hidden behind it. */
    function show(entry) {
        var anchor = dom.addClass(anchorOf(entry.node), 'ge-code-hidden');
        dom.insertAfter(entry.wrapper, anchor);
        if (entry.editor) { entry.editor.refresh(); }
    }

    function hide(entry) {
        entry.wrapper.remove();
        dom.removeClass(anchorOf(entry.node), 'ge-code-hidden');
        dom.removeClass(entry.node, 'ge-code-hidden');
    }

    function close(entry) {
        hide(entry);
        if (entry.editor) { entry.editor.toTextArea(); }
        entry.wrapper.remove();
        open.splice(open.indexOf(entry), 1);
    }

    function openEditor(node) {
        if (entryOf(node)) { return; }

        var entry = {
            node: node,
            kind: ge.kindOf(node),
            // As getHtml gives it: no drawers, no editor open in it
            from: ge.nodeHtml(node),
            // A drawer, to the editor: never content, never a block to move
            wrapper: dom.element('div', { 'class': 'ge-tools-drawer ge-code-inline' }),
            editor: null,
        };
        entry.textarea = entry.wrapper.appendChild(dom.element('textarea', { 'class': 'ge-code-inline-source' }));
        entry.textarea.value = entry.from;

        var bar = entry.wrapper.appendChild(dom.element('div', { 'class': 'ge-code-inline-bar' }));
        var applyButton = bar.appendChild(dom.element('button', {
            type: 'button',
            'class': 'btn btn-sm btn-primary ge-code-apply',
        }, ge.t('codemirror.apply')));
        applyButton.addEventListener('click', function() { apply(entry); });
        var cancelButton = bar.appendChild(dom.element('button', {
            type: 'button',
            'class': 'btn btn-sm btn-outline-secondary ge-code-cancel',
        }, ge.t('codemirror.cancel')));
        cancelButton.addEventListener('click', function() { close(entry); });

        open.push(entry);
        show(entry);

        if (window.CodeMirror) {
            entry.editor = window.CodeMirror.fromTextArea(entry.textarea, options());
            dom.addClass(entry.editor.getWrapperElement(), 'ge-code-editor');
            entry.editor.focus();
        } else {
            entry.textarea.focus();
        }
    }

    /**
     * What was written, in the block's place, through the edit-html events.
     * The canvas leaves editing to take it in and comes back, as it does for
     * getHtml, so what was written is read as the editor reads any markup.
     */
    function apply(entry) {
        var to = entry.editor ? entry.editor.getValue() : entry.textarea.value;
        var payload = ge.payloadFor(entry.kind, entry.node, { source: 'tool', from: entry.from, to: to });

        // Canceled, the editor stays open with what was written in it
        if (!ge.emit('before-edit-html', payload)) { return; }

        close(entry);

        var instance = GridEditor.get(ge.canvas);
        instance.deinit();

        // Parsed as innerHTML parses: a <script> written here is markup,
        // and does not run in the editor
        var made = dom.parse(to);
        var parent = entry.node.parentElement;
        entry.node.replaceWith.apply(entry.node, made);

        instance.init();

        // The node is the first element written, or none when only text was;
        // `nodes` is every element written, which may be several
        var written = made.filter(function(node) { return node.nodeType === 1; });
        var first = written[0] || null;

        ge.emit('after-edit-html', ge.payloadFor(entry.kind, first || entry.node, {
            node: first,
            nodes: written,
            parent: first ? first.parentElement : parent,
            source: 'tool',
            from: entry.from,
            to: to,
        }));
    }

    function tool(drawer, node) {
        ge.createTool(drawer, ge.t('tool.edit_html'), 'ge-edit-html', 'bi bi-code-slash', function() {
            openEditor(node);
        });
    }

    return {
        drawerTools: function(drawer, node, kind) {
            if (editable(node, kind)) { tool(drawer, node); }
        },

        // Plain content has no gear, and so none of the drawerTools: its
        // html is what there is to edit about it
        plainTools: tool,

        // Every deinit - getHtml's among them - takes the editors off the
        // canvas, whatever is in them, and every init puts them back where
        // their block is. A block that is gone takes its editor with it.
        onBeforeDeinit: function() {
            open.forEach(hide);
        },

        onInit: function() {
            open.slice().forEach(function(entry) {
                if (!dom.attached(entry.node)) {
                    if (entry.editor) { entry.editor.toTextArea(); }
                    entry.wrapper.remove();
                    open.splice(open.indexOf(entry), 1);
                    return;
                }

                show(entry);
            });
        },
    };
};
