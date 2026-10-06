/**
 * Browser tests for toolbar_groups: the toolbar's add buttons sorted into
 * categories, with tabs choosing which one shows.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var path = require('path');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Two rows, an editor with a text type (a stand-in: the fixture loads no
 * rich text editor), the fixture's containers and the sections plugin, and
 * whatever test plugins `extra` registers first.
 */
function start(settings, extra) {
    return `
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        document.querySelector('.container').style.width = '';
        delete GridEditor.features.stamp;
        delete GridEditor.features.mediaA;
        delete GridEditor.features.mediaB;
        delete GridEditor.features.paster;
        delete GridEditor.containers.gallery;
        GridEditor.texts.simple = function() {
            return { labelKey: 'text.simple', start: function() {}, stop: function() {} };
        };
        Object.assign(GridEditor.locales.en, { 'text.simple': 'Simple' });
        const grid = document.querySelector('#myGrid');
        grid.innerHTML =
            '<div class="row" id="first"><div class="column col-12" id="a"><div class="ge-content"><p>First row</p></div></div></div>' +
            '<div class="row" id="second"><div class="column col-12"><div class="ge-content"><p>Second row</p></div></div></div>';
        const row = function() {
            const made = document.createElement('div');
            made.className = 'row';
            return made;
        };
        ${extra || ''}
        const settings = Object.assign({ default_view: 'xs', content_types: ['simple'] }, ${JSON.stringify(settings || {})});
        settings.plugins = window.fixture.plugins(['sections'].concat(settings.extraPlugins || []));
        delete settings.extraPlugins;
        window.fixture.init(settings);
    `;
}

/** The tabs, the one chosen, and the add buttons showing on the toolbar's line. */
var STATE = `
    const tabs = document.querySelector('.ge-mainControls .ge-toolbar-groups');
    const shown = Array.from(document.querySelectorAll('.ge-mainControls [data-ge-toolbar]')).filter(function(button) {
        return !button.closest('.ge-toolbar-stash') && !button.closest('.ge-toolbar-end') && button.getClientRects().length > 0;
    });
    return {
        tabs: tabs ? Array.from(tabs.children).map(function(tab) { return tab.textContent; }) : null,
        chosen: tabs ? Array.from(tabs.children).filter(function(tab) { return tab.getAttribute('aria-selected') === 'true'; }).map(function(tab) { return tab.textContent; }) : null,
        shown: shown.map(function(button) { return button.getAttribute('title'); }),
        total: document.querySelectorAll('.ge-mainControls [data-ge-toolbar]').length,
    };
`;

var ROWS = ['Add row 12', 'Add row 6-6', 'Add row 4-4-4'];
// Today's order: the containers, then the plugins' items as the plugins load
var CONTENT = ['Tabs', 'Accordion', 'Popup', 'Card', 'Section'];
// The texts go with the elements since element-buttons
var ELEMENTS = ['Text'];

function same(list, expected) {
    return JSON.stringify(list) === JSON.stringify(expected);
}

function sameSet(list, expected) {
    return same(list.slice().sort(), expected.slice().sort());
}

