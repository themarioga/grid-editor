/**
 * grid-editor, set up the way a module app has it: everything imported, and
 * nothing on window.
 *
 * Imported once, before the first editor is made - app.ts does it. The
 * plugins register on GridEditor as they are imported, so the imports are
 * the list of what the editors in this app can do.
 */
import GridEditor from '@themarioga/grid-editor';

// The plugins this app uses
import '@themarioga/grid-editor/plugins/tabs';
import '@themarioga/grid-editor/plugins/accordion';
import '@themarioga/grid-editor/plugins/card';
import '@themarioga/grid-editor/plugins/elements';
import '@themarioga/grid-editor/plugins/style';
import '@themarioga/grid-editor/plugins/tinymce';
import '@themarioga/grid-editor/locales/es';

// SortableJS, for dragging. A page that loads it with a <script> tag has it
// as window.Sortable; a module app hands it over.
import Sortable from 'sortablejs';

// Bootstrap's javascript: its Modal asks before a delete and holds the modal
// settings panel, and its data API runs the view dropdown and the tabs.
import * as bootstrap from 'bootstrap';

// tinyMCE 7, bundled: the editor, its default theme, model and icons. Its
// skin is a stylesheet, in angular.json.
import 'tinymce/tinymce';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import 'tinymce/icons/default';

GridEditor.Sortable = Sortable;
GridEditor.bootstrap = bootstrap;

export { GridEditor };
