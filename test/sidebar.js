/**
 * Browser tests for settings_panel 'sidebar': the panel that stays on the
 * right while editing - no gears, the room it takes, folding it away, the
 * window's width, the editor's lifecycle, and one sidebar per page (spec
 * permanent-settings-panel, AC-01 to AC-03, AC-24 to AC-42, AC-51 to AC-53
 * and AC-61). test/selection.js has what selects a node.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.tinymce = {
        init: function(config) {
            const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {}, remove: function() {} };
            config.init_instance_callback.call(editor, editor);
        },
    };

    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
    window.text = function(html) {
        return '<div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">' + html + '</div>';
    };
    window.CANVAS =
        '<div class="row" id="r1">' +
            '<div class="column col-6" id="a">' + text('<p>A</p>') + '</div>' +
            '<div class="column col-6" id="b"><div data-ge-element="quote" id="el"><blockquote>Q</blockquote></div></div>' +
        '</div>' +
        '<div class="container" id="s"><div class="row"><div class="column col-12" id="sc">' + text('<p>S</p>') + '</div></div></div>';

    window.start = function(overrides, html) {
        if (ge()) { ge().destroy(); }
        window.warnings = [];
        window.changes = [];
        const grid = q('#myGrid');
        grid.innerHTML = html === undefined ? CANVAS : html;
        if (window.onChange) { grid.removeEventListener('grideditor:selection-change', window.onChange); }
        window.onChange = function(e) { window.changes.push({ node: e.detail.node && e.detail.node.id, from: e.detail.from && e.detail.from.id }); };
        grid.addEventListener('grideditor:selection-change', window.onChange);
        return window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            settings_panel: 'sidebar',
            confirm_delete: false,
            drawer_overflow: 'wrap',
            plugins: window.fixture.plugins(['sections']),
        }, overrides || {}));
    };

    window.sidebar = function() { return q('.ge-settings-sidebar'); };
    window.toggle = function() { return q('.ge-sidebar-toggle'); };
    window.reserved = function() { return document.documentElement.classList.contains('ge-sidebar-open'); };
    window.selected = function() { const node = ge().getSelected(); return node ? node.id : null; };
    window.inSidebar = function() { return !!sidebar().querySelector('.ge-settings-body > .ge-details'); };
    window.home = function(id) { return !!q('#' + id + ' > .ge-tools-drawer > .ge-details'); };

    /** Every drawer of the canvas, in order, as the classes of its tools. */
    window.drawerTools = function() {
        return qa('#myGrid .ge-tools-drawer').map(function(drawer) {
            return Array.from(drawer.children).filter(function(child) {
                return !child.matches('.ge-details');
            }).map(function(child) { return child.className; }).join(' ');
        });
    };

    /** Where the sidebar and its button are, and what the button says. */
    window.layout = function() {
        const panel = sidebar().getBoundingClientRect();
        const button = toggle().getBoundingClientRect();
        return {
            show: sidebar().classList.contains('show'),
            reserved: reserved(),
            panelLeft: Math.round(panel.left),
            panelWidth: Math.round(panel.width),
            buttonLeft: Math.round(button.left),
            buttonRight: Math.round(button.right),
            buttonMiddle: Math.round(button.top + button.height / 2),
            windowMiddle: Math.round(innerHeight / 2),
            width: innerWidth,
            visible: getComputedStyle(toggle()).display !== 'none',
            icon: toggle().querySelector('i').className,
            expanded: toggle().getAttribute('aria-expanded'),
            label: toggle().getAttribute('aria-label'),
        };
    };
    return true;