/** Q01: the tabs, which ones there are, which buttons they show, and what is kept. */
async function structureTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var off = await page.eval(start() + STATE);
    t.check('AC-01 off by default: no tabs, every add button on the line as before',
        off.tabs === null && !(await page.eval(`return !!document.querySelector('.ge-toolbar-stash');`)) &&
        sameSet(off.shown, ROWS.concat(CONTENT, ELEMENTS)), off);

    var on = await page.eval(start({ toolbar_groups: true }) + STATE);
    t.check('AC-02 (rev v2) with toolbar_groups, tabs Rows, Content and Elements, Rows chosen, only the row buttons showing',
        same(on.tabs, ['Rows', 'Content', 'Elements']) && same(on.chosen, ['Rows']) && same(on.shown, ROWS) && on.total === off.total, on);

    await page.click('.ge-toolbar-groups [data-ge-group="content"]');
    var content = await page.eval(STATE);
    t.check('AC-03 (rev v2) the Content tab shows the containers, then the section, in today\'s order; the text is not there',
        same(content.chosen, ['Content']) && same(content.shown, CONTENT), content);

    await page.click('.ge-toolbar-groups [data-ge-group="elements"]');
    var elements = await page.eval(STATE);
    t.check('the Elements tab shows the text', same(elements.chosen, ['Elements']) && same(elements.shown, ELEMENTS), elements);
    await page.click('.ge-toolbar-groups [data-ge-group="content"]');

    await page.screenshot(path.join(t.screenshots, 'toolbar-groups.png'));

    var relocated = await page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        window.fixture.editor().setLocale('es');
    ` + STATE);
    t.check('AC-07 setLocale rebuilds the toolbar in Spanish, on the same tab',
        same(relocated.tabs, ['Filas', 'Contenido', 'Elementos']) && same(relocated.chosen, ['Contenido']) &&
        relocated.shown.length === CONTENT.length, relocated);

    var recreated = await page.eval(start({ toolbar_groups: true }) + STATE);
    t.check('AC-21 an editor made again starts on Rows', same(recreated.chosen, ['Rows']), recreated);

    var rowsOnly = await page.eval(start({ toolbar_groups: true, content_types: [], extraPlugins: [] }, `
        const plugins = window.fixture.plugins;
        window.fixture.plugins = function() { return []; };
        setTimeout(function() { window.fixture.plugins = plugins; });
    `) + STATE);
    t.check('AC-08 a single category: no tabs, its buttons on the line', rowsOnly.tabs === null && same(rowsOnly.shown, ROWS), rowsOnly);

    var none = await page.eval(start({ toolbar_groups: true, content_types: [], new_row_layouts: [] }, `
        const plugins = window.fixture.plugins;
        window.fixture.plugins = function() { return []; };
        setTimeout(function() { window.fixture.plugins = plugins; });
    `) + STATE + `;`);
    var rightSide = await page.eval(`return !!document.querySelector('.ge-mainControls .gm-preview') && !!document.querySelector('.ge-mainControls .ge-layout-mode');`);
    t.check('AC-09 no add buttons at all: no tabs, the right of the toolbar as always',
        none.tabs === null && none.shown.length === 0 && rightSide, none);

    var STAMP = `
        GridEditor.features.stamp = function() {
            return { toolbar: [
                { labelKey: 'stamp.add', kind: 'row', create: function() { return row(); } },
                { labelKey: 'stamp.again', kind: 'row', create: function() { return row(); } },
            ] };
        };
        Object.assign(GridEditor.locales.en, { 'stamp.add': 'Stamp', 'stamp.again': 'Stamp again' });
    `;
    var stamp = await page.eval(start({ toolbar_groups: true, extraPlugins: ['stamp'] }, STAMP) + `
        document.querySelector('.ge-toolbar-groups [data-ge-group="stamp"]').click();
    ` + STATE);
    var warned = page.errors().filter(function(error) { return /group\.stamp/.test(error); });
    t.check('AC-10 a plugin naming no group has a tab of its own, labelled by its first button, with only its buttons',
        same(stamp.tabs, ['Rows', 'Content', 'Elements', 'Stamp']) && same(stamp.shown, ['Stamp', 'Stamp again']) && warned.length === 0, stamp);

    var media = await page.eval(start({ toolbar_groups: true, extraPlugins: ['mediaA', 'mediaB'] }, `
        GridEditor.features.mediaA = function() {
            return { toolbar: [{ labelKey: 'media.a', kind: 'row', group: 'media', create: function() { return row(); } }] };
        };
        GridEditor.features.mediaB = function() {
            return { toolbar: [{ labelKey: 'media.b', kind: 'row', group: 'media', create: function() { return row(); } }] };
        };
        Object.assign(GridEditor.locales.en, { 'media.a': 'Photo', 'media.b': 'Video', 'group.media': 'Media' });
    `) + `
        document.querySelector('.ge-toolbar-groups [data-ge-group="media"]').click();
    ` + STATE);
    t.check('AC-11 two plugins naming the same group share its tab, in the order they load',
        same(media.tabs, ['Rows', 'Content', 'Elements', 'Media']) && same(media.shown, ['Photo', 'Video']), media);

    var joined = await page.eval(start({ toolbar_groups: true, extraPlugins: ['stamp'] }, `
        GridEditor.features.stamp = function() {
            return { toolbar: [{ labelKey: 'stamp.add', kind: 'row', group: 'rows', create: function() { return row(); } }] };
        };
        Object.assign(GridEditor.locales.en, { 'stamp.add': 'Stamp' });
    `) + STATE);
    t.check('AC-12 a plugin\'s item in rows comes after the row buttons',
        same(joined.tabs, ['Rows', 'Content', 'Elements']) && same(joined.shown, ROWS.concat(['Stamp'])), joined);

    var gallery = await page.eval(start({ toolbar_groups: true, extraPlugins: ['gallery'] }, `
        GridEditor.containers.gallery = function() {
            return { labelKey: 'gallery.add', group: 'slides', create: function() {
                const made = document.createElement('div');
                made.setAttribute('data-ge-container', 'gallery');
                return made;
            } };
        };
        Object.assign(GridEditor.locales.en, { 'gallery.add': 'Gallery' });
    `) + `
        const inContent = (document.querySelector('.ge-toolbar-groups [data-ge-group="content"]').click(),
            Array.from(document.querySelectorAll('.ge-toolbar-start [data-ge-toolbar]')).map(function(b) { return b.getAttribute('title'); }));
        document.querySelector('.ge-toolbar-groups [data-ge-group="slides"]').click();
    ` + `const state = (function() { ${STATE} })(); state.inContent = inContent; return state;`);
    t.check('AC-13 a container with a group is in that tab, not in Content',
        same(gallery.tabs, ['Rows', 'Content', 'Elements', 'Gallery']) && same(gallery.shown, ['Gallery']) &&
        gallery.inContent.indexOf('Gallery') < 0, gallery);

    var end = await page.eval(start({ toolbar_groups: true, extraPlugins: ['paster'] }, `
        GridEditor.features.paster = function() {
            return { toolbar: [{ labelKey: 'paster.add', kind: 'row', align: 'end', group: 'media', iconClass: 'bi bi-star', create: function() { return row(); } }] };
        };
        Object.assign(GridEditor.locales.en, { 'paster.add': 'Paster' });
    `) + `
        const button = document.querySelector('[data-ge-feature="paster"]');
        const state = (function() { ${STATE} })();
        state.inEnd = !!button.closest('.ge-toolbar-end');
        return state;
    `);
    t.check('AC-14 an item with align end stays on the right and makes no tab',
        same(end.tabs, ['Rows', 'Content', 'Elements']) && end.inEnd, end);

    var invalid = await page.eval(start({ toolbar_groups: true, extraPlugins: ['stamp', 'mediaA'] }, `
        GridEditor.features.stamp = function() {
            return { toolbar: [{ labelKey: 'stamp.add', kind: 'row', group: '', create: function() { return row(); } }] };
        };
        GridEditor.features.mediaA = function() {
            return { toolbar: [{ labelKey: 'media.a', kind: 'row', group: 42, create: function() { return row(); } }] };
        };
        Object.assign(GridEditor.locales.en, { 'stamp.add': 'Stamp', 'media.a': 'Photo' });
    `) + `
        return Array.from(document.querySelectorAll('.ge-toolbar-groups > button')).map(function(tab) { return tab.getAttribute('data-ge-group'); });
    `);
    t.check('AC-19 an empty or non-string group counts as none: the plugin\'s own tab',
        same(invalid, ['rows', 'content', 'elements', 'stamp', 'mediaA']), invalid);

    var typed = await page.eval(start({ toolbar_groups: true, elements: { types: [
        { type: 'quote', label: 'Quote', html: '<blockquote></blockquote>' },
        { type: 'figure', label: 'Figure', html: '<figure></figure>' },
        { type: 'video', label: 'Video', group: 'media', html: '<video></video>' },
    ] } }) + `
        const shownIn = function(name) {
            document.querySelector('.ge-toolbar-groups [data-ge-group="' + name + '"]').click();
            return (function() { ${STATE} })().shown;
        };
        const state = (function() { ${STATE} })();
        return { tabs: state.tabs, elements: shownIn('elements'), media: shownIn('media'), content: shownIn('content') };
    `);
    t.check('element-buttons AC-18 the Elements tab has the text and the types that name no group; Content keeps the containers and the section',
        // In the order the plugins load: elements before text. The label of
        // media is the group.media string an earlier check registered
        same(typed.tabs, ['Rows', 'Content', 'Elements', 'Media']) && same(typed.elements, ['Quote', 'Figure', 'Text']) &&
        same(typed.content, CONTENT), typed);
    t.check('element-buttons AC-19 a type with a group is in that tab, not in Elements', same(typed.media, ['Video']), typed);

    await page.eval(start({ toolbar_groups: true }) + 'return true;');
    var keyboard = await page.eval(`
        const tabs = document.querySelector('.ge-toolbar-groups');
        const content = tabs.querySelector('[data-ge-group="content"]');
        content.focus();
        return {
            role: tabs.getAttribute('role'),
            label: tabs.getAttribute('aria-label'),
            focused: document.activeElement === content,
            buttons: Array.from(tabs.children).every(function(tab) { return tab.tagName === 'BUTTON' && tab.getAttribute('role') === 'tab'; }),
        };
    `);
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    var entered = await page.eval(STATE);
    t.check('AC-18 each tab is a focusable button with role tab; Enter chooses it and it is aria-selected',
        keyboard.role === 'tablist' && keyboard.label === 'Add' && keyboard.focused && keyboard.buttons &&
        same(entered.chosen, ['Content']), { keyboard: keyboard, entered: entered });

    var errors = page.errors();
    t.check('the toolbar groups structure tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** Q02: what the buttons do with tabs, and what sits beside them. */
async function interactionTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var ROW_IDS = `
        return Array.from(document.querySelectorAll('#myGrid > .row')).map(function(row) {
            return row.id || (row.querySelector('[data-ge-container]') ? 'container' : 'new');
        }).join(',');
    `;

    await page.eval(start({ toolbar_groups: true }) + 'return true;');
    await page.click('.ge-toolbar-groups [data-ge-group="content"]');
    await page.click('.ge-toolbar-start [data-ge-container-type="tabs"]');
    var clicked = await page.eval(ROW_IDS);
    t.check('AC-04 a button of the chosen tab adds at the end of the canvas, as without tabs',
        clicked === 'first,second,container', clicked);

    await page.eval(start({ toolbar_groups: true, toolbar_drag: true }) + 'return true;');
    await page.click('.ge-toolbar-groups [data-ge-group="content"]');
    await page.drag('.ge-toolbar-start [data-ge-container-type="card"]', '#second > .ge-tools-drawer');
    var dragged = await page.eval(ROW_IDS);
    t.check('AC-05 a button of the chosen tab dragged between two rows lands there',
        dragged === 'first,container,second', dragged);

    await page.eval(start({ toolbar_groups: true, active_target: true }) + 'return true;');
    await page.click('.ge-toolbar-groups [data-ge-group="content"]');
    await page.eval(`window.fixture.editor().setActiveTarget('#a'); return true;`);
    await page.click('.ge-toolbar-start [data-ge-container-type="card"]');
    var targeted = await page.eval(`
        const card = document.querySelector('#myGrid [data-ge-container="card"]');
        return { inTarget: !!card && card.parentElement.id === 'a', rows: (function() { ${ROW_IDS} })() };
    `);
    t.check('AC-06 with an active target, the button adds at its end', targeted.inTarget && targeted.rows === 'first,second', targeted);

    // The frame after a resize is when the more button works out what fits
    var SETTLE = 'await new Promise(function(resolve) { setTimeout(resolve, 150); });';
    var MORE = `
        const more = document.querySelector('.ge-toolbar-more');
        const start = document.querySelector('.ge-toolbar-start');
        const wrapper = document.querySelector('.ge-wrapper');
        const tops = Array.from(wrapper.children).filter(function(node) { return node.offsetParent; })
            .map(function(node) { return Math.round(node.getBoundingClientRect().top); });
        return {
            needed: more.classList.contains('ge-needed'),
            inMenu: Array.from(document.querySelectorAll('.ge-toolbar-overflow [data-ge-toolbar]')).map(function(b) { return b.getAttribute('title'); }),
            tabsInMenu: !!document.querySelector('.ge-toolbar-overflow .ge-toolbar-groups'),
            tabsShown: document.querySelector('.ge-toolbar-groups').getBoundingClientRect().width > 0,
            oneLine: tops.every(function(top) { return Math.abs(top - tops[0]) < 2; }),
            fits: start.scrollWidth <= start.clientWidth,
        };
    `;
    await page.eval(start({ toolbar_groups: true }) + 'return true;');
    await page.click('.ge-toolbar-groups [data-ge-group="content"]');
    // Room for the row buttons, not for all of Content's
    var narrow = await page.eval(`document.querySelector('.container').style.width = '700px';` + SETTLE + MORE);
    t.check('AC-15 narrowed, the last Content buttons go behind the more button, the tabs never',
        narrow.needed && narrow.inMenu.length > 0 && CONTENT.indexOf(narrow.inMenu[0]) >= 0 &&
        !narrow.tabsInMenu && narrow.tabsShown && narrow.oneLine && narrow.fits, narrow);

    await page.screenshot(path.join(t.screenshots, 'toolbar-groups-narrow.png'));

    await page.click('.ge-toolbar-groups [data-ge-group="rows"]');
    var rows = await page.eval(SETTLE + MORE);
    t.check('AC-16 another tab: the more button is worked out again for its buttons, and goes when they fit',
        !rows.needed && rows.inMenu.length === 0 && rows.fits, rows);

    var hiddenItems = await page.eval(`
        // The handle a plugin gets is the editor's own toolbarItems, reached here through a plugin
        let handle = null;
        GridEditor.features.peek = function(ge) { handle = ge; return {}; };
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        document.querySelector('.container').style.width = '';
        window.fixture.init({ default_view: 'xs', content_types: ['simple'], toolbar_groups: true,
            plugins: window.fixture.plugins(['sections', 'peek']) });
        const found = handle.toolbarItems('sections');
        delete GridEditor.features.peek;
        return {
            found: found.length,
            label: found.length ? found[0].getAttribute('title') : null,
            hidden: found.length ? found[0].getClientRects().length === 0 : null,
        };
    `);
    t.check('AC-17 toolbarItems finds a button whose tab is not chosen',
        hiddenItems.found === 1 && hiddenItems.label === 'Section' && hiddenItems.hidden === true, hiddenItems);

    var html = await page.eval(`return window.fixture.editor().getHtml();`);
    t.check('AC-20 getHtml has nothing of the tabs', !/ge-toolbar-groups|data-ge-group|role="tab"/.test(html), html);

    var errors = page.errors();
    t.check('the toolbar groups interaction tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'toolbargroups',
    description: 'the toolbar\'s add buttons in categories, chosen with tabs',
    run: async function(t) {
        await structureTests(t);
        await interactionTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['toolbargroups']);
}
