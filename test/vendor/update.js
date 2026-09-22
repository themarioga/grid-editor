/**
 * Downloads the vendored test dependencies.
 *
 * The test fixtures load jQuery, jQuery UI, SortableJS and Bootstrap from
 * `test/vendor` rather than from a CDN, so that a test run needs no network.
 * The files are committed; this script exists to refresh them. Run it with
 * `node test/vendor/update.js` after changing a version below, and commit what
 * it writes.
 */

var fs = require('fs');
var path = require('path');

var VENDOR = __dirname;

var FILES = [
    {
        file: 'jquery/jquery.min.js',
        url: 'https://code.jquery.com/jquery-4.0.0.min.js',
    },
    {
        file: 'jquery-ui/jquery-ui.min.js',
        url: 'https://code.jquery.com/ui/1.14.2/jquery-ui.min.js',
    },
    {
        file: 'sortablejs/Sortable.min.js',
        url: 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js',
    },
    {
        file: 'bootstrap/bootstrap.min.css',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
    },
    {
        file: 'bootstrap/bootstrap.bundle.min.js',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js',
    },
    {
        file: 'bootstrap-icons/bootstrap-icons.css',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.css',
    },
    {
        file: 'bootstrap-icons/fonts/bootstrap-icons.woff',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff',
    },
    {
        file: 'bootstrap-icons/fonts/bootstrap-icons.woff2',
        url: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/fonts/bootstrap-icons.woff2',
    },
];

async function download(entry) {
    var target = path.join(VENDOR, entry.file);
    var response = await fetch(entry.url);

    if (!response.ok) {
        throw new Error(entry.url + ' returned ' + response.status);
    }

    var body = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    console.log(entry.file + '  ' + body.length + ' bytes  <- ' + entry.url);
}

async function main() {
    for (var entry of FILES) {
        await download(entry);
    }
}

main().catch(function(error) {
    console.error(error.message);
    process.exitCode = 1;
});
