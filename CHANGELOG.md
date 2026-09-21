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

### Added
- `example/index-autosave.html`, demonstrating auto save to localStorage plus
  layout import/export, by [@Ka-Bar](https://github.com/Ka-Bar).

### Fixed
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