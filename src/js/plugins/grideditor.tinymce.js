/**
 * tinyMCE for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and tinyMCE 7
 * after or before it, and a text of the tinymce type is edited with an
 * inline tinyMCE. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <script src="tinymce/tinymce.min.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.tinymce.min.js"></script>
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
    'text.tinymce': 'tinyMCE',
});

// tinyMCE snapshots the target element's attributes when an inline editor is
// created and restores them on remove(), so this has to run *after* remove()
// to keep the grid editor's own class and tinyMCE's leftovers off the element.
function cleanUp(contentArea) {
    dom.removeClass(contentArea, 'active ge-rte-active');
    ['id', 'style', 'spellcheck', 'contenteditable', 'data-mce-style'].forEach(function(name) {
        contentArea.removeAttribute(name);
    });
}

var INITIAL_CONTENT = '<p>Lorem ipsum dolores</p>';

// What this file remembers about a content area: its editor, and whether a
// deinit came before that editor was ready
var editors = new WeakMap();
var pendingRemove = new WeakSet();

GridEditor.texts.tinymce = function(ge) {
    return {
        labelKey: 'text.tinymce',
        initialContent: INITIAL_CONTENT,
        missingKey: 'error.tinymce_missing',

        available: function() { return !!window.tinymce; },

        start: function(contentAreas) {
            var settings = ge.settings;
            var userConfig = (settings.tinymce && settings.tinymce.config) ? settings.tinymce.config : {};

            contentAreas.forEach(function(contentArea) {
                if (dom.hasClass(contentArea, 'active')) { return; }

                if (contentArea.innerHTML == INITIAL_CONTENT) {
                    contentArea.innerHTML = '';
                }
                dom.addClass(contentArea, 'active');

                var configuration = Object.assign({
                    // tinyMCE's own "Upgrade" badge in the menubar. Off by
                    // default because an inline editor here is a column of
                    // someone's page, not tinyMCE's own interface; a host that
                    // wants it back passes promotion: true.
                    promotion: false,
                }, userConfig, {
                    target: contentArea,
                    inline: true,
                    init_instance_callback: function(editor) {
                        // deinit ran before this init finished, so tear it down again
                        if (pendingRemove.has(contentArea)) {
                            pendingRemove.delete(contentArea);
                            editor.remove();
                            // deinit already ran and cannot clean up after this
                            // late remove(), so do it here instead
                            cleanUp(contentArea);
                            return;
                        }

                        editors.set(contentArea, editor);

                        // The editor rewrote what is inside this content area
                        // while it took it over, so whatever the grid editor
                        // had in there is gone. Saying so lets it put its own
                        // furniture back.
                        ge.textReady(contentArea);

                        // Undo and redo rewrite it too, from snapshots that
                        // leave out whatever is marked data-mce-bogus - an
                        // element's drawer among them - so it goes back in
                        // after each of those as well
                        editor.on('Undo Redo', function() {
                            ge.textReady(contentArea);
                        });

                        // The inline toolbar is laid out against the element's
                        // geometry at the moment tinyMCE draws it, and an
                        // element that has just appeared - a tab pane, an
                        // accordion body, a column whose width is still
                        // settling - may not have its own width yet. Asking
                        // for the ui again once the browser has laid the frame
                        // out measures it as it now is, instead of leaving a
                        // toolbar wrapped into a narrow column.
                        window.requestAnimationFrame(function() {
                            if (editor.removed || !editor.ui || !editor.ui.show) { return; }

                            editor.ui.show();
                        });

                        // And again whenever the user comes back to this
                        // editor: by then the element may have been resized,
                        // hidden and shown again - a tab switched away from
                        // and back, a column made narrower - and the toolbar
                        // is only ever as right as its last measurement.
                        editor.on('focus', function() {
                            window.requestAnimationFrame(function() {
                                if (editor.removed || !editor.ui || !editor.ui.show) { return; }

                                editor.ui.show();
                            });
                        });

                        // Bring focus to text field
                        editor.focus();

                        // Call the original callback, if one was passed in the config
                        if (userConfig.init_instance_callback) {
                            userConfig.init_instance_callback.call(this, editor);
                        }
                    }
                });
                // We always edit the element we were handed, so a selector in the
                // user config would only fight with target
                delete configuration.selector;

                window.tinymce.init(configuration);
            });
        },

        stop: function(contentAreas) {
            contentAreas.filter(function(contentArea) {
                return dom.hasClass(contentArea, 'active');
            }).forEach(function(contentArea) {
                var editor = editors.get(contentArea);

                if (editor) {
                    editors.delete(contentArea);
                    editor.remove();
                } else {
                    // tinymce.init() is asynchronous, so the editor may not exist
                    // yet. Leave a note for init_instance_callback to remove it.
                    pendingRemove.add(contentArea);
                }

                cleanUp(contentArea);
            });
        },
    };
};
