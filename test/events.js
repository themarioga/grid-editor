/**
 * Browser tests for the host callbacks: the events, the settings callbacks,
 * what cancelation does, and the re-entrancy queue.
 *
 * The re-entrancy tests come first, deliberately: a handler that calls back
 * into the editor is the subtle part of the design, so it is the part with
 * tests written first.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Installed before the editor starts: a log every notification writes to, a
 * summary of each payload, and a stub for window.confirm so a delete can be
 * driven from a test.
 */
var RECORDER = `
    window.log = [];
    window.payloads = {};
    window.confirmDialog = function() { return jQuery('.ge-confirm'); };
    window.dialogShown = function() { return jQuery('.ge-confirm').hasClass('show'); };
    window.answerDialog = function(answer) {
        jQuery('.ge-confirm').find(answer ? '.ge-confirm-ok' : '.ge-confirm-cancel').trigger('click');
    };

    window.EVENTS = [
        'before-add-row', 'after-add-row',
        'before-add-column', 'after-add-column',
        'before-add-element', 'after-add-element',
        'before-add', 'after-add',
        'before-delete', 'after-delete',
        'before-move', 'after-move',
        'before-resize', 'after-resize',
    ];

    window.summarize = function(payload) {
        const grid = document.getElementById('myGrid');
        const position = function(where) {
            if (!where) { return undefined; }
            return { index: where.index, isCanvas: where.parent[0] === grid };
        };

        return {
            kind: payload.kind,
            node: payload.node.attr('class'),
            nodeIsJquery: payload.node instanceof jQuery,
            parentIsCanvas: payload.parent[0] === grid,
            canvasIsGrid: payload.canvas[0] === grid,
            breakpoint: payload.breakpoint,
            source: payload.source,
            from: typeof payload.from === 'object' ? position(payload.from) : payload.from,
            to: typeof payload.to === 'object' ? position(payload.to) : payload.to,
            keys: Object.keys(payload).sort().join(','),
        };
    };

    window.record = function(name, payload) {
        window.log.push(name);
        window.payloads[name] = window.summarize(payload);
    };

    window.bindEvents = function() {
        window.EVENTS.forEach(function(name) {
            jQuery('#myGrid').on('grideditor:' + name, function(e, payload) {
                window.record('event:' + name, payload);
            });
        });
    };

    window.recordingCallbacks = function() {
        const callbacks = {};
        window.EVENTS.forEach(function(name) {
            callbacks[name.replace(/-/g, '_')] = function(payload) {
                window.record('callback:' + name, payload);
            };
        });
        return callbacks;
    };

    /** The editor, recording both ways, plus whatever settings a test needs. */
    window.start = function(overrides) {
        window.log = [];
        window.payloads = {};
        window.fixture.init(jQuery.extend({ callbacks: window.recordingCallbacks() }, overrides || {}));
        window.bindEvents();
        return jQuery('#myGrid').data('grideditor');
    };

    window.restart = function(overrides) {
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').off();
        return window.start(overrides);
    };

    return true;
`;

/** Ids on the two columns of the second row, so a drag has something to aim at. */
var LABEL_COLUMNS = `
    const columns = jQuery('#myGrid > .row').eq(1).children('.column');
    columns.eq(0).attr('id', 'left');
    columns.eq(1).attr('id', 'right');
    return jQuery('#myGrid > .row').eq(1).children('.column').map(function() { return this.id; }).get();
`;

async function recordingPage(t, overrides) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(RECORDER);
    await page.eval('window.start(' + JSON.stringify(overrides || {}) + '); return true;');
    return page;
}

/**
 * A handler that calls back into the editor must not rearrange the canvas in
 * the middle of the operation that called it.
 */
