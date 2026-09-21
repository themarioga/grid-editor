/**
 * Static file server for the browser tests, so a test run needs nothing but
 * node and Chrome. The example pages load their dependencies from a CDN, so
 * they have to be served over http rather than opened as files.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

var CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
};

function serve(root) {
    root = path.resolve(root);

    var server = http.createServer(function(request, response) {
        var requested = decodeURIComponent(request.url.split('?')[0]);
        var file = path.join(root, path.normalize(requested));

        // Refuse to serve anything outside the root, symlinks included
        var resolved;
        try {
            resolved = fs.realpathSync(file);
        } catch (error) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        if (resolved !== root && resolved.indexOf(root + path.sep) !== 0) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        if (fs.statSync(resolved).isDirectory()) {
            resolved = path.join(resolved, 'index.html');
            if (!fs.existsSync(resolved)) {
                response.writeHead(404);
                response.end('Not found');
                return;
            }
        }

        response.writeHead(200, {
            'Content-Type': CONTENT_TYPES[path.extname(resolved)] || 'application/octet-stream',
        });
        fs.createReadStream(resolved).pipe(response);
    });

    return new Promise(function(resolve) {
        server.listen(0, '127.0.0.1', function() {
            resolve({
                url: 'http://127.0.0.1:' + server.address().port,
                close: function() {
                    return new Promise(function(closed) { server.close(closed); });
                },
            });
        });
    });
}

module.exports = { serve: serve };
