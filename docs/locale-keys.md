grid-editor locale keys
=======================

Every user-visible string in grid-editor goes through `t(key)`, and every key
is listed here. The list is hand-written on purpose — it is prose a reviewer
can read — and `test/locales.js` holds it to the source in both directions: a
key in the code that is missing here fails the build, and so does a key here
that no longer exists in the code.

English lives in `$.fn.gridEditor.locales.en`, inside the main bundle, and is
where every lookup ends. Shipped locales (currently `es`) translate all of it,
and `test/locales.js` fails the build when one falls behind. The files are in
`src/js/locales/`.

Lookup order for a key is `locale_strings` → `locales[locale]` → `locales.en` →
the key itself. A key nothing defines is shown as the key, and logs once.

`{name}` placeholders are filled from the parameters the call passes.


tool.*
------

The tools in a drawer, and the buttons in the toolbar above the canvas.

| Key | English | Where |
| --- | --- | --- |
| `tool.move` | Move | Drag handle in the row and column drawers |
| `tool.settings` | Settings | Opens the settings panel in a drawer |
| `tool.add_row` | Add row | Column drawer, adds a nested row |
| `tool.add_column` | Add column\n(hold to choose the width) | Row drawer. A click adds a column, holding the tool offers the widths. Two lines |
| `tool.column_size` | {size} of 12 | Tooltip of a width in that picker |
| `tool.column_equal` | Equal: shares what the row has left | The `equal` choice in that picker, which adds a `col` |
| `tool.column_auto` | Auto: as wide as its content | The `auto` choice in that picker, which adds a `col-auto` |
| `tool.delete_row` | Remove row | Row drawer |
| `tool.delete_column` | Remove col | Column drawer |
| `tool.delete_element` | Remove element | Element drawer |
| `tool.delete_container` | Remove container | Container drawer |
| `tool.delete_pane` | Remove pane | Drawer of a tab or an accordion item |
| `tool.rename` | Double click to rename | Tooltip of a pane's label, which is edited in place |
| `tool.toggle_popup` | Fold this popup away while editing | Popup drawer. Editing shows a popup unfolded, and this folds it away |
| `tool.element_info` | Element: {name} | Tooltip of the element drawer's info tool. `{name}` is the element's `data-ge-label`, its `data-ge-element` type, or both |
| `tool.column_narrower` | Make column narrower\n(hold shift for min) | Column drawer, the `-` tool. Two lines |
| `tool.column_wider` | Make column wider\n(hold shift for max) | Column drawer, the `+` tool. Two lines |
| `tool.indent_decrease` | Decrease indent\n(hold shift for none) | Column drawer, removes offset units |
| `tool.indent_increase` | Increase indent\n(hold shift for max) | Column drawer, adds offset units |
| `tool.edit_source` | Edit Source Code | Toolbar, swaps the canvas for its html |
| `tool.preview` | Preview | Toolbar, hides the editing furniture while held |
| `tool.id_placeholder` | id | Placeholder of the id input in the settings panel |
| `tool.id_title` | Set a unique identifier | Tooltip of that input |
| `tool.classes_placeholder` | classes | Placeholder of the css class input beside it |
| `tool.classes_title` | Css classes, separated by spaces | Tooltip of that input |
| `tool.toggle_class` | Toggle "{label}" styling | Tooltip of a `row_classes`/`col_classes` button. `{label}` is the host's label |


row.*
-----

| Key | English | Where |
| --- | --- | --- |
| `row.add` | Add row {layout} | Tooltip of each toolbar add-row button. `{layout}` is the column layout, as in `6-6` |
| `row.add_row_cols` | Add a row of {columns} columns, {counts} per row | Tooltip of a toolbar button for a `{ row_cols, columns }` layout. `{counts}` reads like `1, md: 3` |


panel.*
-------

Where a node's settings open, and what they are called there: `settings_panel`
`'offcanvas'`, `'popover'` or `'modal'` - an unfolded `'inline'` panel has no
title. `{kind}` is one of the `panel.kind_*` keys, or a container's own label.

