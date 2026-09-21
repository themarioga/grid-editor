(function($) {
    $.fn.gridEditor.RTEs.tinymce = {

        init: function(settings, contentAreas) {

            if (!window.tinymce) {
                console.error('tinyMCE not available! Make sure you loaded the tinyMCE js file.');
                return;
            }

            var self = this;
            var userConfig = (settings.tinymce && settings.tinymce.config) ? settings.tinymce.config : {};

            contentAreas.each(function() {
                var contentArea = $(this);
                if (contentArea.hasClass('active')) { return; }

                if (contentArea.html() == self.initialContent) {
                    contentArea.html('');
                }
                contentArea.addClass('active');

                var configuration = $.extend({}, userConfig, {
                    target: this,
                    inline: true,
                    init_instance_callback: function(editor) {
                        // deinit ran before this init finished, so tear it down again
                        if (contentArea.data('ge-tinymce-pending-remove')) {
                            contentArea.removeData('ge-tinymce-pending-remove');
                            editor.remove();
                            return;
                        }

                        contentArea.data('ge-tinymce', editor);

                        // Bring focus to text field
                        editor.focus();

                        // Call the original callbacks, if any were passed in the config
                        if (userConfig.init_instance_callback) {
                            userConfig.init_instance_callback.call(this, editor);
                        }
                        // 'oninit' is the pre-6 name, honoured so existing configs keep working
                        if (userConfig.oninit) {
                            userConfig.oninit.call(this, editor);
                        }
                    }
                });
                // We always edit the element we were handed, so a selector in the
                // user config would only fight with target
                delete configuration.selector;

                window.tinymce.init(configuration);
            });
        },

        deinit: function(settings, contentAreas) {
            contentAreas.filter('.active').each(function() {
                var contentArea = $(this);
                var editor = contentArea.data('ge-tinymce');

                if (editor) {
                    contentArea.removeData('ge-tinymce');
                    editor.remove();
                } else {
                    // tinymce.init() is asynchronous, so the editor may not exist
                    // yet. Leave a note for init_instance_callback to remove it.
                    contentArea.data('ge-tinymce-pending-remove', true);
                }

                contentArea
                    .removeClass('active')
                    .removeAttr('id')
                    .removeAttr('style')
                    .removeAttr('spellcheck')
                    .removeAttr('contenteditable')
                    .removeAttr('data-mce-style')
                ;
            });
        },

        initialContent: '<p>Lorem ipsum dolores</p>',
    };
})(jQuery);
