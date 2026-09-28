How to build grid-editor
========================

Do NOT make changes to the files in the `dist` directory. 

Instead, update the files in the `src` directory. Then install the dependencies:

* `npm install`

From then on out, you can build the files in the `dist` directory by running:

* `npm run build`

During development, you can also run `npm run watch` to automatically rebuild on changes.

The sources are ES modules. `build/build.js` turns them into what `dist/`
ships, with esbuild; Grunt runs the stylesheets and calls it, so `npm run
build` is the one command either way. Every script comes out twice:

| Output | What it is |
| --- | --- |
| `dist/grideditor.js`, `.min.js` + map | the editor as a classic script, defining `window.GridEditor` |
| `dist/grideditor.esm.js` | the editor as an ES module, exporting `GridEditor` |
| `dist/grideditor.bundle.min.js` | the minified editor with SortableJS in front of it |
| `dist/grideditor.jquery.js`, `.min.js` + map | the jQuery adapter: the 6.x API for a page that loads jQuery 4 |
| `dist/plugins/grideditor.<name>.js`, `.min.js`, `.esm.js` | each plugin, classic and as a module |
| `dist/locales/grideditor.<code>.js`, `.min.js`, `.esm.js` | each locale, the same two ways |
| `dist/grideditor.d.ts` | the public API's types, copied from `types/` |
| `dist/grideditor.css`, `.min.css` + map | the stylesheet, from `src/less/` |

A plugin or a locale never carries a copy of the editor. Its classic script
finds the one the page loaded through `src/js/register.js`, which says so, in
an error, when the editor has not been loaded yet; its module imports
`../grideditor.esm.js`. `src/js/dom.js`, the editor's DOM helpers, is not
public: the build puts a copy in each script that uses it.

The text editor plugins - tinyMCE, CKEditor and summernote - each import
`src/js/text/grideditor.text.js`, what every text editor shares, so each
script carries it; however many a page loads, it is installed once. That
shared file is never published on its own.

The bundle is the minified editor concatenated with the copy of SortableJS in
`node_modules`, for pages that would rather load one file than two. It carries
both MIT notices, and a page loads it *or* the editor and SortableJS
separately, never both. The version is pinned in `package.json`, so refreshing
it is an `npm update sortablejs` and a rebuild.

Locale files are deliberately not part of the editor: a page loads only the
languages it offers. English is the exception and lives in the editor, because
it is the fallback every string lookup ends at. See `docs/locale-keys.md` for
the keys, and `src/js/locales/grideditor.es.js` for what a locale file looks
like.

Running the tests
=================

The tests drive real pages in a real Chrome over the DevTools protocol, so they
need Chrome or Chromium installed. They test the files in the `dist` directory,
so build first:

* `npm run build`
* `npm test`

`npm test` first checks the public API's types (`npm run test:types`, which
compiles `test/types/usage.ts` against `types/grideditor.d.ts`), then runs the
browser suites. There is nothing extra to install: the tests use node and Chrome, and start
their own web server. `npm test` runs every suite in `test/` in one Chrome and
prints one summary, and exits non-zero if anything failed. To run a single
suite, pass part of its name:

* `npm test -- rte`

A suite can also be run on its own with `node test/rte.js`.

The fixture pages in `test/fixtures` load SortableJS and Bootstrap from
`test/vendor` rather than from a CDN, so most of the suite runs offline.
`grid.html`, which most suites run on, has no jQuery; `adapter.html` is the
same page through the jQuery adapter, with the vendored jQuery 4, and
`esm.html` imports the module build. The
rich text editor suite is the exception: it loads tinyMCE, CKEditor and
Summernote from their CDNs to test against the real editors, and the runner
skips it, with a reason, when there is no network. `OFFLINE=1 npm test` forces
that path.

Set `CHROME=/path/to/chrome` if your browser is not on the PATH under a name
the tests look for, `HEADFUL=1` to watch the run in a visible window, or
`CHROME_LOG=1` to see Chrome's own output. A run leaves a screenshot of the
editor in `test/screenshots`.

See `test/vendor/README.md` for what is vendored and how to refresh it, and the
comment at the top of `test/run.js` for what a suite looks like.

Linting
=======

* `npm run lint`

The configuration lives in `eslint.config.js`. Keep it clean: almost every rule
is a warning, so warnings are the output that matters.
