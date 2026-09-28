/**
 * The classic script's entry: the editor as window.GridEditor, for a page
 * that loads it with a <script> tag and its plugins after it.
 *
 * Loaded twice, the first copy is kept: its plugins registered on it, and
 * the editors on the page are its.
 */
import { GridEditor } from './grideditor.js';

if (window.GridEditor) {
    if (window.console && window.console.warn) {
        window.console.warn('grid-editor: ' + GridEditor.t({ locale: 'en' }, 'warning.duplicate_build'));
    }
} else {
    window.GridEditor = GridEditor;
}