async function reentrancyTests(t) {
    var page = await recordingPage(t);

    var deferredReset = await page.eval(`
        const ge = jQuery('#myGrid').data('grideditor');

        // A marker on an existing drawer: init() leaves drawers it already
        // made alone, so the marker only disappears if a reset ran
        jQuery('#myGrid').on('grideditor:after-add-row', function() {
            jQuery('#myGrid .ge-tools-drawer').first().attr('data-marker', 'yes');
            ge.reset();
            window.markerDuringHandler = jQuery('#myGrid [data-marker]').length;
        });

        jQuery('.ge-addRowGroup a').eq(0).trigger('click');

        return {
            duringHandler: window.markerDuringHandler,
            afterOperation: jQuery('#myGrid [data-marker]').length,
            addEvents: window.log.filter(name => /add-row/.test(name)).length,
            rows: jQuery('#myGrid > .row').length,
        };
    `);
    t.check('a reset() from inside a handler runs after the operation, not during it',
        deferredReset.duringHandler === 1 && deferredReset.afterOperation === 0 &&
        deferredReset.addEvents === 4 && deferredReset.rows === 3,
        deferredReset);

    var deferredAdd = await page.eval(`
        const ge = window.restart();
        const rowsBefore = jQuery('#myGrid > .row').length;

        jQuery('#myGrid').on('grideditor:after-add-row', function(e, payload) {
            if (payload.source === 'api') { return; }
            window.log.push('handler:start');
            const row = ge.createRow([12], { appendTo: ge.canvas });
            window.log.push('handler:returned ' + (row instanceof jQuery));
            window.rowsSeenByHandler = jQuery('#myGrid > .row').length;
        });

        jQuery('.ge-addRowGroup a').eq(0).trigger('click');

        return {
            log: window.log.filter(name => /add-row|handler/.test(name)),
            addedWhenHandlerRan: window.rowsSeenByHandler - rowsBefore,
            addedInTotal: jQuery('#myGrid > .row').length - rowsBefore,
        };
    `);
    t.check('a create* from inside a handler is queued and runs as its own operation',
        deferredAdd.addedWhenHandlerRan === 1 && deferredAdd.addedInTotal === 2 &&
        deferredAdd.log.join('|') === [
            'event:before-add-row', 'callback:before-add-row',
            'event:after-add-row', 'handler:start', 'handler:returned true',
            'callback:after-add-row',
            'event:before-add-row', 'callback:before-add-row',
            'event:after-add-row', 'callback:after-add-row',
        ].join('|'),
        deferredAdd);

    var errors = page.errors();
    t.check('the re-entrancy tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Ordering and payload, on the one operation every page has: the toolbar's
 * add row button.
 */
async function orderingTests(t) {
    var page = await recordingPage(t);

    var added = await page.eval(`
        jQuery('.ge-addRowGroup a').eq(1).trigger('click');
        return {
            log: window.log,
            before: window.payloads['event:before-add-row'],
            generic: window.payloads['event:before-add'],
            after: window.payloads['event:after-add-row'],
            columns: jQuery('#myGrid > .row').last().children('.column').length,
        };
    `);
    t.check('an operation fires the specific event, then the generic one, then the callbacks',
        added.log.join('|') === [
            'event:before-add-row', 'event:before-add',
            'callback:before-add-row', 'callback:before-add',
            'event:after-add-row', 'event:after-add',
            'callback:after-add-row', 'callback:after-add',
        ].join('|'),
        added.log);
    t.check('the payload carries the documented fields',
        added.before.kind === 'row' && added.before.nodeIsJquery &&
        added.before.parentIsCanvas && added.before.canvasIsGrid &&
        added.before.breakpoint === 'all' && added.before.source === 'tool' &&
        added.before.keys === 'breakpoint,canvas,kind,node,parent,source' &&
        added.generic.kind === 'row' && added.after.kind === 'row',
        added);
    t.check('the row the toolbar announced is the row it added',
        /row/.test(added.before.node) && added.columns === 2, added);

    var toolsAndApi = await page.eval(`
        window.restart();
        const ge = jQuery('#myGrid').data('grideditor');
        const rowBefore = jQuery('#myGrid > .row').first();

        jQuery('#myGrid .ge-add-column').first().trigger('click');
        const columnFromTool = window.payloads['event:after-add-column'];

        window.log = [];
        ge.createColumn(3, { appendTo: rowBefore });
        const columnFromApi = window.payloads['event:after-add-column'];

        ge.createElement('<span>tag</span>', { type: 'analytics', appendTo: jQuery('#myGrid .ge-content').first() });

        return {
            columnFromTool: columnFromTool,
            columnFromApi: columnFromApi,
            element: window.payloads['event:after-add-element'],
            log: window.log,
        };
    `);
    t.check('a column added by a tool and by the api differ only in source',
        toolsAndApi.columnFromTool.kind === 'column' && toolsAndApi.columnFromTool.source === 'tool' &&
        toolsAndApi.columnFromApi.kind === 'column' && toolsAndApi.columnFromApi.source === 'api',
        toolsAndApi);
    t.check('createElement announces an element add',
        toolsAndApi.element.kind === 'element' && toolsAndApi.element.source === 'api' &&
        toolsAndApi.log.filter(name => /add-element/.test(name)).length === 4,
        toolsAndApi);

    var errors = page.errors();
    t.check('the ordering tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Canceling: an event's preventDefault, the generic event's preventDefault,
 * and a callback returning false.
 */
async function cancelTests(t) {
    var page = await recordingPage(t);

    var byEvent = await page.eval(`
        const rows = () => jQuery('#myGrid > .row').length;
        const before = rows();

        jQuery('#myGrid').on('grideditor:before-add-row', function(e) { e.preventDefault(); });
        jQuery('.ge-addRowGroup a').eq(0).trigger('click');

        return {
            rowsUnchanged: rows() === before,
            log: window.log,
        };
    `);
    t.check('canceling the specific before event leaves the DOM untouched and fires no after event',
        byEvent.rowsUnchanged && byEvent.log.indexOf('event:after-add-row') === -1 &&
        byEvent.log.indexOf('event:after-add') === -1,
        byEvent);

    var byGeneric = await page.eval(`
        window.restart();
        const before = jQuery('#myGrid > .row').length;

        jQuery('#myGrid').on('grideditor:before-add', function(e) { e.preventDefault(); });
        jQuery('.ge-addRowGroup a').eq(0).trigger('click');

        return {
            rowsUnchanged: jQuery('#myGrid > .row').length === before,
            log: window.log,
        };
    `);
    t.check('canceling the generic before event cancels the operation too',
        byGeneric.rowsUnchanged && byGeneric.log.indexOf('event:after-add-row') === -1, byGeneric);

    var byCallback = await page.eval(`
        const callbacks = window.recordingCallbacks();
        callbacks.before_add_row = function(payload) {
            window.record('callback:before-add-row', payload);
            return false;
        };
        window.restart({ callbacks: callbacks });

        const before = jQuery('#myGrid > .row').length;
        jQuery('.ge-addRowGroup a').eq(0).trigger('click');

        return {
            rowsUnchanged: jQuery('#myGrid > .row').length === before,
            log: window.log,
        };
    `);
    t.check('a callback returning false cancels as preventDefault does',
        byCallback.rowsUnchanged && byCallback.log.indexOf('event:after-add-row') === -1, byCallback);

    var canceledApi = await page.eval(`
        const ge = window.restart();
        jQuery('#myGrid').on('grideditor:before-add-row', function(e) { e.preventDefault(); });

        const before = jQuery('#myGrid > .row').length;
        const row = ge.createRow([12], { appendTo: ge.canvas });

        return {
            returned: row,
            rowsUnchanged: jQuery('#myGrid > .row').length === before,
        };
    `);
    t.check('a canceled create* returns null so the host can tell',
        canceledApi.returned === null && canceledApi.rowsUnchanged, canceledApi);

    var errors = page.errors();
    t.check('the cancel tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Deleting: the events, the built-in confirm, and confirm_delete.
 */
async function deleteTests(t) {
    var page = await recordingPage(t);

    var asked = await page.eval(`
        const before = jQuery('#myGrid > .row').length;
        jQuery('#myGrid > .row').first().find('> .ge-tools-drawer .ge-delete-row').trigger('click');
        return { before: before };
    `);
    await sleep(600);
    var dialog = await page.eval(`
        const modal = jQuery('.ge-confirm');
        return {
            shown: modal.hasClass('show'),
            insideCanvas: jQuery('#myGrid .ge-confirm').length,
            message: modal.find('.ge-confirm-message').text(),
            title: modal.find('.modal-title').text(),
            ok: modal.find('.ge-confirm-ok').text(),
            cancel: modal.find('.ge-confirm-cancel').text(),
            focused: document.activeElement === modal.find('.ge-confirm-ok')[0],
            rowsStillThere: jQuery('#myGrid > .row').length,
            log: window.log,
        };
    `);
    t.check('deleting asks in a Bootstrap modal, outside the canvas, before anything happens',
        dialog.shown && dialog.insideCanvas === 0 && dialog.message === 'Delete row?' &&
        dialog.title === 'Confirm' && dialog.ok === 'Delete' && dialog.cancel === 'Cancel' &&
        dialog.focused && dialog.rowsStillThere === asked.before &&
        dialog.log.join('|') === 'event:before-delete|callback:before-delete',
        dialog);

    await page.eval(`window.answerDialog(true); return true;`);
    await sleep(900);
    var afterDelete = await page.eval(`
        return {
            rows: jQuery('#myGrid > .row').length,
            dialogGone: !jQuery('.ge-confirm').hasClass('show') && jQuery('.modal-backdrop').length === 0,
            log: window.log,
            payload: window.payloads['event:after-delete'],
            editing: jQuery('#myGrid').hasClass('ge-editing'),
        };
    `);
    t.check('saying yes removes the row and announces it once the animation has finished',
        afterDelete.rows === asked.before - 1 && afterDelete.dialogGone &&
        afterDelete.log.join('|') === [
            'event:before-delete', 'callback:before-delete',
            'event:after-delete', 'callback:after-delete',
        ].join('|') &&
        afterDelete.payload.kind === 'row' && afterDelete.payload.source === 'tool' &&
        afterDelete.payload.parentIsCanvas && afterDelete.editing,
        afterDelete);

    var declining = await page.eval(`
        window.restart();
        const before = jQuery('#myGrid > .row').length;
        jQuery('#myGrid > .row').first().find('> .ge-tools-drawer .ge-delete-row').trigger('click');
        return { before: before };
    `);
    await sleep(600);
    await page.eval(`window.answerDialog(false); return true;`);
    await sleep(900);
    var declined = await page.eval(`
        return {
            kept: jQuery('#myGrid > .row').length === ${'${declining.before}'},
            log: window.log,
        };
    `.replace('${declining.before}', String(declining.before)));
    t.check('saying no keeps the row and fires no after-delete',
        declined.kept && declined.log.join('|') === 'event:before-delete|callback:before-delete',
        declined);

    var canceled = await page.eval(`
        window.restart();
        jQuery('#myGrid').on('grideditor:before-delete', function(e) { e.preventDefault(); });

        const before = jQuery('#myGrid > .row').length;
        jQuery('#myGrid > .row').first().find('> .ge-tools-drawer .ge-delete-row').trigger('click');
        return { before: before };
    `);
    await sleep(600);
    var afterCancel = await page.eval(`
        return {
            kept: jQuery('#myGrid > .row').length === ${'${canceled.before}'},
            asked: jQuery('.ge-confirm').hasClass('show'),
            log: window.log,
        };
    `.replace('${canceled.before}', String(canceled.before)));
    t.check('a host that cancels before-delete is never asked the question',
        afterCancel.kept && !afterCancel.asked &&
        afterCancel.log.indexOf('event:after-delete') === -1,
        afterCancel);

    var fresh = await recordingPage(t, { confirm_delete: false });
    var withoutConfirm = await fresh.eval(`
        const columns = jQuery('#myGrid > .row').eq(1).children('.column').length;
        jQuery('#myGrid > .row').eq(1).children('.column').first()
            .find('> .ge-tools-drawer .ge-delete-column').trigger('click');
        return { columns: columns, asked: jQuery('.ge-confirm').length };
    `);
    await sleep(900);
    var columnGone = await fresh.eval(`
        return {
            columns: jQuery('#myGrid > .row').eq(1).children('.column').length,
            payload: window.payloads['event:after-delete'],
        };
    `);
    t.check('confirm_delete false deletes a column straight away, as kind column',
        withoutConfirm.asked === 0 && columnGone.columns === withoutConfirm.columns - 1 &&
        columnGone.payload.kind === 'column' && !columnGone.payload.parentIsCanvas,
        { before: withoutConfirm, after: columnGone });

    // A page with Bootstrap's css but not its javascript still gets asked
    var native = await t.page(FIXTURE, `window.fixture`);
    var nativeConfirm = await native.eval(`
        window.bootstrap = undefined;
        window.asked = [];
        window.confirm = function(message) { window.asked.push(message); return true; };
        window.fixture.init();

        const before = jQuery('#myGrid > .row').length;
        jQuery('#myGrid > .row').first().find('> .ge-tools-drawer .ge-delete-row').trigger('click');
        return { before: before, asked: window.asked };
    `);
    await sleep(900);
    var nativeGone = await native.eval(`return { rows: jQuery('#myGrid > .row').length, dialogs: jQuery('.ge-confirm').length };`);
    t.check('without Bootstrap\u2019s javascript the question falls back to the browser',
        nativeConfirm.asked.length === 1 && nativeConfirm.asked[0] === 'Delete row?' &&
        nativeGone.rows === nativeConfirm.before - 1 && nativeGone.dialogs === 0,
        { asked: nativeConfirm.asked, after: nativeGone });

    var errors = page.errors().concat(fresh.errors()).concat(native.errors());
    t.check('the delete tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * The width tools, which are the resize pair's only caller until the drag
 * handle lands.
 */
async function resizeTests(t) {
    var page = await recordingPage(t);

    var resized = await page.eval(`
        const column = jQuery('#myGrid > .row').eq(1).children('.column').first();
        const before = column.attr('class');

        // What the column looked like at the moment after-resize was
        // delivered, so the class cannot be written after the announcement
        jQuery('#myGrid').on('grideditor:after-resize', function() {
            window.classesWhenAnnounced = column.attr('class');
        });
        column.find('> .ge-tools-drawer .ge-decrease-col-width').trigger('click');

        return {
            before: before,
            after: column.attr('class'),
            whenAnnounced: window.classesWhenAnnounced,
            log: window.log,
            payload: window.payloads['event:after-resize'],
        };
    `);
    t.check('the size class is on the column by the time after-resize fires',
        /col-lg-5/.test(resized.whenAnnounced || ''), resized);
    t.check('a width tool announces the resize with the sizes it moved between',
        /col-lg-6/.test(resized.before) && /col-lg-5/.test(resized.after) &&
        resized.log.join('|') === [
            'event:before-resize', 'callback:before-resize',
            'event:after-resize', 'callback:after-resize',
        ].join('|') &&
        resized.payload.kind === 'column' && resized.payload.source === 'tool' &&
        resized.payload.from === 6 && resized.payload.to === 5 &&
        resized.payload.keys === 'breakpoint,canvas,from,kind,node,parent,source,to',
        resized);

    var canceled = await page.eval(`
        window.restart();
        jQuery('#myGrid').on('grideditor:before-resize', function(e) { e.preventDefault(); });

        const column = jQuery('#myGrid > .row').eq(1).children('.column').first();
        const before = column.attr('class');
        column.find('> .ge-tools-drawer .ge-decrease-col-width').trigger('click');

        return {
            unchanged: column.attr('class') === before,
            log: window.log,
        };
    `);
    t.check('canceling before-resize leaves the column class alone',
        canceled.unchanged && canceled.log.indexOf('event:after-resize') === -1, canceled);

    var noop = await page.eval(`
        window.restart();
        const column = jQuery('#myGrid > .row').first().children('.column').first();
        const widen = column.find('> .ge-tools-drawer .ge-increase-col-width');

        // The first one is a real change: the column was full width at lg and
        // unsized below it, and the all view writes every tier
        widen.trigger(jQuery.Event('click', { shiftKey: true }));
        const firstClick = window.log.slice();
        window.log = [];

        // The second one asks for exactly what is already there
        widen.trigger(jQuery.Event('click', { shiftKey: true }));

        return {
            classes: column.attr('class'),
            firstClick: firstClick,
            secondClick: window.log,
        };
    `);
    t.check('a width tool that would not change the size fires nothing',
        /col-12/.test(noop.classes) && /col-xxl-12/.test(noop.classes) &&
        noop.firstClick.length === 4 && noop.secondClick.length === 0,
        noop);

    var errors = page.errors();
    t.check('the resize tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Moving, with real drags, because a sortable only reports what the pointer
 * actually did.
 */
async function moveTests(t) {
    var page = await recordingPage(t);

    await page.eval(LABEL_COLUMNS);
    // Aimed at the top of the target column rather than its middle: with
    // tolerance 'pointer' that is unambiguously "before this one", and it is
    // not a point the placeholder's own reflow moves out from under the drag
    await page.drag('#right > .ge-tools-drawer .ge-move', '#left', { yRatio: 0.15 });
    var moved = await page.eval(`
        return {
            order: jQuery('#myGrid > .row').eq(1).children('.column').map(function() { return this.id; }).get(),
            log: window.log,
            before: window.payloads['event:before-move'],
            after: window.payloads['event:after-move'],
        };
    `);
    t.check('dragging a column reorders it and announces the move',
        moved.order.join(',') === 'right,left' &&
        moved.log.join('|') === [
            'event:before-move', 'callback:before-move',
            'event:after-move', 'callback:after-move',
        ].join('|') &&
        moved.after.kind === 'column' && moved.after.source === 'dragdrop' &&
        moved.after.from.index === 1 && moved.after.to.index === 0 &&
        moved.before.from.index === 1 && moved.before.to === undefined,
        moved);

    await page.eval(`
        window.restart();
        jQuery('#myGrid').on('grideditor:before-move', function(e) { e.preventDefault(); });
        return true;
    `);
    await page.eval(LABEL_COLUMNS);
    // Aimed at the top of the target column rather than its middle: with
    // tolerance 'pointer' that is unambiguously "before this one", and it is
    // not a point the placeholder's own reflow moves out from under the drag
    await page.drag('#right > .ge-tools-drawer .ge-move', '#left', { yRatio: 0.15 });
    var canceledMove = await page.eval(`
        return {
            order: jQuery('#myGrid > .row').eq(1).children('.column').map(function() { return this.id; }).get(),
            log: window.log,
        };
    `);
    t.check('a canceled move puts the column back and fires no after-move',
        canceledMove.order.join(',') === 'left,right' &&
        canceledMove.log.join('|') === 'event:before-move|callback:before-move',
        canceledMove);

    await page.eval(`window.restart(); return true;`);
    await page.eval(LABEL_COLUMNS);
    await page.drag('#left > .ge-tools-drawer .ge-move', '#left', { dx: 6, dy: 4, steps: 3 });
    var nowhere = await page.eval(`
        return {
            order: jQuery('#myGrid > .row').eq(1).children('.column').map(function() { return this.id; }).get(),
            log: window.log,
        };
    `);
    t.check('a drag that goes nowhere is not reported as a move',
        nowhere.order.join(',') === 'left,right' &&
        nowhere.log.indexOf('event:after-move') === -1,
        nowhere);

    var errors = page.errors();
    t.check('the move tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'events',
    description: 'host callbacks and the event bus',
    run: async function(t) {
        await reentrancyTests(t);
        await orderingTests(t);
        await cancelTests(t);
        await deleteTests(t);
        await resizeTests(t);
        await moveTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['events']);
}
