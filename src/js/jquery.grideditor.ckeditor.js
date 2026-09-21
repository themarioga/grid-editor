(function($) {
    $.fn.gridEditor.RTEs.ckeditor = {

        init: function(settings, contentAreas) {

            if (!window.CKEDITOR) {
                console.error($.fn.gridEditor.t(settings, 'error.ckeditor_missing'));
            }

            var self = this;
            contentAreas.each(function() {
                var contentArea = $(this);
                if (!contentArea.hasClass('active')) {
                    if (contentArea.html() == self.initialContent) {
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
                                    contentArea.trigger('ge-rte-ready');

                                    instance.focus();
                                }
                            }
                        }
                    );
                    var instance = CKEDITOR.inline(contentArea.get(0), configuration);
                }
            });
        },

        deinit: function(settings, contentAreas) {
            contentAreas.filter('.active').each(function() {
                var contentArea = $(this);
                
                // Destroy all CKEditor instances
                $.each(CKEDITOR.instances, function(_, instance) {
                    instance.destroy();
                });

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

        initialContent: '<p>Lorem initius... </p>',
    };
})(jQuery);