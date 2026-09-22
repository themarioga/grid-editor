/**
 * Test runner.
 *
 * Every file in `test/` that exports a `run` function is a suite. The runner
 * starts one Chrome and one static file server, hands both to every suite in
 * turn, and prints a single summary. It exits non-zero if any check failed or
 * any suite threw.
 *
 *   npm test               run every suite
 *   npm test -- resize     run the suites whose name contains "resize"
 *   OFFLINE=1 npm test     pretend there is no network
 *
 * Suites are plain modules, so `node test/rte.js` runs one on its own.
 *
 * A suite looks like this:
 *
 *   module.exports = {
 *       name: 'example',
 *       description: 'what this suite covers',
 *       requiresNetwork: false,   // true skips the suite when offline
 *       run: async function(t) {
 *           var page = await t.page('/example/basic.html');
 *           t.check('the page boots', await page.eval('return !!window.jQuery;'));
 *       },
 *   };
 */

var fs = require('fs');
var path = require('path');
var cdp = require('./cdp');
var serve = require('./server').serve;

var ROOT = path.join(__dirname, '..');
var SCREENSHOTS = path.join(__dirname, 'screenshots');

// Any host will do: this only answers "is there a network at all", for the
// suites that load a rich text editor from its CDN.
var NETWORK_PROBE = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/package.json';

/**
 * Collects what one suite reported.
 */
function Suite(name, module_) {
    this.name = name;
    this.module = module_;
    this.results = [];
}

Suite.prototype.check = function(name, passed, detail) {
    this.results.push({ name: name, passed: !!passed });
    console.log(
        (passed ? '  PASS  ' : '  FAIL  ') + name +
        (detail ? '\n          ' + JSON.stringify(detail) : '')
    );
};

Suite.prototype.skip = function(name, reason) {
    this.results.push({ name: name, skipped: true });
    console.log('  SKIP  ' + name + '\n          ' + reason);
};

Suite.prototype.counts = function() {
    var failed = 0, skipped = 0, passed = 0;

    this.results.forEach(function(result) {
        if (result.skipped) { skipped++; }
        else if (result.passed) { passed++; }
        else { failed++; }
    });

    return { passed: passed, failed: failed, skipped: skipped };
};

/**
 * Every test module in `test/`, in a stable order. A file that exports no
 * `run` is a helper (cdp, server, this file) rather than a suite.
 */
function findSuites() {
    return fs.readdirSync(__dirname)
        .filter(function(entry) {
            // Skipping this file keeps node from reporting a circular require
            // of the module it is still busy evaluating.
            return /\.js$/.test(entry) && entry !== path.basename(__filename);
        })
        .sort()
        .map(function(entry) {
            var module_ = require(path.join(__dirname, entry));
            return { name: module_.name || path.basename(entry, '.js'), module: module_ };
        })
        .filter(function(candidate) { return typeof candidate.module.run === 'function'; });
}

function matches(name, patterns) {
    if (!patterns.length) { return true; }

    return patterns.some(function(pattern) {
        return name.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
    });
}

async function online() {
    // OFFLINE=1 forces the no-network path, which is how the offline
    // behaviour gets tested on a machine that does have a network.
    if (process.env.OFFLINE) { return false; }

    try {
        var response = await fetch(NETWORK_PROBE, { signal: AbortSignal.timeout(5000) });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * The handle a suite gets: the shared browser and server, a page helper, and
 * somewhere to report to.
 */
function context(suite, browser, base) {
    return {
        browser: browser,
        base: base,
        screenshots: SCREENSHOTS,
        sleep: cdp.sleep,
        goto: cdp.goto,
        check: suite.check.bind(suite),
        skip: suite.skip.bind(suite),

        /**
         * A new page, already at `url` (relative to the server root) with the
         * document loaded. `waitFor` is an expression to wait for on top of
         * that, for the page's own dependencies.
         */
        page: async function(url, waitFor) {
            var page = await browser.newPage();
            await cdp.goto(page, base + url);
            if (waitFor) { await page.waitFor(waitFor, { label: url }); }
            return page;
        },
    };
}

async function main(argv) {
    var patterns = (argv || process.argv.slice(2)).filter(function(argument) {
        return argument.indexOf('-') !== 0;
    });

    var selected = findSuites().filter(function(candidate) {
        return matches(candidate.name, patterns);
    });

    if (!selected.length) {
        console.log('No suite matches ' + JSON.stringify(patterns));
        process.exitCode = 1;
        return;
    }

    var networkAvailable = null;
    var server = await serve(ROOT);
    var browser = await cdp.launchChrome();
    var suites = [];

    try {
        for (var candidate of selected) {
            var suite = new Suite(candidate.name, candidate.module);
            suites.push(suite);

            console.log('\n' + suite.name + (candidate.module.description ? '  (' + candidate.module.description + ')' : ''));

            if (candidate.module.requiresNetwork) {
                if (networkAvailable === null) { networkAvailable = await online(); }
                if (!networkAvailable) {
                    suite.skip(suite.name, 'this suite loads its editors from a CDN and there is no network');
                    continue;
                }
            }

            try {
                await candidate.module.run(context(suite, browser, server.url));
            } catch (error) {
                console.log('  the suite stopped early: ' + (error && error.stack || error));
                suite.results.push({ name: suite.name + ' completed', passed: false });
            }
        }
    } finally {
        browser.close();
        await server.close();
    }

    var totals = { passed: 0, failed: 0, skipped: 0 };
    console.log('\nSummary');
    suites.forEach(function(finished) {
        var counts = finished.counts();
        totals.passed += counts.passed;
        totals.failed += counts.failed;
        totals.skipped += counts.skipped;
        console.log(
            '  ' + (counts.failed ? 'FAIL' : 'ok  ') + '  ' + finished.name + ': ' +
            counts.passed + ' passed, ' + counts.failed + ' failed, ' + counts.skipped + ' skipped'
        );
    });

    console.log(
        '\n' + suites.length + ' suite' + (suites.length === 1 ? '' : 's') + ', ' +
        totals.passed + ' passed, ' + totals.failed + ' failed, ' + totals.skipped + ' skipped'
    );

    process.exitCode = totals.failed ? 1 : 0;
}

module.exports = { main: main };

if (require.main === module) {
    main();
}
