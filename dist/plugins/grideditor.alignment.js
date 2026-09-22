/**
 * Alignment for grid-editor.
 *
 * A utility plugin: load this file after the editor and a row's columns can be
 * justified and aligned per breakpoint, and a column can align itself, with
 * Bootstrap's justify-content-{breakpoint}-*, align-items-{breakpoint}-* and
 * align-self-{breakpoint}-* classes. What it can ask the editor for is the
 * handle its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.alignment.min.js"></script>
 *
 * Fields only, in the settings panels: alignment is set now and then, not
 * clicked through, and a drawer is short of room.
 */
(function($) {

$.extend($.fn.gridEditor.locales.en, {
    'utility.justify_content': 'Justify columns',
    'utility.align_items': 'Align columns',
    'utility.align_self': 'Align self',
});

/** What Bootstrap's value names come to in css. */
var FLEX = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    between: 'space-between',
    around: 'space-around',
    evenly: 'space-evenly',
    baseline: 'baseline',
    stretch: 'stretch',
    auto: 'auto',
};

/**
 * A family whose preview is its one css property. `none` is what the
 * property is when no class says anything, which a view has to show over a
 * wider breakpoint's class that is live in a wide window.
 */
function family(definition) {
    return $.extend({
        prefix: definition.name,
        preview: function(value) {
            var styles = {};
            styles[definition.name] = value === null ? definition.none : FLEX[value];
            return styles;
        },
    }, definition);
}

$.fn.gridEditor.utilities.alignment = function() {
    return {
        families: [
            family({
                name: 'justify-content',
                labelKey: 'utility.justify_content',
                values: ['start', 'center', 'end', 'between', 'around', 'evenly'],
                appliesTo: ['row'],
                none: 'normal',
            }),
            family({
                name: 'align-items',
                labelKey: 'utility.align_items',
                values: ['start', 'center', 'end', 'baseline', 'stretch'],
                appliesTo: ['row'],
                none: 'normal',
            }),
            family({
                name: 'align-self',
                labelKey: 'utility.align_self',
                values: ['auto', 'start', 'center', 'end', 'baseline', 'stretch'],
                appliesTo: ['column'],
                none: 'auto',
            }),
        ],
    };
};

})(jQuery);
