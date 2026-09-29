/**
 * Spacing for grid-editor.
 *
 * A utility plugin: load this file after the editor and every row, column,
 * element and container can have its padding and margin set per breakpoint,
 * with Bootstrap's p-{breakpoint}-*, pt-, px- … and m-{breakpoint}-*, mt-, mx-
 * … classes. What it can ask the editor for is the handle its factory is
 * called with, described in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.spacing.min.js"></script>
 *
 * Fourteen families would be fourteen fields, so the panel has two, padding
 * and margin, each a choice of side and a value for that side.
 *
 * utilities.spacing.values narrows the values offered, and
 * utilities.spacing.scale is what 0 to 5 come to, for a page that changed
 * Bootstrap's $spacers.
 *
 * Deprecated since 7.3, and gone in 8.0: grideditor.style.js carries this
 * plugin's families, and edits them in its own sections. This file is that
 * part on its own, as it was, and says so once per editor. Loaded beside
 * the style plugin, it stands down.
 */
import { GridEditor } from '../grideditor.js';
import { spacingPart } from '../style/spacing.js';

GridEditor.utilities.spacing = function(ge) {
    ge.warn('the "spacing" plugin is deprecated and will be removed in 8.0: load grideditor.style.js');
    return spacingPart(ge, ge.settings.utilities.spacing);
};
