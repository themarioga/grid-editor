/**
 * CKEditor for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and CKEditor 5's
 * browser build after or before it, and a text of the ckeditor type is
 * edited with an inline CKEditor. What it can ask the editor for is the
 * handle its factory is called with, described in docs/plugins.md.
 *
 *   <link rel="stylesheet" href="ckeditor5/ckeditor5.css">
 *   <script src="ckeditor5/ckeditor5.umd.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.ckeditor.min.js"></script>
 *
 * CKEditor 5 asks for a license key, GPL or a commercial one, which is the
 * host's to pass in ckeditor.config.
 *
 * It imports what every text editor shares - text blocks, the Text button,
 * createText, making the host's plain content a text - from
 * src/js/text/grideditor.text.js, which the build puts in its classic
 * script, installed once however many editors a page loads.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';
import '../text/grideditor.text.js';

Object.assign(GridEditor.locales.en, {
    'text.ckeditor': 'CKEditor',
    'error.ckeditor_start': 'CKEditor could not start: {message}',
    'warning.ckeditor_plugin': 'CKEditor has no plugin called {name}, so it is left out.',
});

var INITIAL_CONTENT = '<p>Lorem initius... </p>';

// What CKEditor 5 is started with when the host's config does not say. It
// has no plugins of its own, so these are what a text can do. Names, looked
// up on window.CKEDITOR.
var PLUGINS = [
    'Essentials', 'Autoformat', 'Paragraph', 'Heading', 'Bold', 'Italic', 'Underline', 'Strikethrough',
    'Link', 'AutoLink', 'List', 'BlockQuote', 'Indent', 'HorizontalLine', 'Table', 'TableToolbar',
    'PasteFromOffice',
];

var DEFAULTS = {
    toolbar: [
        'undo', 'redo', '|', 'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', '|',
        'link', 'bulletedList', 'numberedList', 'blockQuote', '|', 'insertTable', 'horizontalLine',
    ],
    // CKEditor's own headings start at h2, and make every h1 in the content
    // an h2: a column's text keeps the headings it has
    heading: {
        options: [
            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        ].concat([1, 2, 3, 4, 5, 6].map(function(level) {
            return {
                model: 'heading' + level, view: 'h' + level,
                title: 'Heading ' + level, class: 'ck-heading_heading' + level,
            };
        })),
    },
    table: { contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'] },
};

// What this file keeps about a content area: its editor once it is ready,
// the start that is still to have one, and a promise of the content area
// being free again, with no editor starting or being destroyed on it:
// CKEditor does both asynchronously, and two at once on one element clash
var editors = new WeakMap();
var starting = new WeakMap();
var busy = new WeakMap();

/** The plugins the config names, as CKEditor wants them: constructors. */
function pluginsFor(ge, names) {
    return names.map(function(plugin) {
        if (typeof plugin !== 'string') { return plugin; }
        if (!window.CKEDITOR[plugin]) { ge.warn(ge.t('warning.ckeditor_plugin', { name: plugin })); }
        return window.CKEDITOR[plugin];
    }).filter(Boolean);
}

GridEditor.texts.ckeditor = function(ge) {

    /**
     * Take the editor off a content area and leave its content behind, now:
     * getHtml reads the content area the moment its editor is stopped.
     *
     * CKEditor puts the attributes back as destroy() is called, but its
     * content only as it finishes, and then as nothing: it empties the
     * element unless told otherwise. So the content goes back in twice, now
     * and once CKEditor is done. The promise is of that.
     */
    function destroy(contentArea, editor) {
        var data = editor.getData();
        var done = editor.destroy().catch(function() {}).then(function() {
            contentArea.innerHTML = data;
        });

        contentArea.innerHTML = data;
        return done;
    }

    return {
        labelKey: 'text.ckeditor',
        initialContent: INITIAL_CONTENT,
        missingKey: 'error.ckeditor_missing',

        // CKEditor 4 is window.CKEDITOR too, without an InlineEditor
        available: function() { return !!(window.CKEDITOR && window.CKEDITOR.InlineEditor); },

        start: function(contentAreas) {
            var settings = ge.settings;
            var userConfig = (settings.ckeditor && settings.ckeditor.config) ? settings.ckeditor.config : {};

            contentAreas.forEach(function(contentArea) {
                if (dom.hasClass(contentArea, 'active')) { return; }

                if (contentArea.innerHTML == INITIAL_CONTENT) {
                    contentArea.innerHTML = '';
                }
                dom.addClass(contentArea, 'active');

                var configuration = Object.assign({}, DEFAULTS, userConfig);
                configuration.plugins = pluginsFor(ge, userConfig.plugins || PLUGINS);

                var ticket = {};
                starting.set(contentArea, ticket);

                var run = (busy.get(contentArea) || Promise.resolve()).then(function() {
                    // Stopped again while it waited for the last editor to go
                    if (starting.get(contentArea) !== ticket) { return null; }

                    return window.CKEDITOR.InlineEditor.create(contentArea, configuration);
                }).then(function(editor) {
                    if (!editor) { return null; }

                    // Stopped while it started, so it goes again
                    if (starting.get(contentArea) !== ticket) {
                        return destroy(contentArea, editor);
                    }
                    starting.delete(contentArea);
                    editors.set(contentArea, editor);

                    // The editor owns what is inside the content area now,
                    // so the grid editor is told to put its own furniture back
                    ge.textReady(contentArea);

                    editor.editing.view.focus();
                    return null;
                }).catch(function(error) {
                    // A licenseKey missing is the likely one
                    if (starting.get(contentArea) === ticket) {
                        starting.delete(contentArea);
                        dom.removeClass(contentArea, 'active');
                    }
                    console.error(ge.t('error.ckeditor_start', { message: (error && error.message) || error }));
                });
                busy.set(contentArea, run);
            });
        },

        // What destroy() puts back. Null while it is still starting
        read: function(contentArea) {
            var editor = editors.get(contentArea);
            return editor ? editor.getData() : null;
        },

        stop: function(contentAreas) {
            contentAreas.filter(function(contentArea) {
                return dom.hasClass(contentArea, 'active');
            }).forEach(function(contentArea) {
                // This content area's editor, and no other: the other
                // CKEditors on the page, the host's own included, stay
                var editor = editors.get(contentArea);
                editors.delete(contentArea);
                // One still starting sees this and goes as it is ready
                starting.delete(contentArea);

                if (editor) { busy.set(contentArea, destroy(contentArea, editor)); }

                dom.removeClass(contentArea, 'active');
            });
        },
    };
};
