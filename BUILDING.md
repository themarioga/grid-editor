How to build grid-editor
========================

Do NOT make changes to the files in the `dist` directory. 

Instead, update the files in the `src` directory. Then install the dependencies:

* `npm install`

From then on out, you can build the files in the `dist` directory by running:

* `npm run build`

During development, you can also run `npm run watch` to automatically rebuild on changes.

Running the tests
=================

The tests drive the example pages in a real Chrome, against the real editors
loaded from their CDNs, so they need Chrome or Chromium installed and an
internet connection. They test the files in the `dist` directory, so build
first:

* `npm run build`
* `npm test`

There is nothing extra to install: the tests use node and Chrome, and start
their own web server. Set `CHROME=/path/to/chrome` if your browser is not on
the PATH under a name they look for, `HEADFUL=1` to watch the run in a visible
window, or `CHROME_LOG=1` to see Chrome's own output. A run leaves a screenshot
of the editor in `test/screenshots`.
