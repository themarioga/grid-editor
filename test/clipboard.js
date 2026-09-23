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
var START = `
    localStorage.clear();
    if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
    jQuery('#myGrid').html(
        '<div class="row" id="hero"><div class="col-lg-12"><h1>First row</h1><p><a href="#hero">Back up</a></p></div></div>' +
        '<div class="row"><div class="col-lg-6"><p>Left</p></div><div class="col-lg-6"><p>Right</p></div></div>'
    );
    window.fixture.init({ plugins: window.fixture.plugins(['clipboard', 'sections']) });
    window.ge = jQuery('#myGrid').data('grideditor');
    window.pastes = [];
    jQuery('#myGrid').on('grideditor:after-add', function(e, payload) {
        if (payload.source === 'paste') { window.pastes.push(payload.kind); }
    });
`;

/**
 * Which paste tools and toolbar buttons are showing. By their own display
 * rather than :visible, because a drawer is only shown on hover.
 */
var SHOWING = `
    const on = function() { return this.style.display !== 'none'; };
    return {
        columnPaste: jQuery('#myGrid .column > .ge-tools-drawer > .ge-paste').filter(on).length,
        rowPaste: jQuery('#myGrid .row > .ge-tools-drawer > .ge-paste').filter(on).length,
        sectionPaste: jQuery('#myGrid .ge-section > .ge-tools-drawer > .ge-paste').filter(on).length,
        toolbar: jQuery('.ge-mainControls [data-ge-feature="clipboard"]').filter(on).map(function() {
            return jQuery(this).attr('title');
        }).get(),
    };
`;

/** Every id in the canvas is there once. */
var IDS_UNIQUE = `
    (function() {
        const ids = jQuery('#myGrid [id]').map(function() { return this.id; }).get();
        return new Set(ids).size === ids.length;
    })()
`;

