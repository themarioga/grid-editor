/**
 * Float, a part of the style plugin: floating an element per breakpoint, with Bootstrap's
 * float-{breakpoint}-start, -end and -none classes.
 *
 * Its families, and whatever it does on the canvas, as a function of the
 * handle: grideditor.style.js puts them in its sections.
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'utility.float': 'Float',
    'utility.float_start': 'Start',
    'utility.float_end': 'End',
    'utility.float_none': 'None',
});

/** Start and end are left and right: Bootstrap's css is left to right. */
var CSS = { start: 'left', end: 'right', none: 'none' };

export function floatPart(ge) {

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
}