| Key | English | Where |
| --- | --- | --- |
| `panel.title` | {kind} settings | Title of the offcanvas, popover or modal |
| `panel.close` | Close | Label of its close button |
| `panel.done` | Done | The modal's button that closes it |
| `panel.id` | Id | Label of the id field |
| `panel.classes` | Classes | Label of the classes field |
| `panel.editor` | Editor | Label of a text's settings field that says which editor edits it |
| `panel.kind_row` | Row | `{kind}` for a row |
| `panel.kind_column` | Column | For a column |
| `panel.kind_text` | Text | For a text |
| `panel.kind_element` | Element | For an element |
| `panel.kind_section` | Section | For a section |
| `panel.kind_tab` | Tab | For a tab |
| `panel.kind_accordion_item` | Accordion item | For an accordion item |


container.*
-----------

The containers: tabs, accordions and popups, and the panes inside them.

| Key | English | Where |
| --- | --- | --- |
| `container.add_tabs` | Tabs | Toolbar button that adds a tabs container |
| `container.add_tab` | Add tab | Container drawer, adds a pane |
| `container.tab_label` | Tab {number} | Label of a new tab. `{number}` is its position |
| `container.add_accordion` | Accordion | Toolbar button that adds an accordion |
| `container.add_accordion_item` | Add item | Container drawer, adds an item |
| `container.accordion_label` | Item {number} | Label of a new accordion item |
| `container.add_popup` | Popup | Toolbar button that adds a popup |
| `container.popup_title` | Title | Title of a new popup, in its modal header |
| `container.popup_trigger` | Open | Label of the button a popup makes to open itself |
| `container.add_card` | Card | Toolbar button that adds a card |
| `container.card_title` | Card title | Title of a new card, in its header |
| `container.card_footer` | Card footer | Text of a new card's footer, when it has one |


section.*
---------

The sections plugin: Bootstrap's `.container` and its kin, on the canvas.

| Key | English | Where |
| --- | --- | --- |
| `section.add` | Section | Toolbar button that adds a section |
| `section.width` | Width | Label of a section's width field, in its settings panel |
| `section.fixed` | Fixed | Its choice for `container` |
| `section.fluid` | Full width | Its choice for `container-fluid` |
| `section.from` | Fixed from {breakpoint} | Its choice for `container-{bp}`. `{breakpoint}` is the key |
| `tool.add_row_to_section` | Add row | Section drawer, adds a row to the section |
| `tool.delete_section` | Remove section | Section drawer |
| `confirm.delete_section` | Delete this section and everything in it? | Asked before a section is deleted |


text.*
------

Text blocks: a content area, the text editor that edits it, and its drawer;
and the host's plain content, which a click makes a text. `{editor}` is an
editor's label, one of the `text.<type>` keys below or, for a plugin with no
label, its type.

The keys a text needs once an editor is loaded - `text.add`, `text.add_type`,
`panel.editor` and `panel.kind_text` - are the text editor plugins' since 6.0, and come with any of them. The rest
are the main bundle's: what the editor shows with no text editor loaded.

| Key | English | Where |
| --- | --- | --- |
| `text.add` | Text | Toolbar button that adds a text block, when one editor is offered |
| `text.add_type` | Text ({editor}) | The same, one per editor, when several are offered |
| `text.no_editor` | No text editor "{type}" is loaded: this text can be moved and deleted, not edited | Text drawer, for a content area whose editor's plugin is not loaded |
| `text.tinymce` | tinyMCE | The tinyMCE plugin's label |
| `text.ckeditor` | CKEditor | The CKEditor plugin's label |
| `text.summernote` | Summernote | The summernote plugin's label |
| `tool.delete_text` | Remove text | Text drawer |
| `tool.delete_plain` | Remove content | Plain content's drawer |
| `tool.convert_type` | Edit as {editor} text | Title of each choice a click on plain content offers, when several editors are |


clipboard.*
-----------

The clipboard plugin: copy and paste.

| Key | English | Where |
| --- | --- | --- |
| `tool.copy` | Copy | Row, column, section, text, container and element drawers |
| `tool.paste` | Paste | Column, row and section drawers, while something that fits there is copied |
| `clipboard.paste_row` | Paste row | Title of the toolbar's paste button, while a row is copied |
| `clipboard.paste_section` | Paste section | Title of the toolbar's paste button, while a section is copied |


codemirror.*
------------

The codemirror-inline plugin: a block's html, edited in place.

| Key | English | Where |
| --- | --- | --- |
| `tool.edit_html` | Edit html | The </> tool, in the drawers of rows, columns, texts, plain content, elements, sections and containers |
| `codemirror.apply` | Apply | Under the editor: the block's place takes what was written |
| `codemirror.cancel` | Cancel | Under the editor: the block stays as it was |


