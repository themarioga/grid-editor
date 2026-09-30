/**
 * Inline style for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * container, pane, element and section gets a Style accordion in its
 * settings panel - size, spacing, border, background, text, typography,
 * display, flex, position and free css - written to the node's own style
 * attribute, with Bootstrap's classes for each section as chips that put
 * them in the classes field. What it can ask the editor for is the handle
 * its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.inline-style.min.js"></script>
 *
 * It also edits spacing, text alignment, display, flex, sticky and float,
 * Bootstrap's responsive classes, per breakpoint in its sections. On a node
 * that is flex or grid, the drawer leaves the flow, so the canvas lays the
 * content out as the page will.
 *
 * Where the settings panel has no room for it - a popover, inline in the
 * drawer - the accordion opens in a dialog, from a Style button.
 *
 * inline_style.sections chooses the sections, and in each the properties and
 * whether it has a catalog; inline_style.spacing is the options of spacing, whose
 * scale the gaps share, and inline_style.visibility those of the eye.
 */
import { GridEditor } from '../grideditor.js';
import { spacingPart } from '../inline-style/spacing.js';
import { textalignPart } from '../inline-style/textalign.js';
import { displayPart } from '../inline-style/display.js';
import { flexPart } from '../inline-style/flex.js';
import { floatPart } from '../inline-style/float.js';
import { stickyPart } from '../inline-style/sticky.js';
import { drawerflowPart } from '../inline-style/drawerflow.js';
import { resolveOptions } from '../inline-style/options.js';
import { createAccordion } from '../inline-style/accordion.js';

Object.assign(GridEditor.locales.en, {
    'inline_style.section_title': 'Style',
    'inline_style.dialog_title': 'Style: {kind}',
    'inline_style.section_size': 'Size',
    'inline_style.section_spacing': 'Spacing',
    'inline_style.section_border': 'Border',
    'inline_style.section_background': 'Background',
    'inline_style.section_text': 'Text',
    'inline_style.section_typography': 'Typography',
    'inline_style.section_display': 'Display',
    'inline_style.section_flex': 'Flex',
    'inline_style.section_position': 'Position',
    'inline_style.section_custom': 'Custom css',
    'inline_style.all_sizes': 'Applies to every size',
    'inline_style.overridden': 'The class {class} takes priority over this value',
    'inline_style.invalid': 'Not a value this property takes',
    'inline_style.catalog': 'Bootstrap classes',
    'inline_style.shadow_x': 'X',
    'inline_style.shadow_y': 'Y',
    'inline_style.shadow_blur': 'Blur',
    'inline_style.shadow_spread': 'Spread',
    'inline_style.shadow_color': 'Color',
    'inline_style.shadow_inset': 'Inset',
    'inline_style.shadow_text_mode': 'Edit as text',
    'inline_style.prop_width': 'Width',
    'inline_style.prop_height': 'Height',
    'inline_style.prop_min_width': 'Min width',
    'inline_style.prop_min_height': 'Min height',
    'inline_style.prop_max_width': 'Max width',
    'inline_style.prop_max_height': 'Max height',
    'inline_style.prop_margin_top': 'Margin top',
    'inline_style.prop_margin_right': 'Margin right',
    'inline_style.prop_margin_bottom': 'Margin bottom',
    'inline_style.prop_margin_left': 'Margin left',
    'inline_style.prop_padding_top': 'Padding top',
    'inline_style.prop_padding_right': 'Padding right',
    'inline_style.prop_padding_bottom': 'Padding bottom',
    'inline_style.prop_padding_left': 'Padding left',
    'inline_style.prop_border_width': 'Border width',
    'inline_style.prop_border_style': 'Border style',
    'inline_style.prop_border_color': 'Border color',
    'inline_style.prop_border_radius': 'Border radius',
    'inline_style.prop_box_shadow': 'Shadow',
    'inline_style.prop_background_color': 'Background color',
    'inline_style.prop_background_image': 'Background image',
    'inline_style.prop_background_size': 'Background size',
    'inline_style.prop_background_position': 'Background position',
    'inline_style.prop_background_repeat': 'Background repeat',
    'inline_style.prop_color': 'Color',
    'inline_style.prop_font_size': 'Font size',
    'inline_style.prop_text_align': 'Text align',
    'inline_style.prop_text_shadow': 'Text shadow',
    'inline_style.prop_font_family': 'Font family',
    'inline_style.prop_font_weight': 'Font weight',
    'inline_style.prop_font_style': 'Font style',
    'inline_style.prop_line_height': 'Line height',
    'inline_style.prop_letter_spacing': 'Letter spacing',
    'inline_style.prop_text_transform': 'Text transform',
    'inline_style.prop_text_decoration': 'Text decoration',
    'inline_style.prop_display': 'Display',
    'inline_style.prop_opacity': 'Opacity',
    'inline_style.prop_overflow': 'Overflow',
    'inline_style.prop_visibility': 'Visibility',
    'inline_style.prop_position': 'Position',
    'inline_style.prop_top': 'Top',
    'inline_style.prop_right': 'Right',
    'inline_style.prop_bottom': 'Bottom',
    'inline_style.prop_left': 'Left',
    'inline_style.prop_z_index': 'Z-index',
});

// The drawer's part last: it asks the browser how the others left the node
var PARTS = ['spacing', 'textalign', 'display', 'flex', 'float', 'sticky', 'drawerflow'];

GridEditor.utilities['inline-style'] = function(ge) {

    var options = resolveOptions(ge);
    var parts = {
        spacing: spacingPart(ge, options.spacing),
        textalign: textalignPart(ge),
        display: displayPart(ge, options.visibility),
        flex: flexPart(ge, options.spacing),
        float: floatPart(ge),
        sticky: stickyPart(ge),
        drawerflow: drawerflowPart(ge),
    };
    var accordions = []; // { node, accordion } for every panel built since the last init
    var context = {
        sections: options.sections,
        parts: parts,
        state: { open: null },
        opened: function(key) {
            accordions.forEach(function(entry) { entry.accordion.open(key); });
        },
    };

    /** Every part's hook, called in turn. */
    function each(hook) {
        return function() {
            var args = arguments;
            PARTS.forEach(function(name) {
                if (parts[name][hook]) { parts[name][hook].apply(null, args); }
            });
        };
    }

    var partsRefresh = each('onRefresh');

    return {
        // The parts' families, edited in the sections rather than in Responsive
        families: PARTS.reduce(function(all, name) {
            return all.concat(parts[name].families.map(function(family) {
                return Object.assign({}, family, { panel: false });
            }));
        }, []),

        panelSection: function(node, kind) {
            var accordion = createAccordion(ge, node, kind, context);
            if (!accordion) { return null; }

            accordions.push({ node: node, accordion: accordion });

            return { labelKey: 'inline_style.section_title', titleKey: 'inline_style.dialog_title', body: accordion.element };
        },

        preview: function(node, kind, breakpoint) {
            return parts.spacing.preview(node, kind, breakpoint);
        },

        // After a write, a change of classes or of view: the accordions of
        // the nodes it touched follow
        onRefresh: function(scope) {
            partsRefresh(scope);

            accordions = accordions.filter(function(entry) { return entry.accordion.element.isConnected; });
            accordions.forEach(function(entry) {
                if (entry.node === scope || scope.contains(entry.node)) { entry.accordion.render(); }
            });
        },

        drawerTools: each('drawerTools'),

        onDeinit: function() {
            each('onDeinit')();
            accordions = [];
        },
    };
};
