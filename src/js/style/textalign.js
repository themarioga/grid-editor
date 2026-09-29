/**
 * Text alignment, a part of the style plugin: text alignment per breakpoint, with Bootstrap's text-{breakpoint}-start,
 * -center and -end classes.
 *
 * The part is what the textalign plugin was up to 7.2 - its families, and
 * whatever it did on the canvas - as a function of the handle.
 * grideditor.style.js puts it in its sections; the deprecated
 * grideditor.textalign.js still registers it on its own, as it always did.
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'utility.text_align': 'Text alignment',
    'utility.text_start': 'Start',
    'utility.text_center': 'Center',
    'utility.text_end': 'End',
});

/** Start and end are left and right: Bootstrap's css is left to right. */
var CSS = { start: 'left', center: 'center', end: 'right' };

export function textalignPart(ge) {

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
            appliesTo: ['row', 'column', 'text', 'element', 'container'],
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
}
