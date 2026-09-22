/**
 * Floating elements for grid-editor.
 *
 * A utility plugin: load this file after the editor and after the elements
 * plugin, and an element can float to the start or the end of its content
 * area per breakpoint, with the text around it, using Bootstrap's
 * float-{breakpoint}-start, -end and -none classes. What it can ask the
 * editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.elements.min.js"></script>
 *   <script src="dist/plugins/grideditor.float.min.js"></script>
 *
 * Elements only. A floated row or column stops being part of the grid, and a
 * container sits beside the content areas rather than in their text.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.float': 'Float',
    'utility.float_start': 'Start',
    'utility.float_end': 'End',
    'utility.float_none': 'None',
});

/** Start and end are left and right: Bootstrap's css is left to right. */
var CSS = { start: 'left', end: 'right', none: 'none' };

$.fn.gridEditor.utilities.float = function(ge) {

    function label(value) {
        if (value === 'start') { return ge.t('utility.float_start'); }
        if (value === 'end') { return ge.t('utility.float_end'); }

        return ge.t('utility.float_none');
    }

    return {
        families: [{
            name: 'float',
            prefix: 'float',
            values: ['start', 'end', 'none'],
            appliesTo: ['element'],
            labelKey: 'utility.float',
            label: label,

            /** With no class applying here, whatever the host's css floats it as. */
            preview: function(value, node) {
                return { float: value === null ? ge.bareStyle(node, 'float', 'float') : CSS[value] };
            },
        }],
    };
};

})(jQuery);
