/**
 * Alignment for grid-editor.
 *
 * A utility plugin: load this file after the editor and a column can align
 * itself in its row, per breakpoint, with Bootstrap's align-self-{breakpoint}-*
 * classes. What it can ask the editor for is the handle its factory is called
 * with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.alignment.min.js"></script>
 *
 * How a row justifies and aligns its columns - justify-content-* and
 * align-items-* - is a flex container's, and the style plugin's Flex section
 * edits it, on a row and on anything else made flex.
 *
 * A field only, in the settings panel: alignment is set now and then, not
 * clicked through, and a drawer is short of room.
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'utility.align_self': 'Align self',
});

/** What Bootstrap's value names come to in css. */
var FLEX = {
    start: 'flex-start',
    end: 'flex-end',
    center: 'center',
    baseline: 'baseline',
    stretch: 'stretch',
    auto: 'auto',
};

GridEditor.utilities.alignment = function() {
    return {
        families: [{
            name: 'align-self',
            prefix: 'align-self',
            labelKey: 'utility.align_self',
            values: ['auto', 'start', 'center', 'end', 'baseline', 'stretch'],
            appliesTo: ['column'],

            /** Without a class, auto: what the row's align-items says. */
            preview: function(value) {
                return { 'align-self': value === null ? 'auto' : FLEX[value] };
            },
        }],
    };
};