async function toolTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var tools = await page.eval(START + `
        ge.createSection({ appendTo: jQuery('#myGrid') });
        ge.createContainer('tabs', { appendTo: jQuery('#myGrid .column').eq(1) });
        ge.createElement('<blockquote>Quoted</blockquote>', { appendTo: jQuery('#myGrid .column').eq(2).find('.ge-content') });
        const copyOn = function(selector) {
            return jQuery(selector).map(function() {
                return jQuery(this).children('.ge-tools-drawer').children('.ge-copy').length;
            }).get();
        };
        return {
            rows: copyOn('#myGrid .row'),
            columns: copyOn('#myGrid .column'),
            sections: copyOn('#myGrid .ge-section'),
            containers: copyOn('#myGrid [data-ge-container]'),
            elements: copyOn('#myGrid .ge-element'),
            tabs: copyOn('#myGrid .ge-tab'),
            pasteTools: jQuery('#myGrid .ge-paste').length,
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
        ge.createSection({ appendTo: jQuery('#myGrid') });
        jQuery('#hero > .ge-tools-drawer > .ge-copy').trigger('click');
        const stored = JSON.parse(localStorage.getItem('grideditor.clipboard'));
        return {
            stored: { category: stored.category, kind: stored.kind, clean: !/ge-tools-drawer|ge-editing|ge-copy/.test(stored.html) },
            editing: jQuery('#myGrid').hasClass('ge-editing'),
            flashed: jQuery('#hero > .ge-tools-drawer > .ge-copy').hasClass('ge-copied'),
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
        const paste = jQuery('.ge-mainControls [data-ge-feature="clipboard"]');
        const end = jQuery('.ge-mainControls .ge-toolbar-end');
        return {
            inEnd: paste.length > 0 && paste.parent().is(end),
            iconOnly: paste.get().every(function(button) { return jQuery(button).children('span').length === 0; }),
            // Floated right after the source and preview group, so it stands to its left
            beforeSource: end.prevAll('.btn-group').has('.gm-edit-mode').length === 1,
            sectionStays: jQuery('.ge-addContainerGroup [data-ge-feature="sections"] span').text() === 'Section',
        };
    `);
    t.check('the toolbar\'s paste button is an icon on the right, beside source and preview',
        placed.inEnd && placed.iconOnly && placed.beforeSource && placed.sectionStays, placed);

    // The other paste button is hidden, not gone, and Bootstrap's btn-group
    // rules would square off the corners the two share
    var ROUNDED = `
        const shown = jQuery('.ge-mainControls [data-ge-feature="clipboard"]').filter(function() {
            return this.style.display !== 'none';
        }).first()[0];
        const style = getComputedStyle(shown);
        return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']
            .map(function(corner) { return style[corner]; });
    `;
    var rowCorners = await page.eval(ROUNDED);
    var sectionCorners = await page.eval(`
        jQuery('#myGrid .ge-section > .ge-tools-drawer > .ge-copy').trigger('click');
    ` + ROUNDED);
    await page.eval(`jQuery('#hero > .ge-tools-drawer > .ge-copy').trigger('click');`);
    var rounded = function(corners) { return corners.every(function(radius) { return parseFloat(radius) > 0; }); };
    t.check('whichever paste button shows, all four of its corners are rounded',
        rounded(rowCorners) && rounded(sectionCorners), { row: rowCorners, section: sectionCorners });

    var pasted = await page.eval(`
        const target = jQuery('#myGrid .row').eq(1).children('.column').first();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        const nested = target.children('.row');
        return {
            nested: nested.length,
            text: nested.find('h1').text(),
            id: nested.attr('id'),
            link: nested.find('.ge-content a').attr('href'),
            hasDrawer: nested.children('.ge-tools-drawer').length === 1,
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
        jQuery('#myGrid .ge-section > .ge-tools-drawer > .ge-paste').trigger('click');
        return {
            rows: jQuery('#myGrid .ge-section > .row').length,
            text: jQuery('#myGrid .ge-section > .row').last().find('h1').text(),
            id: jQuery('#myGrid .ge-section > .row').last().attr('id'),
        };
    `);
    t.check('a row pastes into a section too, with an id of its own again',
        intoSection.rows === 2 && intoSection.text === 'First row' && intoSection.id === 'hero-3', intoSection);

    var fromToolbar = await page.eval(`
        const before = jQuery('#myGrid').children('.row').length;
        jQuery('.ge-mainControls [data-ge-feature="clipboard"]').filter(function() { return this.style.display !== 'none'; }).trigger('click');
        return {
            added: jQuery('#myGrid').children('.row').length - before,
            last: jQuery('#myGrid').children('.row').last().find('h1').text(),
        };
    `);
    t.check('the toolbar\'s paste row button puts it at the end of the canvas',
        fromToolbar.added === 1 && fromToolbar.last === 'First row', fromToolbar);

    var canceled = await page.eval(`
        jQuery('#myGrid').one('grideditor:before-add-row', function(e, payload) {
            if (payload.source === 'paste') { e.preventDefault(); }
        });
        const before = jQuery('#myGrid .row').length;
        jQuery('#myGrid .column').first().children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        return { added: jQuery('#myGrid .row').length - before };
    `);
    t.check('canceling before-add-row turns a paste away', canceled.added === 0, canceled);

    var errors = page.errors();
    t.check('the row tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function otherKindTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var column = await page.eval(START + `
        jQuery('#myGrid .row').eq(1).children('.column').last().children('.ge-tools-drawer').children('.ge-copy').trigger('click');
        const showing = (function() { ${SHOWING} })();
        jQuery('#hero > .ge-tools-drawer > .ge-paste').trigger('click');
        return {
            showing: showing,
            columns: jQuery('#hero').children('.column').length,
            text: jQuery('#hero').children('.column').last().children('.ge-text-block').children('.ge-content').text().trim(),
            sized: jQuery('#hero').children('.column').last().hasClass('col-lg-6'),
        };
    `);
    t.check('a column copies and pastes into a row, and only a row',
        column.showing.rowPaste > 0 && column.showing.columnPaste === 0 && column.showing.toolbar.length === 0 &&
        column.columns === 2 && column.text === 'Right' && column.sized,
        column);

    var tabs = await page.eval(`
        const source = jQuery('#myGrid .column').first();
        const made = ge.createContainer('tabs', { tabs: 2, labels: ['One', 'Two'], appendTo: source });
        made.children('.ge-tools-drawer').children('.ge-copy').trigger('click');

        const target = jQuery('#hero').children('.column').last();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');

        const copies = jQuery('#myGrid [data-ge-container="tabs"]');
        const pointsHome = function(container) {
            return container.find('.nav-link').get().every(function(link) {
                return container.find(jQuery(link).attr('data-bs-target')).length === 1;
            });
        };
        return {
            copies: copies.length,
            inTarget: target.children('[data-ge-container="tabs"]').length,
            labels: copies.last().find('.nav-link').text(),
            ownPanes: pointsHome(copies.first()) && pointsHome(copies.last()),
            newIds: copies.first().find('.tab-pane').first().attr('id') !== copies.last().find('.tab-pane').first().attr('id'),
            idsUnique: ${IDS_UNIQUE},
            pastes: window.pastes.slice(),
        };
    `);
    t.check('a tabs container pastes into a column with new ids, each strip pointing at its own panes',
        tabs.copies === 2 && tabs.inTarget === 1 && tabs.labels === 'OneTwo' &&
        tabs.ownPanes && tabs.newIds && tabs.idsUnique && tabs.pastes.indexOf('tabs') !== -1,
        tabs);

    var text = await page.eval(`
        const source = jQuery('#myGrid').children('.row').eq(1).children('.column').first().children('.ge-text-block').first();
        const area = source.children('.ge-content').html('<p>Copied text</p>');
        source.children('.ge-tools-drawer').children('.ge-copy').trigger('click');
        const stored = JSON.parse(localStorage.getItem('grideditor.clipboard'));
        const showing = (function() { ${SHOWING} })();
        // Its drawer is beside the content area, not in it, and the text block
        // around both is a new one: copying took the canvas out of editing
        const flashed = area.parent('.ge-text-block').children('.ge-tools-drawer').children('.ge-copy').hasClass('ge-copied');

        const target = jQuery('#hero').children('.column').last();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        const pasted = target.children('.ge-text-block').last();
        return {
            category: stored.category,
            showing: showing,
            flashed: flashed,
            text: pasted.children('.ge-content').text(),
            drawer: pasted.children('.ge-tools-drawer').length,
        };
    `);
    t.check('a text block copies and pastes into a column, as a text block of its own',
        text.category === 'text' && text.showing.columnPaste > 0 && text.showing.rowPaste === 0 &&
        text.showing.toolbar.length === 0 && text.flashed && text.text === 'Copied text' && text.drawer === 1,
        text);

    var element = await page.eval(`
        const area = jQuery('#hero').children('.column').first().children('.ge-text-block').children('.ge-content');
        const quote = ge.createElement('<blockquote>Quoted</blockquote>', { type: 'quote', appendTo: area });
        quote.children('.ge-tools-drawer').children('.ge-copy').trigger('click');

        const target = jQuery('#myGrid .row').eq(1).children('.column').first();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        return {
            inArea: target.children('.ge-text-block').children('.ge-content').last().children('.ge-element').length,
            text: target.find('.ge-element blockquote').text(),
            kind: target.find('.ge-element').attr('data-ge-element'),
        };
    `);
    t.check('an element pastes into the column\'s content area, as an element',
        element.inArea === 1 && element.text === 'Quoted' && element.kind === 'quote', element);

    var section = await page.eval(`
        const made = ge.createSection({ appendTo: jQuery('#myGrid') });
        made.children('.ge-tools-drawer').children('.ge-copy').trigger('click');
        const showing = (function() { ${SHOWING} })();
        jQuery('.ge-mainControls [data-ge-feature="clipboard"]').filter(function() { return this.style.display !== 'none'; }).trigger('click');
        return {
            showing: showing,
            sections: jQuery('#myGrid').children('.ge-section').length,
        };
    `);
    t.check('a section pastes onto the canvas from the toolbar, and nowhere else',
        section.showing.toolbar.join(',') === 'Paste section' && section.showing.columnPaste === 0 &&
        section.showing.rowPaste === 0 && section.showing.sectionPaste === 0 && section.sections === 2,
        section);

    var html = await page.eval(`return jQuery('#myGrid').gridEditor('getHtml');`);
    t.check('what was pasted comes out of getHtml with no clipboard furniture',
        !/ge-copy|ge-paste|ge-copied/.test(html), html.slice(0, 300));

    var errors = page.errors();
    t.check('the other kinds tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** The canvas as getHtml gives it, parsed, where Bootstrap's own attributes are back. */
var EXPORTED = `
    const exported = document.createElement('div');
    exported.innerHTML = jQuery('#myGrid').gridEditor('getHtml');
    const ids = Array.from(exported.querySelectorAll('[id]')).map(function(node) { return node.id; });
    const unique = new Set(ids).size === ids.length;
`;

async function idTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var accordion = await page.eval(START + `
        const source = jQuery('#hero').children('.column').first();
        ge.createContainer('accordion', { items: 2, appendTo: source })
            .children('.ge-tools-drawer').children('.ge-copy').trigger('click');

        const target = jQuery('#myGrid').children('.row').eq(1).children('.column').first();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');
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
        jQuery('#myGrid').on('grideditor:popup-orphan', function(e, payload) { window.orphans.push(payload.missing); });

        const source = jQuery('#hero').children('.column').first();
        const made = ge.createContainer('popup', { title: 'Terms', appendTo: source });
        const original = made.attr('data-ge-popup-id');

        // A trigger the host wrote elsewhere on the page, for the original
        jQuery('#myGrid').children('.row').eq(1).children('.column').last().children('.ge-text-block').children('.ge-content')
            .append('<button type="button" class="btn btn-link" id="host-trigger" data-ge-popup-target="' + original + '">Terms</button>');
        ge.reset();

        jQuery('[data-ge-popup-id="' + original + '"]').children('.ge-tools-drawer').children('.ge-copy').trigger('click');
        const target = jQuery('#myGrid').children('.row').eq(1).children('.column').first();
        target.children('.ge-tools-drawer').children('.ge-paste').trigger('click');
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
        const column = jQuery('#hero').children('.column').first();
        const made = ge.createContainer('popup', { trigger: false, appendTo: column });
        const original = made.attr('data-ge-popup-id');

        // The host's trigger, in the same row as the popup it opens
        column.children('.ge-text-block').children('.ge-content').append('<a href="#" class="host-trigger" data-ge-popup-target="' + original + '">Open</a>');
        ge.reset();

        jQuery('#hero > .ge-tools-drawer > .ge-copy').trigger('click');
        jQuery('#myGrid').children('.row').eq(1).children('.column').first()
            .children('.ge-tools-drawer').children('.ge-paste').trigger('click');
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

    await first.eval(`jQuery('#hero > .ge-tools-drawer > .ge-copy').trigger('click');`);
    await sleep(300);

    var seen = await second.eval(SHOWING);
    t.check('a row copied in one tab shows as pasteable in another, without a reload',
        seen.columnPaste > 0 && seen.toolbar.join(',') === 'Paste row', seen);

    var pasted = await second.eval(`
        jQuery('#myGrid .column').first().children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        return {
            text: jQuery('#myGrid .column').first().children('.row').find('h1').text(),
            id: jQuery('#myGrid .column').first().children('.row').attr('id'),
        };
    `);
    t.check('and pastes there', pasted.text === 'First row' && pasted.id === 'hero-2', pasted);

    var reloaded = await t.page(FIXTURE, `window.fixture`);
    var afterReload = await reloaded.eval(START.replace('localStorage.clear();', '') + SHOWING);
    t.check('what was copied survives a reload', afterReload.columnPaste > 0, afterReload);

    var withoutTabs = await reloaded.eval(`
        ge.createContainer('tabs', { appendTo: jQuery('#myGrid .column').first() })
            .children('.ge-tools-drawer').children('.ge-copy').trigger('click');
        jQuery('#myGrid').gridEditor('destroy');
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
        jQuery('#hero > .ge-tools-drawer > .ge-copy').trigger('click');
        const showing = (function() { ${SHOWING} })();
        jQuery('#myGrid .column').first().children('.ge-tools-drawer').children('.ge-paste').trigger('click');
        return {
            showing: showing,
            pasted: jQuery('#myGrid .column').first().children('.row').length,
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
