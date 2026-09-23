/**
 * Up to 6.0 the main bundle carries a copy of each text editor plugin, so a
 * page that loaded only the editor keeps the editor it had. This marks those
 * copies, and the editor warns once when a content area is edited with one:
 * 6.0 leaves them out. Loaded on its own, a plugin's file registers itself
 * again, unmarked, and is the one used.
 *
 * Only ever concatenated after the plugins it marks, never built on its own.
 */
(function($) {
    ['tinymce', 'ckeditor', 'summernote'].forEach(function(type) {
        if ($.fn.gridEditor.texts[type]) { $.fn.gridEditor.texts[type].bundled = true; }
    });
})(jQuery);
