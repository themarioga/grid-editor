Vendored test dependencies
==========================

The fixture pages under `test/fixtures` load these instead of reaching for a
CDN, which is what lets a test run work with the network switched off — and is
what makes CI possible at all. They are committed on purpose. Do not point a
new fixture at a CDN.

| Directory | Package | Version |
| --- | --- | --- |
| `jquery/` | jquery | 4.0.0 |
| `jquery-ui/` | jquery-ui (custom download, full bundle) | 1.14.2 |
| `sortablejs/` | sortablejs | 1.15.6 |
| `bootstrap/` | bootstrap (css and the bundled js) | 5.3.8 |
| `bootstrap-icons/` | bootstrap-icons (css and the woff/woff2 fonts) | 1.13.1 |

The versions match the ones the example pages load, so a fixture and an example
page run against the same libraries. SortableJS is here ahead of the pages that
will use it: it is what replaces jQuery UI in 4.0, and it is vendored now so the
port can be tested before anything ships.

To refresh them, change the version in `update.js`, then:

    npm run test:vendor

and commit what it writes. The `bootstrap-icons` css expects its fonts in
`bootstrap-icons/fonts/`, so keep that layout.

The rich text editors are deliberately *not* vendored: `test/rte.js` loads
tinyMCE, CKEditor and Summernote from their CDNs, because it tests the
integrations against the real editors. The runner skips that suite when there
is no network.
