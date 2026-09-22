grid-editor locale keys
=======================

Every user-visible string in grid-editor goes through `t(key)`, and every key
is listed here. The list is hand-written on purpose — it is prose a reviewer
can read — and `test/locales.js` holds it to the source in both directions: a
key in the code that is missing here fails the build, and so does a key here
that no longer exists in the code.

English lives in `$.fn.gridEditor.locales.en`, inside the main bundle, and is
where every lookup ends. Shipped locales (currently `es`) translate all of it;
see `docs/spec-3.0.md` section 7 for the rules, and `src/js/locales/` for the
files.

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
| `tool.toggle_class` | Toggle "{label}" styling | Tooltip of a `row_classes`/`col_classes` button. `{label}` is the host's label |


row.*
-----

| Key | English | Where |
| --- | --- | --- |
| `row.add` | Add row {layout} | Tooltip of each toolbar add-row button. `{layout}` is the column layout, as in `6-6` |


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
| `view.all` | All sizes | The default view, which writes every breakpoint at once |
| `view.xs` | Phone | Layout mode writing `col-*` and `offset-*` |
| `view.sm` | Tablet | Layout mode writing `col-sm-*` and `offset-sm-*` |
| `view.md` | Small desktop | Layout mode writing `col-md-*` and `offset-md-*` |
| `view.lg` | Desktop | Layout mode writing `col-lg-*` and `offset-lg-*` |
| `view.xl` | Large desktop | Layout mode writing `col-xl-*` and `offset-xl-*` |
| `view.xxl` | Widescreen | Layout mode writing `col-xxl-*` and `offset-xxl-*` |


error.*
-------

Console messages for the host developer, not the page's user, but translated
all the same: the developer reading them is the one who chose the locale.

| Key | English | Where |
| --- | --- | --- |
| `error.tinymce_missing` | tinyMCE not available! … | `content_types: ['tinymce']` with no tinyMCE loaded |
| `error.ckeditor_missing` | CKEditor not available! … | `content_types: ['ckeditor']` with no CKEditor loaded |
| `error.summernote_missing` | Summernote not available! … | `content_types: ['summernote']` with no Summernote loaded |


Namespaces not in use yet
-------------------------

`element.*` and `column.*` are reserved by `docs/spec-3.0.md` section 7.3 and
have no keys yet: the element and offset strings that exist live under
`tool.*` and `confirm.*`, next to the tools they belong to.
