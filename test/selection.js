/**
 * Browser tests for the selection of settings_panel 'sidebar': which node a
 * click or the focus selects, what deselects, and getSelected/setSelected
 * with the selection-change event (spec permanent-settings-panel, AC-04 to
 * AC-23 and AC-54 to AC-59). test/sidebar.js has the sidebar itself.
 *
 * The texts use a stand-in for tinyMCE, as test/texts.js does, so a click on
 * a text opens it.
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
        init: function(config) {
            const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {}, remove: function() {} };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.tinymce = window.fakeTinymce;

    // The plugin handle, for what only a plugin can do: open the dialog, ask in the confirm modal
    GridEditor.features.handle = function(ge) { window.handle = ge; return {}; };

    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    window.text = function(html) {
        return '<div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">' + html + '</div>';
    };
    window.col = function(id, size) {
        return '<div class="column col-' + size + '" id="' + id + '">' + text('<p>' + id + '</p>') + '</div>';
    };
    window.CANVAS = '<div class="row" id="r1">' + col('a', 6) + col('b', 6) + '</div>';

    /** A fresh editor with the sidebar, with the selection changes logged. */
    window.start = function(overrides) {
        if (ge()) { ge().destroy(); }
        window.warnings = [];
        window.changes = [];
        const grid = q('#myGrid');
        grid.innerHTML = CANVAS;
        if (window.onChange) { grid.removeEventListener('grideditor:selection-change', window.onChange); }
        window.onChange = function(e) {
            window.changes.push({ node: id(e.detail.node), from: id(e.detail.from), canvas: e.detail.canvas === grid });
        };
        grid.addEventListener('grideditor:selection-change', window.onChange);
        return window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            settings_panel: 'sidebar',
            confirm_delete: false,
            plugins: window.fixture.plugins(['handle']),
        }, overrides || {}));
    };

    /** A node by its id, a text by its column's id and ':text'. */
    window.id = function(node) {
        if (!node) { return null; }
        if (node.matches('.ge-content')) { return node.closest('.column').id + ':text'; }
        return node.id || node.className;
    };
    window.selected = function() { return id(ge().getSelected()); };
    window.marked = function() { return qa('.ge-settings-target').map(id).join(','); };
    window.sidebar = function() { return q('.ge-settings-sidebar'); };
    window.title = function() { return sidebar().querySelector('.ge-settings-title').textContent; };
    window.inSidebar = function(node) { return ge().getSelected() === node && !!sidebar().querySelector('.ge-settings-body > .ge-details'); };
    window.home = function(id) { return !!q('#' + id + ' > .ge-tools-drawer > .ge-details'); };
    window.escape = function(on) {
        (on || document).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    };
    /** A press at one point and the click it ends in, \`dx\` and \`dy\` away. */
    window.pressAndClick = function(node, dx, dy) {
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
        node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100 + dx, clientY: 100 + dy }));
    };
    return true;
