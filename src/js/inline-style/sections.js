/**
 * What the inline-style plugin's sections are made of: for each, its inline
 * properties and the field each one gets, the Bootstrap 5.3 classes its
 * catalog offers, and which of the merged utility parts it shows.
 *
 * Data, and the few questions asked of it: which classes set a property,
 * which properties a kind of node is offered.
 */

var COLORS = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
var SIDES = ['top', 'end', 'bottom', 'start'];
var OPACITIES = ['10', '25', '50', '75', '100'];

function each(prefix, values, suffix) {
    return values.map(function(value) { return prefix + value + (suffix || ''); });
}

/**
 * A catalog group: the classes it offers and whether they exclude each
 * other, so choosing one takes the others off. `notOn` names the kinds of
 * node it is never offered on, `onlyOn` the only ones it is.
 */
function group(classes, exclusive, notOn, onlyOn) {
    return { classes: classes, exclusive: exclusive !== false, notOn: notOn || [], onlyOn: onlyOn || null };
}

/**
 * A property's field. `type` is the widget: text for any css value, select
 * for a fixed list, color, url for background-image, shadow for
 * box-shadow and text-shadow. `notOn` names the kinds of node it is never
 * offered on.
 */
function prop(name, options) {
    return {
        name: name,
        labelKey: options.labelKey,
        type: options.type || 'text',
        values: options.values || null,
        notOn: options.notOn || [],
    };
}

var NOT_ON_COLUMN = ['column'];

/** The image classes are for the markup an element holds. */
var ONLY_ON_ELEMENT = ['element'];