confirm.*
---------

Shown by `window.confirm` unless the host sets `confirm_delete: false` or
cancels `grideditor:before-delete` and asks in its own way.

The question is asked in a Bootstrap modal the editor builds outside the
canvas; a page that loaded Bootstrap's css but not its javascript gets the
browser's own confirm instead.

| Key | English | Where |
| --- | --- | --- |
| `confirm.title` | Confirm | Title of the confirmation modal |
| `confirm.ok` | Delete | The button that goes through with it |
| `confirm.cancel` | Cancel | The button that does not, and the close button's label |
| `confirm.delete_row` | Delete row? | Before a row is removed |
| `confirm.delete_column` | Delete column? | Before a column is removed |
| `confirm.delete_text` | Delete this text? | Before a text block is removed |
| `confirm.delete_plain` | Delete this content? | Before the host's plain content is removed |
| `confirm.delete_element` | Delete element? | Before an element is removed |
| `confirm.delete_container` | Delete this container and everything in it? | Before a container is removed |
| `confirm.delete_tab` | Delete this tab and everything in it? | Before a tab and its pane are removed |
| `confirm.delete_accordion_item` | Delete this item and everything in it? | Before an accordion item is removed |


view.*
------

The layout mode dropdown: one key per view the build offers, used for both the
dropdown item and the button that shows the current mode. The key is the view
key, so a locale covers a new breakpoint by adding `view.<key>`. Short strings
— they share a line with the other toolbar buttons.

| Key | English | Where |
| --- | --- | --- |
| `view.all` | All sizes | The default view, which writes one class for every breakpoint |
| `view.xs` | Phone | Layout mode writing `col-*` and `offset-*` |
| `view.sm` | Tablet | Layout mode writing `col-sm-*` and `offset-sm-*` |
| `view.md` | Small desktop | Layout mode writing `col-md-*` and `offset-md-*` |
| `view.lg` | Desktop | Layout mode writing `col-lg-*` and `offset-lg-*` |
| `view.xl` | Large desktop | Layout mode writing `col-xl-*` and `offset-xl-*` |
| `view.xxl` | Widescreen | Layout mode writing `col-xxl-*` and `offset-xxl-*` |


utility.*
---------

The Responsive section of a settings panel, which the utility plugins fill.
The labels of each utility and its values are the plugins' own keys.

| Key | English | Where |
| --- | --- | --- |
| `utility.section` | Responsive: {view} | The section's fold toggle. `{view}` is the label of the view being edited |
| `utility.col_width` | Width | The column width field, in a column's Responsive section |
| `utility.col_equal` | Equal | Its choice for `col` / `col-{bp}` |
| `utility.col_auto` | Auto | Its choice for `col-auto` / `col-{bp}-auto` |
| `utility.col_from_row` | From the row: {count} | The width field's empty choice when the row's row-cols sizes the column. `{count}` is `badge.row_cols` |
| `utility.row_cols` | Columns per row | The row-cols field, in a row's Responsive section |
| `utility.default` | Default | The empty choice of a field when nothing below the view sets the utility, and always in the all view |
| `utility.inherit` | Inherit: {value} (from {breakpoint}) | The empty choice in a breakpoint view when a smaller breakpoint sets the utility. `{breakpoint}` is its key, `sm` |
| `utility.varies` | Changes at {breakpoints}; choosing here replaces that | Note under a field in the all view when breakpoints set their own value. `{breakpoints}` is a list of keys |
| `utility.visibility` | Visibility | Label of the visibility plugin's field |
| `utility.visibility_hidden` | Hidden | Its choice for `d-*-none` |
| `utility.visibility_shown` | Shown | Its choice for `d-*-block`, or `d-*-flex` on a row |
| `tool.hide_in_view` | Hide in this view | The visibility plugin's eye, on a node shown in the view being edited |
| `tool.show_in_view` | Show in this view | The same eye, on a node hidden there |
| `utility.order` | Order | Label of the order plugin's field |
| `utility.order_first` | First | Its choice for `order-*-first` |
| `utility.order_last` | Last | Its choice for `order-*-last` |
| `tool.order_earlier` | Earlier in this view | The order plugin's left arrow in a column drawer |
| `tool.order_later` | Later in this view | Its right arrow |
| `utility.justify_content` | Justify columns | The alignment plugin's `justify-content-*` field, on a row |
| `utility.align_items` | Align columns | Its `align-items-*` field, on a row |
| `utility.align_self` | Align self | Its `align-self-*` field, on a column |
| `utility.gutters` | Gutters | The gutters plugin's `g-*` field, on a row |
| `utility.gutters_x` | Horizontal gutters | Its `gx-*` field |
| `utility.gutters_y` | Vertical gutters | Its `gy-*` field |
| `utility.padding` | Padding | The spacing plugin's padding group |
| `utility.margin` | Margin | Its margin group |
| `utility.side_all` | All sides | The side of `p-*` and `m-*` in a group's side choice |
| `utility.side_x` | Left and right | The side of `px-*` and `mx-*` |
| `utility.side_y` | Top and bottom | The side of `py-*` and `my-*` |
| `utility.side_t` | Top | The side of `pt-*` and `mt-*` |
| `utility.side_b` | Bottom | The side of `pb-*` and `mb-*` |
| `utility.side_s` | Start | The side of `ps-*` and `ms-*` |
| `utility.side_e` | End | The side of `pe-*` and `me-*` |
| `utility.text_align` | Text alignment | Label of the textalign plugin's field |
| `utility.text_start` | Start | Its choice for `text-*-start` |
| `utility.text_center` | Center | Its choice for `text-*-center` |
| `utility.text_end` | End | Its choice for `text-*-end` |
| `utility.float` | Float | Label of the float plugin's field, on an element |
| `utility.float_start` | Start | Its choice for `float-*-start` |
| `utility.float_end` | End | Its choice for `float-*-end` |
| `utility.float_none` | None | Its choice for `float-*-none` |
| `utility.spacing_gutter` | A column's side padding is its gutter: changing it changes the gutter | Note in a column's spacing group while it carries side padding |


