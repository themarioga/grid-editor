(function($) {

    // tinyMCE snapshots the target element's attributes when an inline editor is
    // created and restores them on remove(), so this has to run *after* remove()
    // to keep the grid editor's own class and tinyMCE's leftovers off the element.
    function cleanUp(contentArea) {
        contentArea
            .removeClass('active')
            .removeClass('ge-rte-active')
            .removeAttr('id')
            .removeAttr('style')
            .removeAttr('spellcheck')
            .removeAttr('contenteditable')
            .removeAttr('data-mce-style')
        ;
    }

    $.fn.gridEditor.RTEs.tinymce = {

        init: function(settings, contentAreas) {

            if (!window.tinymce) {
                console.error($.fn.gridEditor.t(settings, 'error.tinymce_missing'));
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

                var configuration = $.extend({
                    // tinyMCE's own "Upgrade" badge in the menubar. Off by
                    // default because an inline editor here is a column of
                    // someone's page, not tinyMCE's own interface; a host that
                    // wants it back passes promotion: true.
                    promotion: false,
                }, userConfig, {
                    target: this,
                    inline: true,
                    init_instance_callback: function(editor) {
                        // deinit ran before this init finished, so tear it down again
                        if (contentArea.data('ge-tinymce-pending-remove')) {
                            contentArea.removeData('ge-tinymce-pending-remove');
                            editor.remove();
                            // deinit already ran and cannot clean up after this
                            // late remove(), so do it here instead
                            cleanUp(contentArea);
                            return;
                        }

                        contentArea.data('ge-tinymce', editor);

                        // The editor rewrote what is inside this content area
                        // while it took it over, so whatever the grid editor
                        // had in there is gone. Saying so lets it put its own
                        // furniture back (see RTE_READY in the core).
                        contentArea.trigger('ge-rte-ready');

                        // Undo and redo rewrite it too, from snapshots that
                        // leave out whatever is marked data-mce-bogus - an
                        // element's drawer among them - so it goes back in
                        // after each of those as well
                        editor.on('Undo Redo', function() {
                            contentArea.trigger('ge-rte-ready');
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

                cleanUp(contentArea);
            });
        },

        initialContent: '<p>Lorem ipsum dolores</p>',
    };
})(jQuery);
