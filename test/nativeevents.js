/**
 * Browser tests for 7.0's events: DOM events on the canvas, what canceling
 * one does, their order against the callbacks, a handler calling back in, a
 * listener that throws, and a delete announced once its animation is over.
 *
 * Spec remove-jquery: AC-08 to AC-11, AC-34 and AC-39. events.js holds the
 * catalogue; this is the native delivery of it.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.fresh = function(settings) {
        const running = GridEditor.get('#myGrid');
        if (running) { running.destroy(); }
        document.querySelector('#myGrid').innerHTML =
            '<div class="row" id="first"><div class="col-6"><p>Left</p></div><div class="col-6"><p>Right</p></div></div>' +
            '<div class="row" id="second"><div class="col-12"><p>Below</p></div></div>';
        return GridEditor.create('#myGrid', Object.assign({ confirm_delete: false }, settings || {}));
    };
    window.canvas = function() { return document.querySelector('#myGrid'); };
    window.settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
    return true;
`;

async function cancelTests(t, page) {
    var canceled = await page.eval(`
        fresh();
        const seen = [];
        const stop = function(e) {
            seen.push({ type: e.type, element: e.detail.node instanceof HTMLElement, custom: e instanceof CustomEvent,
                cancelable: e.cancelable, bubbles: e.bubbles });
            e.preventDefault();
        };
        const after = [];
        canvas().addEventListener('grideditor:before-delete', stop);
        canvas().addEventListener('grideditor:after-delete', function(e) { after.push(e.type); });
        document.querySelector('#first > .ge-tools-drawer .ge-delete-row').click();
        await settle(700);
        canvas().removeEventListener('grideditor:before-delete', stop);
        return { seen: seen, after: after, stays: !!document.querySelector('#first') };
    `);
    t.check('preventDefault() on before-delete keeps the row: the event is a cancelable, bubbling CustomEvent with an element in its payload',
        canceled.stays && canceled.after.length === 0 && canceled.seen.length === 1 && canceled.seen[0].element &&
        canceled.seen[0].custom && canceled.seen[0].cancelable && canceled.seen[0].bubbles, canceled);

    var callback = await page.eval(`
        const ge = fresh({ callbacks: { before_add_row: function(payload) { return !(payload.node instanceof HTMLElement); } } });
        const made = ge.createRow([12], { appendTo: canvas() });
        return { made: made, rows: canvas().querySelectorAll(':scope > .row').length };
    `);
    t.check('a callback returning false cancels too: createRow gives null and adds nothing',
        callback.made === null && callback.rows === 2, callback);

    var bubbled = await page.eval(`
        fresh();
        const heard = [];
        const listener = function(e) { heard.push(e.type + ':' + (e.target === canvas())); };
        document.addEventListener('grideditor:after-add-row', listener);
        GridEditor.get('#myGrid').createRow([12], { appendTo: canvas() });
        document.removeEventListener('grideditor:after-add-row', listener);
        return heard;
    `);
    t.check('the events bubble: a listener on the document hears the canvas\'s',
        bubbled.length === 1 && bubbled[0] === 'grideditor:after-add-row:true', bubbled);
}

async function orderTests(t, page) {
    var order = await page.eval(`
        const log = [];
        const ge = fresh({ callbacks: {
            before_add_row: function() { log.push('callback before_add_row'); },
            before_add: function() { log.push('callback before_add'); },
            after_add_row: function() { log.push('callback after_add_row'); },
            after_add: function() { log.push('callback after_add'); },
        } });
        ['before-add-row', 'before-add', 'after-add-row', 'after-add'].forEach(function(name) {
            canvas().addEventListener('grideditor:' + name, function(e) {
                // By an after-*, init() has run: the new row has its drawer
                const ready = name.indexOf('after') === 0 ? ':' + !!e.detail.node.querySelector(':scope > .ge-tools-drawer') : '';
                log.push('event ' + name + ready);
            });
        });
        ge.createRow([12], { appendTo: canvas() });
        return log;
    `);
    t.check('an add fires the specific event, then the generic one, then the callbacks, the change, and the after pair in the same order',
        order.join(' | ') === 'event before-add-row | event before-add | callback before_add_row | callback before_add | ' +
            'event after-add-row:true | event after-add:true | callback after_add_row | callback after_add', order);

    var reentrant = await page.eval(`
        const ge = fresh();
        const seen = [];
        const once = function(e) {
            canvas().removeEventListener('grideditor:after-add-row', once);
            const queued = ge.createRow([6, 6], { appendTo: canvas() });
            seen.push({ returned: queued instanceof HTMLElement, inCanvasYet: canvas().contains(queued) });
        };
        canvas().addEventListener('grideditor:after-add-row', once);
        ge.createRow([12], { appendTo: canvas() });
        const rows = canvas().querySelectorAll(':scope > .row');
        return { seen: seen, rows: rows.length, last: rows[rows.length - 1].querySelectorAll(':scope > .column').length };
    `);
    t.check('a create* from a handler is queued: it runs after the operation that called it, as its own',
        reentrant.seen.length === 1 && reentrant.seen[0].returned && !reentrant.seen[0].inCanvasYet &&
        reentrant.rows === 4 && reentrant.last === 2, reentrant);
}

async function throwingTests(t, page) {
    var thrown = await page.eval(`
        const reported = [];
        const onError = function(e) { reported.push(String(e.message || e.error)); e.preventDefault(); };
        window.addEventListener('error', onError);
        const log = [];
        const ge = fresh({ callbacks: { after_add_row: function() { log.push('callback'); } } });
        const first = function() { throw new Error('a host bug'); };
        const second = function() { log.push('second'); };
        canvas().addEventListener('grideditor:after-add-row', first);
        canvas().addEventListener('grideditor:after-add-row', second);
        let escaped = null;
        let made = null;
        try { made = ge.createRow([12], { appendTo: canvas() }); } catch (error) { escaped = String(error); }
        canvas().removeEventListener('grideditor:after-add-row', first);
        canvas().removeEventListener('grideditor:after-add-row', second);
        window.removeEventListener('error', onError);
        return {
            escaped: escaped,
            added: made instanceof HTMLElement && canvas().contains(made),
            log: log,
            reported: reported,
        };
    `);
    t.check('a listener that throws does not stop the operation: the row is added, the next listener and the callbacks run',
        thrown.escaped === null && thrown.added && thrown.log.join(',') === 'second,callback', thrown);
    t.check('and the error is the browser\'s to report', thrown.reported.some(function(message) { return /a host bug/.test(message); }), thrown);
}

async function animationTests(t, page) {
    var timed = await page.eval(`
        fresh();
        const after = [];
        canvas().addEventListener('grideditor:after-delete', function(e) { after.push(e.detail.kind); });
        const row = document.querySelector('#first');
        row.querySelector(':scope > .ge-tools-drawer .ge-delete-row').click();
        await settle(150);
        const during = { inDom: canvas().contains(row), after: after.length };
        await settle(600);
        return { during: during, gone: !canvas().contains(row), after: after.slice() };
    `);
    t.check('a deleted row stays while its 400 ms animation runs, and is removed and announced when it ends',
        timed.during.inDom && timed.during.after === 0 && timed.gone && timed.after.join(',') === 'row', timed);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    await cancelTests(t, page);
    await orderTests(t, page);
    await throwingTests(t, page);
    await animationTests(t, page);

    var errors = page.errors([/a host bug/]);
    t.check('the native event tests logged no other errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'nativeevents',
    description: 'DOM events on the canvas: canceling, order, re-entrancy, a throwing listener, a delete\'s timing',
    run: run,
};

if (require.main === module) {
    require('./run').main(['nativeevents']);
}
