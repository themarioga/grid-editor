/**
 * Summernote for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and summernote
 * after or before it, and a text of the summernote type is edited with
 * summernote in air mode. What it can ask the editor for is the
 * handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="jquery/jquery.min.js"></script>
 *   <script src="summernote/summernote-bs5.min.js"></script>
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.summernote.min.js"></script>
 *
 * Summernote is a jQuery plugin, so this is the one plugin that needs jQuery
 * on the page: it calls summernote on a content area through it, and
 * nothing else. Towards the editor it is plain DOM, like every plugin, and
 * it needs no jQuery adapter.
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
    'text.summernote': 'Summernote',
});

var INITIAL_CONTENT = '<p>Lorem ipsum dolores</p>';

function isPlainObject(value) {
    return !!value && Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * `sources` merged into `target`, objects and arrays copied all the way
 * down rather than shared: what jQuery's deep extend did for summernote's
 * options, whose callbacks the host's config and this file both fill in.
 */
function deepMerge(target) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
        Object.keys(source || {}).forEach(function(key) {
            var value = source[key];

            if (value === undefined || value === target) { return; }

            if (Array.isArray(value)) {
                target[key] = deepMerge(Array.isArray(target[key]) ? target[key] : [], value);
            } else if (isPlainObject(value)) {
                target[key] = deepMerge(isPlainObject(target[key]) ? target[key] : {}, value);
            } else {
                target[key] = value;
            }
        });
    });

    return target;
}

GridEditor.texts.summernote = function(ge) {
    return {
        labelKey: 'text.summernote',
        initialContent: INITIAL_CONTENT,
        missingKey: 'error.summernote_missing',

        available: function() { return !!(window.jQuery && window.jQuery.fn && window.jQuery.fn.summernote); },

        start: function(contentAreas) {
            var settings = ge.settings;
            var $ = window.jQuery;

            // Summernote 0.9.1 calls $.now(), which jQuery 4 removed, and
            // cannot open without it. Given back only where it is missing,
            // and only once summernote is actually used.
            if (!$.now) { $.now = Date.now; }

            contentAreas.forEach(function(contentArea) {
                if (dom.hasClass(contentArea, 'active')) { return; }

                if (contentArea.innerHTML == INITIAL_CONTENT) {
                    contentArea.innerHTML = '';
                }
                dom.addClass(contentArea, 'active');

                var configuration = deepMerge(
                    {},
                    (settings.summernote && settings.summernote.config ? settings.summernote.config : {}),
                    {
                        tabsize: 2,
                        airMode: true,
                        // Focus editor on creation
                        callbacks: {
                            onInit: function() {

                                // Call original oninit function, if one was passed in the config
                                var callback;
                                try {
                                    callback = settings.summernote.config.callbacks.onInit;
                                } catch (err) {
                                    // No callback passed
                                }
                                if (callback) {
                                    callback.call(this);
                                }

                                // The editor owns what is inside the
                                // content area now, so the grid editor is
                                // told to put its own furniture back
                                ge.textReady(contentArea);

                                $(contentArea).summernote('focus');
                            }
                        }
                    }
                );
                $(contentArea).summernote(configuration);
            });
        },

        stop: function(contentAreas) {
            var $ = window.jQuery;

            contentAreas.filter(function(contentArea) {
                return dom.hasClass(contentArea, 'active');
            }).forEach(function(contentArea) {
                if ($ && $.fn.summernote) { $(contentArea).summernote('destroy'); }

                dom.removeClass(contentArea, 'active');
                ['id', 'style', 'spellcheck'].forEach(function(name) {
                    contentArea.removeAttribute(name);
                });
            });
        },
    };
};
