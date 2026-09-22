/**
 * Text alignment for grid-editor.
 *
 * A utility plugin: load this file after the editor and a row, column,
 * element or container can align its text per breakpoint, with Bootstrap's
 * text-{breakpoint}-start, -center and -end classes. What it can ask the
 * editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.textalign.min.js"></script>
 *
 * The class aligns everything inside the node that does not align itself: a
 * paragraph the rich text editor gave its own text-align keeps it.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.text_align': 'Text alignment',
    'utility.text_start': 'Start',
    'utility.text_center': 'Center',
    'utility.text_end': 'End',
});

/** Start and end are left and right: Bootstrap's css is left to right. */
var CSS = { start: 'left', center: 'center', end: 'right' };

$.fn.gridEditor.utilities.textalign = function(ge) {

    function label(value) {
        if (value === 'start') { return ge.t('utility.text_start'); }
        if (value === 'center') { return ge.t('utility.text_center'); }

        return ge.t('utility.text_end');
    }

    return {
        families: [{
            name: 'text-align',
            prefix: 'text',
            values: ['start', 'center', 'end'],
            appliesTo: ['row', 'column', 'element', 'container'],
            labelKey: 'utility.text_align',
            label: label,

            /**
             * With no class applying here, the node aligns as its parent
             * does - or as the host's css says - which only the browser can
             * tell, so it is asked with the classes out of the way. Parents
             * are previewed before their children, so the parent's answer is
             * already the view's.
             */
            preview: function(value, node) {
                return { 'text-align': value === null ? ge.bareStyle(node, 'text-align', 'text-align') : CSS[value] };
            },
        }],
    };
};

})(jQuery);