`;

/** The window this wide, and the resize the page gets for it. */
async function width(page, pixels) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: pixels, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.waitFor('innerWidth === ' + pixels, { label: 'a window ' + pixels + 'px wide' });
    // The resize event comes with the next frame
    await page.eval(`await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); }); return true;`);
}

async function newPage(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    // In the background a page's transitions do not run, and the sidebar slides
    await page.send('Page.bringToFront');
    await page.eval(SETUP);
    return page;
}

async function markupTests(t) {
    var page = await newPage(t);
    await width(page, 1200);

    var started = await page.eval(`
        start();
        return {
            show: sidebar().classList.contains('show'),
            title: sidebar().querySelector('.ge-settings-title').textContent,
            message: (sidebar().querySelector('.ge-sidebar-empty') || {}).textContent,
            reserved: reserved(),
        };
    `);
    t.check('editing starts with the sidebar open, titled Settings, with its message, and the page making room (AC-01)',
        started.show && started.title === 'Settings' && started.message === 'Click an element to see its settings' && started.reserved,
        started);

    var gears = await page.eval(`
        const build = function(mode) {
            start({ settings_panel: mode });
            ge().createContainer('tabs', { appendTo: '#b' });
            return drawerTools();
        };
        const offcanvas = build('offcanvas');
        const sidebarTools = build('sidebar');
        return {
            offcanvas: offcanvas,
            sidebar: sidebarTools,
            // A drawer of each kind of node with settings, by its delete tool
            kinds: ['row', 'column', 'container', 'pane', 'element', 'section', 'text'].map(function(kind) {
                return !!q('#myGrid .ge-tools-drawer > .ge-delete-' + kind);
            }),
            gears: qa('#myGrid .ge-settings').length,
        };
    `);
    t.check('with the sidebar no drawer has a gear - rows, columns, containers, panes, elements, sections, texts - and the rest of each drawer’s tools are as they were, in their order (AC-02)',
        gears.gears === 0 && gears.kinds.every(Boolean) && gears.sidebar.length === gears.offcanvas.length &&
        gears.offcanvas.every(function(tools, i) {
            return tools.indexOf('ge-settings') !== -1 &&
                tools.split(' ').filter(function(name) { return name !== 'ge-settings'; }).join(' ') === gears.sidebar[i];
        }), gears);

    var others = await page.eval(`
        return ['offcanvas', 'popover', 'modal', 'inline'].map(function(mode) {
            start({ settings_panel: mode });
            return {
                mode: mode,
                gears: qa('#myGrid .ge-tools-drawer > .ge-settings').length,
                drawers: qa('#myGrid .ge-tools-drawer').length,
                sidebar: !!sidebar() || !!toggle(),
                reserved: reserved(),
            };
        });
    `);
    t.check('the other four settings_panel values keep a gear in every drawer, and have no sidebar (AC-03)',
        others.every(function(mode) { return mode.gears === mode.drawers && mode.gears > 0 && !mode.sidebar && !mode.reserved; }), others);

    var section = await page.eval(`
        start({ plugins: window.fixture.plugins(['sections', 'inline-style']) });
        ge().setSelected('#a');
        const holder = sidebar().querySelector('.ge-panel-section[data-ge-plugin="inline-style"]');
        return {
            there: !!holder,
            title: !!(holder && holder.querySelector(':scope > .ge-section-title')),
            button: !!(holder && holder.querySelector('.ge-panel-section-open')),
            dialog: !!q('.ge-dialog.show'),
        };
    `);
    t.check('a plugin’s section is in the sidebar with its title, with no button and no dialog (AC-42)',
        section.there && section.title && !section.button && !section.dialog, section);

    var aria = await page.eval(`
        start();
        const empty = { role: sidebar().getAttribute('role'), label: sidebar().getAttribute('aria-label') };
        ge().setSelected('#a');
        return {
            empty: empty,
            selectedLabel: sidebar().getAttribute('aria-label'),
            controls: toggle().getAttribute('aria-controls') === sidebar().id && !!sidebar().id,
        };
    `);
    t.check('the sidebar is complementary, labelled with its title, and its button controls it by id (AC-61)',
        aria.empty.role === 'complementary' && aria.empty.label === 'Settings' && aria.selectedLabel === 'Column settings' && aria.controls,
        aria);

    var errors = page.errors();
    t.check('the markup tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function foldTests(t) {
    var page = await newPage(t);
    await width(page, 1200);

    await page.eval(`start(); ge().setSelected('#a'); toggle().click(); return true;`);
    await t.sleep(500);
    var folded = await page.eval(`return Object.assign(layout(), { selected: selected() });`);
    t.check('the button folds the sidebar away: the page has its room back, and the button stays on the window’s edge, pointing left (AC-24)',
        !folded.show && !folded.reserved && folded.panelLeft >= folded.width && folded.visible &&
        folded.buttonRight === folded.width && folded.icon === 'bi bi-chevron-left' && folded.expanded === 'false' &&
        folded.label === 'Show settings' && folded.selected === 'a', folded);

    await page.eval(`toggle().click(); return true;`);
    await t.sleep(500);
    var unfolded = await page.eval(`return Object.assign(layout(), { selected: selected(), inSidebar: inSidebar() });`);
    t.check('the button brings it back with what it showed, on its left edge and centred, pointing right (AC-25)',
        unfolded.show && unfolded.reserved && unfolded.inSidebar && unfolded.selected === 'a' &&
        unfolded.panelWidth === 340 && unfolded.buttonRight === unfolded.panelLeft &&
        Math.abs(unfolded.buttonMiddle - unfolded.windowMiddle) <= 1 &&
        unfolded.icon === 'bi bi-chevron-right' && unfolded.expanded === 'true' && unfolded.label === 'Hide settings', unfolded);

    var clicked = await page.eval(`
        start();
        toggle().click();
        q('#a').click();
        return { selected: selected(), show: sidebar().classList.contains('show'), inSidebar: inSidebar() };
    `);
    t.check('a click on a node with the sidebar folded away selects it, and leaves it folded (AC-26)',
        clicked.selected === 'a' && !clicked.show && clicked.inSidebar, clicked);

    var widths = {};
    for (var pixels of [575, 576, 577]) {
        await width(page, pixels);
        widths[pixels] = await page.eval(`start(); return { show: sidebar().classList.contains('show'), reserved: reserved() };`);
    }
    t.check('editing starts in a window 575px wide with the sidebar folded away, and no room made (AC-27)',
        !widths[575].show && !widths[575].reserved, widths);
    t.check('576px wide it starts open, with room made (AC-28)', widths[576].show && widths[576].reserved, widths);
    t.check('577px wide it starts open, with room made (AC-29)', widths[577].show && widths[577].reserved, widths);

    await width(page, 575);
    await page.eval(`start(); toggle().click(); return true;`);
    await t.sleep(500);
    var narrow = await page.eval(`return layout();`);
    t.check('575px wide and opened with its button, the sidebar covers the page edge to edge and makes no room (AC-30)',
        narrow.show && !narrow.reserved && narrow.panelLeft === 0 && narrow.panelWidth === 575 &&
        narrow.buttonLeft >= 0 && narrow.buttonRight <= 575, narrow);

    await width(page, 1200);
    await page.eval(`start(); return true;`);
    await width(page, 575);
    var shrunk = await page.eval(`return { show: sidebar().classList.contains('show'), reserved: reserved() };`);
    t.check('the window narrowing to 575px takes the room back, and the sidebar stays open, over the page (AC-31)',
        shrunk.show && !shrunk.reserved, shrunk);

    await page.eval(`start(); return true;`);
    await width(page, 1200);
    var grown = await page.eval(`return { show: sidebar().classList.contains('show'), reserved: reserved() };`);
    t.check('the window widening to 1200px leaves a folded sidebar folded, with no room made (AC-32)',
        !grown.show && !grown.reserved, grown);

    var errors = page.errors();
    t.check('the folding tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function lifecycleTests(t) {
    var page = await newPage(t);
    await width(page, 1200);

    var off = await page.eval(`
        start();
        ge().setSelected('#a');
        toggle().click();
        changes.length = 0;
        ge().deinit();
        return {
            sidebar: getComputedStyle(sidebar()).display,
            toggle: getComputedStyle(toggle()).display,
            reserved: reserved(),
            marked: qa('.ge-settings-target').length,
            inSidebar: inSidebar(),
            selected: selected(),
        };
    `);
    t.check('deinit hides the sidebar and its button, takes the room and the outline back, and puts the panel back (AC-33)',
        off.sidebar === 'none' && off.toggle === 'none' && !off.reserved && off.marked === 0 && !off.inSidebar && off.selected === 'a', off);

    var back = await page.eval(`
        ge().init();
        await sleep(0);
        const folded = { show: sidebar().classList.contains('show'), reserved: reserved(), visible: getComputedStyle(toggle()).display !== 'none' };
        toggle().click();
        return {
            folded: folded,
            selected: selected(),
            inSidebar: inSidebar(),
            marked: qa('.ge-settings-target').map(function(node) { return node.id; }).join(','),
            reserved: reserved(),
            changes: changes.length,
        };
    `);
    t.check('init brings it back as it was, folded, showing the selected column’s panel, and says nothing (AC-34)',
        !back.folded.show && !back.folded.reserved && back.folded.visible && back.selected === 'a' && back.inSidebar &&
        back.marked === 'a' && back.reserved && back.changes === 0, back);

    var html = await page.eval(`
        start();
        ge().setSelected('#a');
        changes.length = 0;
        const saved = ge().getHtml();
        return {
            leaked: /ge-settings-target|ge-settings-sidebar|ge-sidebar-toggle/.test(saved),
            selected: selected(),
            inSidebar: inSidebar(),
            marked: qa('.ge-settings-target').length,
            changes: changes.length,
        };
    `);
    t.check('getHtml has no outline, no sidebar and no button in it, and the column is still selected and shown (AC-35)',
        !html.leaked && html.selected === 'a' && html.inSidebar && html.marked === 1 && html.changes === 0, html);

    var keep = await page.eval(`
        start();
        ge().setSelected('#a');
        const details = sidebar().querySelector('.ge-settings-body > .ge-details');
        changes.length = 0;
        const saved = ge().getHtml({ keepEditing: true });
        return {
            leaked: /ge-settings-target/.test(saved),
            same: sidebar().querySelector('.ge-settings-body > .ge-details') === details,
            selected: selected(),
            changes: changes.length,
        };
    `);
    t.check('getHtml({ keepEditing: true }) leaves the selection and the sidebar alone (AC-36)',
        !keep.leaked && keep.same && keep.selected === 'a' && keep.changes === 0, keep);

    var source = await page.eval(`
        start();
        ge().setSelected('#a');
        changes.length = 0;
        q('.ge-mainControls .gm-edit-mode').click();
        const open = {
            selected: selected(),
            changes: changes.slice(),
            sidebar: getComputedStyle(sidebar()).display,
            toggle: getComputedStyle(toggle()).display,
            reserved: reserved(),
        };
        q('.ge-mainControls .gm-edit-mode').click();
        return {
            open: open,
            closed: {
                sidebar: getComputedStyle(sidebar()).display,
                reserved: reserved(),
                message: !!sidebar().querySelector('.ge-sidebar-empty'),
                selected: selected(),
            },
        };
    `);
    t.check('opening the source view deselects, says so, and hides the sidebar and its room (AC-37)',
        source.open.selected === null && JSON.stringify(source.open.changes) === JSON.stringify([{ node: null, from: 'a' }]) &&
        source.open.sidebar === 'none' && source.open.toggle === 'none' && !source.open.reserved, source);
    t.check('closing it brings the sidebar back, with nothing selected (AC-38)',
        source.closed.sidebar !== 'none' && source.closed.reserved && source.closed.message && source.closed.selected === null, source);

    var deleted = await page.eval(`
        start();
        ge().setSelected('#a');
        changes.length = 0;
        q('#a > .ge-tools-drawer > .ge-delete-column').click();
        await sleep(800);
        return { gone: !q('#a'), selected: ge().getSelected(), message: !!sidebar().querySelector('.ge-sidebar-empty'), changes: changes.slice() };
    `);
    t.check('deleting the selected column shows the message, and says so (AC-39)',
        deleted.gone && deleted.selected === null && deleted.message &&
        JSON.stringify(deleted.changes) === JSON.stringify([{ node: null, from: 'a' }]), deleted);

    await page.eval(`
        const script = document.createElement('script');
        script.src = '/dist/locales/grideditor.es.js';
        script.onload = function() { window.spanishLoaded = true; };
        document.head.appendChild(script);
        return true;
    `);
    await page.waitFor(`window.spanishLoaded`, { label: 'the Spanish locale' });

    var spanish = await page.eval(`
        start();
        ge().setSelected('#a');
        toggle().click();
        changes.length = 0;
        ge().setLocale('es');
        const result = {
            sidebars: qa('.ge-settings-sidebar').length,
            toggles: qa('.ge-sidebar-toggle').length,
            title: sidebar().querySelector('.ge-settings-title').textContent,
            label: toggle().getAttribute('aria-label'),
            show: sidebar().classList.contains('show'),
            selected: selected(),
            inSidebar: inSidebar(),
            changes: changes.length,
        };
        ge().setLocale('en');
        return result;
    `);
    t.check('setLocale rebuilds the sidebar in the new language, still folded and with the column selected (AC-40)',
        spanish.sidebars === 1 && spanish.toggles === 1 && spanish.title === 'Ajustes: Columna' && spanish.label === 'Mostrar ajustes' &&
        !spanish.show && spanish.selected === 'a' && spanish.inSidebar && spanish.changes === 0, spanish);

    var destroyed = await page.eval(`
        start();
        ge().setSelected('#a');
        ge().destroy();
        return { left: qa('.ge-settings-sidebar, .ge-sidebar-toggle').length, reserved: reserved() };
    `);
    t.check('destroy leaves no sidebar, no button and no room (AC-41)', destroyed.left === 0 && !destroyed.reserved, destroyed);

    var errors = page.errors();
    t.check('the lifecycle tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function instanceTests(t) {
    var page = await newPage(t);
    await width(page, 1200);

    var second = await page.eval(`
        start();
        const other = document.body.appendChild(document.createElement('div'));
        other.id = 'other';
        other.innerHTML = '<div class="row"><div class="column col-12" id="oc"><p>Other</p></div></div>';
        window.second = GridEditor.create(other, { settings_panel: 'sidebar' });
        return {
            settings: second.settings.settings_panel,
            gears: qa('#other .ge-tools-drawer > .ge-settings').length,
            // Plain content has a drawer and no settings
            drawers: qa('#other .ge-tools-drawer').filter(function(drawer) { return drawer.querySelector(':scope > .ge-details'); }).length,
            sidebars: qa('.ge-settings-sidebar').length,
            warned: warnings.filter(function(w) { return /settings_panel "sidebar"/.test(w); }).length,
        };
    `);
    t.check('a second editor asking for the sidebar warns once and behaves as offcanvas, gears and all (AC-51)',
        second.settings === 'offcanvas' && second.gears === second.drawers && second.gears > 0 &&
        second.sidebars === 1 && second.warned === 1, second);

    var after = await page.eval(`
        ge().destroy();
        window.second.reset();
        return {
            settings: window.second.settings.settings_panel,
            gears: qa('#other .ge-tools-drawer > .ge-settings').length,
            sidebars: qa('.ge-settings-sidebar').length,
        };
    `);
    t.check('the first one destroyed, the second stays offcanvas (AC-52)',
        after.settings === 'offcanvas' && after.gears > 0 && after.sidebars === 0, after);

    var third = await page.eval(`
        const another = document.body.appendChild(document.createElement('div'));
        another.innerHTML = '<div class="row"><div class="column col-12"><p>Third</p></div></div>';
        const editor = GridEditor.create(another, { settings_panel: 'sidebar' });
        const result = {
            settings: editor.settings.settings_panel,
            sidebars: qa('.ge-settings-sidebar').length,
            gears: another.querySelectorAll('.ge-settings').length,
        };
        editor.destroy();
        another.remove();
        window.second.destroy();
        q('#other').remove();
        return result;
    `);
    t.check('with the first one destroyed, a third gets the sidebar (AC-53)',
        third.settings === 'sidebar' && third.sidebars === 1 && third.gears === 0, third);

    var errors = page.errors();
    t.check('the instance tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'sidebar',
    description: 'settings_panel sidebar: the panel, folding it, the window, the lifecycle, one per page',
    run: async function(t) {
        await markupTests(t);
        await foldTests(t);
        await lifecycleTests(t);
        await instanceTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['sidebar']);
}
