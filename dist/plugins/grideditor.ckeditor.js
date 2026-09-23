/**
 * CKEditor for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and CKEditor 4
 * after or before it, and content_types: ['ckeditor'] edits each content area
 * with an inline CKEditor. What it can ask the editor for is the handle its
 * factory is called with, described in docs/plugins.md.
 *
 *   <script src="ckeditor/ckeditor.js"></script>
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.ckeditor.min.js"></script>
 *
 * Up to 5.x the main bundle carried a copy of this file; since 6.0 it is
 * loaded on its own, like every plugin.
 */
(function($) {

    $.extend($.fn.gridEditor.locales.en, {
        'text.ckeditor': 'CKEditor',
    });

    var INITIAL_CONTENT = '<p>Lorem initius... </p>';

    $.fn.gridEditor.texts.ckeditor = function(ge) {

        /**
         * The instance editing this content area. Kept in jQuery data when it
         * is made, and looked for among CKEditor's own as a fallback, since
         * an instance made by another version of this file has no data.
         */
        function instanceOf(contentArea) {
            var kept = contentArea.data('ge-ckeditor');
            if (kept) { return kept; }

            var found = null;
            $.each(window.CKEDITOR.instances, function(name, instance) {
                if (instance.element && instance.element.$ === contentArea[0]) { found = instance; }
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

                contentAreas.each(function() {
                    var contentArea = $(this);
                    if (contentArea.hasClass('active')) { return; }

                    if (contentArea.html() == INITIAL_CONTENT) {
                        // CKEditor kills this '&nbsp' creating a non usable box :/
                        contentArea.html('&nbsp;');
                    }

                    // Add the .attr('contenteditable',''true') or CKEditor loads readonly
                    contentArea.addClass('active').attr('contenteditable', 'true');

                    var configuration = $.extend(
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
                    var instance = window.CKEDITOR.inline(contentArea.get(0), configuration);
                    contentArea.data('ge-ckeditor', instance);
                });
            },

            stop: function(contentAreas) {
                contentAreas.filter('.active').each(function() {
                    var contentArea = $(this);

                    // This content area's instance, and no other: up to 5.x
                    // closing one content area destroyed every CKEditor on
                    // the page, other editors' and the host's own included
                    var instance = window.CKEDITOR ? instanceOf(contentArea) : null;
                    if (instance) { instance.destroy(); }
                    contentArea.removeData('ge-ckeditor');

                    // Cleanup
                    contentArea
                        .removeClass('active cke_focus')
                        .removeAttr('id')
                        .removeAttr('style')
                        .removeAttr('spellcheck')
                        .removeAttr('contenteditable')
                    ;
                });
            },
        };
    };
})(jQuery);
