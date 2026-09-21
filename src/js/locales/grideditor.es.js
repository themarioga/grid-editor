/**
 * Spanish strings for grid-editor.
 *
 * Load after the plugin and select with `locale: 'es'`:
 *
 *   <script src="dist/jquery.grideditor.min.js"></script>
 *   <script src="dist/locales/grideditor.es.js"></script>
 *   <script>$('#myGrid').gridEditor({ locale: 'es' });</script>
 *
 * This is one of the two locales grid-editor ships, so it is held to complete
 * coverage of `$.fn.gridEditor.locales.en`: test/locales.js fails when a key
 * is missing. Add the Spanish string in the same change that adds the English
 * one, and keep the wording short enough to fit the tooltip or the dropdown
 * item it appears in.
 */
(function($) {

    $.fn.gridEditor.locales.es = {
        'tool.move': 'Mover',
        'tool.settings': 'Configuración',
        'tool.add_row': 'Añadir fila',
        'tool.add_column': 'Añadir columna',
        'tool.delete_row': 'Borrar fila',
        'tool.delete_column': 'Borrar columna',
        'tool.column_narrower': 'Estrechar columna\n(Mayús para el mínimo)',
        'tool.column_wider': 'Ensanchar columna\n(Mayús para el máximo)',
        'tool.edit_source': 'Editar el código fuente',
        'tool.preview': 'Vista previa',
        'tool.id_placeholder': 'id',
        'tool.id_title': 'Asignar un identificador único',
        'tool.toggle_class': 'Aplicar o quitar el estilo "{label}"',
        'row.add': 'Añadir fila {layout}',
        'confirm.delete_row': '¿Seguro que quieres borrar esta fila?',
        'confirm.delete_column': '¿Seguro que quieres borrar esta columna?',
        'view.lg': 'Escritorio',
        'view.sm': 'Tablet',
        'view.xs': 'Móvil',
        'error.tinymce_missing': '¡tinyMCE no está disponible! Asegúrate de haber cargado el archivo js de tinyMCE.',
        'error.ckeditor_missing': '¡CKEditor no está disponible! Asegúrate de haber cargado los archivos js de ckeditor y del adaptador de jQuery.',
        'error.summernote_missing': '¡Summernote no está disponible! Asegúrate de haber cargado el archivo js de Summernote.',
    };

})(jQuery);
