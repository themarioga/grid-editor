/**
 * Sticky, a part of the inline-style plugin: sticking a node to the top or the
 * bottom of the page as it scrolls, per breakpoint, with Bootstrap's
 * sticky-{breakpoint}-top and -bottom classes.
 *
 * Its families, and whatever it does on the canvas, as a function of the
 * handle: grideditor.inline-style.js puts them in its sections.
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'utility.sticky': 'Sticky',
});

/** What Bootstrap's sticky-top and sticky-bottom are. */
var STUCK = {
    top: { position: 'sticky', top: '0', 'z-index': '1020' },
    bottom: { position: 'sticky', bottom: '0', 'z-index': '1020' },
};

export function stickyPart(ge) {
    return {
        families: [{
            name: 'sticky',
            prefix: 'sticky',
            values: ['top', 'bottom'],
            appliesTo: ['row', 'column', 'element', 'container'],
            labelKey: 'utility.sticky',
            panel: false,

            /** With no class applying here, where the node is without one. */
            preview: function(value, node) {
                if (value !== null) { return STUCK[value]; }

                return { position: ge.bareStyle(node, 'sticky', 'position') };
            },
        }],
    };
}
