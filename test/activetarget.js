/**
 * Browser tests for the active target: with active_target on, a click on
 * any node with settings makes it where the toolbar's buttons add, inside
 * it and in the level it lacks (specs active-target and
 * active-target-selection; the second wins where they differ).
 *
 * The texts use a stand-in for tinyMCE, as test/texts.js does, so the Text
 * button is there and a click on a text opens it.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.fakeTinymce = {
        started: 0,
        init: function(config) {
            window.fakeTinymce.started++;
            const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {}, remove: function() {} };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    window.text = function(html) {
        return '<div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">' + html + '</div>';
    };
    window.col = function(id, size, inner) {
        return '<div class="column col-' + size + '" id="' + id + '">' + (inner || text('<p>' + id + '</p>')) + '</div>';
    };
    /** Two rows - #a and #b side by side, #c under them - and a section #s. */
    window.CANVAS =
        '<div class="row" id="r1">' + col('a', 6) + col('b', 6) + '</div>' +
        '<div class="row" id="r2">' + col('c', 12) + '</div>' +
        '<div class="container" id="s"><div class="row" id="sr">' + col('sc', 12) + '</div></div>';

    /** A fresh editor on the canvas, with the target changes and the adds logged. */
    window.start = function(overrides, html) {
        if (ge()) { ge().destroy(); }
        try { localStorage.removeItem('grideditor.clipboard'); } catch (e) { /* no storage */ }
        window.warnings = [];
        window.changes = [];
        window.adds = [];
        const grid = q('#myGrid');
        grid.innerHTML = html || CANVAS;
        (window.listening || []).forEach(function(entry) { grid.removeEventListener(entry[0], entry[1]); });
        const onChange = function(e) { window.changes.push({ target: e.detail.target && (e.detail.target.id || 'new'), from: e.detail.from && (e.detail.from.id || 'new'), canvas: e.detail.canvas === grid }); };
        const onAdd = function(e) { window.adds.push({ kind: e.detail.kind, source: e.detail.source, parent: e.detail.parent && (e.detail.parent.id || e.detail.parent.className) }); };
        grid.addEventListener('grideditor:target-change', onChange);
        grid.addEventListener('grideditor:after-add', onAdd);
        window.listening = [['grideditor:target-change', onChange], ['grideditor:after-add', onAdd]];
        return window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            active_target: true,
            confirm_delete: false,
            plugins: window.fixture.plugins(['sections', 'clipboard']),
        }, overrides || {}));
    };

    /** The ids a node's column-level content is: rows by their columns, texts as 'text', containers by type. */
    window.blocks = function(node) {
        return Array.from(node.children).filter(function(child) {
            return !child.matches('.ge-tools-drawer, .ge-resize-handle');
        }).map(function(child) {
            if (child.matches('.row')) { return 'row:' + child.querySelectorAll(':scope > .column').length; }
            if (child.matches('.ge-text-block')) { return 'text'; }
            if (child.matches('[data-ge-container]')) { return child.getAttribute('data-ge-container'); }
            if (child.matches('.container')) { return 'section'; }
            return child.id || child.className;
        }).join(',');
    };
    window.target = function() { const node = ge().getActiveTarget(); return node ? node.id || 'new' : null; };
    window.marked = function() { return qa('#myGrid .ge-selected').map(function(node) { return node.id || 'new'; }).join(','); };
    /** A click on a node's drawer: what a click on its background does. */
    window.clickIn = function(id) { q('#' + id + ' > .ge-tools-drawer').click(); };
    /** A click on the drawer of a node that has no id. */
    window.clickOn = function(node) { (node.querySelector(':scope > .ge-tools-drawer') || node).click(); };
    window.textOf = function(id) { return q('#' + id + ' .ge-content'); };
    window.button = {
        text: function() { return q('.ge-mainControls .ge-add-text-button'); },
        row: function(layout) { return q('.ge-addRowGroup a[data-ge-layout="' + layout + '"]'); },
        tabs: function() { return q('.ge-mainControls [data-ge-container-type="tabs"]'); },
        section: function() { return q('.ge-mainControls [data-ge-feature="sections"]'); },
        paste: function() {
            return qa('.ge-mainControls [data-ge-feature="clipboard"]').filter(function(b) { return b.style.display !== 'none'; })[0];
        },
    };
    window.escape = function() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };
    return true;
