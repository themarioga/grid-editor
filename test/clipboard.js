/**
 * Browser tests for the clipboard plugin: copy a row, a column, a section, a
 * container or an element, and paste it wherever that kind of node can go.
 *
 * What is copied is kept in localStorage, so every test starts by clearing
 * it, and one opens a second tab to check that a copy reaches it.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A fresh editor with the clipboard, and nothing copied. */
var HELPERS = `
    window.$$ = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.kids = function(node, selector) {
        return node ? Array.from(node.children).filter(function(c) { return !selector || c.matches(selector); }) : [];
    };
    window.kid = function(node, selector) { return window.kids(node, selector)[0] || null; };
    window.lastOf = function(list) { return list[list.length - 1] || null; };
    window.clickAll = function(list) { list.forEach(function(node) { node.click(); }); };
    /** A node's drawer tools of a class: its own drawer, the direct child. */
    window.toolOf = function(node, className) { return kids(kid(node, '.ge-tools-drawer'), '.' + className); };
    window.showingButtons = function() {
        return $$('.ge-mainControls [data-ge-feature="clipboard"]').filter(function(b) { return b.style.display !== 'none'; });
    };
`;

var START = HELPERS + `
    localStorage.clear();
    if (window.fixture.editor()) { window.fixture.editor().destroy(); }
    document.querySelector('#myGrid').innerHTML = (
        '<div class="row" id="hero"><div class="col-lg-12"><h1>First row</h1><p><a href="#hero">Back up</a></p></div></div>' +
        // Texts as the editor saves them: the first row's loose markup is the
        // host's plain content, which is not copied
        '<div class="row"><div class="col-lg-6"><div class="ge-content" data-ge-content-type="tinymce"><p>Left</p></div></div>' +
        '<div class="col-lg-6"><div class="ge-content" data-ge-content-type="tinymce"><p>Right</p></div></div></div>'
    );
    window.ge = window.fixture.init({ plugins: window.fixture.plugins(['clipboard', 'sections']) });
    window.pastes = [];
    document.querySelector('#myGrid').addEventListener('grideditor:after-add', function(e) {
        if (e.detail.source === 'paste') { window.pastes.push(e.detail.kind); }
    });
`;

/**
 * Which paste tools and toolbar buttons are showing. By their own display
 * rather than :visible, because a drawer is only shown on hover.
 */
var SHOWING = `
    const on = function(node) { return node.style.display !== 'none'; };
    const all = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    return {
        columnPaste: all('#myGrid .column > .ge-tools-drawer > .ge-paste').filter(on).length,
        rowPaste: all('#myGrid .row > .ge-tools-drawer > .ge-paste').filter(on).length,
        sectionPaste: all('#myGrid .ge-section > .ge-tools-drawer > .ge-paste').filter(on).length,
        toolbar: all('.ge-mainControls [data-ge-feature="clipboard"]').filter(on).map(function(button) {
            return button.getAttribute('title');
        }),
    };
`;

/** Every id in the canvas is there once. */
var IDS_UNIQUE = `
    (function() {
        const ids = Array.from(document.querySelectorAll('#myGrid [id]')).map(function(node) { return node.id; });
        return new Set(ids).size === ids.length;
    })()
`;

