/**
 * What a plugin's or a locale's classic script imports in place of the
 * editor: the GridEditor the page already loaded.
 *
 * The build points `import { GridEditor } from '../grideditor.js'` here for
 * the classic scripts, so each registers on the editor the page has rather
 * than bringing its own. Loaded before the editor there is nothing to
 * register on, and saying so is better than a TypeError three calls later.
 */
var GridEditor = window.GridEditor;

if (!GridEditor || typeof GridEditor.get !== 'function') {
    throw new Error('grid-editor: load grideditor.js (or grideditor.bundle.min.js) before its plugins, ' +
        'its locales and grideditor.jquery.js');
}

export { GridEditor };
export default GridEditor;