`;

async function placementTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var off = await page.eval(`
        start({ active_target: undefined });
        clickIn('b');
        button.text().click();
        return { canvas: blocks(q('#myGrid')), b: blocks(q('#b')), marked: marked(), target: ge().getActiveTarget(), changes: changes.length };
    `);
    t.check('without active_target a click in a column changes nothing: the text goes to the end of the canvas (AC-01)',
        off.canvas === 'row:2,row:1,section,row:1' && off.b === 'text' && off.marked === '' && off.target === null && off.changes === 0, off);

    var nothing = await page.eval(`
        start();
        button.text().click();
        return { canvas: blocks(q('#myGrid')), target: target() };
    `);
    t.check('with it on and nothing active, the text goes to the end of the canvas in a row of its own (AC-02)',
        nothing.canvas === 'row:2,row:1,section,row:1' && nothing.target === null, nothing);

    var activated = await page.eval(`
        start();
        clickIn('b');
        return { target: target(), marked: marked(), changes: changes.slice() };
    `);
    t.check('a click in a column makes it the target, marked, and says so (AC-03)',
        activated.target === 'b' && activated.marked === 'b' &&
        JSON.stringify(activated.changes) === JSON.stringify([{ target: 'b', from: null, canvas: true }]), activated);

    var column = await page.eval(`
        start();
        clickIn('b');
        button.text().click();
        const afterText = { b: blocks(q('#b')), canvas: blocks(q('#myGrid')), target: target() };
        button.row('6,6').click();
        const afterRow = blocks(q('#b'));
        button.tabs().click();
        return { afterText: afterText, afterRow: afterRow, afterTabs: blocks(q('#b')), adds: adds.slice(), target: target() };
    `);
    t.check('with a column active the text goes to its end, with no row of its own, and the column stays active (AC-04)',
        column.afterText.b === 'text,text' && column.afterText.canvas === 'row:2,row:1,section' && column.afterText.target === 'b', column);
    t.check('a row goes into it as a nested row of its columns (AC-05)', column.afterRow === 'text,text,row:2', column);
    t.check('a container goes to its end, with no row of its own (AC-06)',
        column.afterTabs === 'text,text,row:2,tabs' && column.target === 'b', column);
    t.check('what is added says the column is its parent, and that the toolbar made it',
        column.adds.length === 3 && column.adds.every(function(add) { return add.parent === 'b' && add.source === 'tool'; }), column.adds);

    var section = await page.eval(`
        start();
        clickIn('s');
        const active = target();
        button.text().click();
        const afterText = blocks(q('#s'));
        button.row('12').click();
        const afterRow = blocks(q('#s'));
        button.section().click();
        return { active: active, afterText: afterText, afterRow: afterRow, canvas: blocks(q('#myGrid')),
            next: q('#s').nextElementSibling.matches('.container') && q('#s').nextElementSibling.id === '', target: target() };
    `);
    t.check('with a section active: a text in a row of its own, a row, and a new section after it (AC-07)',
        section.active === 's' && section.afterText === 'row:1,row:1' && section.afterRow === 'row:1,row:1,row:1' &&
        section.canvas === 'row:2,row:1,section,section' && section.next && section.target === 's', section);

    var sectionFromColumn = await page.eval(`
        start();
        clickIn('a');
        button.section().click();
        return { canvas: blocks(q('#myGrid')), after: q('#r1').nextElementSibling.matches('.container'), a: blocks(q('#a')), target: target() };
    `);
    t.check('a section with a column active goes to the canvas, after the row the column is in (AC-08)',
        sectionFromColumn.canvas === 'row:2,section,row:1,section' && sectionFromColumn.after &&
        sectionFromColumn.a === 'text' && sectionFromColumn.target === 'a', sectionFromColumn);

    var pasted = await page.eval(`
        start();
        q('#r2 > .ge-tools-drawer > .ge-copy').click();
        clickIn('b');
        adds.length = 0;
        const paste = button.paste();
        paste.click();
        return { found: !!paste, b: blocks(q('#b')), adds: adds.slice() };
    `);
    t.check('a pasted row goes into the active column as a nested row, from the paste (AC-09)',
        pasted.found && pasted.b === 'text,row:1' &&
        pasted.adds.length === 1 && pasted.adds[0].kind === 'row' && pasted.adds[0].source === 'paste' && pasted.adds[0].parent === 'b', pasted);

    var canceled = await page.eval(`
        start();
        clickIn('b');
        const cancel = function(e) { e.preventDefault(); };
        q('#myGrid').addEventListener('grideditor:before-add-text', cancel);
        button.text().click();
        q('#myGrid').removeEventListener('grideditor:before-add-text', cancel);
        return { b: blocks(q('#b')), target: target(), canvas: blocks(q('#myGrid')) };
    `);
    t.check('a canceled add adds nothing, and the target stays (AC-17)',
        canceled.b === 'text' && canceled.target === 'b' && canceled.canvas === 'row:2,row:1,section', canceled);

    var callback = await page.eval(`
        window.called = [];
        start({ callbacks: { target_change: function(payload) { window.called.push(payload); } } });
        clickIn('b');
        const event = changes[0];
        const payload = called[0];
        return { event: event, target: payload && payload.target && payload.target.id, from: payload && payload.from, canvas: payload && payload.canvas === q('#myGrid') };
    `);
    t.check('callbacks.target_change gets what the event carries (AC-28)',
        callback.event.target === 'b' && callback.target === 'b' && callback.from === null && callback.canvas, callback);

    var errors = page.errors();
    t.check('the placement tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function activationTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    await page.eval(`start(); clickIn('b'); return true;`);
    await page.click('#c .ge-content');
    var onText = await page.eval(`return { text: ge().getActiveTarget() === textOf('c'), started: fakeTinymce.started };`);
    t.check('a click on a text opens its editor and makes the text the target (AC-10; active-target-selection AC-04)',
        onText.text && onText.started > 0, onText);

    var nested = await page.eval(`
        start({}, '<div class="row" id="r1">' + col('outer', 12, '<div class="row" id="inner-row">' + col('inner', 6) + col('other', 6) + '</div>') + '</div>');
        clickIn('inner');
        return target();
    `);
    t.check('a click in a nested column makes that one the target, not the one around it (AC-11)', nested === 'inner', nested);

    var pane = await page.eval(`
        start();
        clickIn('b');
        button.tabs().click();
        const column = q('#b [data-ge-container="tabs"] .tab-pane.active .column');
        column.querySelector(':scope > .ge-tools-drawer').click();
        return { target: ge().getActiveTarget() === column, inPane: !!column.closest('.tab-pane') };
    `);
    t.check('a click in a tab\\u2019s pane makes the pane\\u2019s column the target (AC-12)', pane.target && pane.inPane, pane);

    var off = await page.eval(`
        start();
        clickIn('b');
        changes.length = 0;
        q('#myGrid').click();
        return { target: target(), changes: changes.slice(), marked: marked() };
    `);
    t.check('a click in the canvas on no node with settings clears the target (AC-13; active-target-selection AC-05)',
        off.target === null && off.marked === '' &&
        JSON.stringify(off.changes) === JSON.stringify([{ target: null, from: 'b', canvas: true }]), off);

    var escaped = await page.eval(`
        start();
        clickIn('b');
        document.activeElement.blur();
        escape();
        return target();
    `);
    t.check('Escape clears it (AC-14)', escaped === null, escaped);

    var kept = await page.eval(`
        start();
        clickIn('b');
        q('#b > .ge-tools-drawer > .ge-settings').click();
        await sleep(400);
        const open = !!q('.ge-settings-target');
        escape();
        await sleep(400);
        const withPanel = target();
        const field = document.body.appendChild(document.createElement('input'));
        field.focus();
        escape();
        const withField = target();
        field.remove();
        return { open: open, withPanel: withPanel, withField: withField };
    `);
    t.check('Escape with the settings panel open, or a field focused, is theirs: the target stays (AC-15)',
        kept.open && kept.withPanel === 'b' && kept.withField === 'b', kept);

    var deleted = await page.eval(`
        start();
        clickIn('a');
        changes.length = 0;
        q('#a > .ge-tools-drawer > .ge-delete-column').click();
        await sleep(800);
        const column = { gone: !q('#a'), target: target(), changes: changes.slice() };
        clickIn('c');
        changes.length = 0;
        q('#r2 > .ge-tools-drawer > .ge-delete-row').click();
        await sleep(800);
        return { column: column, row: { gone: !q('#r2'), target: target(), changes: changes.slice() } };
    `);
    t.check('deleting the target, or the row it is in, clears it and says so (AC-16; active-target-selection AC-36)',
        deleted.column.gone && deleted.column.target === null && deleted.column.changes.length === 1 && deleted.column.changes[0].from === 'a' &&
        deleted.row.gone && deleted.row.target === null &&
        // The click on the row's tool makes the row the target first
        JSON.stringify(deleted.row.changes.map(function(c) { return [c.target, c.from]; })) === JSON.stringify([['r2', 'c'], [null, 'r2']]), deleted);

    var html = await page.eval(`
        start();
        clickIn('b');
        const saved = ge().getHtml();
        return { leaked: /ge-selected|ge-active-target/.test(saved), target: target(), marked: marked() };
    `);
    t.check('getHtml has no mark, and the target is still marked afterwards (AC-18)',
        !html.leaked && html.target === 'b' && html.marked === 'b', html);

    var view = await page.eval(`
        start();
        clickIn('b');
        changes.length = 0;
        ge().changeView('md');
        const md = { target: target(), marked: marked() };
        ge().changeView('all');
        return { md: md, changes: changes.length };
    `);
    t.check('changing the view keeps the target, and says nothing (AC-19)',
        view.md.target === 'b' && view.md.marked === 'b' && view.changes === 0, view);

    await page.eval(`start({ toolbar_drag: true }); clickIn('a'); changes.length = 0; return true;`);
    // Aimed at the top of #c's text: the canvas opens up mid drag and moves
    // the text down, and the drop goes where the marker shows, before it
    await page.drag('.ge-addRowGroup a[data-ge-layout="12"]', '#c .ge-content', { yRatio: 0.1 });
    var dropped = await page.eval(`return { c: blocks(q('#c')), target: target(), changes: changes.length, a: blocks(q('#a')) };`);
    t.check('a toolbar button dropped somewhere goes there, and the target stays (AC-20)',
        dropped.c === 'row:1,text' && dropped.a === 'text' && dropped.target === 'a' && dropped.changes === 0, dropped);

    await page.eval(`start(); clickIn('b'); changes.length = 0; return true;`);
    await page.dragBy('#a > .ge-resize-e', 120, 0);
    var resized = await page.eval(`return { target: target(), changes: changes.length, a: q('#a').className };`);
    await page.drag('#c > .ge-tools-drawer .ge-move', '#b', { yRatio: 0.9 });
    var moved = await page.eval(`return { target: target(), changes: changes.length };`);
    t.check('resizing a column or dragging one leaves the target as it was (AC-21)',
        resized.target === 'b' && resized.changes === 0 && moved.target === 'b' && moved.changes === 0, { resized: resized, moved: moved });

    var source = await page.eval(`
        start();
        clickIn('b');
        changes.length = 0;
        q('.gm-edit-mode').click();
        const open = { target: target(), changes: changes.slice() };
        q('.gm-edit-mode').click();
        return { open: open, back: target(), marked: marked() };
    `);
    t.check('editing the html clears the target, and it does not come back (AC-26)',
        source.open.target === null && source.open.changes.length === 1 && source.open.changes[0].target === null &&
        source.back === null && source.marked === '', source);

    var destroyed = await page.eval(`
        start();
        clickIn('b');
        changes.length = 0;
        ge().destroy();
        return { leaked: /ge-selected/.test(q('#myGrid').innerHTML), changes: changes.length };
    `);
    t.check('destroy leaves no mark in the markup, and says nothing (AC-27)', !destroyed.leaked && destroyed.changes === 0, destroyed);

    var two = await page.eval(`
        start();
        clickIn('b');
        const other = document.body.appendChild(document.createElement('div'));
        other.id = 'otherGrid';
        other.innerHTML = '<div class="row">' + col('x', 12) + '</div>';
        const second = GridEditor.create('#otherGrid', Object.assign({}, window.fixture.settings, { content_types: ['tinymce'], active_target: true }));
        q('#x > .ge-tools-drawer').click();
        const result = { first: target(), second: second.getActiveTarget() && second.getActiveTarget().id };
        second.destroy();
        other.remove();
        return result;
    `);
    t.check('two editors each have their own target, and a click in one clears the other\'s (AC-29; active-target-selection D18)',
        two.first === null && two.second === 'x', two);

    var errors = page.errors();
    t.check('the activation tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function apiTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var set = await page.eval(`
        start();
        const chained = ge().setActiveTarget('#b') === ge();
        const byNode = target();
        ge().setActiveTarget(q('#s'));
        const section = target();
        ge().setActiveTarget(null);
        return { chained: chained, byNode: byNode, section: section, cleared: target(), marked: marked(), changes: changes.map(function(c) { return c.target; }) };
    `);
    t.check('setActiveTarget takes a selector, a node, and null, each told once (AC-22)',
        set.chained && set.byNode === 'b' && set.section === 's' && set.cleared === null && set.marked === '' &&
        JSON.stringify(set.changes) === JSON.stringify(['b', 's', null]), set);

    var refused = await page.eval(`
        start();
        ge().setActiveTarget('#b');
        changes.length = 0;
        warnings.length = 0;
        ge().setActiveTarget(q('#myGrid'));
        ge().setActiveTarget('#nothing');
        ge().setActiveTarget(q('#b > .ge-tools-drawer'));
        return { target: target(), changes: changes.length, warnings: warnings.slice() };
    `);
    t.check('a node with no settings, the canvas or nothing warns and changes nothing (AC-23; active-target-selection AC-33)',
        refused.target === 'b' && refused.changes === 0 && refused.warnings.length === 3 &&
        refused.warnings.every(function(w) { return /setActiveTarget: .* is not a node of the canvas with settings/.test(w); }), refused);

    var off = await page.eval(`
        start({ active_target: false });
        ge().setActiveTarget('#b');
        ge().setActiveTarget('#b');
        return { target: ge().getActiveTarget(), marked: marked(), warnings: warnings.filter(function(w) { return /active_target/.test(w); }).length, changes: changes.length };
    `);
    t.check('with active_target off setActiveTarget warns once and does nothing, and getActiveTarget is null (AC-24)',
        off.target === null && off.marked === '' && off.warnings === 1 && off.changes === 0, off);

    var same = await page.eval(`
        start();
        clickIn('b');
        q('#b > .ge-tools-drawer > a').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        q('#b > .ge-tools-drawer > a').click();
        ge().setActiveTarget('#b');
        return changes.length;
    `);
    t.check('the same target again, by a tool of its drawer, the focus or setActiveTarget, says nothing (AC-25 rev v2)', same === 1, same);

    var toggled = await page.eval(`
        start();
        clickIn('b');
        clickIn('b');
        const byDrawer = { target: target(), marked: marked(), changes: changes.length };
        clickIn('b');
        q('#b').click();
        const byBackground = { target: target(), marked: marked(), changes: changes.length };
        clickIn('s');
        clickIn('s');
        const section = { target: target(), changes: changes.length };
        clickIn('b');
        q('#b > .ge-tools-drawer > a').click();
        const byTool = target();
        return { byDrawer: byDrawer, byBackground: byBackground, section: section, byTool: byTool,
            last: changes[changes.length - 1] && changes[changes.length - 1].target };
    `);
    t.check('the target\'s drawer or background clicked again takes it back; a tool in its drawer keeps it (AC-31)',
        toggled.byDrawer.target === null && toggled.byDrawer.marked === '' && toggled.byDrawer.changes === 2 &&
        toggled.byBackground.target === null && toggled.byBackground.changes === 4 &&
        toggled.section.target === null && toggled.section.changes === 6 &&
        toggled.byTool === 'b', toggled);

    var errors = page.errors();
    t.check('the api tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A target of any level (spec active-target-selection): what a click picks,
 * and where the toolbar and Ctrl+V put things inside it.
 */
var ANY_LEVEL = `
    /** A container of \`type\` made by the toolbar at the end of column #id. */
    window.addContainer = function(type, id) {
        ge().setActiveTarget('#' + id);
        q('.ge-mainControls [data-ge-container-type="' + type + '"]').click();
        return Array.from(q('#' + id).querySelectorAll(':scope > [data-ge-container="' + type + '"]')).pop();
    };
    window.inside = function(node) {
        return Array.from(node.children).filter(function(child) { return !child.matches('.ge-tools-drawer, .ge-resize-handle'); });
    };
    /** Ctrl+key on the page, after a press on the canvas says this is the editor in use. */
    window.press = function(letter) {
        q('#myGrid').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        const e = new KeyboardEvent('keydown', { key: letter, code: 'Key' + letter.toUpperCase(), ctrlKey: true, bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        return e.defaultPrevented;
    };
    window.ELEMENT_CANVAS = CANVAS + '<div class="row" id="r3">' + col('e', 12, '<blockquote data-ge-element="quote" id="el">Q</blockquote>') + '</div>';
    return true;
`;

async function anyLevelTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);
    await page.eval(ANY_LEVEL);

    var picked = await page.eval(`
        start({}, ELEMENT_CANVAS);
        const tabs = addContainer('tabs', 'a');
        changes.length = 0;
        clickOn(tabs);
        const container = { target: ge().getActiveTarget() === tabs, marked: tabs.classList.contains('ge-selected'), told: changes.length === 1 };
        clickIn('r1');
        const row = target();
        clickIn('el');
        const element = target();
        clickIn('s');
        const section = target();
        clickOn(tabs.querySelector('.ge-tab'));
        const pane = ge().getActiveTarget() === tabs.querySelector('.ge-tab');
        return { container: container, row: row, element: element, section: section, pane: pane, marks: qa('#myGrid .ge-selected').length };
    `);
    t.check('a click on a container\'s drawer makes the container the target, marked, and says so (AC-01)',
        picked.container.target && picked.container.marked && picked.container.told, picked);
    t.check('a click picks a row, an element, a section or a pane, one at a time (AC-02)',
        picked.row === 'r1' && picked.element === 'el' && picked.section === 's' && picked.pane && picked.marks === 1, picked);

    var again = await page.eval(`
        start();
        clickIn('r1');
        clickIn('r1');
        const byDrawer = target();
        clickIn('r1');
        q('#r1').click();
        return { byDrawer: byDrawer, byBackground: target() };
    `);
    t.check('a row\'s drawer or background clicked again takes it back (AC-03)', again.byDrawer === null && again.byBackground === null, again);

    var outside = await page.eval(`
        start({ settings_panel: 'offcanvas' });
        clickIn('b');
        q('.ge-mainControls').click();
        const toolbar = target();
        document.body.click();
        return { toolbar: toolbar, page: target() };
    `);
    t.check('a click on the toolbar keeps the target (AC-07)', outside.toolbar === 'b', outside);
    t.check('a click on the page outside the editor clears it, with the offcanvas panel too (AC-06)', outside.page === null, outside);

    var focused = await page.eval(`
        start({ settings_panel: 'popover' });
        q('#r1 > .ge-tools-drawer > a').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        return target();
    `);
    t.check('the focus coming into a row\'s drawer makes it the target, with the popover panel (AC-08)', focused === 'r1', focused);

    var escaped = await page.eval(`
        start();
        clickIn('r1');
        escape();
        return target();
    `);
    t.check('Escape clears a row target in one press (AC-09)', escaped === null, escaped);

    var rowInRow = await page.eval(`
        start();
        clickIn('r1');
        q('#myGrid').addEventListener('grideditor:before-add-column', function() { window.columnAdd = true; });
        window.columnAdd = false;
        window.befores = [];
        q('#myGrid').addEventListener('grideditor:before-add-text', function(e) { window.befores.push(e.detail.parent && e.detail.parent.id); });
        button.row('6,6').click();
        const last = inside(q('#r1')).pop();
        const row = { columns: inside(q('#r1')).length, isColumn: last.matches('.column'), holds: blocks(last), width: last.className };
        button.text().click();
        const textCol = inside(q('#r1')).pop();
        return { row: row, text: blocks(textCol), befores: befores.slice(), columnAdd: columnAdd, adds: adds.slice(), target: target() };
    `);
    t.check('a row added to a row target goes in a new column of it, of the add column width (AC-11)',
        rowInRow.row.columns === 3 && rowInRow.row.isColumn && rowInRow.row.holds === 'row:2' && /\bcol-12\b/.test(rowInRow.row.width), rowInRow);
    t.check('a text added to a row fires its own add with the row as parent, and no column add (AC-40)',
        rowInRow.text === 'text' && JSON.stringify(rowInRow.befores) === JSON.stringify(['r1']) && !rowInRow.columnAdd &&
        rowInRow.adds.every(function(add) { return add.parent === 'r1' && add.source === 'tool'; }) && rowInRow.target === 'r1', rowInRow);

    var rowCols = await page.eval(`
        start({}, '<div class="row row-cols-2" id="rc">' + col('p', 6) + '</div>');
        clickIn('rc');
        button.text().click();
        const last = inside(q('#rc')).pop();
        return { holds: blocks(last), sized: /\\bcol-(sm-|md-|lg-|xl-|xxl-)?\\d+\\b/.test(last.className), className: last.className };
    `);
    t.check('in a row with row-cols the new column has no width of its own (AC-12)', rowCols.holds === 'text' && !rowCols.sized, rowCols);

    var columns = await page.eval(`
        start();
        q('#b > .ge-tools-drawer > .ge-copy').click();
        clickIn('c');
        const intoColumn = press('v');
        const inC = inside(q('#c')).map(function(n) { return n.matches('.row') ? 'row:' + inside(n).map(function(c) { return /col-6/.test(c.className) ? '6' : c.className; }).join() : blocks({ children: [n] }); });
        clickIn('r1');
        press('v');
        const inRow = inside(q('#r1')).length;
        clickIn('s');
        press('v');
        return { intoColumn: intoColumn, inC: inC, inRow: inRow, s: blocks(q('#s')), lastInS: inside(inside(q('#s')).pop()).length };
    `);
    t.check('a column pasted into a column goes in a new row, keeping its width (AC-13)',
        columns.intoColumn && JSON.stringify(columns.inC) === JSON.stringify(['text', 'row:6']), columns);
    t.check('a column pasted into a row is added to the row as it is (AC-14)', columns.inRow === 3, columns);
    t.check('a column pasted into a section goes in a new row (AC-16)', columns.s === 'row:1,row:1' && columns.lastInS === 1, columns);

    var sectionAndPane = await page.eval(`
        start();
        clickIn('s');
        button.text().click();
        const section = blocks(q('#s'));
        const tabs = addContainer('tabs', 'a');
        const tab = tabs.querySelector('.ge-tab');
        clickOn(tab);
        button.text().click();
        const pane = q(tab.querySelector('.nav-link').getAttribute('data-bs-target'));
        return { section: section, pane: blocks(pane) };
    `);
    t.check('a text added to a section or a pane goes in a row and a column of its own (AC-15)',
        sectionAndPane.section === 'row:1,row:1' && sectionAndPane.pane === 'row:1,row:1', sectionAndPane);

    var textTarget = await page.eval(`
        start({}, ELEMENT_CANVAS);
        ge().setActiveTarget(textOf('a'));
        button.text().click();
        const afterText = blocks(q('#a'));
        button.row('6,6').click();
        const afterRow = blocks(q('#a'));
        const tabs = addContainer('tabs', 'b');
        tabs.querySelector(':scope > .ge-tools-drawer > .ge-copy').click();
        clickIn('el');
        const pasted = press('v');
        return { afterText: afterText, afterRow: afterRow, pasted: pasted, e: blocks(q('#e')) };
    `);
    t.check('with a text as the target, a text and a row go to the end of its column (AC-17)',
        textTarget.afterText === 'text,text' && textTarget.afterRow === 'text,text,row:2', textTarget);
    t.check('a container pasted onto an element goes to the end of the element\'s column (AC-18)',
        textTarget.pasted && /,tabs$/.test(textTarget.e), textTarget);

    var shown = await page.eval(`
        start({ plugins: window.fixture.plugins(['sections', 'clipboard', 'carousel', 'offcanvas']) });
        const tabs = addContainer('tabs', 'a');
        const panes = tabs.querySelectorAll(':scope > .tab-content > .tab-pane');
        panes.forEach(function(p) { p.classList.remove('active', 'show'); });
        panes[1].classList.add('active', 'show');
        clickOn(tabs);
        button.text().click();
        const tabsResult = [blocks(panes[0]), blocks(panes[1])];

        const accordion = addContainer('accordion', 'b');
        const collapses = accordion.querySelectorAll('.accordion-collapse');
        collapses.forEach(function(c) { c.classList.remove('show'); });
        collapses[collapses.length - 1].classList.add('show');
        clickOn(accordion);
        button.row('6,6').click();
        const openBody = collapses[collapses.length - 1].querySelector('.accordion-body');

        const bodies = {};
        ['popup', 'offcanvas', 'card', 'carousel'].forEach(function(type) {
            const made = addContainer(type, 'c');
            clickOn(made);
            button.row('6,6').click();
            const region = type === 'carousel' ? made.querySelector('.carousel-item.active') || made.querySelector('.carousel-item')
                : made.querySelector({ popup: '.modal-body', offcanvas: '.offcanvas-body', card: '.card-body' }[type]);
            bodies[type] = blocks(region);
        });

        collapses.forEach(function(c) { c.classList.remove('show'); });
        clickOn(accordion);
        button.text().click();
        const closed = blocks(q('#b'));
        return { tabs: tabsResult, accordion: blocks(openBody), bodies: bodies, closed: closed };
    `);
    t.check('a container target adds to the tab that is open (AC-19)',
        shown.tabs[0] === 'row:1' && shown.tabs[1] === 'row:1,row:1', shown);
    t.check('it adds to the open accordion item, the slide showing, and the body of a popup, an offcanvas or a card (AC-20)',
        shown.accordion === 'row:1,row:2' && ['popup', 'offcanvas', 'card', 'carousel'].every(function(type) { return shown.bodies[type] === 'row:1,row:2'; }), shown);
    t.check('an accordion with every item closed adds to its column (AC-21)', /accordion,text$/.test(shown.closed), shown);

    var section = await page.eval(`
        start();
        clickIn('r1');
        button.section().click();
        const fromRow = blocks(q('#myGrid'));
        ge().setActiveTarget(textOf('c'));
        button.section().click();
        return { fromRow: fromRow, fromText: blocks(q('#myGrid')), r1Next: q('#r1').nextElementSibling.matches('.container'), r2Next: q('#r2').nextElementSibling.matches('.container') };
    `);
    t.check('a section with a row or a text as the target goes to the canvas after its top level block (AC-22)',
        section.fromRow === 'row:2,section,row:1,section' && section.r1Next && section.r2Next, section);

    var canceled = await page.eval(`
        start();
        clickIn('r1');
        const cancel = function(e) { e.preventDefault(); };
        q('#myGrid').addEventListener('grideditor:before-add-text', cancel);
        button.text().click();
        q('#myGrid').removeEventListener('grideditor:before-add-text', cancel);
        return { columns: inside(q('#r1')).length, target: target() };
    `);
    t.check('a canceled add into a row adds no column either, and the target stays (AC-24)',
        canceled.columns === 2 && canceled.target === 'r1', canceled);

    var copied = await page.eval(`
        start();
        const tabs = addContainer('tabs', 'a');
        clickOn(tabs);
        copies = [];
        q('#myGrid').addEventListener('grideditor:after-copy', function(e) { copies.push(e.detail.source + ':' + e.detail.kind); });
        const taken = press('c');
        const clip = JSON.parse(localStorage.getItem('grideditor.clipboard') || 'null');
        clickOn(tabs.querySelector('.ge-tab'));
        localStorage.removeItem('grideditor.clipboard');
        const pane = press('c');
        ge().setActiveTarget(null);
        const none = [press('c'), press('v')];
        return { taken: taken, category: clip && clip.category, copies: copies, pane: pane, stored: localStorage.getItem('grideditor.clipboard'), none: none };
    `);
    t.check('Ctrl+C copies a container target, from the shortcut (AC-25)',
        copied.taken && copied.category === 'container' && copied.copies[0] === 'shortcut:tabs', copied);
    t.check('Ctrl+C on a pane copies nothing and leaves the key to the browser (AC-26)', !copied.pane && copied.stored === null, copied);
    t.check('with no target Ctrl+C and Ctrl+V do nothing (AC-27)', !copied.none[0] && !copied.none[1], copied);

    var api = await page.eval(`
        start();
        ge().setActiveTarget(textOf('a'));
        const text = ge().getActiveTarget() === textOf('a');
        ge().setActiveTarget('#r1');
        return { text: text, row: target(), getSelected: typeof ge().getSelected, setSelected: typeof ge().setSelected };
    `);
    t.check('setActiveTarget takes a text and a row selector (AC-32)', api.text && api.row === 'r1', api);
    t.check('getSelected and setSelected are gone (AC-30)', api.getSelected === 'undefined' && api.setSelected === 'undefined', api);

    var off = await page.eval(`
        start({ active_target: false });
        clickIn('r1');
        return { target: ge().getActiveTarget(), marked: marked() };
    `);
    t.check('with active_target off a click on a row picks nothing (AC-34)', off.target === null && off.marked === '', off);

    var html = await page.eval(`
        start();
        clickIn('r1');
        const saved = ge().getHtml();
        return { leaked: /ge-selected/.test(saved), marked: marked() };
    `);
    t.check('getHtml has no ge-selected, and a row target keeps its mark (AC-35)', !html.leaked && html.marked === 'r1', html);

    var gear = await page.eval(`
        start({ settings_panel: 'offcanvas' });
        clickIn('b');
        q('#r1 > .ge-tools-drawer > .ge-settings').click();
        await sleep(400);
        return { target: target(), selected: q('#r1').classList.contains('ge-selected'), settings: q('#r1').classList.contains('ge-settings-target') };
    `);
    t.check('the gear of a row makes it the target and opens its panel, with both marks (AC-39)',
        gear.target === 'r1' && gear.selected && gear.settings, gear);

    var tool = await page.eval(`
        start();
        clickIn('b');
        q('#b > .ge-tools-drawer > .ge-copy').click();
        return target();
    `);
    t.check('a tool of the target\'s own drawer keeps it (AC-41)', tool === 'b', tool);

    var errors = page.errors();
    t.check('the any level tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Only the sidebar turns active_target on: the other panels keep what the
 * host gave (spec sidebar-active-target).
 */
async function panelTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var offcanvas = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: undefined });
        clickIn('b');
        return { target: ge().getActiveTarget(), marked: marked() };
    `);
    t.check('with offcanvas and no active_target a click makes no target (sidebar-active-target AC-06)',
        offcanvas.target === null && offcanvas.marked === '', offcanvas);

    var off = await page.eval(`
        let error = null;
        try { start({ settings_panel: 'offcanvas', active_target: false }); } catch (e) { error = e; }
        return { thrown: !!error, editor: !!ge(), setting: ge() && ge().settings.active_target };
    `);
    t.check('offcanvas with active_target false is no error (sidebar-active-target AC-07)',
        !off.thrown && off.editor && off.setting === false, off);

    var popover = await page.eval(`
        start({ settings_panel: 'popover' });
        clickIn('b');
        button.text().click();
        return { target: target(), b: blocks(q('#b')), warnings: warnings.length };
    `);
    t.check('popover with active_target true behaves as before (sidebar-active-target AC-15)',
        popover.target === 'b' && popover.b === 'text,text' && popover.warnings === 0, popover);

    var errors = page.errors();
    t.check('the panel tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'activetarget',
    description: 'the active target: where the toolbar adds, chosen by a click on any node with settings',
    run: async function(t) {
        await placementTests(t);
        await activationTests(t);
        await apiTests(t);
        await anyLevelTests(t);
        await panelTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['activetarget']);
}
