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
| `tool.delete_pane` | Remove pane | Drawer of a tab, an accordion item or a carousel slide |
| `tool.carousel_show_previous` | Previous slide | Carousel drawer, shows the previous slide |
| `tool.carousel_show_next` | Next slide | Carousel drawer, shows the next slide |
| `tool.carousel_move_back` | Move back | Slide drawer, moves the slide a place back |
| `tool.carousel_move_forward` | Move forward | Slide drawer, moves the slide a place on |
| `tool.rename` | Double click to rename | Tooltip of a pane's label, which is edited in place |
| `tool.toggle_popup` | Fold this popup away while editing | Popup drawer. Editing shows a popup unfolded, and this folds it away |
| `tool.element_info` | Element: {name} | Tooltip of the element drawer's info tool. `{name}` is the element's `data-ge-label`, its `data-ge-element` type, or both |
| `tool.column_narrower` | Make column narrower\n(hold shift for min) | Column drawer, the `-` tool. Two lines |
| `tool.column_wider` | Make column wider\n(hold shift for max) | Column drawer, the `+` tool. Two lines |
| `tool.indent_decrease` | Decrease indent\n(hold shift for none) | Column drawer, removes offset units |
| `tool.indent_increase` | Increase indent\n(hold shift for max) | Column drawer, adds offset units |
| `tool.edit_source` | Edit Source Code | Toolbar, swaps the canvas for its html |
| `tool.preview` | Preview | Toolbar, hides the editing furniture while held |
| `tool.more` | More | Toolbar, the button that opens the add buttons that don't fit on its line; drawers, the tool that unfolds the ones that don't fit on theirs |
| `group.rows` | Rows | Toolbar, with `toolbar_groups`: the tab of the add row buttons |
| `group.content` | Content | Toolbar, with `toolbar_groups`: the tab of the containers, the sections and the plugins' buttons that join it |
| `group.elements` | Elements | Toolbar, with `toolbar_groups`: the tab of the texts, the elements of `elements.types` and the plugins' buttons that join it |
| `group.select` | Add | Toolbar, with `toolbar_groups`: the accessible name of the tabs |
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
| `panel.section_general` | Id and classes | Heading of the panel's section with the id, the classes and the preset toggles |
| `panel.editor` | Editor | Label of a text's settings field that says which editor edits it |
| `panel.kind_row` | Row | `{kind}` for a row |
| `panel.kind_column` | Column | For a column |
| `panel.kind_text` | Text | For a text |
| `panel.kind_element` | Element | For an element |
| `panel.kind_section` | Section | For a section |
| `panel.kind_tab` | Tab | For a tab |
| `panel.kind_accordion_item` | Accordion item | For an accordion item |
| `panel.kind_carousel_item` | Slide | For a carousel slide |


container.*
-----------

The containers: tabs, accordions, popups, carousels and cards, and the panes inside them.

