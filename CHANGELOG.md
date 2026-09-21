# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]
### Added
- A public API, dispatched from a table instead of a chain of string
  comparisons: `init`, `deinit`, `reset`, `destroy`, `changeView`, `getView`,
  `createRow`, `createColumn` and `createElement`, alongside the existing
  `getHtml`. `create*` methods return the node they made, everything else
  returns the jQuery set and chains.
- `create*` accepts `appendTo`, `prependTo`, `insertAfter` and `insertBefore`.
  Given one, grid-editor places the node and resets the canvas; given none,
  the node comes back detached for the host to place.
- `element.data('grideditor')` is documented API: the same methods, plus a
  frozen copy of `settings` and the `canvas`.
- `createContainer`, `addTab`, `addAccordionItem` and `setLocale` are
  registered but not implemented yet: calling one warns and returns `null`
  rather than doing nothing silently.
- Host callbacks. Every operation is announced twice: as a jQuery event on the
  canvas - the specific name, then the generic one - and as the matching
  `settings.callbacks` entry. `grideditor:before-add-row`,
  `-column`, `-element` and their `after-` counterparts, the generic
  `grideditor:before-add`/`after-add`, plus `before-delete`/`after-delete`,
  `before-move`/`after-move` and `before-resize`/`after-resize`. Every payload
  carries `kind`, `node`, `parent`, `canvas`, `breakpoint` and `source`
  (`tool`, `api` or `dragdrop`); a move adds `from`/`to` positions and a
  resize the sizes it moved between.
- Canceling. `preventDefault()` on either event, or `false` from the callback,
  cancels a `before-*`: nothing is inserted, deleted or resized, no `after-*`
  fires, and a canceled `create*` returns `null`. A canceled move is put back
  with jQuery UI's own `cancel`, since a drag cannot be refused once it has
  started.
- A re-entrancy queue: `init`, `reset` and the `create*` methods called from
  inside a handler run when the operation that called them has finished,
  instead of rebuilding the canvas underneath it.
- `callbacks`, `confirm_delete` and `sortable_options` settings.
- A test runner, `test/run.js`, behind `npm test`. It shares one Chrome and one
  web server across every suite in `test/`, prints one summary and exits
  non-zero on any failure. `npm test -- rte` runs a single suite, and
  `node test/rte.js` still works on its own.
- Vendored test dependencies under `test/vendor` (jQuery, jQuery UI, Bootstrap
  and bootstrap-icons), and a base fixture page in `test/fixtures` that loads
  them, so the suite runs with the network switched off. The rich text editor
  suite keeps loading the editors from their CDNs and is skipped, with a
  reason, when there is no network.
- `npm run lint`, on a flat `eslint.config.js` for eslint 9, with eslint pinned
  in devDependencies. The old `.eslintrc` named `babel-eslint` and
  pre-flat-config rule names, so it had stopped running on a current eslint.

### Changed
- `$(el).gridEditor('remove')` returns the jQuery object instead of
  `undefined`, so it chains like the other methods.
- A method called on an element with no editor on it is a no-op that returns
  the set, instead of doing nothing in some cases and throwing in others.
  `getHtml` still reads the element's html.
- An unknown method name warns once and returns the set.
- The layout modes come from one table, which `changeView`, `getView`, the
  column classes and the mode dropdown all read. Clicking the dropdown now
  goes through `changeView`.

- Deleting a row or a column goes through `before-delete`, then the confirm,
  then `after-delete` once the animation has finished. The host's handler runs
  first on purpose: a host that cancels to show its own dialog never wants the
  built-in confirm to have appeared already. `confirm_delete: false` skips the
  built-in one.
- `after-resize` fires once the column class has actually been written, rather
  than while jQuery UI is still animating the class swap.
- A drag that ends where it started is not reported as a move, and dragging a
  content area reports `kind: 'content'`.
- Adding a node brings the canvas up to date with `init()` rather than a full
  `deinit`/`init`, so inserting a row somewhere else no longer closes the rich
  text editor the user is typing in.

### Deprecated
- `remove`, in favour of `destroy`, which does the same thing. `remove` still
  works and warns once per instance.

### Fixed
- Calling `deinit` twice threw from jQuery UI, which `reset` could reach now
  that both are public methods.

## [2.0.0] - 2026-09-21
### Changed
- **BREAKING:** Migrate from Bootstrap 4 to Bootstrap 5. The layout mode
  dropdown now uses `data-bs-toggle`, so consumers must load Bootstrap 5.
- **BREAKING:** Replace Font Awesome with Bootstrap Icons. Consumers must load
  bootstrap-icons instead of Font Awesome. The default `iconClass` for custom
  `row_tools` and `col_tools` is now `bi bi-wrench`.
  Based on work by [@vahidalvandi](https://github.com/vahidalvandi).
- **BREAKING:** The tinyMCE integration now targets tinyMCE 6 and no longer
  uses the `jquery.tinymce.js` plugin, which tinyMCE dropped after 5.x. Pages
  using `content_types: ['tinymce']` must load tinyMCE 6 and must stop loading
  the jQuery integration plugin. A `tinymce.config.oninit` callback still
  works, and `init_instance_callback` is now honoured too.

### Added
- Browser tests for the rich text editor integrations, run with `npm test`.
  They drive the example pages in a real Chrome over the DevTools protocol,
  against the real editors, since what breaks in these integrations only
  happens in a browser. They need node and Chrome, and nothing else: see
  BUILDING.md.
- `example/index-autosave.html`, demonstrating auto save to localStorage plus
  layout import/export, by [@Ka-Bar](https://github.com/Ka-Bar).
- Example dependencies updated to current releases: jQuery 4.0.0, jQuery UI
  1.14.2, Bootstrap 5.3.8, Bootstrap Icons 1.13.1, summernote 0.9.1,
  CKEditor 4.22.1 and TinyMCE 6.8.6. CKEditor stops short of the latest
  release on purpose: 4.22.1 is the last under the GPL/LGPL/MPL triple
  licence, as 4.23.0 and above are CKEditor 4 LTS under the commercial
  Extended Support Model. TinyMCE stops at 6.8.6 because it is the last MIT
  licensed release; 7.x is GPL-2.0-or-later and 8.x is commercial.

### Fixed
- Clear `ge-rte-active` after the rich text editor has been torn down rather
  than before. An inline editor may restore the class attribute it snapshotted
  when it was created, as tinyMCE does, which put the class straight back and
  made `initRTE` ignore every later click: no content area could be edited
  again after a single `getHtml()` or `remove()`. The tinyMCE integration now
  also cleans up after the late removal it can perform from
  `init_instance_callback`, which used to leave `active` behind and arm a
  pending-remove flag that destroyed the next editor created on that content
  area. This affected the pre-6 integration too.
- Guard the rich text editor lookup. A `content_types` entry with no matching
  registered editor, or an empty `content_types`, made `getHtml`, `remove`,
  add row and add column throw on an undefined editor. They now no-op for that
  content area, matching how `initRTE` already behaved.

## [1.0.8]
- Fix for moving rows in columns #117

## [1.0.3] - 2019-05-18
### Added
- Support for fontawesome 4 and 5

## [1.0.2] - 2019-05-18
### Added
- npm scripts for calling grunt

### Changed
- Migrate from glyphicon to fontawesome #98 by [@Nuranto](https://github.com/Nuranto)
- Wrap source_html content if neccessary. #101 by [@Nuranto](https://github.com/Nuranto)