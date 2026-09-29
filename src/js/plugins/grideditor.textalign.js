/**
 * Text alignment for grid-editor.
 *
 * A utility plugin: load this file after the editor and a row, column,
 * element or container can align its text per breakpoint, with Bootstrap's
 * text-{breakpoint}-start, -center and -end classes. What it can ask the
 * editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.textalign.min.js"></script>
 *
 * The class aligns everything inside the node that does not align itself: a
 * paragraph the rich text editor gave its own text-align keeps it.
 *
 * Deprecated since 7.3, and gone in 8.0: grideditor.style.js carries this
 * plugin's families, and edits them in its own sections. This file is that
 * part on its own, as it was, and says so once per editor. Loaded beside
 * the style plugin, it stands down.
 */
import { GridEditor } from '../grideditor.js';
import { textalignPart } from '../style/textalign.js';

GridEditor.utilities.textalign = function(ge) {
    ge.warn('the "textalign" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
    return textalignPart(ge);
};