| Key | English | Where |
| --- | --- | --- |
| `container.add_tabs` | Tabs | Toolbar button that adds a tabs container |
| `container.add_tab` | Add tab | Container drawer, adds a pane |
| `container.tab_label` | Tab {number} | Label of a new tab. `{number}` is its position |
| `container.tabs_section` | Tabs | Heading of the tabs container's section of its settings panel |
| `container.tabs_style` | Style | Its strip's style select |
| `container.tabs_style_tabs` | Tabs | Its choice for `nav-tabs` |
| `container.tabs_style_pills` | Pills | Its choice for `nav-pills` |
| `container.tabs_style_underline` | Underline | Its choice for `nav-underline` |
| `container.tabs_width` | Width | The strip's width select |
| `container.tabs_width_natural` | Natural | Its choice for no width class |
| `container.tabs_width_fill` | Fill | Its choice for `nav-fill` |
| `container.tabs_width_justified` | Justified | Its choice for `nav-justified` |
| `container.tabs_align` | Alignment | The strip's alignment select, with the natural width and horizontal only |
| `container.tabs_align_start` | Start | Its choice for no alignment class |
| `container.tabs_align_center` | Center | Its choice for `justify-content-center` |
| `container.tabs_align_end` | End | Its choice for `justify-content-end` |
| `container.tabs_layout` | Layout | The container's layout select |
| `container.tabs_layout_horizontal` | Horizontal | Its choice for the strip above the panes |
| `container.tabs_layout_vertical` | Vertical | Its choice for the strip beside the panes at every size: `d-flex`, `flex-column` |
| `container.tabs_layout_vertical_from` | Vertical from {breakpoint} | Its choices for vertical from a breakpoint up, `d-{bp}-flex`, `flex-{bp}-column`. `{breakpoint}` is its key, `md` |
| `container.add_accordion` | Accordion | Toolbar button that adds an accordion |
| `container.add_accordion_item` | Add item | Container drawer, adds an item |
| `container.accordion_label` | Item {number} | Label of a new accordion item |
| `container.add_carousel` | Carousel | Toolbar button that adds a carousel |
| `container.add_carousel_item` | Add slide | Container drawer, adds a slide |
| `container.carousel_previous` | Previous | The text, hidden, of a carousel's previous arrow in the page |
| `container.carousel_next` | Next | The same for the next arrow |
| `container.carousel_slide_label` | Slide {number} | `aria-label` of a carousel's indicator. `{number}` is the slide's position |
| `container.carousel_counter` | {current} / {total} | The container's drawer says which slide is shown, and how many there are |
| `container.carousel_section` | Carousel | Heading of the carousel's section of its settings panel |
| `container.carousel_controls` | Arrows | Its checkbox for the previous and next arrows |
| `container.carousel_indicators` | Indicators | Its checkbox for the indicators |
| `container.carousel_fade` | Fade | Its checkbox for `carousel-fade` |
| `container.carousel_dark` | Dark theme | Its checkbox for `data-bs-theme="dark"` |
| `container.carousel_ride` | Autoplay | Its autoplay select, `data-bs-ride` |
| `container.carousel_ride_no` | No | Its choice for no autoplay |
| `container.carousel_ride_load` | On load | Its choice for `data-bs-ride="carousel"` |
| `container.carousel_ride_interaction` | After first interaction | Its choice for `data-bs-ride="true"` |
| `container.carousel_interval` | Interval (s) | The interval field, in seconds, of the carousel's section and of a slide's. `data-bs-interval` |
| `container.carousel_pause` | Pause on hover | Its checkbox for `data-bs-pause` |
| `container.carousel_wrap` | Wrap around | Its checkbox for `data-bs-wrap` |
| `container.carousel_keyboard` | Keyboard | Its checkbox for `data-bs-keyboard` |
| `container.carousel_touch` | Touch swipe | Its checkbox for `data-bs-touch` |
| `container.carousel_item_section` | Slide | Heading of a slide's section of its settings panel |
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
`panel.editor` and `panel.kind_text` - are the text editor plugins', and come with any of them. The rest
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


autosave.*
----------

The autosave plugin: the question asked when an editor starts with a draft of
the same html saved.

| Key | English | Where |
| --- | --- | --- |
| `autosave.restore_title` | Restore the draft? | Title of the confirm modal |
| `autosave.restore_message` | There is a draft of this page saved on {date}, with changes that were not published. Restore it? | The question, `{date}` the draft's, in the editor's locale |
| `autosave.restore` | Restore | The modal's ok button: the canvas becomes the draft |
| `autosave.discard` | Discard | The modal's cancel button: the draft is taken away |


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
| `confirm.delete_carousel_item` | Delete this slide and everything in it? | Before a carousel slide is removed |


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

