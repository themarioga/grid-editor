/**
 * CKEditor for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and CKEditor 4
 * after or before it, and a text of the ckeditor type is edited with an
 * inline CKEditor. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <script src="ckeditor/ckeditor.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.ckeditor.min.js"></script>
 *
 * Up to 5.x the main bundle carried a copy of this file; since 6.0 it is
 * loaded on its own, like every plugin. It imports what every text editor
 * shares - text blocks, the Text button, createText, making the host's plain
 * content a text - from src/js/text/grideditor.text.js, which the build puts
 * in its classic script, installed once however many editors a page loads.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';
import '../text/grideditor.text.js';

Object.assign(GridEditor.locales.en, {
    'text.ckeditor': 'CKEditor',
});

var INITIAL_CONTENT = '<p>Lorem initius... </p>';

// The instance each content area is edited with, as this file made it
var instances = new WeakMap();

GridEditor.texts.ckeditor = function(ge) {

    /**
     * The instance editing this content area. Kept when it is made, and
     * looked for among CKEditor's own as a fallback, since an instance made
     * by another copy of this file is not in this one's record.
     */
    function instanceOf(contentArea) {
        var kept = instances.get(contentArea);
        if (kept) { return kept; }

        var found = null;
        Object.keys(window.CKEDITOR.instances).forEach(function(name) {
            var instance = window.CKEDITOR.instances[name];
            if (instance.element && instance.element.$ === contentArea) { found = instance; }
        });

        return found;
    }

    return {
        labelKey: 'text.ckeditor',
        initialContent: INITIAL_CONTENT,
        missingKey: 'error.ckeditor_missing',

        available: function() { return !!window.CKEDITOR; },

        start: function(contentAreas) {
            var settings = ge.settings;

            contentAreas.forEach(function(contentArea) {
                if (dom.hasClass(contentArea, 'active')) { return; }

                if (contentArea.innerHTML == INITIAL_CONTENT) {
                    // CKEditor kills this '&nbsp' creating a non usable box :/
                    contentArea.innerHTML = '&nbsp;';
                }

                // contenteditable="true", or CKEditor loads readonly
                dom.addClass(contentArea, 'active');
                contentArea.setAttribute('contenteditable', 'true');

                var configuration = Object.assign(
                    {},
                    (settings.ckeditor && settings.ckeditor.config ? settings.ckeditor.config : {}),
                    {
                        // Focus editor on creation
                        on: {
                            instanceReady: function( evt ) {
                                // Call original instanceReady function, if one was passed in the config
                                var callback;
                                try {
                                    callback = settings.ckeditor.config.on.instanceReady;
                                } catch (err) {
                                    // No callback passed
                                }
                                if (callback) {
                                    callback.call(this, evt);
                                }

                                // The editor owns what is inside the
                                // content area now, so the grid editor is
                                // told to put its own furniture back
                                ge.textReady(contentArea);

                                instance.focus();
                            }
                        }
                    }
                );
                var instance = window.CKEDITOR.inline(contentArea, configuration);
                instances.set(contentArea, instance);
            });
        },

        stop: function(contentAreas) {
            contentAreas.filter(function(contentArea) {
                return dom.hasClass(contentArea, 'active');
            }).forEach(function(contentArea) {
                // This content area's instance, and no other: up to 5.x
                // closing one content area destroyed every CKEditor on
                // the page, other editors' and the host's own included
                var instance = window.CKEDITOR ? instanceOf(contentArea) : null;
                if (instance) { instance.destroy(); }
                instances.delete(contentArea);

                // Cleanup
                dom.removeClass(contentArea, 'active cke_focus');
                ['id', 'style', 'spellcheck', 'contenteditable'].forEach(function(name) {
                    contentArea.removeAttribute(name);
                });
            });
        },
    };
};
