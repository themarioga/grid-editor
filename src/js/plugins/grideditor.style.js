/**
 * Style for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * container, pane, element and section gets a Style accordion in its
 * settings panel - size, spacing, border, background, text, typography,
 * display, position and free css - written to the node's own style
 * attribute, with Bootstrap's classes for each section as chips that put
 * them in the classes field. What it can ask the editor for is the handle
 * its factory is called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.style.min.js"></script>
 *
 * It also edits spacing, text alignment, visibility and float, Bootstrap's
 * responsive classes, per breakpoint in its sections.
 *
 * Where the settings panel has no room for it - a popover, inline in the
 * drawer - the accordion opens in a dialog, from a Style button.
 *
 * style.sections chooses the sections, and in each the properties and
 * whether it has a catalog; style.spacing and style.visibility are the
 * options of those two.
 */
import { GridEditor } from '../grideditor.js';
import { spacingPart } from '../style/spacing.js';
import { textalignPart } from '../style/textalign.js';
import { visibilityPart } from '../style/visibility.js';
import { floatPart } from '../style/float.js';
import { resolveOptions } from '../style/options.js';
import { createAccordion } from '../style/accordion.js';

Object.assign(GridEditor.locales.en, {
    'style.section_title': 'Style',
    'style.dialog_title': 'Style: {kind}',
    'style.section_size': 'Size',
    'style.section_spacing': 'Spacing',
    'style.section_border': 'Border',
    'style.section_background': 'Background',
    'style.section_text': 'Text',
    'style.section_typography': 'Typography',
    'style.section_display': 'Display',
    'style.section_position': 'Position',
    'style.section_custom': 'Custom css',
    'style.all_sizes': 'Applies to every size',
    'style.overridden': 'The class {class} takes priority over this value',
    'style.invalid': 'Not a value this property takes',
    'style.catalog': 'Bootstrap classes',
    'style.shadow_x': 'X',
    'style.shadow_y': 'Y',
    'style.shadow_blur': 'Blur',
    'style.shadow_spread': 'Spread',
    'style.shadow_color': 'Color',
    'style.shadow_inset': 'Inset',
    'style.shadow_text_mode': 'Edit as text',
    'style.prop_width': 'Width',
    'style.prop_height': 'Height',
    'style.prop_min_width': 'Min width',
    'style.prop_min_height': 'Min height',
    'style.prop_max_width': 'Max width',
    'style.prop_max_height': 'Max height',
    'style.prop_margin_top': 'Margin top',
    'style.prop_margin_right': 'Margin right',
    'style.prop_margin_bottom': 'Margin bottom',
    'style.prop_margin_left': 'Margin left',
    'style.prop_padding_top': 'Padding top',
    'style.prop_padding_right': 'Padding right',
    'style.prop_padding_bottom': 'Padding bottom',
    'style.prop_padding_left': 'Padding left',
    'style.prop_border_width': 'Border width',
    'style.prop_border_style': 'Border style',
    'style.prop_border_color': 'Border color',
    'style.prop_border_radius': 'Border radius',
    'style.prop_box_shadow': 'Shadow',
    'style.prop_background_color': 'Background color',
    'style.prop_background_image': 'Background image',
    'style.prop_background_size': 'Background size',
    'style.prop_background_position': 'Background position',
    'style.prop_background_repeat': 'Background repeat',
    'style.prop_color': 'Color',
    'style.prop_font_size': 'Font size',
    'style.prop_text_align': 'Text align',
    'style.prop_text_shadow': 'Text shadow',
    'style.prop_font_family': 'Font family',
    'style.prop_font_weight': 'Font weight',
    'style.prop_font_style': 'Font style',
    'style.prop_line_height': 'Line height',
    'style.prop_letter_spacing': 'Letter spacing',
    'style.prop_text_transform': 'Text transform',
    'style.prop_text_decoration': 'Text decoration',
    'style.prop_display': 'Display',
    'style.prop_opacity': 'Opacity',
    'style.prop_overflow': 'Overflow',
    'style.prop_visibility': 'Visibility',
    'style.prop_position': 'Position',
    'style.prop_top': 'Top',
    'style.prop_right': 'Right',
    'style.prop_bottom': 'Bottom',
    'style.prop_left': 'Left',
    'style.prop_z_index': 'Z-index',
});

var PARTS = ['spacing', 'textalign', 'visibility', 'float'];

GridEditor.utilities.style = function(ge) {

    var options = resolveOptions(ge);
    var parts = {
        spacing: spacingPart(ge, options.spacing),
        textalign: textalignPart(ge),
        visibility: visibilityPart(ge, options.visibility),
        float: floatPart(ge),
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

            return { labelKey: 'style.section_title', titleKey: 'style.dialog_title', body: accordion.element };
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
