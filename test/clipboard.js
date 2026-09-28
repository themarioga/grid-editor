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
    },
};

if (require.main === module) {
    require('./run').main(['clipboard']);
}