async function toolTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var tools = await page.eval(START + `
        ge.createSection({ appendTo: '#myGrid' });
        ge.createContainer('tabs', { appendTo: $$('#myGrid .column')[1] });
        ge.createElement('<blockquote>Quoted</blockquote>', { appendTo: lastOf($$('#myGrid .column')) });
        const copyOn = function(selector) {
            return $$(selector).map(function(node) { return toolOf(node, 'ge-copy').length; });
        };
        return {
            rows: copyOn('#myGrid .row'),
            columns: copyOn('#myGrid .column'),
            sections: copyOn('#myGrid .ge-section'),
            containers: copyOn('#myGrid [data-ge-container]'),
            elements: copyOn('#myGrid .ge-element'),
            tabs: copyOn('#myGrid .ge-tab'),
            pasteTools: $$('#myGrid .ge-paste').length,
            showing: (function() { ${SHOWING} })(),
        };
    `);
    var everyOne = function(list) { return list.length > 0 && list.every(function(n) { return n === 1; }); };
    t.check('rows, columns, sections, containers and elements each get a copy tool, panes do not',
        everyOne(tools.rows) && everyOne(tools.columns) && everyOne(tools.sections) &&
        everyOne(tools.containers) && everyOne(tools.elements) && tools.tabs.every(function(n) { return n === 0; }),
        tools);
    t.check('with nothing copied, no paste tool and no paste button shows',
        tools.pasteTools > 0 && tools.showing.columnPaste === 0 && tools.showing.rowPaste === 0 &&
        tools.showing.sectionPaste === 0 && tools.showing.toolbar.length === 0,
        tools);

    var errors = page.errors();
    t.check('the tool tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function rowTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var copied = await page.eval(START + `
        ge.createSection({ appendTo: '#myGrid' });
        clickAll($$('#hero > .ge-tools-drawer > .ge-copy'));
        const stored = JSON.parse(localStorage.getItem('grideditor.clipboard'));
        return {
            stored: { category: stored.category, kind: stored.kind, clean: !/ge-tools-drawer|ge-editing|ge-copy/.test(stored.html) },
            editing: document.querySelector('#myGrid').classList.contains('ge-editing'),
            flashed: document.querySelector('#hero > .ge-tools-drawer > .ge-copy').classList.contains('ge-copied'),
            showing: (function() { ${SHOWING} })(),
        };
    `);
    t.check('copying a row stores it, clean, and leaves the editor editing',
        copied.stored.category === 'row' && copied.stored.kind === 'row' && copied.stored.clean &&
        copied.editing && copied.flashed,
        copied);
    t.check('a copied row can be pasted in columns, sections and the canvas, not in rows',
        copied.showing.columnPaste > 0 && copied.showing.sectionPaste > 0 && copied.showing.rowPaste === 0 &&
        copied.showing.toolbar.join(',') === 'Paste row',
        copied.showing);

    // Another plugin building the toolbar again - its buttons changed - with
    // no init after it to look at the clipboard
    var rebuilt = await page.eval(`
        GridEditor.features.rebuilder = function(handle) { window.rebuild = handle.refreshToolbar; return {}; };
        window.ge = window.fixture.init({ plugins: window.fixture.plugins(['clipboard', 'sections', 'rebuilder']) });
        window.rebuild();
        const toolbar = showingButtons().map(function(button) { return button.getAttribute('title'); });
        delete GridEditor.features.rebuilder;
        return toolbar;
    `);
    t.check('a toolbar built again shows only the paste button that fits',
        rebuilt.join(',') === 'Paste row', rebuilt);

    var placed = await page.eval(`
        const paste = $$('.ge-mainControls [data-ge-feature="clipboard"]');
        const end = document.querySelector('.ge-mainControls .ge-toolbar-end');
        const before = [];
        for (let node = end.previousElementSibling; node; node = node.previousElementSibling) { before.push(node); }
        return {
            inEnd: paste.length > 0 && paste.every(function(button) { return button.parentElement === end; }),
            iconOnly: paste.every(function(button) { return kids(button, 'span').length === 0; }),
            // Floated right after the source and preview group, so it stands to its left
            beforeSource: before.filter(function(node) { return node.matches('.btn-group') && node.querySelector('.gm-edit-mode'); }).length === 1,
            sectionStays: $$('.ge-addContainerGroup [data-ge-feature="sections"] span').map(function(n) { return n.textContent; }).join('') === 'Section',
        };
    `);
    t.check('the toolbar\'s paste button is an icon on the right, beside source and preview',
        placed.inEnd && placed.iconOnly && placed.beforeSource && placed.sectionStays, placed);

    // The other paste button is hidden, not gone, and Bootstrap's btn-group
    // rules would square off the corners the two share
    var ROUNDED = `
        const shown = showingButtons()[0];
        const style = getComputedStyle(shown);
        return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']
            .map(function(corner) { return style[corner]; });
    `;
    var rowCorners = await page.eval(ROUNDED);
    var sectionCorners = await page.eval(`
        clickAll($$('#myGrid .ge-section > .ge-tools-drawer > .ge-copy'));
    ` + ROUNDED);
    await page.eval(`clickAll($$('#hero > .ge-tools-drawer > .ge-copy'));`);
    var rounded = function(corners) { return corners.every(function(radius) { return parseFloat(radius) > 0; }); };
    t.check('whichever paste button shows, all four of its corners are rounded',
        rounded(rowCorners) && rounded(sectionCorners), { row: rowCorners, section: sectionCorners });

    var pasted = await page.eval(`
        const target = kid($$('#myGrid .row')[1], '.column');
        clickAll(toolOf(target, 'ge-paste'));
        const nested = kids(target, '.row');
        return {
            nested: nested.length,
            text: nested[0] && nested[0].querySelector('h1').textContent,
            id: nested[0] && nested[0].id,
            link: nested[0] && nested[0].querySelector('.ge-content a').getAttribute('href'),
            hasDrawer: !!nested[0] && kids(nested[0], '.ge-tools-drawer').length === 1,
            idsUnique: ${IDS_UNIQUE},
            pastes: window.pastes.slice(),
        };
    `);
    t.check('pasting a row into a column nests a copy of it there, through the add events',
        pasted.nested === 1 && pasted.text === 'First row' && pasted.hasDrawer &&
        pasted.pastes.join(',') === 'row',
        pasted);
    t.check('an id the page already has is renamed in the copy, and the copy\'s own links follow',
        pasted.id === 'hero-2' && pasted.link === '#hero-2' && pasted.idsUnique, pasted);

    var intoSection = await page.eval(`
        clickAll($$('#myGrid .ge-section > .ge-tools-drawer > .ge-paste'));
        const rows = $$('#myGrid .ge-section > .row');
        return {
            rows: rows.length,
            text: lastOf(rows).querySelector('h1').textContent,
            id: lastOf(rows).id,
        };
    `);
    t.check('a row pastes into a section too, with an id of its own again',
        intoSection.rows === 2 && intoSection.text === 'First row' && intoSection.id === 'hero-3', intoSection);

    var fromToolbar = await page.eval(`
        const grid = document.querySelector('#myGrid');
        const before = kids(grid, '.row').length;
        clickAll(showingButtons());
        return {
            added: kids(grid, '.row').length - before,
            last: lastOf(kids(grid, '.row')).querySelector('h1').textContent,
        };
    `);
    t.check('the toolbar\'s paste row button puts it at the end of the canvas',
        fromToolbar.added === 1 && fromToolbar.last === 'First row', fromToolbar);

    var canceled = await page.eval(`
        document.querySelector('#myGrid').addEventListener('grideditor:before-add-row', function(e) {
            if (e.detail.source === 'paste') { e.preventDefault(); }
        }, { once: true });
        const before = $$('#myGrid .row').length;
        clickAll(toolOf(document.querySelector('#myGrid .column'), 'ge-paste'));
        return { added: $$('#myGrid .row').length - before };
    `);
    t.check('canceling before-add-row turns a paste away', canceled.added === 0, canceled);

    var errors = page.errors();
    t.check('the row tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function otherKindTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var column = await page.eval(START + `
        clickAll(toolOf(lastOf(kids($$('#myGrid .row')[1], '.column')), 'ge-copy'));
        const showing = (function() { ${SHOWING} })();
        clickAll($$('#hero > .ge-tools-drawer > .ge-paste'));
        const hero = document.querySelector('#hero');
        const pasted = lastOf(kids(hero, '.column'));
        return {
            showing: showing,
            columns: kids(hero, '.column').length,
            text: kids(kid(pasted, '.ge-text-block'), '.ge-content').map(function(n) { return n.textContent; }).join('').trim(),
            sized: pasted.classList.contains('col-lg-6'),
        };
    `);
    t.check('a column copies and pastes into a row, and only a row',
        column.showing.rowPaste > 0 && column.showing.columnPaste === 0 && column.showing.toolbar.length === 0 &&
        column.columns === 2 && column.text === 'Right' && column.sized,
        column);

    var tabs = await page.eval(`
        const source = document.querySelector('#myGrid .column');
        const made = ge.createContainer('tabs', { tabs: 2, labels: ['One', 'Two'], appendTo: source });
        clickAll(toolOf(made, 'ge-copy'));

        const target = lastOf(kids(document.querySelector('#hero'), '.column'));
        clickAll(toolOf(target, 'ge-paste'));

        const copies = $$('#myGrid [data-ge-container="tabs"]');
        const pointsHome = function(container) {
            return $$('.nav-link', container).every(function(link) {
                return $$(link.getAttribute('data-bs-target'), container).length === 1;
            });
        };
        return {
            copies: copies.length,
            inTarget: kids(target, '[data-ge-container="tabs"]').length,
            labels: $$('.nav-link', lastOf(copies)).map(function(n) { return n.textContent; }).join(''),
            ownPanes: pointsHome(copies[0]) && pointsHome(lastOf(copies)),
            newIds: copies[0].querySelector('.tab-pane').id !== lastOf(copies).querySelector('.tab-pane').id,
            idsUnique: ${IDS_UNIQUE},
            pastes: window.pastes.slice(),
        };
    `);
    t.check('a tabs container pastes into a column with new ids, each strip pointing at its own panes',
        tabs.copies === 2 && tabs.inTarget === 1 && tabs.labels === 'OneTwo' &&
        tabs.ownPanes && tabs.newIds && tabs.idsUnique && tabs.pastes.indexOf('tabs') !== -1,
        tabs);

    var text = await page.eval(`
        const source = kid(kid(kids(document.querySelector('#myGrid'), '.row')[1], '.column'), '.ge-text-block');
        const area = kid(source, '.ge-content');
        area.innerHTML = '<p>Copied text</p>';
        clickAll(toolOf(source, 'ge-copy'));
        const stored = JSON.parse(localStorage.getItem('grideditor.clipboard'));
        const showing = (function() { ${SHOWING} })();
        // Its drawer is beside the content area, not in it, and the text block
        // around both is a new one: copying took the canvas out of editing
        const home = area.parentElement.matches('.ge-text-block') ? area.parentElement : null;
        const flashed = toolOf(home, 'ge-copy').some(function(tool) { return tool.classList.contains('ge-copied'); });

        const target = lastOf(kids(document.querySelector('#hero'), '.column'));
        clickAll(toolOf(target, 'ge-paste'));
        const pasted = lastOf(kids(target, '.ge-text-block'));
        return {
            category: stored.category,
            showing: showing,
            flashed: flashed,
            text: kids(pasted, '.ge-content').map(function(n) { return n.textContent; }).join(''),
            drawer: kids(pasted, '.ge-tools-drawer').length,
        };
    `);
    t.check('a text block copies and pastes into a column, as a text block of its own',
        text.category === 'text' && text.showing.columnPaste > 0 && text.showing.rowPaste === 0 &&
        text.showing.toolbar.length === 0 && text.flashed && text.text === 'Copied text' && text.drawer === 1,
        text);

    var element = await page.eval(`
        const source = kid(document.querySelector('#hero'), '.column');
        const quote = ge.createElement('<blockquote>Quoted</blockquote>', { type: 'quote', appendTo: source });
        clickAll(toolOf(quote, 'ge-copy'));

        const target = kid($$('#myGrid .row')[1], '.column');
        clickAll(toolOf(target, 'ge-paste'));
        return {
            last: target.lastElementChild.matches('.ge-element'),
            inText: $$('.ge-content .ge-element', target).length,
            text: $$('.ge-element blockquote', target).map(function(n) { return n.textContent; }).join(''),
            kind: target.querySelector('.ge-element').getAttribute('data-ge-element'),
        };
    `);
    t.check('an element pastes into a column, at its end, as a block of the column and not into its text',
        element.last && element.inText === 0 && element.text === 'Quoted' && element.kind === 'quote', element);

    var section = await page.eval(`
        const made = ge.createSection({ appendTo: '#myGrid' });
        clickAll(toolOf(made, 'ge-copy'));
        const showing = (function() { ${SHOWING} })();
        clickAll(showingButtons());
        return {
            showing: showing,
            sections: kids(document.querySelector('#myGrid'), '.ge-section').length,
        };
    `);
    t.check('a section pastes onto the canvas from the toolbar, and nowhere else',
        section.showing.toolbar.join(',') === 'Paste section' && section.showing.columnPaste === 0 &&
        section.showing.rowPaste === 0 && section.showing.sectionPaste === 0 && section.sections === 2,
        section);

    var html = await page.eval(`return window.fixture.editor().getHtml();`);
    t.check('what was pasted comes out of getHtml with no clipboard furniture',
        !/ge-copy|ge-paste|ge-copied/.test(html), html.slice(0, 300));

    var errors = page.errors();
    t.check('the other kinds tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** The canvas as getHtml gives it, parsed, where Bootstrap's own attributes are back. */
var EXPORTED = `
    const exported = document.createElement('div');
    exported.innerHTML = window.fixture.editor().getHtml();
    const ids = Array.from(exported.querySelectorAll('[id]')).map(function(node) { return node.id; });
    const unique = new Set(ids).size === ids.length;
`;

async function idTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var accordion = await page.eval(START + `
        const source = kid(document.querySelector('#hero'), '.column');
        clickAll(toolOf(ge.createContainer('accordion', { items: 2, appendTo: source }), 'ge-copy'));

        const target = kid(kids(document.querySelector('#myGrid'), '.row')[1], '.column');
        clickAll(toolOf(target, 'ge-paste'));
        ` + EXPORTED + `

        const accordions = Array.from(exported.querySelectorAll('[data-ge-container="accordion"]'));
        const describe = function(container) {
            const own = container.querySelector('.accordion');
            return {
                id: own.id,
                targetsHome: Array.from(container.querySelectorAll('.accordion-button')).every(function(button) {
                    const pane = container.querySelector(button.getAttribute('data-bs-target'));
                    return !!pane && pane.classList.contains('accordion-collapse');
                }),
                parentsHome: Array.from(container.querySelectorAll('.accordion-collapse')).every(function(pane) {
                    return pane.getAttribute('data-bs-parent') === '#' + own.id;
                }),
                panes: Array.from(container.querySelectorAll('.accordion-collapse')).map(function(pane) { return pane.id; }),
            };
        };
        return {
            count: accordions.length,
            original: describe(accordions[0]),
            copy: describe(accordions[1]),
            unique: unique,
        };
    `);
    t.check('a pasted accordion gets new ids for itself and its items',
        accordion.count === 2 && accordion.unique && accordion.original.id !== accordion.copy.id &&
        accordion.copy.panes.every(function(id) { return accordion.original.panes.indexOf(id) === -1; }),
        accordion);
    t.check('its buttons open its own items, and its items close each other, not the original\'s',
        accordion.original.targetsHome && accordion.original.parentsHome &&
        accordion.copy.targetsHome && accordion.copy.parentsHome,
        accordion);

    var popup = await page.eval(START + `
        window.orphans = [];
        document.querySelector('#myGrid').addEventListener('grideditor:popup-orphan', function(e) { window.orphans.push(e.detail.missing); });

        const source = kid(document.querySelector('#hero'), '.column');
        const made = ge.createContainer('popup', { title: 'Terms', appendTo: source });
        const original = made.getAttribute('data-ge-popup-id');

        // A trigger the host wrote elsewhere on the page, for the original
        const secondRow = kids(document.querySelector('#myGrid'), '.row')[1];
        kid(kid(lastOf(kids(secondRow, '.column')), '.ge-text-block'), '.ge-content')
            .insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-link" id="host-trigger" data-ge-popup-target="' + original + '">Terms</button>');
        ge.reset();

        clickAll(toolOf(document.querySelector('[data-ge-popup-id="' + original + '"]'), 'ge-copy'));
        const target = kid(kids(document.querySelector('#myGrid'), '.row')[1], '.column');
        clickAll(toolOf(target, 'ge-paste'));
        ` + EXPORTED + `

        const popups = Array.from(exported.querySelectorAll('[data-ge-container="popup"]'));
        const describe = function(container) {
            const trigger = container.querySelector(':scope > [data-ge-popup-target]');
            return {
                popupId: container.getAttribute('data-ge-popup-id'),
                modalId: container.querySelector('.modal').id,
                triggerTarget: trigger.getAttribute('data-ge-popup-target'),
                triggerBs: trigger.getAttribute('data-bs-target'),
            };
        };
        return {
            original: original,
            count: popups.length,
            first: describe(popups[0]),
            copy: describe(popups[1]),
            hostTrigger: exported.querySelector('#host-trigger').getAttribute('data-bs-target'),
            unique: unique,
            orphans: window.orphans.slice(),
        };
    `);
    t.check('a pasted popup gets a new id, and its modal and its own trigger follow',
        popup.count === 2 && popup.unique && popup.copy.popupId !== popup.original &&
        popup.copy.modalId === popup.copy.popupId && popup.copy.triggerTarget === popup.copy.popupId &&
        popup.copy.triggerBs === '#' + popup.copy.popupId,
        popup);
    t.check('the original popup, and a trigger outside the copy, still point at the original',
        popup.first.popupId === popup.original && popup.first.modalId === popup.original &&
        popup.first.triggerBs === '#' + popup.original && popup.hostTrigger === '#' + popup.original &&
        popup.orphans.length === 0,
        popup);

    var row = await page.eval(START + `
        const column = kid(document.querySelector('#hero'), '.column');
        const made = ge.createContainer('popup', { trigger: false, appendTo: column });
        const original = made.getAttribute('data-ge-popup-id');

        // The host's trigger, in the same row as the popup it opens
        kid(kid(column, '.ge-text-block'), '.ge-content')
            .insertAdjacentHTML('beforeend', '<a href="#" class="host-trigger" data-ge-popup-target="' + original + '">Open</a>');
        ge.reset();

        clickAll($$('#hero > .ge-tools-drawer > .ge-copy'));
        clickAll(toolOf(kid(kids(document.querySelector('#myGrid'), '.row')[1], '.column'), 'ge-paste'));
        ` + EXPORTED + `

        const copy = exported.querySelector('#hero-2');
        const trigger = copy.querySelector('.host-trigger');
        return {
            original: original,
            copyPopup: copy.querySelector('[data-ge-popup-id]').getAttribute('data-ge-popup-id'),
            triggerTarget: trigger.getAttribute('data-ge-popup-target'),
            triggerBs: trigger.getAttribute('data-bs-target'),
            originalTrigger: exported.querySelector('#hero .host-trigger').getAttribute('data-bs-target'),
            unique: unique,
        };
    `);
    t.check('a trigger copied along with its popup, in the same row, opens the copy\'s popup',
        row.unique && row.copyPopup !== row.original && row.triggerTarget === row.copyPopup &&
        row.triggerBs === '#' + row.copyPopup && row.originalTrigger === '#' + row.original,
        row);

    var offcanvas = await page.eval(START.replace("['clipboard', 'sections']", "['clipboard', 'sections', 'offcanvas']") + `
        window.orphans = [];
        document.querySelector('#myGrid').addEventListener('grideditor:offcanvas-orphan', function(e) { window.orphans.push(e.detail.missing); });

        const source = kid(document.querySelector('#hero'), '.column');
        const made = ge.createContainer('offcanvas', { title: 'Menu', appendTo: source });
        const original = made.getAttribute('data-ge-offcanvas-id');

        // A trigger the host wrote elsewhere on the page, for the original
        const secondRow = kids(document.querySelector('#myGrid'), '.row')[1];
        kid(kid(lastOf(kids(secondRow, '.column')), '.ge-text-block'), '.ge-content')
            .insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-link" id="host-offcanvas" data-ge-offcanvas-target="' + original + '">Menu</button>');
        ge.reset();

        clickAll(toolOf(document.querySelector('[data-ge-offcanvas-id="' + original + '"]'), 'ge-copy'));
        const target = kid(kids(document.querySelector('#myGrid'), '.row')[1], '.column');
        clickAll(toolOf(target, 'ge-paste'));
        ` + EXPORTED + `

        const describe = function(container) {
            const panel = container.querySelector(':scope > [id]');
            const trigger = container.querySelector(':scope > [data-ge-offcanvas-target]');
            return {
                id: container.getAttribute('data-ge-offcanvas-id'),
                panel: panel.id,
                labelledBy: panel.getAttribute('aria-labelledby'),
                title: panel.querySelector('.offcanvas-title').id,
                trigger: trigger.getAttribute('data-ge-offcanvas-target'),
                triggerBs: trigger.getAttribute('data-bs-target'),
            };
        };
        const all = Array.from(exported.querySelectorAll('[data-ge-container="offcanvas"]'));
        return {
            original: original,
            count: all.length,
            first: describe(all[0]),
            copy: describe(all[1]),
            hostTrigger: exported.querySelector('#host-offcanvas').getAttribute('data-bs-target'),
            unique: unique,
            orphans: window.orphans,
        };
    `);
    t.check('a pasted offcanvas gets a new id, and its panel, its title and its own trigger follow (offcanvas AC-11)',
        offcanvas.count === 2 && offcanvas.unique && offcanvas.copy.id !== offcanvas.original &&
        offcanvas.copy.panel === offcanvas.copy.id && offcanvas.copy.trigger === offcanvas.copy.id &&
        offcanvas.copy.triggerBs === '#' + offcanvas.copy.id && offcanvas.copy.labelledBy === offcanvas.copy.title &&
        offcanvas.copy.title !== offcanvas.first.title,
        offcanvas);
    t.check('the original offcanvas, and a trigger outside the copy, still point at the original (offcanvas AC-11)',
        offcanvas.first.id === offcanvas.original && offcanvas.first.panel === offcanvas.original &&
        offcanvas.first.labelledBy === offcanvas.first.title && offcanvas.first.triggerBs === '#' + offcanvas.original &&
        offcanvas.hostTrigger === '#' + offcanvas.original && offcanvas.orphans.length === 0,
        offcanvas);

    // A container plugin of the host's own, with an attribute of its own that points at an id
    var references = await page.eval(HELPERS + `
        localStorage.clear();
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        GridEditor.containers.xref = function(handle) {
            window.xrefHandle = handle;
            return {
                labelKey: 'container.add_xref',
                references: ['data-x-ref'],
                create: function() { return document.createElement('div'); },
            };
        };
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="col-12"><p id="ge-x-1-a">Taken</p></div></div>';
        window.fixture.init({ plugins: window.fixture.plugins(['xref']) });

        const fresh = window.xrefHandle.freshNode('<div><p id="ge-x-1-a">Copy</p><a data-x-ref="ge-x-1-a" data-y-ref="ge-x-1-a">To it</a></div>');
        const result = {
            id: fresh.querySelector('p').id,
            followed: fresh.querySelector('a').getAttribute('data-x-ref'),
            notDeclared: fresh.querySelector('a').getAttribute('data-y-ref'),
        };

        window.fixture.editor().destroy();
        delete GridEditor.containers.xref;
        return result;
    `);
    t.check('freshNode follows the attributes a container plugin declares as references, and no others (offcanvas AC-31)',
        references.id !== 'ge-x-1-a' && references.followed === references.id && references.notDeclared === 'ge-x-1-a',
        references);

    var errors = page.errors();
    t.check('the id tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function reachTests(t) {
    var first = await t.page(FIXTURE, `window.fixture`);
    var second = await t.page(FIXTURE, `window.fixture`);

    await first.eval(START);
    await second.eval(START.replace('localStorage.clear();', ''));

    await first.eval(`clickAll($$('#hero > .ge-tools-drawer > .ge-copy'));`);
    await sleep(300);

    var seen = await second.eval(SHOWING);
    t.check('a row copied in one tab shows as pasteable in another, without a reload',
        seen.columnPaste > 0 && seen.toolbar.join(',') === 'Paste row', seen);

    var pasted = await second.eval(`
        const column = document.querySelector('#myGrid .column');
        clickAll(toolOf(column, 'ge-paste'));
        const row = kid(column, '.row');
        return {
            text: row ? row.querySelector('h1').textContent : '',
            id: row ? row.id : null,
        };
    `);
    t.check('and pastes there', pasted.text === 'First row' && pasted.id === 'hero-2', pasted);

    var reloaded = await t.page(FIXTURE, `window.fixture`);
    var afterReload = await reloaded.eval(START.replace('localStorage.clear();', '') + SHOWING);
    t.check('what was copied survives a reload', afterReload.columnPaste > 0, afterReload);

    var withoutTabs = await reloaded.eval(`
        clickAll(toolOf(ge.createContainer('tabs', { appendTo: document.querySelector('#myGrid .column') }), 'ge-copy'));
        window.fixture.editor().destroy();
        window.fixture.init({ plugins: ['clipboard'] });
    ` + SHOWING);
    t.check('an editor without the plugin a container needs offers no paste for it',
        withoutTabs.columnPaste === 0, withoutTabs);

    var errors = first.errors().concat(second.errors(), reloaded.errors());
    t.check('the reach tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function noStorageTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var result = await page.eval(START + `
        Storage.prototype.getItem = function() { throw new Error('denied'); };
        Storage.prototype.setItem = function() { throw new Error('denied'); };
        clickAll($$('#hero > .ge-tools-drawer > .ge-copy'));
        const showing = (function() { ${SHOWING} })();
        clickAll(toolOf(document.querySelector('#myGrid .column'), 'ge-paste'));
        return {
            showing: showing,
            pasted: kids(document.querySelector('#myGrid .column'), '.row').length,
        };
    `);
    t.check('with no storage to be had, copy and paste still work within the page',
        result.showing.columnPaste > 0 && result.pasted === 1, result);

    var errors = page.errors();
    t.check('the no storage tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Ctrl+C and Ctrl+V (spec clipboard-shortcuts). An editor with the sidebar,
 * or the settings given, a fake tinyMCE so the texts are texts, and every
 * copy, paste and canceled paste logged.
 */
var SHORTCUTS = HELPERS + `
    window.warnings = window.warnings || [];
    if (!window.warnWrapped) {
        const warn = console.warn;
        console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
        window.warnWrapped = true;
    }
    window.tinymce = {
        init: function(config) {
            const editor = { ui: { show: function() {} }, on: function() {}, focus: function() {}, remove: function() {} };
            config.init_instance_callback.call(editor, editor);
        },
    };
    window.q = function(selector) { return document.querySelector(selector); };
    window.text = function(html) {
        return '<div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">' + html + '</div>';
    };
    window.CANVAS =
        '<div class="row" id="r1">' +
            '<div class="column col-6" id="a">' + text('<p>A</p>') + '</div>' +
            '<div class="column col-6" id="b">' + text('<p>B</p>') + '</div>' +
        '</div>' +
        '<div class="container" id="s"><div class="row" id="sr"><div class="column col-12" id="sc">' + text('<p>S</p>') + '</div></div></div>';

    window.start = function(overrides, html) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        localStorage.clear();
        window.getSelection().removeAllRanges();
        if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); }
        window.warnings = [];
        window.copies = [];
        window.adds = [];
        window.tried = 0;
        const grid = q('#myGrid');
        grid.innerHTML = html === undefined ? CANVAS : html;
        (window.listening || []).forEach(function(entry) { grid.removeEventListener(entry[0], entry[1]); });
        const onCopy = function(e) { window.copies.push(e.detail.source); };
        const onAdd = function(e) {
            if (e.detail.source === 'paste') { window.adds.push({ kind: e.detail.kind, parent: e.detail.parent && (e.detail.parent.id || e.detail.parent.className) }); }
        };
        const onTry = function(e) { if (e.detail.source === 'paste') { window.tried++; } };
        grid.addEventListener('grideditor:after-copy', onCopy);
        grid.addEventListener('grideditor:after-add', onAdd);
        grid.addEventListener('grideditor:before-add', onTry);
        window.listening = [['grideditor:after-copy', onCopy], ['grideditor:after-add', onAdd], ['grideditor:before-add', onTry]];
        window.ge = window.fixture.init(Object.assign({
            content_types: ['tinymce'],
            settings_panel: 'sidebar',
            confirm_delete: false,
            plugins: window.fixture.plugins(['clipboard', 'sections']),
        }, overrides || {}));
        return window.ge;
    };

    window.stored = function() {
        const raw = localStorage.getItem('grideditor.clipboard');
        return raw ? JSON.parse(raw) : null;
    };
    /** A click as a pointer makes it: pointerdown first, which is what says which editor is used. */
    window.use = function(node) {
        node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        node.click();
    };
    window.drawer = function(id) { return q('#' + id + ' > .ge-tools-drawer'); };
    window.textIn = function(id) { return q('#' + id + ' .ge-content'); };
    /** A key with Ctrl, sent where the focus is. True when the editor took it. */
    window.press = function(letter, extra) {
        const e = new KeyboardEvent('keydown', Object.assign({
            key: letter, code: 'Key' + letter.toUpperCase(), ctrlKey: true, bubbles: true, cancelable: true,
        }, extra || {}));
        (document.activeElement || document.body).dispatchEvent(e);
        return e.defaultPrevented;
    };
    window.copyByTool = function(selector) { q(selector + ' > .ge-tools-drawer > .ge-copy').click(); window.copies = []; };
    window.copyText = function(id) { q('#' + id + ' .ge-text-block > .ge-tools-drawer > .ge-copy').click(); window.copies = []; };
    /** What a node holds at column level: rows by their columns, texts, sections. */
    window.blocks = function(node) {
        return Array.from(node.children).filter(function(child) {
            return !child.matches('.ge-tools-drawer, .ge-resize-handle');
        }).map(function(child) {
            if (child.matches('.row')) { return 'row:' + child.querySelectorAll(':scope > .column').length; }
            if (child.matches('.ge-text-block')) { return 'text'; }
            if (child.matches('.ge-section, .container')) { return 'section'; }
            return child.id || child.className;
        }).join(',');
    };
    return true;
