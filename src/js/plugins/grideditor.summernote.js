/**
 * Summernote for grid-editor's content areas.
 *
 * A text editor plugin: load this file after the editor, and summernote
 * after or before it, and content_types: ['summernote'] edits each content
 * area with summernote in air mode. What it can ask the editor for is the
 * handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="summernote/summernote-bs5.min.js"></script>
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.summernote.min.js"></script>
 *
 * Up to 6.0 the main bundle carries a copy of this file too.
 */
(function($) {

    $.extend($.fn.gridEditor.locales.en, {
        'text.summernote': 'Summernote',
    });

    var INITIAL_CONTENT = '<p>Lorem ipsum dolores</p>';

    $.fn.gridEditor.texts.summernote = function(ge) {
        return {
            labelKey: 'text.summernote',
            initialContent: INITIAL_CONTENT,
            missingKey: 'error.summernote_missing',

            available: function() { return !!$.fn.summernote; },

            start: function(contentAreas) {
                var settings = ge.settings;

                // Summernote 0.9.1 calls $.now(), which jQuery 4 removed, and
                // cannot open without it. Given back only where it is missing,
                // and only once summernote is actually used.
                if (!$.now) { $.now = Date.now; }

                contentAreas.each(function() {
                    var contentArea = $(this);
                    if (contentArea.hasClass('active')) { return; }

                    if (contentArea.html() == INITIAL_CONTENT) {
                        contentArea.html('');
                    }
                    contentArea.addClass('active');

                    var configuration = $.extend(
                        true, // deep copy
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

                                    contentArea.summernote('focus');
                                }
                            }
                        }
                    );
                    contentArea.summernote(configuration);
                });
            },

            stop: function(contentAreas) {
                contentAreas.filter('.active').each(function() {
                    var contentArea = $(this);
                    contentArea.summernote('destroy');
                    contentArea
                        .removeClass('active')
                        .removeAttr('id')
                        .removeAttr('style')
                        .removeAttr('spellcheck')
                    ;
                });
            },
        };
    };
})(jQuery);
