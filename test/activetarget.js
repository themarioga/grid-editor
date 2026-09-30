/**
 * Browser tests for the active target: with active_target on, a click in a
 * column or a section makes it where the toolbar's buttons add, as a drop at
 * its end would.
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
    window.marked = function() { return qa('#myGrid .ge-active-target').map(function(node) { return node.id || 'new'; }).join(','); };
    /** A click in a column or a section, on its drawer: what a click on its background does. */
    window.clickIn = function(id) { q('#' + id + ' > .ge-tools-drawer').click(); };
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
    var onText = await page.eval(`return { target: target(), started: fakeTinymce.started };`);
    t.check('a click on a text opens its editor and makes its column the target (AC-10)',
        onText.target === 'c' && onText.started > 0, onText);

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
        q('#r1 > .ge-tools-drawer').click();
        return { target: target(), changes: changes.slice(), marked: marked() };
    `);
    t.check('a click in the canvas on no column or section clears the target (AC-13)',
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
    t.check('deleting the target, or the row it is in, clears it and says so (AC-16)',
        deleted.column.gone && deleted.column.target === null && deleted.column.changes.length === 1 && deleted.column.changes[0].from === 'a' &&
        deleted.row.gone && deleted.row.target === null && deleted.row.changes.length === 1 && deleted.row.changes[0].from === 'c', deleted);

    var html = await page.eval(`
        start();
        clickIn('b');
        const saved = ge().getHtml();
        return { leaked: /ge-active-target/.test(saved), target: target(), marked: marked() };
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
    await page.drag('.ge-addRowGroup a[data-ge-layout="12"]', '#c .ge-content', { yRatio: 0.9 });
    var dropped = await page.eval(`return { c: blocks(q('#c')), target: target(), changes: changes.length, a: blocks(q('#a')) };`);
    t.check('a toolbar button dropped somewhere goes there, and the target stays (AC-20)',
        dropped.c === 'text,row:1' && dropped.a === 'text' && dropped.target === 'a' && dropped.changes === 0, dropped);

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
        return { leaked: /ge-active-target/.test(q('#myGrid').innerHTML), changes: changes.length };
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
    t.check('two editors each keep their own target (AC-29)', two.first === 'b' && two.second === 'x', two);

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
        ge().setActiveTarget(q('#r1'));
        ge().setActiveTarget('#nothing');
        return { target: target(), changes: changes.length, warnings: warnings.slice() };
    `);
    t.check('a node that is not a column or a region warns and changes nothing (AC-23)',
        refused.target === 'b' && refused.changes === 0 && refused.warnings.length === 2 &&
        refused.warnings.every(function(w) { return /setActiveTarget: .* is not a column or a region of the canvas/.test(w); }), refused);

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
        clickIn('b');
        ge().setActiveTarget('#b');
        return changes.length;
    `);
    t.check('the same target again, by click or by setActiveTarget, says nothing (AC-25)', same === 1, same);

    var errors = page.errors();
    t.check('the api tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'activetarget',
    description: 'the active target: where the toolbar adds, chosen by a click in a column or a section',
    run: async function(t) {
        await placementTests(t);
        await activationTests(t);
        await apiTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['activetarget']);
}
