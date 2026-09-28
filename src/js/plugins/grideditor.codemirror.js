/**
 * CodeMirror for grid-editor's source view.
 *
 * A feature plugin: load this file after the editor, and CodeMirror 5 with
 * its html mode after or before it, and the toolbar's source button edits the
 * canvas's html in CodeMirror - highlighted, with line numbers - rather than
 * in a plain textarea. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <link rel="stylesheet" href="codemirror/lib/codemirror.css">
 *   <script src="codemirror/lib/codemirror.js"></script>
 *   <script src="codemirror/mode/xml/xml.js"></script>
 *   <script src="codemirror/mode/javascript/javascript.js"></script>
 *   <script src="codemirror/mode/css/css.js"></script>
 *   <script src="codemirror/mode/htmlmixed/htmlmixed.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.codemirror.min.js"></script>
 *
 * CodeMirror 5 rather than 6: 6 comes as ES modules only, for a bundler,
 * where 5 loads from a script tag like the rest of the page. Without
 * CodeMirror on the page the source view is the textarea, as before, and
 * the console says why.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'error.codemirror_missing': 'CodeMirror not available! Make sure you loaded the CodeMirror js file; the source is edited in a plain textarea without it.',
});

GridEditor.features.codemirror = function(ge) {

    var editor = null;
    var warned = false;

    function options() {
        var own = (ge.settings.codemirror && ge.settings.codemirror.config) || {};

        return Object.assign({
            mode: 'htmlmixed',
            lineNumbers: true,
            lineWrapping: true,
            tabSize: 2,
            indentUnit: 2,
        }, own);
    }

    return {
        // Over the textarea the editor fills with the canvas's html: it goes
        // where the textarea was, as tall as the editor made the textarea
        onSourceOpen: function(textarea) {
            if (!window.CodeMirror) {
                if (!warned) {
                    warned = true;
                    ge.warn(ge.t('error.codemirror_missing'));
                }
                return;
            }

            var height = dom.outerHeight(textarea);

            editor = window.CodeMirror.fromTextArea(textarea, options());
            dom.addClass(editor.getWrapperElement(), 'ge-code-editor');
            editor.setSize(null, height);
            editor.focus();
        },

        // What it holds goes back in the textarea, which is what the canvas
        // is made of again, and the textarea is left as it found it
        onSourceClose: function() {
            if (!editor) { return; }

            editor.save();
            editor.toTextArea();
            editor = null;
        },
    };
};