`;

async function clickTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var column = await page.eval(`
        start();
        q('#a').click();
        return { selected: selected(), title: title(), marked: marked(), inSidebar: inSidebar(q('#a')), home: home('a'), changes: changes.slice() };
    `);
    t.check('a click on a column shows its panel in the sidebar, titled after it, outlines it and says so (AC-04)',
        column.selected === 'a' && column.title === 'Column settings' && column.marked === 'a' && column.inSidebar && !column.home &&
        JSON.stringify(column.changes) === JSON.stringify([{ node: 'a', from: null, canvas: true }]), column);

    var inText = await page.eval(`
        start();
        q('#a .ge-content p').click();
        return { selected: selected(), marked: marked() };
    `);
    t.check('a click inside a text selects the text, the innermost node with settings, not its column (AC-05)',
        inText.selected === 'a:text' && inText.marked === 'a:text', inText);

    var drawer = await page.eval(`
        start();
        q('#r1 > .ge-tools-drawer').click();
        return { selected: selected(), title: title() };
    `);
    t.check('a click on a row\u2019s drawer selects the row (AC-06)',
        drawer.selected === 'r1' && drawer.title === 'Row settings', drawer);

    var other = await page.eval(`
        start();
        q('#a').click();
        changes.length = 0;
        q('#b').click();
        return { selected: selected(), marked: marked(), aHome: home('a'), bHome: home('b'), inSidebar: inSidebar(q('#b')), changes: changes.slice() };
    `);
    t.check('a click on another column puts the first one\u2019s panel back in its drawer and shows the other\u2019s (AC-07)',
        other.selected === 'b' && other.marked === 'b' && other.aHome && !other.bHome && other.inSidebar &&
        JSON.stringify(other.changes) === JSON.stringify([{ node: 'b', from: 'a', canvas: true }]), other);

    var again = await page.eval(`
        start();
        q('#a').click();
        changes.length = 0;
        q('#a').click();
        return { selected: selected(), changes: changes.length };
    `);
    t.check('a click on the selected column again keeps it, and says nothing (AC-08)',
        again.selected === 'a' && again.changes === 0, again);

    var threshold = await page.eval(`
        const result = {};
        [[4, 2, 2], [3, 3, 0], [2, 1, 1]].forEach(function(move) {
            start({ drag: { threshold: 3 } });
            q('#a').click();
            pressAndClick(q('#b'), move[1], move[2]);
            result[move[0]] = selected();
        });
        return result;
    `);
    t.check('a click whose press was 4px away, counted along both axes, is the end of a drag and selects nothing (AC-09)',
        threshold[4] === 'a', threshold);
    t.check('3px away is still a click, and selects (AC-10)', threshold[3] === 'b', threshold);
    t.check('2px away is a click, and selects (AC-11)', threshold[2] === 'b', threshold);

    var target = await page.eval(`
        start({ active_target: true });
        q('#a').click();
        return { selected: selected(), target: id(ge().getActiveTarget()) };
    `);
    t.check('with active_target a click on a column selects it and makes it the target (AC-12)',
        target.selected === 'a' && target.target === 'a', target);

    var background = await page.eval(`
        start();
        q('#a').click();
        changes.length = 0;
        q('#myGrid').click();
        return { selected: selected(), marked: marked(), changes: changes.slice() };
    `);
    t.check('a click on the canvas\u2019s background deselects (AC-17)',
        background.selected === null && background.marked === '' &&
        JSON.stringify(background.changes) === JSON.stringify([{ node: null, from: 'a', canvas: true }]), background);

    var close = await page.eval(`
        start();
        q('#a').click();
        sidebar().querySelector('.ge-settings-close').click();
        return { selected: selected(), message: sidebar().querySelector('.ge-sidebar-empty') !== null };
    `);
    t.check('the sidebar\u2019s close button deselects (AC-18)', close.selected === null && close.message, close);

    var outside = await page.eval(`
        start();
        q('#a').click();
        const away = document.body.appendChild(document.createElement('div'));
        away.textContent = 'away';
        away.click();
        away.remove();
        return selected();
    `);
    t.check('a click on the page outside the canvas and the editor deselects (AC-19)', outside === null, outside);

    var controls = await page.eval(`
        start();
        q('#a').click();
        const result = {};
        q('.ge-mainControls').click();
        result.toolbar = selected();
        const more = q('.ge-mainControls .ge-toolbar-more');
        result.hasMenu = !!more;
        if (more) { more.click(); }
        result.menu = selected();
        const picker = document.body.appendChild(document.createElement('div'));
        picker.className = 'ge-size-picker';
        picker.click();
        picker.remove();
        result.picker = selected();
        handle.openDialog('A dialog', document.createElement('div'));
        await sleep(400);
        q('.ge-dialog .modal-body').click();
        result.dialog = selected();
        handle.closeDialog();
        await sleep(400);
        handle.confirm('Sure?', {}, function() {});
        await sleep(400);
        q('.ge-confirm .ge-confirm-message').click();
        result.confirm = selected();
        q('.ge-confirm .ge-confirm-cancel').click();
        await sleep(400);
        sidebar().querySelector('.ge-settings-body').click();
        result.sidebar = selected();
        q('.ge-sidebar-toggle').click();
        q('.ge-sidebar-toggle').click();
        result.toggle = selected();
        return result;
    `);
    t.check('a click on the toolbar, its menu, the size picker, the dialog, the confirmation, the sidebar or its button keeps the selection (AC-20)',
        controls.hasMenu && ['toolbar', 'menu', 'picker', 'dialog', 'confirm', 'sidebar', 'toggle'].every(function(key) {
            return controls[key] === 'a';
        }), controls);

    var openText = await page.eval(`
        start();
        q('#a .ge-content').click();
        const open = !!q('#myGrid .ge-rte-active');
        const away = document.body.appendChild(document.createElement('div'));
        away.click();
        away.remove();
        return { open: open, selected: selected() };
    `);
    t.check('with a text open, a click outside the canvas - its editor\u2019s toolbar, say - keeps the selection (AC-21)',
        openText.open && openText.selected === 'a:text', openText);

    var errors = page.errors();
    t.check('the click tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function keyboardTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    // A page in the background gets no focus events, and its modals' transitions do not end
    await page.send('Page.bringToFront');
    await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await page.eval(SETUP);

    var escaped = await page.eval(`
        start();
        q('#a').click();
        document.activeElement.blur();
        changes.length = 0;
        escape();
        return { selected: selected(), message: !!sidebar().querySelector('.ge-sidebar-empty'), changes: changes.slice() };
    `);
    t.check('Escape deselects: the sidebar shows its message, and says so (AC-13)',
        escaped.selected === null && escaped.message &&
        JSON.stringify(escaped.changes) === JSON.stringify([{ node: null, from: 'a', canvas: true }]), escaped);

    var twice = await page.eval(`
        start({ active_target: true });
        q('#a').click();
        document.activeElement.blur();
        escape();
        const first = { selected: selected(), target: id(ge().getActiveTarget()) };
        escape();
        return { first: first, second: { selected: selected(), target: id(ge().getActiveTarget()) } };
    `);
    t.check('with a target too, the first Escape deselects and the second clears the target (AC-14)',
        twice.first.selected === null && twice.first.target === 'a' && twice.second.target === null, twice);

    var dialog = await page.eval(`
        start();
        q('#a').click();
        handle.openDialog('A dialog', document.createElement('div'));
        // Bootstrap ignores Escape until the modal has finished fading in
        await sleep(800);
        escape(q('.ge-dialog'));
        await sleep(600);
        return { dialog: !!q('.ge-dialog.show'), selected: selected() };
    `);
    t.check('Escape with a dialog open closes the dialog and keeps the selection (AC-15)',
        !dialog.dialog && dialog.selected === 'a', dialog);

    var field = await page.eval(`
        start();
        q('#a').click();
        sidebar().querySelector('.ge-id').focus();
        escape();
        return selected();
    `);
    t.check('Escape with the focus in a field of the panel keeps the selection (AC-16)', field === 'a', field);

    var focused = await page.eval(`
        start();
        document.activeElement.blur();
        const move = q('#r1 > .ge-tools-drawer .ge-move');
        move.tabIndex = 0;
        move.focus();
        return { selected: selected(), focused: document.activeElement === move };
    `);
    t.check('the focus coming into the move tool of a row\u2019s drawer selects the row (AC-22)',
        focused.focused && focused.selected === 'r1', focused);

    var inPanel = await page.eval(`
        start();
        q('#r1 > .ge-tools-drawer').click();
        changes.length = 0;
        sidebar().querySelector('.ge-classes').focus();
        return { selected: selected(), changes: changes.length };
    `);
    t.check('the focus going to a field in the sidebar keeps the selection (AC-23)',
        inPanel.selected === 'r1' && inPanel.changes === 0, inPanel);

    var errors = page.errors();
    t.check('the keyboard tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function apiTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var set = await page.eval(`
        start();
        const chained = ge().setSelected(q('#b')) === ge();
        return { chained: chained, selected: selected(), inSidebar: inSidebar(q('#b')), changes: changes.slice() };
    `);
    t.check('setSelected selects a column of the canvas, says so, and getSelected gives it back (AC-54)',
        set.chained && set.selected === 'b' && set.inSidebar &&
        JSON.stringify(set.changes) === JSON.stringify([{ node: 'b', from: null, canvas: true }]), set);

    var cleared = await page.eval(`
        start();
        ge().setSelected('#a').setSelected(null);
        return { selected: ge().getSelected(), message: !!sidebar().querySelector('.ge-sidebar-empty') };
    `);
    t.check('setSelected(null) deselects (AC-55)', cleared.selected === null && cleared.message, cleared);

    var refused = await page.eval(`
        start();
        ge().setSelected('#a');
        changes.length = 0;
        ge().setSelected('#no-such-node');
        const stray = document.body.appendChild(document.createElement('div'));
        ge().setSelected(stray);
        stray.remove();
        ge().setSelected(q('#a .ge-content p'));
        return { selected: selected(), changes: changes.length, warned: warnings.filter(function(w) { return /setSelected/.test(w); }).length };
    `);
    t.check('setSelected with no node, one outside the canvas, or one with no settings warns and changes nothing (AC-56)',
        refused.selected === 'a' && refused.changes === 0 && refused.warned === 3, refused);

    var offcanvas = await page.eval(`
        start({ settings_panel: 'offcanvas' });
        ge().setSelected('#a');
        ge().setSelected('#b');
        return {
            selected: ge().getSelected(),
            marked: marked(),
            changes: changes.length,
            warned: warnings.filter(function(w) { return /setSelected/.test(w); }).length,
        };
    `);
    t.check('without the sidebar setSelected warns once and does nothing, and getSelected is null (AC-57)',
        offcanvas.selected === null && offcanvas.marked === '' && offcanvas.changes === 0 && offcanvas.warned === 1, offcanvas);

    var kept = await page.eval(`
        start();
        ge().deinit();
        ge().setSelected('#a');
        const away = { selected: selected(), marked: marked() };
        ge().init();
        await sleep(0);
        return { away: away, selected: selected(), inSidebar: inSidebar(q('#a')), title: title() };
    `);
    t.check('out of editing setSelected keeps the node, which the sidebar shows when editing starts again (AC-58)',
        kept.away.selected === 'a' && kept.away.marked === '' && kept.selected === 'a' && kept.inSidebar &&
        kept.title === 'Column settings', kept);

    var callback = await page.eval(`
        window.called = [];
        start({ callbacks: { selection_change: function(payload) { window.called.push(payload); } } });
        let event = null;
        const grab = function(e) { event = e.detail; };
        q('#myGrid').addEventListener('grideditor:selection-change', grab);
        q('#a').click();
        q('#myGrid').removeEventListener('grideditor:selection-change', grab);
        return {
            calls: called.length,
            same: called[0] === event || (called[0].node === event.node && called[0].from === event.from && called[0].canvas === event.canvas),
            node: id(called[0].node),
        };
    `);
    t.check('callbacks.selection_change gets what the event carries (AC-59)',
        callback.calls === 1 && callback.same && callback.node === 'a', callback);

    var errors = page.errors();
    t.check('the API tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'selection',
    description: 'settings_panel sidebar: what a click, the focus and the API select',
    run: async function(t) {
        await clickTests(t);
        await keyboardTests(t);
        await apiTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['selection']);
}
