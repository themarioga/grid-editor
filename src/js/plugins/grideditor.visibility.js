/**
 * Visibility for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * element and container can be hidden at some breakpoints and shown at
 * others, with Bootstrap's d-{breakpoint}-none and d-{breakpoint}-block (or
 * -flex, for a row, which is a flex container and stops being a grid as a
 * block). What it can ask the editor for is the handle its factory is called
 * with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.visibility.min.js"></script>
 *
 * A hidden node is never hidden from the editor, which would leave nothing to
 * click to show it again. It stays on the canvas, faded and striped in a view
 * where it is hidden, and in the all view says at which breakpoints it is.
 *
 * utilities.visibility.drawer: false leaves the eye out of the drawers, and
 * the panel field is the only control.
 *
 * Deprecated since 7.3, and gone in 8.0: grideditor.style.js carries this
 * plugin's families, and edits them in its own sections. This file is that
 * part on its own, as it was, and says so once per editor. Loaded beside
 * the style plugin, it stands down.
 */
import { GridEditor } from '../grideditor.js';
import { visibilityPart } from '../style/visibility.js';

GridEditor.utilities.visibility = function(ge) {
    ge.warn('the "visibility" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
    return visibilityPart(ge, ge.settings.utilities.visibility);
};