The Responsive section of a settings panel, which the utility plugins fill,
and the per breakpoint fields of the inline-style plugin's sections. The labels of
each utility and its values are the plugins' own keys.

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
| `utility.display` | Display | Label of the display field, `d-*`, in the inline-style plugin's Display section. Its other choices are the values themselves |
| `utility.visibility_hidden` | Hidden | Its choice for `d-*-none` |
| `tool.hide_in_view` | Hide in this view | The inline-style plugin's eye, on a node shown in the view being edited |
| `tool.show_in_view` | Show in this view | The same eye, on a node hidden there |
| `utility.order` | Order | Label of the order plugin's field |
| `utility.order_first` | First | Its choice for `order-*-first` |
| `utility.order_last` | Last | Its choice for `order-*-last` |
| `tool.order_earlier` | Earlier in this view | The order plugin's left arrow in a column drawer |
| `tool.order_later` | Later in this view | Its right arrow |
| `utility.align_self` | Align self | The alignment plugin's `align-self-*` field, on a column |
| `utility.gutters` | Gutters | The gutters plugin's `g-*` field, on a row |
| `utility.gutters_x` | Horizontal gutters | Its `gx-*` field |
| `utility.gutters_y` | Vertical gutters | Its `gy-*` field |
| `utility.padding` | Padding | The padding group, in the inline-style plugin's Spacing section |
| `utility.margin` | Margin | Its margin group |
| `utility.side_all` | All sides | The side of `p-*` and `m-*` in a group's side choice |
| `utility.side_x` | Left and right | The side of `px-*` and `mx-*` |
| `utility.side_y` | Top and bottom | The side of `py-*` and `my-*` |
| `utility.side_t` | Top | The side of `pt-*` and `mt-*` |
| `utility.side_b` | Bottom | The side of `pb-*` and `mb-*` |
| `utility.side_s` | Start | The side of `ps-*` and `ms-*` |
| `utility.side_e` | End | The side of `pe-*` and `me-*` |
| `utility.text_align` | Text alignment | Label of the text alignment field, in the inline-style plugin's Text section |
| `utility.text_start` | Start | Its choice for `text-*-start` |
| `utility.text_center` | Center | Its choice for `text-*-center` |
| `utility.text_end` | End | Its choice for `text-*-end` |
| `utility.flex_direction` | Direction | The `flex-*-row` / `-column` field, in the inline-style plugin's Flex section |
| `utility.flex_wrap` | Wrap | Its `flex-*-wrap` / `-nowrap` field |
| `utility.justify_content` | Justify columns | Its `justify-content-*` field |
| `utility.align_items` | Align columns | Its `align-items-*` field |
| `utility.align_content` | Align lines | Its `align-content-*` field |
| `utility.gap` | Gap | Its `gap-*` field, on anything but a row |
| `utility.row_gap` | Row gap | Its `row-gap-*` field |
| `utility.column_gap` | Column gap | Its `column-gap-*` field |
| `utility.flex_fill` | Fill | Its `flex-*-fill` field, on anything but a row |
| `utility.flex_grow` | Grow | Its `flex-*-grow-*` field |
| `utility.flex_shrink` | Shrink | Its `flex-*-shrink-*` field |
| `utility.sticky` | Sticky | The `sticky-*-top` / `-bottom` field, in the inline-style plugin's Position section |
| `utility.float` | Float | Label of the float field, in the inline-style plugin's Position section, on an element |
| `utility.float_start` | Start | Its choice for `float-*-start` |
| `utility.float_end` | End | Its choice for `float-*-end` |
| `utility.float_none` | None | Its choice for `float-*-none` |
| `utility.spacing_gutter` | A column's side padding is its gutter: changing it changes the gutter | Note in a column's spacing group while it carries side padding |


inline_style.*
--------------

The inline-style plugin's accordion, in a node's settings panel or in the dialog.