`;

async function shortcutSettingTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SHORTCUTS);

    var sidebar = await page.eval(`
        start();
        use(drawer('r1'));
        const taken = press('c');
        const clip = stored();
        return { taken: taken, category: clip && clip.category, copies: copies.slice(), selected: ge.getActiveTarget() && ge.getActiveTarget().id };
    `);
    t.check('with the sidebar and no clipboard setting, Ctrl+C copies the selected row and says so (AC-01, AC-38)',
        sidebar.taken && sidebar.category === 'row' && sidebar.selected === 'r1' && sidebar.copies.length === 1, sidebar);

    var target = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        use(drawer('a'));
        press('c');
        const clip = stored();
        return { category: clip && clip.category, target: ge.getActiveTarget() && ge.getActiveTarget().id };
    `);
    t.check('with active_target, Ctrl+C copies the target column (AC-02)',
        target.category === 'column' && target.target === 'a', target);

    var none = await page.eval(`
        start({ settings_panel: 'offcanvas' });
        copyByTool('#r1');
        use(drawer('a'));
        const c = press('c');
        const v = press('v');
        return { c: c, v: v, adds: adds.length, copies: copies.length };
    `);
    t.check('with offcanvas and no active_target, the keys are the browser’s (AC-03 rev v2)',
        !none.c && !none.v && none.adds === 0 && none.copies === 0, none);

    var off = await page.eval(`
        start({ clipboard: { shortcuts: false } });
        use(drawer('r1'));
        const taken = press('c');
        return { taken: taken, stored: stored() };
    `);
    t.check('clipboard.shortcuts false turns them off (AC-04)', !off.taken && off.stored === null, off);

    var system = await page.eval(`
        start();
        let calls = 0;
        const setData = DataTransfer.prototype.setData;
        DataTransfer.prototype.setData = function() { calls++; return setData.apply(this, arguments); };
        const clipboard = navigator.clipboard;
        const spied = clipboard ? ['write', 'writeText', 'read', 'readText'].filter(function(name) { return clipboard[name]; }) : [];
        const saved = {};
        spied.forEach(function(name) { saved[name] = clipboard[name]; clipboard[name] = function() { calls++; return Promise.resolve(); }; });
        use(drawer('r1'));
        press('c');
        use(drawer('a'));
        press('v');
        DataTransfer.prototype.setData = setData;
        spied.forEach(function(name) { clipboard[name] = saved[name]; });
        return { stored: !!stored(), adds: adds.length, calls: calls };
    `);
    t.check('a copy and a paste with the keys use the plugin’s store, never the system clipboard (AC-05)',
        system.stored && system.adds === 1 && system.calls === 0, system);

    var lonely = await page.eval(`
        start({ settings_panel: 'offcanvas', clipboard: { shortcuts: true } });
        ge.deinit();
        ge.init();
        const warned = warnings.filter(function(w) { return /clipboard\\.shortcuts needs active_target/.test(w); }).length;
        copyByTool('#r1');
        use(drawer('a'));
        const c = press('c');
        const v = press('v');
        return { warned: warned, c: c, v: v, adds: adds.length, copies: copies.length };
    `);
    t.check('shortcuts true without active_target warns once, through init again too (AC-28 rev v2)', lonely.warned === 1, lonely);
    t.check('and the keys do nothing (AC-29)', !lonely.c && !lonely.v && lonely.adds === 0 && lonely.copies === 0, lonely);

    var odd = await page.eval(`
        start({ clipboard: { shortcuts: 'yes' } });
        use(drawer('r1'));
        press('c');
        return {
            warned: warnings.filter(function(w) { return /clipboard\\.shortcuts is true or false/.test(w); }).length,
            category: stored() && stored().category,
        };
    `);
    t.check('a shortcuts that is not a boolean warns, and the default (on with the sidebar) is used (AC-34)',
        odd.warned === 1 && odd.category === 'row', odd);

    var popover = await page.eval(`
        start({ settings_panel: 'popover', active_target: true });
        use(drawer('a'));
        press('c');
        return { category: stored() && stored().category };
    `);
    t.check('with a popover panel and active_target, Ctrl+C copies the target (AC-39)', popover.category === 'column', popover);

    var errors = page.errors();
    t.check('the shortcut setting tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function shortcutGuardTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SHORTCUTS);

    var field = await page.eval(`
        start();
        use(drawer('r1'));
        let input = q('.ge-settings-sidebar input');
        if (!input) { input = q('.ge-settings-sidebar .ge-settings-body').appendChild(document.createElement('input')); }
        input.focus();
        const taken = press('c');
        return { focused: document.activeElement === input, taken: taken, stored: stored() };
    `);
    t.check('with the focus in a field of the sidebar, Ctrl+C is the browser’s (AC-06)',
        field.focused && !field.taken && field.stored === null, field);

    var editable = await page.eval(`
        start();
        copyByTool('#r1');
        use(textIn('a'));
        const content = textIn('a');
        content.contentEditable = 'true';
        content.focus();
        const c = press('c');
        const v = press('v');
        return { focused: document.activeElement === content, c: c, v: v, adds: adds.length, copies: copies.length };
    `);
    t.check('with a text being edited, Ctrl+C and Ctrl+V are the browser’s (AC-07)',
        editable.focused && !editable.c && !editable.v && editable.adds === 0 && editable.copies === 0, editable);

    var selection = await page.eval(`
        start();
        use(drawer('r1'));
        const range = document.createRange();
        range.selectNodeContents(q('#b p'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        const taken = press('c');
        window.getSelection().removeAllRanges();
        return { taken: taken, stored: stored() };
    `);
    t.check('with text selected on the page, Ctrl+C copies the text, not the node (AC-08)',
        !selection.taken && selection.stored === null, selection);

    var held = await page.eval(`
        start();
        copyByTool('#r1');
        use(drawer('a'));
        const taken = press('v', { repeat: true });
        return { taken: taken, adds: adds.length };
    `);
    t.check('a Ctrl+V repeated by holding the keys pastes nothing (AC-12)', !held.taken && held.adds === 0, held);

    var keys = await page.eval(`
        start();
        use(drawer('r1'));
        const meta = press('c', { ctrlKey: false, metaKey: true });
        const metaStored = !!stored();
        localStorage.clear();
        const shift = press('c', { shiftKey: true });
        const shiftStored = !!stored();
        const caps = press('C');
        const capsStored = !!stored();
        localStorage.clear();
        const cyrillic = press('c', { key: 'с', code: 'KeyC' });
        return { meta: meta && metaStored, shift: shift || shiftStored, caps: caps && capsStored, cyrillic: cyrillic && !!stored() };
    `);
    t.check('⌘C copies like Ctrl+C (AC-13)', keys.meta, keys);
    t.check('Ctrl+Shift+C is not the shortcut (AC-14)', !keys.shift, keys);
    t.check('with caps lock, or a layout without Latin letters, the key still counts (spec §8)', keys.caps && keys.cyrillic, keys);

    var preview = await page.eval(`
        start();
        use(drawer('r1'));
        const button = q('.ge-mainControls .gm-preview');
        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('mouseenter'));
        button.click();
        const editing = q('#myGrid').classList.contains('ge-editing');
        const taken = press('c');
        button.click();
        button.dispatchEvent(new MouseEvent('mouseleave'));
        return { editing: editing, taken: taken, stored: stored() };
    `);
    t.check('in preview, Ctrl+C does nothing (AC-15)', !preview.editing && !preview.taken && preview.stored === null, preview);

    var destroyed = await page.eval(`
        start();
        use(drawer('r1'));
        ge.destroy();
        let error = null;
        let taken = false;
        try { taken = press('c'); } catch (e) { error = e.message; }
        return { error: error, taken: taken, stored: stored() };
    `);
    t.check('after destroy, Ctrl+C is no error and copies nothing (AC-17)',
        destroyed.error === null && !destroyed.taken && destroyed.stored === null, destroyed);

    var popover = await page.eval(`
        start({ settings_panel: 'popover', active_target: true });
        use(drawer('a'));
        const gear = q('#a > .ge-tools-drawer > .ge-settings');
        use(gear);
        await new Promise(function(r) { setTimeout(r, 50); });
        const open = !!q('body > .ge-settings-popover') && q('body > .ge-settings-popover').style.display !== 'none';
        const taken = press('c');
        return { open: open, panelOpen: ge.panelOpen ? null : null, taken: taken, stored: stored() };
    `);
    t.check('with a popover panel open, Ctrl+C does nothing (AC-33)', popover.open && !popover.taken && popover.stored === null, popover);

    var inline = await page.eval(`
        start({ settings_panel: 'inline', active_target: true });
        use(drawer('a'));
        use(q('#a > .ge-tools-drawer > .ge-settings'));
        const details = q('#a > .ge-tools-drawer > .ge-details');
        const shown = !!details && details.offsetHeight > 0;
        const button = details && details.querySelector('button');
        if (button) { button.focus(); }
        const taken = press('c');
        return { shown: shown, button: !!button, focused: !!button && document.activeElement === button, taken: taken, stored: stored() };
    `);
    t.check('with an inline panel unfolded, Ctrl+C does nothing, even with the focus on one of its buttons (AC-40)',
        inline.shown && !inline.taken && inline.stored === null, inline);

    var errors = page.errors();
    t.check('the shortcut guard tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function shortcutPlaceTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SHORTCUTS);

    var column = await page.eval(`
        start();
        copyByTool('#r1');
        use(drawer('a'));
        const taken = press('v');
        return { taken: taken, adds: adds.slice(), a: blocks(q('#a')) };
    `);
    t.check('Ctrl+V with a column selected pastes the row nested at its end, as a paste (AC-09)',
        column.taken && column.adds.length === 1 && column.adds[0].kind === 'row' && column.adds[0].parent === 'a' &&
        column.a === 'text,row:2', column);

    var canceled = await page.eval(`
        start();
        copyByTool('#r1');
        const cancel = function(e) { if (e.detail.source === 'paste') { e.preventDefault(); } };
        q('#myGrid').addEventListener('grideditor:before-add-row', cancel);
        use(drawer('a'));
        press('v');
        q('#myGrid').removeEventListener('grideditor:before-add-row', cancel);
        return { tried: tried, adds: adds.length, a: blocks(q('#a')) };
    `);
    t.check('a paste a handler cancels adds nothing (AC-10)',
        canceled.tried === 1 && canceled.adds === 0 && canceled.a === 'text', canceled);

    var empty = await page.eval(`
        start();
        use(drawer('a'));
        const taken = press('v');
        return { taken: taken, adds: adds.length };
    `);
    t.check('with nothing copied, Ctrl+V is the browser’s (AC-11)', !empty.taken && empty.adds === 0, empty);

    var source = await page.eval(`
        start();
        use(drawer('r1'));
        press('c');
        const fromKeys = copies.slice();
        q('#r1 > .ge-tools-drawer > .ge-copy').click();
        return { fromKeys: fromKeys, fromTool: copies.slice(1) };
    `);
    t.check('after-copy says shortcut for the keys, and still tool for the tool (AC-16)',
        source.fromKeys.join() === 'shortcut' && source.fromTool.join() === 'tool', source);

    var both = await page.eval(`
        start({ active_target: true });
        use(textIn('a'));
        const target = ge.getActiveTarget();
        press('c');
        const copied = stored() && stored().category;
        copyByTool('#r1');
        use(textIn('a'));
        press('v');
        return {
            targetIsText: !!target && target.matches('.ge-content, .ge-text-block'),
            copied: copied, adds: adds.slice(), a: blocks(q('#a')),
        };
    `);
    t.check('with a text clicked, the text is the target: Ctrl+C copies the text (AC-18; active-target-selection AC-04)',
        both.targetIsText && both.copied === 'text', both);
    t.check('and Ctrl+V pastes the row into its column (AC-19; active-target-selection AC-17)',
        both.adds.length === 1 && both.adds[0].parent === 'a' && both.a === 'text,row:2', both);

    var top = await page.eval(`
        start();
        copyByTool('#r1');
        use(drawer('r1'));
        const taken = press('v');
        const last = Array.from(q('#r1').children).filter(function(c) { return c.matches('.column'); }).pop();
        return { target: ge.getActiveTarget() && ge.getActiveTarget().id, taken: taken, adds: adds.slice(), holds: blocks(last) };
    `);
    t.check('a row pasted onto a top level row goes in a new column of it (AC-20 rev; active-target-selection AC-11)',
        top.target === 'r1' && top.taken && top.adds.length === 1 && top.adds[0].kind === 'row' && top.adds[0].parent === 'r1' && top.holds === 'row:2', top);

    var textSelected = await page.eval(`
        start();
        copyText('a');
        use(drawer('r1'));
        ge.setActiveTarget(textIn('b'));
        ge.setActiveTarget(null);
        const taken = press('v');
        return { target: ge.getActiveTarget(), taken: taken, adds: adds.length };
    `);
    t.check('with the target cleared, a text is pasted at the end of the canvas (AC-21 rev v3; active-target-selection AC-27)',
        textSelected.target === null && textSelected.taken && textSelected.adds === 1, textSelected);

    var columnInColumn = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        copyByTool('#a');
        use(drawer('b'));
        press('v');
        return { target: ge.getActiveTarget() && ge.getActiveTarget().id, adds: adds.slice(), b: blocks(q('#b')) };
    `);
    t.check('a column copied, a column as the target: it goes in a new row at its end (AC-22 rev; active-target-selection AC-13)',
        columnInColumn.target === 'b' && columnInColumn.adds.length === 1 && columnInColumn.adds[0].kind === 'column' && columnInColumn.b === 'text,row:1', columnInColumn);

    var sectionTarget = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        copyText('a');
        use(drawer('s'));
        press('v');
        return { target: ge.getActiveTarget() && ge.getActiveTarget().id, adds: adds.slice(), s: blocks(q('#s')) };
    `);
    t.check('a text copied, a section as the target: it goes in a row and a column of its own (AC-23 rev; active-target-selection AC-15)',
        sectionTarget.target === 's' && sectionTarget.adds.length === 1 && sectionTarget.s === 'row:1,row:1', sectionTarget);

    var section = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        copyByTool('#s');
        use(drawer('sc'));
        press('v');
        const top = Array.from(q('#myGrid').children).filter(function(c) { return c.matches('.row, .ge-section, .container'); });
        return { adds: adds.slice(), order: top.map(function(c) { return c.id || (c.matches('.ge-section, .container') ? 'section' : 'row'); }) };
    `);
    t.check('a section copied, a column of a section as the target: it goes to the canvas after that section (AC-24)',
        section.adds.length === 1 && section.adds[0].kind === 'section' && section.order.join() === 'r1,s,s-2', section);

    var text = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        copyText('b');
        use(drawer('a'));
        press('v');
        return { a: blocks(q('#a')), adds: adds.slice() };
    `);
    t.check('a text copied, a column as the target: at its end, in no row of its own (AC-25)',
        text.a === 'text,text' && text.adds.length === 1, text);

    var nothing = await page.eval(`
        start();
        copyByTool('#r1');
        use(drawer('a'));
        ge.setActiveTarget(null);
        ge.setActiveTarget(null);
        const taken = press('v');
        return { taken: taken, adds: adds.slice(), canvas: blocks(q('#myGrid')) };
    `);
    t.check('with no target, Ctrl+V pastes at the end of the canvas (AC-26 rev v3)',
        nothing.taken && nothing.adds.length === 1 && nothing.adds[0].kind === 'row' && nothing.adds[0].parent === 'myGrid' &&
        nothing.canvas === 'row:2,section,row:2', nothing);

    var noTarget = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        copyText('b');
        use(q('#myGrid'));
        const taken = press('v');
        const last = q('#myGrid').lastElementChild;
        return { target: ge.getActiveTarget(), taken: taken, adds: adds.slice(), canvas: blocks(q('#myGrid')),
            wrapped: last.matches('.row') && blocks(last.querySelector(':scope > .column')) === 'text' };
    `);
    t.check('with active_target and no target, a text pasted goes at the end of the canvas in a row and column of its own (AC-27 rev)',
        noTarget.target === null && noTarget.taken && noTarget.adds.length === 1 && noTarget.adds[0].kind === 'text' &&
        noTarget.canvas === 'row:2,section,row:1' && noTarget.wrapped, noTarget);

    var topCut = await page.eval(`
        start();
        use(drawer('r1'));
        const cut = press('x');
        await new Promise(function(resolve) { setTimeout(resolve, 900); });
        const target = ge.getActiveTarget();
        const taken = press('v');
        return { cut: cut, target: target, taken: taken, canvas: blocks(q('#myGrid')) };
    `);
    t.check('a top-level row cut with Ctrl+X comes back at the end of the canvas with Ctrl+V',
        topCut.cut && topCut.target === null && topCut.taken && topCut.canvas === 'section,row:2', topCut);

    var escaped = await page.eval(`
        start();
        use(drawer('a'));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const target = ge.getActiveTarget();
        const taken = press('c');
        return { target: target, taken: taken, stored: stored() };
    `);
    t.check('Escape clears the target in one press, and Ctrl+C then copies nothing (AC-30 rev; active-target-selection AC-09)',
        escaped.target === null && !escaped.taken && escaped.stored === null, escaped);

    var rowSelected = await page.eval(`
        start();
        copyByTool('#a');
        use(drawer('r1'));
        press('v');
        return { target: ge.getActiveTarget() && ge.getActiveTarget().id, r1: q('#r1').querySelectorAll(':scope > .column').length, adds: adds.slice() };
    `);
    t.check('a row as the target: a column copied goes to its end (AC-31; active-target-selection AC-14)',
        rowSelected.target === 'r1' && rowSelected.r1 === 3 &&
        rowSelected.adds.length === 1 && rowSelected.adds[0].kind === 'column', rowSelected);

    var pane = await page.eval(`
        start();
        ge.createContainer('tabs', { appendTo: '#b' });
        const tab = q('#myGrid .ge-tab');
        use(kid(tab, '.ge-tools-drawer') || tab);
        const kind = ge.getActiveTarget() && ge.getActiveTarget().matches('.ge-tab');
        const taken = press('c');
        return { pane: kind, taken: taken, stored: stored() };
    `);
    t.check('a tab’s pane selected is not copied (AC-32)', pane.pane && !pane.taken && pane.stored === null, pane);

    var textIntoColumn = await page.eval(`
        start();
        copyText('b');
        use(textIn('a'));
        press('v');
        return { a: blocks(q('#a')), adds: adds.slice() };
    `);
    t.check('a text copied, a text clicked: the text goes to the end of its column, the target (AC-37)',
        textIntoColumn.a === 'text,text' && textIntoColumn.adds.length === 1 && textIntoColumn.adds[0].parent === 'a', textIntoColumn);

    var errors = page.errors();
    t.check('the shortcut place tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function shortcutEditorTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SHORTCUTS);

    var two = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true });
        const other = document.body.appendChild(document.createElement('div'));
        other.id = 'other';
        other.innerHTML = '<div class="row"><div class="column col-12" id="oc">' + text('<p>Other</p>') + '</div></div>';
        const second = GridEditor.create(other, {
            content_types: ['tinymce'], active_target: true, plugins: window.fixture.plugins(['clipboard', 'sections']),
        });
        let copiesThere = 0;
        other.addEventListener('grideditor:after-copy', function() { copiesThere++; });
        use(drawer('a'));
        use(drawer('oc'));
        press('c');
        const clip = stored();
        const result = { html: clip && /id="oc"/.test(clip.html), here: copies.length, there: copiesThere };
        localStorage.clear();
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        result.outside = press('c');
        result.outsideStored = stored();
        second.destroy();
        other.remove();
        return result;
    `);
    t.check('with two editors, the key goes to the one used last, and only one copy is made (AC-35 rev v2)',
        two.html && two.here === 0 && two.there === 1, two);
    t.check('after a click outside both, the key goes to neither (AC-36)', !two.outside && two.outsideStored === null, two);

    var errors = page.errors();
    t.check('the shortcut editor tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Cut (spec clipboard-cut): its tool and Ctrl+X, a copy and a removal with no
 * question, all or nothing, and the target moving to what held the node.
 */
var CUT = `
    /** The cut's events, in order, as name:source[:cut][:target]. */
    window.watch = function() {
        window.cutLog = [];
        const grid = q('#myGrid');
        ['before-delete', 'after-copy', 'target-change', 'after-delete'].forEach(function(name) {
            const listen = function(e) {
                const d = e.detail;
                window.cutLog.push([name, d.source || '', d.cut === undefined ? '' : String(d.cut),
                    name === 'target-change' ? (d.target ? d.target.id || 'node' : 'none') : ''].filter(Boolean).join(':'));
            };
            grid.addEventListener('grideditor:' + name, listen);
            window.listening.push(['grideditor:' + name, listen]);
        });
    };
    /** A press on the canvas - which says this editor is the one used - then the node as the target, and Ctrl+X. */
    window.cutAt = function(node) {
        q('#myGrid').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        ge.setActiveTarget(node);
        return press('x');
    };
    window.tabsIn = function(list) { return list.map(function(b) { return b.replace(/ge-container ge-container-tabs/g, 'tabs'); }); };
    window.settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 900); }); };
    window.targetId = function() { const n = ge.getActiveTarget(); return n ? n.id || n.className.split(' ')[0] : null; };
    window.confirmShown = function() { return !!q('.ge-confirm.show'); };
    window.ELEMENT = '<div class="row" id="r1"><div class="column col-6" id="a">' + text('<p>A</p>') +
        '<blockquote data-ge-element="quote" id="el">Q</blockquote></div>' +
        '<div class="column col-6" id="b">' + text('<p>B</p>') + '</div></div>' +
        '<div class="container" id="s"><div class="row" id="sr"><div class="column col-12" id="sc">' + text('<p>S</p>') + '</div></div></div>';
    return true;
`;

async function cutTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SHORTCUTS);
    await page.eval(CUT);

    var tabs = await page.eval(`
        start({ confirm_delete: true });
        const made = ge.createContainer('tabs', { appendTo: '#a' });
        use(made.querySelector(':scope > .ge-tools-drawer'));
        watch();
        const taken = press('x');
        const asked = confirmShown();
        await settle();
        const cut = { taken: taken, asked: asked, gone: !q('#a [data-ge-container="tabs"]'), category: stored() && stored().category,
            target: targetId(), log: cutLog.slice() };
        adds.length = 0;
        press('v');
        const back = tabsIn([blocks(q('#a'))])[0];
        use(drawer('r1'));
        press('v');
        const inRow = tabsIn(Array.from(q('#r1').children).filter(function(c) { return c.matches('.column'); }).map(blocks));
        press('v');
        const again = tabsIn(Array.from(q('#r1').children).filter(function(c) { return c.matches('.column'); }).map(blocks));
        return { cut: cut, back: back, inRow: inRow, again: again, adds: adds.slice() };
    `);
    t.check('Ctrl+X on a container stores it, removes it, and leaves its column as the target (AC-01)',
        tabs.cut.taken && tabs.cut.gone && tabs.cut.category === 'container' && tabs.cut.target === 'a', tabs.cut);
    t.check('the events come in order: before-delete, after-copy, target-change, after-delete (AC-02)',
        JSON.stringify(tabs.cut.log) === JSON.stringify(['before-delete:cut', 'after-copy:shortcut:true', 'target-change:a', 'after-delete:cut']), tabs.cut.log);
    t.check('with confirm_delete on, a cut asks nothing (AC-03)', !tabs.cut.asked, tabs.cut);
    t.check('Ctrl+V right after puts it back at the end of its column (AC-05)', /,tabs$/.test(tabs.back), tabs);
    t.check('Ctrl+V into a row pastes it in a new column of the row, from the paste (AC-04)',
        tabs.inRow.length === 3 && tabs.inRow[2] === 'tabs' &&
        tabs.adds.length === 3 && tabs.adds[0].parent === 'a' && tabs.adds[1].parent === 'r1' && tabs.adds.every(function(a) { return a.kind === 'tabs'; }), tabs);
    t.check('what was cut pastes again, as a second copy (AC-06)', tabs.again.length === 4 && tabs.again[3] === 'tabs', tabs);

    var canceled = await page.eval(`
        start({ confirm_delete: true });
        copyText('b');
        use(drawer('r1'));
        watch();
        const cancel = function(e) { e.preventDefault(); };
        q('#myGrid').addEventListener('grideditor:before-delete', cancel);
        const taken = press('x');
        await settle(300);
        q('#myGrid').removeEventListener('grideditor:before-delete', cancel);
        return { taken: taken, row: !!q('#r1'), kept: stored() && stored().category, log: cutLog.slice(), target: targetId() };
    `);
    t.check('a before-delete that cancels cancels the cut: nothing copied, the row and the target stay (AC-07)',
        !canceled.taken && canceled.row && canceled.kept === 'text' && canceled.target === 'r1' &&
        JSON.stringify(canceled.log) === JSON.stringify(['before-delete:cut']), canceled);

    var tool = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: false, confirm_delete: true });
        watch();
        q('#a > .ge-tools-drawer > .ge-cut').click();
        const asked = confirmShown();
        await settle();
        return { asked: asked, gone: !q('#a'), category: stored() && stored().category, log: cutLog.slice() };
    `);
    t.check('without active_target the Cut tool cuts, with no question, from the tool (AC-08)',
        !tool.asked && tool.gone && tool.category === 'column' &&
        JSON.stringify(tool.log) === JSON.stringify(['before-delete:cut', 'after-copy:tool:true', 'after-delete:cut']), tool);

    var toolTarget = await page.eval(`
        start({ confirm_delete: true });
        ge.setActiveTarget(textIn('b'));
        use(q('#a > .ge-tools-drawer > .ge-cut'));
        await settle();
        const elsewhere = { gone: !q('#a'), target: targetId() };
        start({ confirm_delete: true });
        ge.setActiveTarget(textIn('a'));
        use(q('#r1 > .ge-tools-drawer > .ge-cut'));
        await settle();
        return { elsewhere: elsewhere, ancestor: { gone: !q('#r1'), target: targetId() } };
    `);
    t.check('the Cut tool of another column cuts that one, and its row is the target (AC-09)',
        toolTarget.elsewhere.gone && toolTarget.elsewhere.target === 'r1', toolTarget);
    t.check('the Cut tool of the row a target text is in cuts the row, and the target goes to its parent: none at the top (AC-25)',
        toolTarget.ancestor.gone && toolTarget.ancestor.target === null, toolTarget);

    var parents = await page.eval(`
        const out = {};
        start({}, ELEMENT);
        cutAt(q('#b')); await settle(); out.column = targetId();
        start({}, ELEMENT);
        cutAt(textIn('a')); await settle(); out.text = targetId();
        start({}, ELEMENT);
        cutAt(q('#sr')); await settle(); out.sectionRow = targetId();
        start({}, ELEMENT);
        cutAt(q('#el')); await settle(); out.element = targetId();
        start();
        const tabs = ge.createContainer('tabs', { appendTo: '#a' });
        cutAt(tabs.querySelector('.tab-pane.active > .row')); await settle(); out.tabRow = ge.getActiveTarget() === tabs;
        start();
        const accordion = ge.createContainer('accordion', { appendTo: '#b' });
        const item = accordion.querySelector('.accordion-item');
        cutAt(item.querySelector('.accordion-body > .row')); await settle(); out.itemRow = ge.getActiveTarget() === item;
        start();
        cutAt(q('#r1')); await settle(); out.topRow = targetId(); out.topGone = !q('#r1');
        start();
        cutAt(q('#s')); await settle(); out.section = targetId(); out.sectionGone = !q('#s');
        return out;
    `);
    t.check('the target goes to what held the node: a column’s row, a text’s column, a section row’s section, an element’s column (AC-10)',
        parents.column === 'r1' && parents.text === 'a' && parents.sectionRow === 's' && parents.element === 'a', parents);
    t.check('a row in a tab’s pane leaves the tabs as the target (AC-11)', parents.tabRow, parents);
    t.check('a row in an accordion item leaves the item as the target (AC-12)', parents.itemRow, parents);
    t.check('a top level row or a section is cut and leaves no target (AC-13)',
        parents.topGone && parents.topRow === null && parents.sectionGone && parents.section === null, parents);

    var refused = await page.eval(`
        start();
        const tabs = ge.createContainer('tabs', { appendTo: '#a' });
        const tab = tabs.querySelector('.ge-tab');
        const onPane = cutAt(tab);
        const paneKept = !!tab.isConnected && stored() === null;
        ge.setActiveTarget(null);
        const none = press('x');
        return { onPane: onPane, paneKept: paneKept, none: none, stored: stored(), r1: !!q('#r1') };
    `);
    t.check('Ctrl+X on a pane does nothing and leaves the key to the browser (AC-14)', !refused.onPane && refused.paneKept, refused);
    t.check('Ctrl+X with no target does nothing (AC-15)', !refused.none && refused.stored === null && refused.r1, refused);

    var guards = await page.eval(`
        const out = {};
        start();
        use(drawer('r1'));
        const field = document.body.appendChild(document.createElement('input'));
        field.focus();
        out.field = press('x');
        field.remove();
        use(drawer('r1'));
        const range = document.createRange();
        range.selectNodeContents(q('#b p'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        out.selected = press('x');
        window.getSelection().removeAllRanges();
        start({ settings_panel: 'popover', active_target: true });
        use(drawer('r1'));
        q('#r1 > .ge-tools-drawer > .ge-settings').click();
        out.panel = press('x');
        q('#r1 > .ge-tools-drawer > .ge-settings').click();
        start();
        use(drawer('r1'));
        const button = q('.ge-mainControls .gm-preview');
        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        button.click();
        out.preview = press('x');
        button.click();
        start({ clipboard: { shortcuts: false } });
        use(drawer('r1'));
        out.off = press('x');
        out.row = !!q('#r1');
        out.stored = stored();
        return out;
    `);
    t.check('typing, text selected, a panel open, preview or shortcuts: false leave Ctrl+X to the browser (AC-16)',
        !guards.field && !guards.selected && !guards.panel && !guards.preview && !guards.off && guards.row && guards.stored === null, guards);

    var keys = await page.eval(`
        start();
        use(drawer('r1'));
        const shift = press('x', { shiftKey: true });
        const alt = press('x', { altKey: true });
        const held = press('x', { repeat: true });
        const kept = !!q('#r1');
        const meta = press('x', { ctrlKey: false, metaKey: true });
        await settle();
        return { shift: shift, alt: alt, held: held, kept: kept, meta: meta, metaGone: !q('#r1') };
    `);
    t.check('Ctrl+Shift+X, Alt+Ctrl+X and a held Ctrl+X do not cut (AC-17)', !keys.shift && !keys.alt && !keys.held && keys.kept, keys);
    t.check('⌘X cuts like Ctrl+X (AC-18)', keys.meta && keys.metaGone, keys);

    var between = await page.eval(`
        start();
        cutAt(q('#a'));
        await settle();
        const other = document.body.appendChild(document.createElement('div'));
        other.id = 'otherGrid';
        other.innerHTML = '<div class="row"><div class="column col-12" id="x">' + text('<p>X</p>') + '</div></div>';
        const second = GridEditor.create('#otherGrid', Object.assign({}, window.fixture.settings,
            { content_types: ['tinymce'], active_target: true, plugins: window.fixture.plugins(['clipboard']) }));
        use(q('#x > .ge-tools-drawer'));
        const taken = press('v');
        const result = { taken: taken, x: blocks(q('#x')) };
        second.destroy();
        other.remove();
        return result;
    `);
    t.check('what is cut in one editor pastes in another (AC-20)', between.taken && between.x === 'text,row:1', between);

    var copies = await page.eval(`
        start();
        watch();
        copyByTool('#r1');
        use(drawer('a'));
        press('c');
        return cutLog.filter(function(entry) { return entry.indexOf('after-copy') === 0; });
    `);
    t.check('Copy and Ctrl+C say cut: false (AC-21)',
        JSON.stringify(copies) === JSON.stringify(['after-copy:tool:false', 'after-copy:shortcut:false']), copies);

    var drawers = await page.eval(`
        start({ settings_panel: 'offcanvas', active_target: true }, ELEMENT);
        const tabs = ge.createContainer('tabs', { appendTo: '#b' });
        const copiesNow = Array.from(document.querySelectorAll('#myGrid .ge-copy'));
        return {
            count: copiesNow.length,
            besides: copiesNow.every(function(copy) {
                const cut = copy.nextElementSibling;
                return !!cut && cut.matches('.ge-cut') && cut.title === 'Cut' && !!cut.querySelector('i.bi-scissors');
            }),
            panes: tabs.querySelectorAll('.ge-tab > .ge-tools-drawer > .ge-cut').length,
        };
    `);
    t.check('every drawer with Copy has Cut right after it, titled and with the scissors (AC-22)', drawers.count > 5 && drawers.besides, drawers);
    t.check('a pane’s drawer has no Cut (AC-23)', drawers.panes === 0, drawers);

    var midway = await page.eval(`
        start();
        use(drawer('b'));
        press('x');
        const pasted = press('v');
        const during = { b: !!q('#b'), target: targetId() };
        await settle();
        return { pasted: pasted, during: during, columns: q('#r1').querySelectorAll(':scope > .column').length };
    `);
    t.check('Ctrl+V while the cut node is still going out pastes into the new target (AC-24)',
        midway.pasted && midway.during.target === 'r1' && midway.columns === 2, midway);

    var errors = page.errors();
    t.check('the cut tests logged no errors', errors.length === 0, errors.slice(0, 5));

    var noStorage = await t.page(FIXTURE, `window.fixture`);
    await noStorage.eval(SHORTCUTS);
    await noStorage.eval(CUT);
    var memory = await noStorage.eval(`
        Storage.prototype.getItem = function() { throw new Error('denied'); };
        Storage.prototype.setItem = function() { throw new Error('denied'); };
        Storage.prototype.clear = function() {};
        start();
        cutAt(q('#a'));
        await settle();
        const gone = !q('#a');
        use(drawer('b'));
        const taken = press('v');
        return { gone: gone, taken: taken, b: blocks(q('#b')) };
    `);
    t.check('with no storage, a cut still pastes within the page (AC-26)',
        memory.gone && memory.taken && memory.b === 'text,row:1', memory);
}

module.exports = {
    name: 'clipboard',
    description: 'copy and paste, with the clipboard plugin',
    run: async function(t) {
        await toolTests(t);
        await rowTests(t);
        await otherKindTests(t);
        await idTests(t);
        await reachTests(t);
        await noStorageTests(t);
        await shortcutSettingTests(t);
        await shortcutGuardTests(t);
        await shortcutPlaceTests(t);
        await shortcutEditorTests(t);
        await cutTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['clipboard']);
}
