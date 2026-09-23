How to build grid-editor
========================

Do NOT make changes to the files in the `dist` directory. 

Instead, update the files in the `src` directory. Then install the dependencies:

* `npm install`

From then on out, you can build the files in the `dist` directory by running:

* `npm run build`

During development, you can also run `npm run watch` to automatically rebuild on changes.

The build emits the plugin as `dist/jquery.grideditor.js`, the stylesheet as
`dist/grideditor.css`, each with a minified twin and a source map beside it,
and the files in `src/js/locales/` and `src/js/plugins/` one by one under
`dist/locales/` and `dist/plugins/`. Neither of those two directories is part
of the main bundle: the `src/js/*.js` glob does not descend, so a page loads
the languages and the container plugins it actually wants. See
[docs/plugins.md](docs/plugins.md) for what a container plugin is.

The text editor plugins - tinyMCE, CKEditor and summernote - are built to
`dist/plugins/` like the others, and up to 6.0 also go into the main bundle,
followed by `src/js/compat/bundled-texts.js`, which marks them as the bundle's
copies so the editor can warn a page that relies on them. 6.0 drops both from
`jsFiles` in the Gruntfile.

One more file comes out of it: `dist/jquery.grideditor.bundle.min.js`, the
minified editor concatenated with the copy of SortableJS in `node_modules`,
for pages that would rather load one file than two. It carries both MIT
notices, it is built after the minified editor because it is made of it, and a
page loads it *or* the editor and SortableJS separately, never both. The
version is pinned in `package.json`, so refreshing it is an `npm update
sortablejs` and a rebuild.

Locale files are deliberately not part of the main bundle: a page loads only the languages it
offers. English is the exception and lives in the bundle, because it is the
fallback every string lookup ends at. See `docs/locale-keys.md` for the keys,
and `src/js/locales/grideditor.es.js` for what a locale file looks like.

Running the tests
=================

The tests drive real pages in a real Chrome over the DevTools protocol, so they
need Chrome or Chromium installed. They test the files in the `dist` directory,
so build first:

* `npm run build`
* `npm test`

There is nothing extra to install: the tests use node and Chrome, and start
their own web server. `npm test` runs every suite in `test/` in one Chrome and
prints one summary, and exits non-zero if anything failed. To run a single
suite, pass part of its name:

* `npm test -- rte`

A suite can also be run on its own with `node test/rte.js`.

The fixture pages in `test/fixtures` load jQuery, SortableJS and Bootstrap from
`test/vendor` rather than from a CDN, so most of the suite runs offline. The
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
