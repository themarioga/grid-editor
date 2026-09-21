# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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