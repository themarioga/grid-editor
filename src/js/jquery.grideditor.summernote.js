(function($) {

    $.fn.gridEditor.RTEs.summernote = {

        init: function(settings, contentAreas) {
            
            if (!jQuery().summernote) {
                console.error($.fn.gridEditor.t(settings, 'error.summernote_missing'));
            }

            var self = this;
            contentAreas.each(function() {
                var contentArea = $(this);
                if (!contentArea.hasClass('active')) {
                    if (contentArea.html() == self.initialContent) {
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
                                    contentArea.trigger('ge-rte-ready');
                                    
                                    contentArea.summernote('focus');
                                }
                            }
                        }
                    );
                    contentArea.summernote(configuration);
                }
            });
        },

        deinit: function(settings, contentAreas) {
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

        initialContent: '<p>Lorem ipsum dolores</p>',
    };
})(jQuery);