badge.*
-------

Text the utility plugins show on the canvas while editing. Never in the
markup `getHtml` returns.

| Key | English | Where |
| --- | --- | --- |
| `badge.hidden_in` | Hidden at {breakpoints} | Corner of a node hidden at some breakpoints, in the all view. `{breakpoints}` is a list of keys |
| `badge.row_cols` | {count} per row | Corner of a row whose row-cols sizes its columns in the view being edited |
| `badge.row_cols_auto` | As wide as their content | The same, for `row-cols-auto` |
| `badge.order` | Order: {value} | Corner of a column ordered by class in the view being edited |


error.*
-------

Console messages for the host developer, not the page's user, but translated
all the same: the developer reading them is the one who chose the locale.

| Key | English | Where |
| --- | --- | --- |
| `error.sortable_missing` | SortableJS not available! … | Logged once when the drag library is not on the page |
| `warning.setting_removed` | The {setting} setting was removed in 4.0. Use {replacement} instead. | Logged once per removed setting a host still passes |
| `warning.already_editing` | This element already has an editor: … | An editor asked for on an element that has one; the one it has is handed back |
| `warning.destroyed` | {method}() was called on an editor that has been destroyed, … | Logged once per method called on a destroyed editor |
| `warning.duplicate_build` | grideditor.js was loaded twice: … | A second copy of the classic script, which keeps the first `GridEditor` |
| `warning.plugin_6x` | The "{name}" plugin is written for grid-editor 6 … | `grideditor.jquery.js`: a plugin registered on `$.fn.gridEditor.*`, which is left out |
| `warning.adapter_no_jquery` | grideditor.jquery.js needs jQuery 4, … | `grideditor.jquery.js` loaded on a page with no jQuery |
| `warning.oninit_removed` | tinyMCE's oninit option was removed in 7.0 … | A `tinymce.config` that still has `oninit`; `init_instance_callback` is called |
| `error.tinymce_missing` | tinyMCE not available! … | `content_types: ['tinymce']` with no tinyMCE loaded |
| `error.ckeditor_missing` | CKEditor not available! … | `content_types: ['ckeditor']` with no CKEditor loaded |
| `error.summernote_missing` | Summernote not available! … | `content_types: ['summernote']` with no Summernote loaded |
| `error.codemirror_missing` | CodeMirror not available! … | The codemirror plugin's source view with no CodeMirror loaded: the textarea is used |


Namespaces not in use yet
-------------------------

`element.*` and `column.*` are reserved and have no keys yet: the element and
offset strings that exist live under `tool.*` and `confirm.*`, next to the
tools they belong to.