export var SECTIONS = [
    {
        key: 'size',
        labelKey: 'inline_style.section_size',
        properties: [
            prop('width', { labelKey: 'inline_style.prop_width', notOn: NOT_ON_COLUMN }),
            prop('height', { labelKey: 'inline_style.prop_height', notOn: NOT_ON_COLUMN }),
            prop('min-width', { labelKey: 'inline_style.prop_min_width' }),
            prop('min-height', { labelKey: 'inline_style.prop_min_height' }),
            prop('max-width', { labelKey: 'inline_style.prop_max_width' }),
            prop('max-height', { labelKey: 'inline_style.prop_max_height' }),
        ],
        catalog: [
            group(each('w-', ['25', '50', '75', '100', 'auto']), true, NOT_ON_COLUMN),
            group(each('h-', ['25', '50', '75', '100', 'auto']), true, NOT_ON_COLUMN),
            group(['mw-100', 'mh-100', 'vw-100', 'vh-100', 'min-vw-100', 'min-vh-100'], false, NOT_ON_COLUMN),
            group(['img-fluid', 'img-thumbnail'], false, [], ONLY_ON_ELEMENT),
            group(each('object-fit-', ['contain', 'cover', 'fill', 'scale', 'none']), true, [], ONLY_ON_ELEMENT),
        ],
        parts: [],
    },
    {
        key: 'spacing',
        labelKey: 'inline_style.section_spacing',
        properties: [
            prop('margin-top', { labelKey: 'inline_style.prop_margin_top' }), prop('margin-right', { labelKey: 'inline_style.prop_margin_right' }), prop('margin-bottom', { labelKey: 'inline_style.prop_margin_bottom' }), prop('margin-left', { labelKey: 'inline_style.prop_margin_left' }),
            prop('padding-top', { labelKey: 'inline_style.prop_padding_top' }), prop('padding-right', { labelKey: 'inline_style.prop_padding_right' }), prop('padding-bottom', { labelKey: 'inline_style.prop_padding_bottom' }), prop('padding-left', { labelKey: 'inline_style.prop_padding_left' }),
        ],
        catalog: [],
        parts: ['spacing'],
    },
    {
        key: 'border',
        labelKey: 'inline_style.section_border',
        properties: [
            prop('border-width', { labelKey: 'inline_style.prop_border_width' }),
            prop('border-style', { labelKey: 'inline_style.prop_border_style', type: 'select', values: ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'] }),
            prop('border-color', { labelKey: 'inline_style.prop_border_color', type: 'color' }),
            prop('border-radius', { labelKey: 'inline_style.prop_border_radius' }),
            prop('box-shadow', { labelKey: 'inline_style.prop_box_shadow', type: 'shadow' }),
        ],
        catalog: [
            group(['border', 'border-0'].concat(each('border-', SIDES), each('border-', SIDES, '-0')), false),
            group(each('border-', ['1', '2', '3', '4', '5'])),
            group(each('border-', COLORS.concat(['black', 'white'])).concat(each('border-', COLORS, '-subtle'))),
            group(each('border-opacity-', OPACITIES)),
            group(['rounded'].concat(each('rounded-', ['0', '1', '2', '3', '4', '5', 'circle', 'pill']))),
            group(each('rounded-', SIDES), false),
            group(['shadow-none', 'shadow-sm', 'shadow', 'shadow-lg']),
        ],
        parts: [],
    },
    {
        key: 'background',
        labelKey: 'inline_style.section_background',
        properties: [
            prop('background-color', { labelKey: 'inline_style.prop_background_color', type: 'color' }),
            prop('background-image', { labelKey: 'inline_style.prop_background_image', type: 'url' }),
            prop('background-size', { labelKey: 'inline_style.prop_background_size' }),
            prop('background-position', { labelKey: 'inline_style.prop_background_position' }),
            prop('background-repeat', { labelKey: 'inline_style.prop_background_repeat', type: 'select', values: ['repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'space', 'round'] }),
        ],
        catalog: [
            group(each('bg-', COLORS.concat(['body', 'body-secondary', 'body-tertiary', 'white', 'black', 'transparent']))
                .concat(each('bg-', COLORS, '-subtle'), each('text-bg-', COLORS))),
            group(['bg-gradient'], false),
            group(each('bg-opacity-', OPACITIES)),
        ],
        parts: [],
    },
    {
        key: 'text',
        labelKey: 'inline_style.section_text',
        properties: [
            prop('color', { labelKey: 'inline_style.prop_color', type: 'color' }),
            prop('font-size', { labelKey: 'inline_style.prop_font_size' }),
            prop('text-align', { labelKey: 'inline_style.prop_text_align', type: 'select', values: ['start', 'center', 'end', 'left', 'right', 'justify'] }),
            prop('text-shadow', { labelKey: 'inline_style.prop_text_shadow', type: 'shadow' }),
        ],
        catalog: [
            group(each('text-', COLORS.concat(['body', 'body-secondary', 'body-tertiary', 'white', 'black']))
                .concat(each('text-', COLORS, '-emphasis'), ['text-body-emphasis'])),
            group(each('text-opacity-', ['25', '50', '75', '100'])),
            group(each('fs-', ['1', '2', '3', '4', '5', '6'])),
            group(each('text-decoration-', ['none', 'underline', 'line-through'])),
        ],
        parts: ['textalign'],
    },
    {
        key: 'typography',
        labelKey: 'inline_style.section_typography',
        properties: [
            prop('font-family', { labelKey: 'inline_style.prop_font_family' }),
            prop('font-weight', { labelKey: 'inline_style.prop_font_weight', type: 'select', values: ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'normal', 'bold', 'lighter', 'bolder'] }),
            prop('font-style', { labelKey: 'inline_style.prop_font_style', type: 'select', values: ['normal', 'italic', 'oblique'] }),
            prop('line-height', { labelKey: 'inline_style.prop_line_height' }),
            prop('letter-spacing', { labelKey: 'inline_style.prop_letter_spacing' }),
            prop('text-transform', { labelKey: 'inline_style.prop_text_transform', type: 'select', values: ['none', 'uppercase', 'lowercase', 'capitalize'] }),
            prop('text-decoration', { labelKey: 'inline_style.prop_text_decoration', type: 'select', values: ['none', 'underline', 'line-through', 'overline'] }),
        ],
        catalog: [
            group(each('fw-', ['lighter', 'light', 'normal', 'medium', 'semibold', 'bold', 'bolder'])),
            group(each('fst-', ['italic', 'normal'])),
            group(each('lh-', ['1', 'sm', 'base', 'lg'])),
            group(each('text-', ['lowercase', 'uppercase', 'capitalize'])),
            group(['font-monospace'], false),
            group(['text-wrap', 'text-nowrap']),
            group(['text-break'], false),
        ],
        parts: [],
    },
    {
        key: 'display',
        labelKey: 'inline_style.section_display',
        properties: [
            prop('display', { labelKey: 'inline_style.prop_display', type: 'select', values: ['none', 'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid'] }),
            prop('opacity', { labelKey: 'inline_style.prop_opacity' }),
            prop('overflow', { labelKey: 'inline_style.prop_overflow', type: 'select', values: ['visible', 'hidden', 'auto', 'scroll', 'clip'] }),
            prop('visibility', { labelKey: 'inline_style.prop_visibility', type: 'select', values: ['visible', 'hidden'] }),
        ],
        catalog: [
            group(each('opacity-', ['0', '25', '50', '75', '100'])),
            group(each('overflow-', ['auto', 'hidden', 'visible', 'scroll'])),
            group(['visible', 'invisible']),
        ],
        parts: ['display'],
    },
    {
        key: 'flex',
        labelKey: 'inline_style.section_flex',
        properties: [],
        catalog: [
            group(['vstack', 'hstack'], true, ['row']),
        ],
        parts: ['flex'],
    },
    {
        key: 'position',
        labelKey: 'inline_style.section_position',
        properties: [
            prop('position', { labelKey: 'inline_style.prop_position', type: 'select', values: ['static', 'relative', 'absolute', 'fixed', 'sticky'] }),
            prop('top', { labelKey: 'inline_style.prop_top', notOn: NOT_ON_COLUMN }),
            prop('right', { labelKey: 'inline_style.prop_right', notOn: NOT_ON_COLUMN }),
            prop('bottom', { labelKey: 'inline_style.prop_bottom', notOn: NOT_ON_COLUMN }),
            prop('left', { labelKey: 'inline_style.prop_left', notOn: NOT_ON_COLUMN }),
            prop('z-index', { labelKey: 'inline_style.prop_z_index' }),
        ],
        catalog: [
            group(each('position-', ['static', 'relative', 'absolute', 'fixed', 'sticky'])),
            group(each('top-', ['0', '50', '100'])),
            group(each('bottom-', ['0', '50', '100'])),
            group(each('start-', ['0', '50', '100'])),
            group(each('end-', ['0', '50', '100'])),
            group(['translate-middle', 'translate-middle-x', 'translate-middle-y']),
            group(['z-n1', 'z-0', 'z-1', 'z-2', 'z-3']),
            group(['fixed-top', 'fixed-bottom']),
        ],
        parts: ['float', 'sticky'],
    },
    {
        key: 'custom',
        labelKey: 'inline_style.section_custom',
        properties: [],
        catalog: [],
        parts: [],
        custom: true,
    },
];

export function section(key) {
    return SECTIONS.filter(function(each_) { return each_.key === key; })[0] || null;
}

/** Whether a property or a catalog group is offered on this kind of node. */
export function offeredOn(item, kind) {
    if (item.onlyOn && item.onlyOn.indexOf(kind) === -1) { return false; }

    return item.notOn.indexOf(kind) === -1;
}

var BREAKPOINT = '(?:(?:sm|md|lg|xl|xxl)-)?';
var SPACER = '(?:[0-5]|auto)';
var COLOR = '(?:' + COLORS.join('|') + '|black|white)';
var BG = '(?:' + COLORS.join('|') + '|body|body-secondary|body-tertiary|white|black|transparent)';
var TEXT_COLOR = '(?:' + COLORS.join('|') + '|body|body-secondary|body-tertiary|white|black|muted|black-50|white-50)';
var BORDER = 'border(?:-(?:top|end|bottom|start))?(?:-0)?';
var SUBTLE = '(?:' + COLORS.join('|') + ')-subtle';
var EMPHASIS = '(?:' + COLORS.join('|') + '|body)-emphasis';
var TEXT_BG = 'text-bg-(?:' + COLORS.join('|') + ')';
var STICKY = 'sticky-' + BREAKPOINT;

function spacing(key, side) {
    var sides = { top: '[ty]?', bottom: '[by]?', left: '[sx]?', right: '[ex]?' }[side];
    return new RegExp('^' + key + sides + '-' + BREAKPOINT + SPACER + '$');
}

/**
 * The Bootstrap classes that set each property. Every one of Bootstrap's
 * utilities is !important, so a node that carries one of them for a
 * property shows the class, whatever its inline style says.
 */
var SETS = {
    'width': /^(?:w-(?:25|50|75|100|auto)|vw-100)$/,
    'height': /^(?:h-(?:25|50|75|100|auto)|vh-100)$/,
    'max-width': /^mw-100$/,
    'max-height': /^mh-100$/,
    'min-width': /^min-vw-100$/,
    'min-height': /^min-vh-100$/,
    'margin-top': spacing('m', 'top'),
    'margin-right': spacing('m', 'right'),
    'margin-bottom': spacing('m', 'bottom'),
    'margin-left': spacing('m', 'left'),
    'padding-top': spacing('p', 'top'),
    'padding-right': spacing('p', 'right'),
    'padding-bottom': spacing('p', 'bottom'),
    'padding-left': spacing('p', 'left'),
    'border-width': new RegExp('^(?:' + BORDER + '|border-[1-5])$'),
    'border-style': new RegExp('^' + BORDER + '$'),
    'border-color': new RegExp('^(?:' + BORDER + '|border-' + COLOR + '|border-' + SUBTLE + ')$'),
    'border-radius': /^rounded(?:-(?:[0-5]|circle|pill|top|end|bottom|start))?$/,
    'box-shadow': /^shadow(?:-(?:none|sm|lg))?$/,
    'background-color': new RegExp('^(?:bg-' + BG + '|bg-' + SUBTLE + '|' + TEXT_BG + ')$'),
    'background-image': /^bg-gradient$/,
    'color': new RegExp('^(?:text-' + TEXT_COLOR + '|text-' + EMPHASIS + '|' + TEXT_BG + ')$'),
    'font-size': /^fs-[1-6]$/,
    'text-align': new RegExp('^text-' + BREAKPOINT + '(?:start|center|end)$'),
    'text-decoration': /^text-decoration-(?:none|underline|line-through)$/,
    'font-family': /^font-monospace$/,
    'font-weight': /^fw-(?:lighter|light|normal|medium|semibold|bold|bolder)$/,
    'font-style': /^fst-(?:italic|normal)$/,
    'line-height': /^lh-(?:1|sm|base|lg)$/,
    'text-transform': /^text-(?:lowercase|uppercase|capitalize)$/,
    'display': new RegExp('^(?:d-' + BREAKPOINT + '(?:none|inline|inline-block|block|grid|inline-grid|table|table-row|table-cell|flex|inline-flex)|vstack|hstack)$'),
    'opacity': /^opacity-(?:0|25|50|75|100)$/,
    'overflow': /^overflow-(?:auto|hidden|visible|scroll)$/,
    'visibility': /^(?:visible|invisible)$/,
    'position': new RegExp('^(?:position-(?:static|relative|absolute|fixed|sticky)|fixed-(?:top|bottom)|' + STICKY + '(?:top|bottom))$'),
    'top': new RegExp('^(?:top-(?:0|50|100)|fixed-top|' + STICKY + 'top)$'),
    'bottom': new RegExp('^(?:bottom-(?:0|50|100)|fixed-bottom|' + STICKY + 'bottom)$'),
    'left': /^start-(?:0|50|100)$/,
    'right': /^end-(?:0|50|100)$/,
    'z-index': /^z-(?:n1|[0-3])$/,
};

/** The first of these classes that sets the property, or null. */
export function overriding(property, classes) {
    var pattern = SETS[property];
    if (!pattern) { return null; }

    return classes.filter(function(name) { return pattern.test(name); })[0] || null;
}
