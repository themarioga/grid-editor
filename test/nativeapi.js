/**
 * Browser tests for 7.0's native API: GridEditor, its create and get, what an
 * element with an editor already on it gets, a destroyed editor, and what
 * a module app hands the editor in place of the page's globals.
 *
 * Spec remove-jquery: AC-03 to AC-07, AC-12, AC-29, AC-30, AC-32, AC-33,
 * AC-38, AC-41 and AC-44 to AC-47.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    window.fresh = function(html) {
        const running = GridEditor.get('#myGrid');
        if (running) { running.destroy(); }
        document.querySelector('#myGrid').innerHTML = html ||
            '<div class="row"><div class="col-6" id="left"><p>Left</p></div><div class="col-6" id="right"><p>Right</p></div></div>';
        window.warnings = [];
    };
    window.settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
    return true;
`;

async function creationTests(t, page) {
    var made = await page.eval(`
        fresh();
        const element = document.querySelector('#myGrid');
        const ge = new GridEditor(element, { new_row_layouts: [[12]] });
        const result = {
            instance: ge instanceof GridEditor,
            got: GridEditor.get(element) === ge,
            bySelector: GridEditor.get('#myGrid') === ge,
            canvas: ge.canvas === element,
            drawers: element.querySelectorAll('.ge-tools-drawer').length > 0,
            buttons: document.querySelectorAll('.ge-addRowGroup a').length,
        };
        ge.destroy();
        fresh();
        const created = GridEditor.create(element, { new_row_layouts: [[6, 6], [12]] });
        result.create = created instanceof GridEditor && GridEditor.get(element) === created &&
            document.querySelectorAll('.ge-addRowGroup a').length === 2;
        return result;
    `);
    t.check('new GridEditor puts an editor on an element with none, and GridEditor.get finds it',
        made.instance && made.got && made.bySelector && made.canvas && made.drawers && made.buttons === 1, made);
    t.check('GridEditor.create does the same', made.create, made);

    var none = await page.eval(`
        const other = document.createElement('div');
        document.body.appendChild(other);
        const result = { element: GridEditor.get(other), missing: GridEditor.get('#nothing-here'), nothing: GridEditor.get(null) };
        other.remove();
        return result;
    `);
    t.check('GridEditor.get of an element with no editor is null',
        none.element === null && none.missing === null && none.nothing === null, none);

    var twice = await page.eval(`
        fresh();
        const first = GridEditor.create('#myGrid', { new_row_layouts: [[12]] });
        const second = new GridEditor('#myGrid', { new_row_layouts: [[6, 6], [4, 4, 4]] });
        const third = GridEditor.create(document.querySelector('#myGrid'), { default_view: 'md' });
        return {
            same: first === second && second === third,
            layouts: first.settings.new_row_layouts.length,
            view: first.getView(),
            controls: document.querySelectorAll('.ge-mainControls').length,
            drawersPerRow: document.querySelectorAll('#myGrid > .row > .ge-tools-drawer').length,
            warnings: window.warnings.filter(function(w) { return /already has an editor/.test(w); }).length,
        };
    `);
    t.check('an element that has an editor gets it back, options and all, with no second set of controls, and one warning',
        twice.same && twice.layouts === 1 && twice.view === 'all' && twice.controls === 1 &&
        twice.drawersPerRow === 1 && twice.warnings === 1, twice);

    var selector = await page.eval(`
        fresh();
        const extra = document.createElement('div');
        extra.className = 'second-grid';
        extra.innerHTML = '<div class="row"><div class="col-12"><p>Second</p></div></div>';
        document.body.appendChild(extra);
        const ge = new GridEditor('#myGrid');
        const result = { first: ge.canvas === document.querySelector('#myGrid') };
        ge.destroy();
        extra.remove();
        return result;
    `);
    t.check('a selector puts the editor on the first element it matches', selector.first, selector);

    var wrong = await page.eval(`
        const attempt = function(target) {
            try { new GridEditor(target); return 'made'; } catch (error) { return error instanceof TypeError ? 'TypeError' : String(error); }
        };
        return {
            missing: attempt('.missing'),
            number: attempt(42),
            nothing: attempt(undefined),
            leftAlone: document.querySelectorAll('.ge-mainControls').length,
        };
    `);
    t.check('a selector that matches nothing, or something that is not an element, throws a TypeError and builds nothing',
        wrong.missing === 'TypeError' && wrong.number === 'TypeError' && wrong.nothing === 'TypeError' && wrong.leftAlone === 0,
        wrong);
}

async function lifecycleTests(t, page) {
    var destroyed = await page.eval(`
        fresh();
        const element = document.querySelector('#myGrid');
        const ge = GridEditor.create(element);
        const chained = ge.changeView('md').reset() === ge;
        const returned = ge.destroy();
        return {
            chained: chained,
            returned: returned === ge,
            got: GridEditor.get(element),
            drawers: element.querySelectorAll('.ge-tools-drawer').length,
            controls: document.querySelectorAll('.ge-mainControls').length,
            editing: element.classList.contains('ge-editing'),
        };
    `);
    t.check('the methods that do something chain, and destroy takes the editor off: get is null, the controls are gone',
        destroyed.chained && destroyed.returned && destroyed.got === null && destroyed.drawers === 0 &&
        destroyed.controls === 0 && !destroyed.editing, destroyed);

    var after = await page.eval(`
        fresh();
        const element = document.querySelector('#myGrid');
        const ge = GridEditor.create(element);
        ge.destroy();
        window.warnings = [];
        const row = ge.createRow([12], { appendTo: element });
        const again = ge.createRow([12], { appendTo: element });
        const chained = ge.reset();
        return {
            row: row,
            again: again,
            chained: chained === ge,
            rows: element.querySelectorAll(':scope > .row').length,
            warnings: window.warnings.filter(function(w) { return /destroyed/.test(w); }).length,
            html: ge.getHtml() === element.innerHTML,
            plain: typeof ge.getPlainHtml() === 'string' && !/column/.test(ge.getPlainHtml()),
        };
    `);
    t.check('a destroyed editor does nothing, says so once per method, and its getHtml reads the element as it is',
        after.row === null && after.again === null && after.chained && after.rows === 1 &&
        after.warnings === 2 && after.html && after.plain, after);

    var detached = await page.eval(`
        fresh();
        const element = document.querySelector('#myGrid');
        const ge = GridEditor.create(element);
        const parent = element.parentNode;
        const next = element.nextSibling;
        element.remove();
        let threw = null;
        try { ge.destroy(); } catch (error) { threw = String(error); }
        parent.insertBefore(element, next);
        return { threw: threw, got: GridEditor.get(element), controls: document.querySelectorAll('.ge-mainControls').length };
    `);
    t.check('destroy on a canvas already taken out of the document does not throw, and the editor is gone',
        detached.threw === null && detached.got === null && detached.controls === 0, detached);

    var errors = page.errors();
    t.check('the lifecycle tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function createTests(t, page) {
    var made = await page.eval(`
        fresh();
        const ge = GridEditor.create('#myGrid', { plugins: window.fixture.plugins(['sections']), elements: { enabled: true } });
        const isElement = function(node) { return node instanceof HTMLElement; };
        const detached = function(node) { return isElement(node) && !node.parentNode; };
        const placed = function(node) { return isElement(node) && document.querySelector('#myGrid').contains(node); };
        const results = {
            row: detached(ge.createRow([6, 6])),
            rowPlaced: placed(ge.createRow([12], { appendTo: '#myGrid' })),
            column: detached(ge.createColumn(4)),
            columnPlaced: placed(ge.createColumn(3, { appendTo: document.querySelector('#myGrid .row') })),
            container: detached(ge.createContainer('tabs')),
            containerPlaced: placed(ge.createContainer('card', { appendTo: '#left' })),
            element: detached(ge.createElement('<blockquote>Quote</blockquote>')),
            section: detached(ge.createSection()),
            sectionPlaced: placed(ge.createSection({ appendTo: '#myGrid' })),
        };
        const tabs = ge.createContainer('tabs', { appendTo: '#right' });
        results.tab = placed(ge.addTab(tabs, { label: 'More' }));
        results.unknown = ge.createContainer('nonsense');

        document.querySelector('#myGrid').addEventListener('grideditor:before-add-row', function(e) { e.preventDefault(); }, { once: true });
        results.canceled = ge.createRow([12], { appendTo: '#myGrid' });
        return results;
    `);
    t.check('every create* hands back an element, detached with no placement, placed with one',
        made.row && made.rowPlaced && made.column && made.columnPlaced && made.container && made.containerPlaced &&
        made.element && made.section && made.sectionPlaced && made.tab, made);
    t.check('and null where 6.x gave none: an unknown container type, an add a handler canceled',
        made.unknown === null && made.canceled === null, made);
}

async function libraryTests(t, page) {
    var sortable = await page.eval(`
        fresh();
        const library = window.Sortable;
        delete window.Sortable;
        GridEditor.Sortable = library;
        const ge = GridEditor.create('#myGrid');
        const lists = library.get(document.querySelector('#myGrid .row')) ? 1 : 0;
        ge.destroy();
        GridEditor.Sortable = null;
        window.Sortable = library;
        return { lists: lists, warned: window.warnings.filter(function(w) { return /SortableJS not available/.test(w); }).length };
    `);
    t.check('with no window.Sortable, the SortableJS a module app assigns to GridEditor.Sortable is the one used',
        sortable.lists === 1 && sortable.warned === 0, sortable);

    var modal = await page.eval(`
        fresh();
        const bootstrap = window.bootstrap;
        delete window.bootstrap;
        GridEditor.bootstrap = { Modal: bootstrap.Modal };
        const confirmed = [];
        const confirm = window.confirm;
        window.confirm = function(message) { confirmed.push(message); return true; };

        GridEditor.create('#myGrid', { confirm_delete: true });
        document.querySelector('#left').closest('.row').querySelector(':scope > .ge-tools-drawer .ge-delete-row').click();
        await settle(600);
        const dialog = document.querySelector('body > .ge-confirm');
        const result = { shown: !!dialog && dialog.classList.contains('show'), asked: confirmed.length };
        dialog.querySelector('.ge-confirm-ok').click();
        await settle(1000);
        result.rows = document.querySelectorAll('#myGrid > .row').length;

        GridEditor.get('#myGrid').destroy();
        window.confirm = confirm;
        window.bootstrap = bootstrap;
        GridEditor.bootstrap = null;
        return result;
    `);
    t.check('with no window.bootstrap, GridEditor.bootstrap\'s Modal asks before a delete, not window.confirm',
        modal.shown && modal.asked === 0 && modal.rows === 0, modal);

    var panel = await page.eval(`
        fresh();
        const bootstrap = window.bootstrap;
        delete window.bootstrap;
        GridEditor.bootstrap = { Modal: bootstrap.Modal };
        GridEditor.create('#myGrid', { settings_panel: 'modal' });
        document.querySelector('#left > .ge-tools-drawer .ge-settings').click();
        await settle(600);
        const panel = document.querySelector('body > .ge-settings-modal');
        const result = { instance: !!(panel && bootstrap.Modal.getInstance(panel)), shown: !!panel && panel.classList.contains('show') };
        GridEditor.get('#myGrid').destroy();
        await settle(800);
        window.bootstrap = bootstrap;
        GridEditor.bootstrap = null;
        return result;
    `);
    t.check('and the modal settings panel is a Bootstrap Modal of its',
        panel.instance && panel.shown, panel);

    var destroyedOpen = await page.eval(`
        fresh();
        const reported = [];
        const onError = function(e) { reported.push(String(e.message)); };
        window.addEventListener('error', onError);
        GridEditor.create('#myGrid', { settings_panel: 'modal' });
        document.querySelector('#left > .ge-tools-drawer .ge-settings').click();
        await settle(100);
        const opening = GridEditor.get('#myGrid');
        opening.destroy();
        await settle(1200);
        const whileOpen = { panels: document.querySelectorAll('body > .ge-settings-modal').length, backdrops: document.querySelectorAll('.modal-backdrop').length };

        fresh();
        GridEditor.create('#myGrid', { settings_panel: 'modal' });
        document.querySelector('#left > .ge-tools-drawer .ge-settings').click();
        await settle(600);
        GridEditor.get('#myGrid').destroy();
        await settle(1200);

        fresh();
        GridEditor.create('#myGrid', { confirm_delete: true });
        document.querySelector('#left').closest('.row').querySelector(':scope > .ge-tools-drawer .ge-delete-row').click();
        await settle(600);
        GridEditor.get('#myGrid').destroy();
        await settle(1200);

        window.removeEventListener('error', onError);
        return {
            reported: reported,
            whileOpen: whileOpen,
            panels: document.querySelectorAll('body > .ge-settings-modal, body > .ge-confirm').length,
            backdrops: document.querySelectorAll('.modal-backdrop').length,
            bodyLocked: document.body.classList.contains('modal-open'),
        };
    `);
    t.check('destroy with a modal open - the settings panel opening or open, the delete confirmation - closes it first: no error, nothing left behind',
        destroyedOpen.reported.length === 0 && destroyedOpen.whileOpen.panels === 0 && destroyedOpen.whileOpen.backdrops === 0 &&
        destroyedOpen.panels === 0 && destroyedOpen.backdrops === 0 && !destroyedOpen.bodyLocked, destroyedOpen);

    var preferred = await page.eval(`
        fresh();
        const Modal = window.bootstrap.Modal;
        const used = [];
        GridEditor.bootstrap = {
            Modal: {
                getInstance: function(el) { used.push('getInstance'); return Modal.getInstance(el); },
                getOrCreateInstance: function(el) { used.push('getOrCreateInstance'); return Modal.getOrCreateInstance(el); },
            },
        };
        GridEditor.create('#myGrid', { confirm_delete: true });
        document.querySelector('#left').closest('.row').querySelector(':scope > .ge-tools-drawer .ge-delete-row').click();
        await settle(600);
        const dialog = document.querySelector('body > .ge-confirm');
        dialog.querySelector('.ge-confirm-cancel').click();
        await settle(600);
        GridEditor.get('#myGrid').destroy();
        GridEditor.bootstrap = null;
        return { used: used.length > 0 };
    `);
    t.check('with both set, GridEditor.bootstrap is the one used', preferred.used, preferred);

    var neither = await page.eval(`
        fresh();
        const bootstrap = window.bootstrap;
        delete window.bootstrap;
        const confirmed = [];
        const confirm = window.confirm;
        window.confirm = function(message) { confirmed.push(message); return false; };
        GridEditor.create('#myGrid', { confirm_delete: true });
        document.querySelector('#left').closest('.row').querySelector(':scope > .ge-tools-drawer .ge-delete-row').click();
        await settle(100);
        const result = { asked: confirmed, dialog: !!document.querySelector('body > .ge-confirm'), rows: document.querySelectorAll('#myGrid > .row').length };
        GridEditor.get('#myGrid').destroy();
        window.confirm = confirm;
        window.bootstrap = bootstrap;
        return result;
    `);
    t.check('with neither, the browser\'s confirm asks, as in 6.x',
        neither.asked.length === 1 && neither.asked[0] === 'Delete row?' && !neither.dialog && neither.rows === 1, neither);
}

async function buildTests(t, page) {
    var twice = await page.eval(`
        const first = window.GridEditor;
        window.warnings = [];
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/grideditor.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return {
            kept: window.GridEditor === first,
            warned: window.warnings.filter(function(w) { return /loaded twice/.test(w); }).length,
        };
    `);
    t.check('grideditor.js loaded a second time keeps the first GridEditor, and says so once',
        twice.kept && twice.warned === 1, twice);
}

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    await creationTests(t, page);
    await lifecycleTests(t, page);
    await createTests(t, page);
    await libraryTests(t, page);
    await buildTests(t, page);

    var errors = page.errors();
    t.check('the native API tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'nativeapi',
    description: 'GridEditor, create and get, a second editor, a destroyed one, and what a module app hands in',
    run: run,
};

if (require.main === module) {
    require('./run').main(['nativeapi']);
}