| Key | English | Where |
| --- | --- | --- |
| `inline_style.section_title` | Style | Heading of the inline-style plugin's section of the panel, and the button that opens it in the dialog when `settings_panel` is `popover` or `inline` |
| `inline_style.dialog_title` | Style: {kind} | Title of that dialog. `{kind}` is what the panel's title calls the node |
| `inline_style.section_size` | Size | The accordion's section header |
| `inline_style.section_spacing` | Spacing | The accordion's section header |
| `inline_style.section_border` | Border | The accordion's section header |
| `inline_style.section_background` | Background | The accordion's section header |
| `inline_style.section_text` | Text | The accordion's section header |
| `inline_style.section_typography` | Typography | The accordion's section header |
| `inline_style.section_display` | Display | The accordion's section header |
| `inline_style.section_flex` | Flex | The accordion's section header |
| `inline_style.section_position` | Position | The accordion's section header |
| `inline_style.section_custom` | Custom css | The accordion's section header |
| `inline_style.all_sizes` | Applies to every size | Note over a section's inline fields in a breakpoint view: the style attribute is not responsive |
| `inline_style.overridden` | The class {class} takes priority over this value | Note under an inline field whose property a Bootstrap utility on the node also sets. `{class}` is that class |
| `inline_style.invalid` | Not a value this property takes | Tooltip of an inline field holding a value the browser refused |
| `inline_style.catalog` | Bootstrap classes | Heading of a section's Bootstrap class chips |
| `inline_style.shadow_x` | X | A part of the shadow builder |
| `inline_style.shadow_y` | Y | A part of the shadow builder |
| `inline_style.shadow_blur` | Blur | A part of the shadow builder |
| `inline_style.shadow_spread` | Spread | A part of the shadow builder |
| `inline_style.shadow_color` | Color | A part of the shadow builder |
| `inline_style.shadow_inset` | Inset | The shadow builder's inset checkbox |
| `inline_style.shadow_text_mode` | Edit as text | Link under the shadow builder that edits the value as text |
| `inline_style.shadow_builder_mode` | Edit with the builder | Link under a shadow edited as text that goes back to the builder, when the value is one shadow or none |
| `inline_style.prop_width` | Width | Label of the `width` field |
| `inline_style.prop_height` | Height | Label of the `height` field |
| `inline_style.prop_min_width` | Min width | Label of the `min-width` field |
| `inline_style.prop_min_height` | Min height | Label of the `min-height` field |
| `inline_style.prop_max_width` | Max width | Label of the `max-width` field |
| `inline_style.prop_max_height` | Max height | Label of the `max-height` field |
| `inline_style.prop_margin_top` | Margin top | Label of the `margin-top` field |
| `inline_style.prop_margin_right` | Margin right | Label of the `margin-right` field |
| `inline_style.prop_margin_bottom` | Margin bottom | Label of the `margin-bottom` field |
| `inline_style.prop_margin_left` | Margin left | Label of the `margin-left` field |
| `inline_style.prop_padding_top` | Padding top | Label of the `padding-top` field |
| `inline_style.prop_padding_right` | Padding right | Label of the `padding-right` field |
| `inline_style.prop_padding_bottom` | Padding bottom | Label of the `padding-bottom` field |
| `inline_style.prop_padding_left` | Padding left | Label of the `padding-left` field |
| `inline_style.prop_border_width` | Border width | Label of the `border-width` field |
| `inline_style.prop_border_style` | Border style | Label of the `border-style` field |
| `inline_style.prop_border_color` | Border color | Label of the `border-color` field |
| `inline_style.prop_border_radius` | Border radius | Label of the `border-radius` field |
| `inline_style.prop_box_shadow` | Shadow | Label of the `box-shadow` field |
| `inline_style.prop_background_color` | Background color | Label of the `background-color` field |
| `inline_style.prop_background_image` | Background image | Label of the `background-image` field |
| `inline_style.prop_background_size` | Background size | Label of the `background-size` field |
| `inline_style.prop_background_position` | Background position | Label of the `background-position` field |
| `inline_style.prop_background_repeat` | Background repeat | Label of the `background-repeat` field |
| `inline_style.prop_color` | Color | Label of the `color` field |
| `inline_style.prop_font_size` | Font size | Label of the `font-size` field |
| `inline_style.prop_text_align` | Text align | Label of the `text-align` field |
| `inline_style.prop_text_shadow` | Text shadow | Label of the `text-shadow` field |
| `inline_style.prop_font_family` | Font family | Label of the `font-family` field |
| `inline_style.prop_font_weight` | Font weight | Label of the `font-weight` field |
| `inline_style.prop_font_style` | Font style | Label of the `font-style` field |
| `inline_style.prop_line_height` | Line height | Label of the `line-height` field |
| `inline_style.prop_letter_spacing` | Letter spacing | Label of the `letter-spacing` field |
| `inline_style.prop_text_transform` | Text transform | Label of the `text-transform` field |
| `inline_style.prop_text_decoration` | Text decoration | Label of the `text-decoration` field |
| `inline_style.prop_display` | Display | Label of the `display` field |
| `inline_style.prop_opacity` | Opacity | Label of the `opacity` field |
| `inline_style.prop_overflow` | Overflow | Label of the `overflow` field |
| `inline_style.prop_visibility` | Visibility | Label of the `visibility` field |
| `inline_style.prop_position` | Position | Label of the `position` field |
| `inline_style.prop_top` | Top | Label of the `top` field |
| `inline_style.prop_right` | Right | Label of the `right` field |
| `inline_style.prop_bottom` | Bottom | Label of the `bottom` field |
| `inline_style.prop_left` | Left | Label of the `left` field |
| `inline_style.prop_z_index` | Z-index | Label of the `z-index` field |


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
| `warning.already_editing` | This element already has an editor: … | An editor asked for on an element that has one; the one it has is handed back |
| `warning.destroyed` | {method}() was called on an editor that has been destroyed, … | Logged once per method called on a destroyed editor |
| `warning.duplicate_build` | grideditor.js was loaded twice: … | A second copy of the classic script, which keeps the first `GridEditor` |
| `warning.adapter_no_jquery` | grideditor.jquery.js needs jQuery 4, … | `grideditor.jquery.js` loaded on a page with no jQuery |
| `error.tinymce_missing` | tinyMCE not available! … | `content_types: ['tinymce']` with no tinyMCE loaded |
| `error.ckeditor_missing` | CKEditor 5 not available! … | `content_types: ['ckeditor']` with no CKEditor 5 loaded, CKEditor 4 included |
| `error.ckeditor_start` | CKEditor could not start: {message} | `InlineEditor.create` failed: most likely no `licenseKey` in `ckeditor.config` |
| `warning.ckeditor_plugin` | CKEditor has no plugin called {name}, … | A plugin name in `ckeditor.config.plugins` that is not on `window.CKEDITOR` |
| `error.summernote_missing` | Summernote not available! … | `content_types: ['summernote']` with no Summernote loaded |
| `error.codemirror_missing` | CodeMirror not available! … | The codemirror plugin's source view with no CodeMirror loaded: the textarea is used |


Namespaces not in use yet
-------------------------

`element.*` and `column.*` are reserved and have no keys yet: the element and
offset strings that exist live under `tool.*` and `confirm.*`, next to the
tools they belong to.
