/**
 * Flex, a part of the style plugin: a flex container's direction, wrap,
 * alignment and gaps, and how its children grow, shrink and fill, per
 * breakpoint, with Bootstrap's flex-{breakpoint}-*, justify-content-*,
 * align-items-*, align-content-*, gap-* and row-/column-gap-* classes.
 *
 * Its families, and whatever it does on the canvas, as a function of the
 * handle and the spacing options, whose scale the gaps share:
 * grideditor.style.js puts them in its Flex section.
 */
import { GridEditor } from '../grideditor.js';

Object.assign(GridEditor.locales.en, {
    'utility.flex_direction': 'Direction',
    'utility.flex_wrap': 'Wrap',
    'utility.justify_content': 'Justify columns',
    'utility.align_items': 'Align columns',
    'utility.align_content': 'Align lines',
    'utility.gap': 'Gap',
    'utility.row_gap': 'Row gap',
    'utility.column_gap': 'Column gap',
    'utility.flex_fill': 'Fill',
    'utility.flex_grow': 'Grow',
    'utility.flex_shrink': 'Shrink',
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
};

var GAPS = ['0', '1', '2', '3', '4', '5'];

/** Bootstrap's $spacers. */
var SCALE = ['0', '.25rem', '.5rem', '1rem', '1.5rem', '3rem'];

/** A flex container: a row is one already, and has its gutters for gaps. */
var CONTAINERS = ['row', 'column', 'element', 'container'];

/** What sits in a flex container and can grow, shrink or fill it. */
var ITEMS = ['column', 'element', 'container'];

export function flexPart(ge, spacing) {

    var scale = (spacing && spacing.scale) || SCALE;

    /** A family whose preview is its one css property, the node's own without a class. */
    function family(definition) {
        var property = definition.property || definition.name;

        return Object.assign({
            prefix: definition.name,
            panel: false,
            preview: function(value, node) {
                var styles = {};
                styles[property] = value === null ? ge.bareStyle(node, definition.name, property) : definition.css(value);
                return styles;
            },
        }, definition);
    }

    /** An alignment family: its values are Bootstrap's names, and without a class it is normal. */
    function alignment(definition) {
        return family(Object.assign({
            appliesTo: CONTAINERS,
            preview: function(value) {
                var styles = {};
                styles[definition.name] = value === null ? 'normal' : FLEX[value];
                return styles;
            },
        }, definition));
    }

    function gap(definition) {
        return family(Object.assign({
            values: GAPS,
            appliesTo: ITEMS,
            css: function(value) { return scale[value]; },
        }, definition));
    }

    function same(value) {
        return value;
    }

    return {
        families: [
            family({
                name: 'flex-direction',
                prefix: 'flex',
                labelKey: 'utility.flex_direction',
                values: ['row', 'row-reverse', 'column', 'column-reverse'],
                appliesTo: CONTAINERS,
                css: same,
            }),
            family({
                name: 'flex-wrap',
                prefix: 'flex',
                labelKey: 'utility.flex_wrap',
                values: ['wrap', 'nowrap', 'wrap-reverse'],
                appliesTo: CONTAINERS,
                css: same,
            }),
            alignment({
                name: 'justify-content',
                labelKey: 'utility.justify_content',
                values: ['start', 'center', 'end', 'between', 'around', 'evenly'],
            }),
            alignment({
                name: 'align-items',
                labelKey: 'utility.align_items',
                values: ['start', 'center', 'end', 'baseline', 'stretch'],
            }),
            alignment({
                name: 'align-content',
                labelKey: 'utility.align_content',
                values: ['start', 'center', 'end', 'between', 'around', 'stretch'],
            }),
            gap({ name: 'gap', labelKey: 'utility.gap' }),
            gap({ name: 'row-gap', labelKey: 'utility.row_gap' }),
            gap({ name: 'column-gap', labelKey: 'utility.column_gap' }),
            family({
                name: 'flex-fill',
                prefix: 'flex',
                property: 'flex',
                labelKey: 'utility.flex_fill',
                values: ['fill'],
                appliesTo: ITEMS,
                css: function() { return '1 1 auto'; },
            }),
            family({
                name: 'flex-grow',
                prefix: 'flex',
                labelKey: 'utility.flex_grow',
                values: ['grow-0', 'grow-1'],
                appliesTo: ITEMS,
                css: function(value) { return value.slice(-1); },
            }),
            family({
                name: 'flex-shrink',
                prefix: 'flex',
                labelKey: 'utility.flex_shrink',
                values: ['shrink-0', 'shrink-1'],
                appliesTo: ITEMS,
                css: function(value) { return value.slice(-1); },
            }),
        ],
    };
}
