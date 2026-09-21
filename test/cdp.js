/**
 * Minimal Chrome DevTools Protocol client for the browser tests.
 *
 * Deliberately dependency free: it launches Chrome with remote debugging
 * enabled, talks to it over the WebSocket built into node, and exposes just
 * enough of the protocol to drive a page. The grid editor is a jQuery plugin
 * that leans on what the browser and the rich text editors actually do to the
 * DOM, so these tests need a real browser rather than a DOM emulation.
 */

var spawn = require('child_process').spawn;
var spawnSync = require('child_process').spawnSync;
var fs = require('fs');
var os = require('os');
var path = require('path');

var CHROME_BINARIES = [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
];

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function findChrome() {
    if (process.env.CHROME) { return process.env.CHROME; }

    for (var i = 0; i < CHROME_BINARIES.length; i++) {
        var found = spawnSync('which', [CHROME_BINARIES[i]], { encoding: 'utf8' });
        if (found.status === 0) { return found.stdout.trim(); }
    }

    throw new Error(
        'No Chrome or Chromium found. Install one, or point the CHROME ' +
        'environment variable at the binary.'
    );
}

/**
 * A single page, plus the console output it produced.
 */
function Session(ws) {
    this.ws = ws;
    this.lastId = 0;
    this.pending = new Map();
    this.logs = [];

    var self = this;
    ws.addEventListener('message', function(event) {
        var message = JSON.parse(event.data);

        if (message.id && self.pending.has(message.id)) {
            var callbacks = self.pending.get(message.id);
            self.pending.delete(message.id);
            if (message.error) {
                callbacks.reject(new Error(message.error.message));
            } else {
                callbacks.resolve(message.result);
            }
            return;
        }

        self.record(message);
    });
}

Session.prototype.record = function(message) {
    var params = message.params;

    if (message.method === 'Runtime.consoleAPICalled') {
        this.logs.push({
            kind: 'console.' + params.type,
            text: params.args.map(function(arg) {
                return arg.value !== undefined ? String(arg.value) : (arg.description || arg.type);
            }).join(' '),
        });
    } else if (message.method === 'Runtime.exceptionThrown') {
        var details = params.exceptionDetails;
        this.logs.push({
            kind: 'exception',
            text: (details.exception && (details.exception.description || details.exception.value)) || details.text,
        });
    } else if (message.method === 'Log.entryAdded') {
        this.logs.push({
            kind: 'log.' + params.entry.level,
            text: params.entry.text + ' ' + (params.entry.url || ''),
        });
    }
};

Session.prototype.send = function(method, params) {
    var id = ++this.lastId;
    var self = this;

    return new Promise(function(resolve, reject) {
        self.pending.set(id, { resolve: resolve, reject: reject });
        self.ws.send(JSON.stringify({ id: id, method: method, params: params || {} }));
    });
};

/**
 * Run `expression` as the body of an async function in the page and return
 * whatever it returns, so a test step can await things in page context.
 */
Session.prototype.eval = async function(expression) {
    var result = await this.send('Runtime.evaluate', {
        expression: '(async () => { ' + expression + ' })()',
        awaitPromise: true,
        returnByValue: true,
    });

    if (result.exceptionDetails) {
        var details = result.exceptionDetails;
        throw new Error('page exception: ' + (
            (details.exception && (details.exception.description || details.exception.value)) || details.text
        ));
    }

    return result.result.value;
};

Session.prototype.waitFor = async function(expression, options) {
    options = options || {};
    var timeout = options.timeout || 15000;
    var start = Date.now();

    while (Date.now() - start < timeout) {
        if (await this.eval('return !!(' + expression + ');')) { return true; }
        await sleep(100);
    }

    throw new Error('timed out waiting for: ' + (options.label || expression));
};

/**
 * Click an element with a real mouse event. The grid editor starts editors
 * from a delegated click handler, and an inline editor only takes focus for a
 * genuine click, so a jQuery trigger would not tell us much.
 */
Session.prototype.click = async function(selector, nth) {
    var point = await this.eval(
        'const elements = document.querySelectorAll(' + JSON.stringify(selector) + ');' +
        'const element = elements[' + (nth || 0) + '];' +
        'if (!element) { return null; }' +
        'element.scrollIntoView({ block: "center" });' +
        'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));' +
        'const box = element.getBoundingClientRect();' +
        'return { x: box.left + Math.min(box.width / 2, 40), y: box.top + Math.min(box.height / 2, 20) };'
    );

    if (!point) {
        throw new Error('no element for selector ' + selector + ' [' + (nth || 0) + ']');
    }

    for (var type of ['mousePressed', 'mouseReleased']) {
        await this.send('Input.dispatchMouseEvent', {
            type: type,
            x: point.x,
            y: point.y,
            button: 'left',
            clickCount: 1,
        });
    }

    await sleep(150);
};

Session.prototype.type = async function(text) {
    await this.send('Input.insertText', { text: text });
    await sleep(100);
};

/**
 * Error level output, minus the noise a test cannot do anything about.
 */
Session.prototype.errors = function(ignore) {
    var patterns = [/favicon\.ico/].concat(ignore || []);

    return this.logs.filter(function(entry) {
        if (entry.kind !== 'exception' && entry.kind !== 'console.error' && entry.kind !== 'log.error') {
            return false;
        }
        return !patterns.some(function(pattern) { return pattern.test(entry.text); });
    });
};

Session.prototype.screenshot = async function(file) {
    var result = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    return file;
};

function Browser(process_, port, userDataDir) {
    this.process = process_;
    this.port = port;
    this.userDataDir = userDataDir;
}

Browser.prototype.newPage = async function() {
    var response = await fetch('http://127.0.0.1:' + this.port + '/json/new?about:blank', { method: 'PUT' });
    var target = await response.json();

    var ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(function(resolve, reject) {
        ws.addEventListener('open', resolve);
        ws.addEventListener('error', reject);
    });

    var session = new Session(ws);
    await session.send('Runtime.enable');
    await session.send('Page.enable');
    await session.send('Log.enable');

    return session;
};

Browser.prototype.close = function() {
    this.process.kill();
    try {
        fs.rmSync(this.userDataDir, { recursive: true, force: true });
    } catch (error) {
        // A profile left in the temp directory is not worth failing a test run
    }
};

/**
 * Start Chrome on a port of its own choosing, which it writes into the
 * profile directory once it is listening.
 */
async function launchChrome(options) {
    options = options || {};

    var userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-editor-chrome-'));
    var args = [
        '--remote-debugging-port=0',
        '--user-data-dir=' + userDataDir,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--hide-scrollbars',
        '--window-size=1400,1000',
        'about:blank',
    ];

    if (!options.headful && !process.env.HEADFUL) {
        args.unshift('--headless=new');
    }

    var chrome = spawn(findChrome(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.on('data', function(chunk) {
        if (process.env.CHROME_LOG) { process.stderr.write('[chrome] ' + chunk); }
    });

    var portFile = path.join(userDataDir, 'DevToolsActivePort');
    for (var attempt = 0; attempt < 100; attempt++) {
        if (fs.existsSync(portFile)) {
            var port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0], 10);
            if (port) { return new Browser(chrome, port, userDataDir); }
        }
        await sleep(100);
    }

    chrome.kill();
    throw new Error('Chrome did not start a debugging port');
}

async function goto(session, url) {
    await session.send('Page.navigate', { url: url });
    await session.waitFor('document.readyState === "complete"', { label: 'page load ' + url });
}

module.exports = {
    launchChrome: launchChrome,
    goto: goto,
    sleep: sleep,
};
