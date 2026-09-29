/**
 * Floating elements for grid-editor.
 *
 * A utility plugin: load this file after the editor and after the elements
 * plugin, and an element can float to the start or the end of its content
 * area per breakpoint, with the text around it, using Bootstrap's
 * float-{breakpoint}-start, -end and -none classes. What it can ask the
 * editor for is the handle its factory is called with, described in
 * docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.elements.min.js"></script>
 *   <script src="dist/plugins/grideditor.float.min.js"></script>
 *
 * Elements only. A floated row or column stops being part of the grid, and a
 * container sits beside the content areas rather than in their text.
 *
 * Deprecated since 7.3, and gone in 8.0: grideditor.style.js carries this
 * plugin's families, and edits them in its own sections. This file is that
 * part on its own, as it was, and says so once per editor. Loaded beside
 * the style plugin, it stands down.
 */
import { GridEditor } from '../grideditor.js';
import { floatPart } from '../style/float.js';

GridEditor.utilities.float = function(ge) {
    ge.warn('the "float" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
    return floatPart(ge);
};
