/**
 * Browser tests for the preview button and the containers that open from a
 * trigger: pressed, a popup's or an offcanvas's trigger opens it with
 * Bootstrap's own javascript, and its close button closes it; let go, an open
 * one closes, and each is left as editing had it. Hovering the button only
 * looks. Also the preview-change event, the onPreviewChange hook, and a
 * getHtml, the source view or destroy in the middle of a preview.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.all = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.one = function(selector, root) { return (root || document).querySelector(selector); };
    window.ge = function() { return window.fixture.editor(); };
    window.grid = function() { return one('#myGrid'); };
    window.column = function() { return one('#myGrid .column'); };
    window.eye = function() { return one('.ge-mainControls .gm-preview'); };
    window.editing = function() { return grid().classList.contains('ge-editing'); };
    window.wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };
    window.parse = function(html) { const holder = document.createElement('div'); holder.innerHTML = html; return holder; };
    window.visible = function(node) { return getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0; };
    window.attributes = function(node) {
        return Array.from(node.attributes).map(function(each) { return each.name + '=' + each.value; }).sort().join(' ');
    };

    window.oc = function() { return one('#myGrid [data-ge-container="offcanvas"]'); };
    window.pop = function() { return one('#myGrid [data-ge-container="popup"]'); };
    window.target = function(c) { return one('#' + c.getAttribute(c.matches('[data-ge-container="popup"]') ? 'data-ge-popup-id' : 'data-ge-offcanvas-id'), c); };
    window.trigger = function(c) { return one(':scope > [data-ge-popup-target], :scope > [data-ge-offcanvas-target]', c); };
    window.dismiss = function(c) { return one('.btn-close', target(c)); };

    window.changes = [];
    grid().addEventListener('grideditor:preview-change', function(e) { window.changes.push(e.detail.previewing); });
    window.orphans = 0;
    grid().addEventListener('grideditor:offcanvas-orphan', function() { window.orphans++; });

    /** A fresh editor on one column, with an offcanvas and a popup in it. */
    window.start = function() {
        if (ge()) { window.fixture.teardown(); }
        window.changes = [];
        window.orphans = 0;
        grid().innerHTML = '<div class="row"><div class="column col-12"></div></div>';
        window.fixture.init({ plugins: window.fixture.plugins(['offcanvas', 'popup']), confirm_delete: false });
        ge().createContainer('offcanvas', { appendTo: column() });
        ge().createContainer('popup', { appendTo: column() });
    };
    return true;
`;

async function start(t) {
    var page = await t.page(FIXTURE, 'window.fixture');
    await page.eval(HELPERS);
    return page;
}

async function hoverTests(t, page) {
    var hover = await page.eval(`
        start();
        eye().dispatchEvent(new MouseEvent('mouseenter'));
        const looking = !editing();
        trigger(oc()).click();
        await wait(400);
        const result = {
            looking: looking,
            toggle: trigger(oc()).getAttribute('data-bs-toggle'),
            shown: target(oc()).classList.contains('show'),
            changes: window.changes.slice(),
        };
        eye().dispatchEvent(new MouseEvent('mouseleave'));
        result.back = editing();
        return result;
    `);
    t.check('hovering the preview button only looks: the triggers open nothing, and no preview-change',
        hover.looking && hover.toggle === null && !hover.shown && hover.changes.length === 0 && hover.back, hover);
}

async function offcanvasTests(t, page) {
    var pressed = await page.eval(`
        start();
        const c = oc();
        const before = attributes(target(c));
        eye().dispatchEvent(new MouseEvent('mouseenter'));
        eye().click();
        eye().dispatchEvent(new MouseEvent('mouseleave'));
        const armed = {
            active: eye().classList.contains('active'),
            editing: editing(),
            toggle: trigger(c).getAttribute('data-bs-toggle'),
            target: trigger(c).getAttribute('data-bs-target'),
            dismiss: dismiss(c).getAttribute('data-bs-dismiss'),
            hidden: !visible(target(c)) || getComputedStyle(target(c)).visibility === 'hidden',
        };

        trigger(c).click();
        await wait(500);
        const opened = { shown: target(c).classList.contains('show'), backdrops: all('.offcanvas-backdrop').length };

        dismiss(c).click();
        await wait(500);
        const closed = { shown: target(c).classList.contains('show'), backdrops: all('.offcanvas-backdrop').length };

        trigger(c).click();
        await wait(500);
        const reopened = target(c).classList.contains('show');

        eye().click();
        await wait(500);
        return {
            armed: armed,
            opened: opened,
            closed: closed,
            reopened: reopened,
            after: {
                editing: editing(),
                active: eye().classList.contains('active'),
                same: attributes(target(c)) === before,
                attrs: attributes(target(c)),
                before: before,
                backdrops: all('.offcanvas-backdrop').length,
                bodyStyle: document.body.getAttribute('style'),
                toggle: trigger(c).getAttribute('data-bs-toggle'),
                dismiss: dismiss(c).getAttribute('data-bs-dismiss'),
                unfolded: visible(target(c)),
                changes: window.changes.slice(),
            },
        };
    `);
    t.check('pressed, the canvas stops editing and an offcanvas trigger and close button reach Bootstrap',
        pressed.armed.active && !pressed.armed.editing && pressed.armed.toggle === 'offcanvas' &&
        /^#ge-offcanvas-/.test(pressed.armed.target) && pressed.armed.dismiss === 'offcanvas' && pressed.armed.hidden,
        pressed.armed);
    t.check('in the preview the trigger opens the offcanvas, with its backdrop, and its close button closes it',
        pressed.opened.shown && pressed.opened.backdrops === 1 && !pressed.closed.shown && pressed.closed.backdrops === 0 &&
        pressed.reopened,
        pressed);
    t.check('let go with the offcanvas open, it closes and is left as editing had it',
        pressed.after.editing && !pressed.after.active && pressed.after.same && pressed.after.backdrops === 0 &&
        !pressed.after.bodyStyle && pressed.after.toggle === null && pressed.after.dismiss === null && pressed.after.unfolded,
        pressed.after);
    t.check('preview-change says pressed and let go, once each',
        JSON.stringify(pressed.after.changes) === '[true,false]', pressed.after.changes);
}

async function popupTests(t, page) {
    var popup = await page.eval(`
        start();
        const c = pop();
        const before = attributes(target(c));
        eye().click();
        trigger(c).click();
        await wait(500);
        const opened = {
            shown: target(c).classList.contains('show'),
            backdrops: all('.modal-backdrop').length,
            dismiss: dismiss(c).getAttribute('data-bs-dismiss'),
        };

        dismiss(c).click();
        await wait(500);
        const closed = { shown: target(c).classList.contains('show'), style: target(c).getAttribute('style') };

        trigger(c).click();
        await wait(500);
        eye().click();
        await wait(500);
        return {
            opened: opened,
            closed: closed,
            after: {
                same: attributes(target(c)) === before,
                attrs: attributes(target(c)),
                before: before,
                backdrops: all('.modal-backdrop').length,
                modalOpen: document.body.classList.contains('modal-open'),
                unfolded: visible(target(c)),
                dismiss: dismiss(c).getAttribute('data-bs-dismiss'),
                toggle: trigger(c).getAttribute('data-bs-toggle'),
            },
        };
    `);
    t.check('in the preview a popup\'s trigger opens it and its close button closes it',
        popup.opened.shown && popup.opened.backdrops === 1 && popup.opened.dismiss === 'modal' && !popup.closed.shown,
        popup);
    t.check('let go with the popup open, it closes and is unfolded again, as editing had it',
        popup.after.same && popup.after.backdrops === 0 && !popup.after.modalOpen && popup.after.unfolded &&
        popup.after.dismiss === null && popup.after.toggle === null,
        popup.after);

    var closedFirst = await page.eval(`
        start();
        const c = pop();
        const before = attributes(target(c));
        eye().click();
        trigger(c).click();
        await wait(500);
        dismiss(c).click();
        await wait(500);
        eye().click();
        return { same: attributes(target(c)) === before, attrs: attributes(target(c)), unfolded: visible(target(c)) };
    `);
    t.check('a popup opened and closed in the preview is unfolded again when it is let go',
        closedFirst.same && closedFirst.unfolded, closedFirst);
}

async function midwayTests(t, page) {
    var read = await page.eval(`
        start();
        const c = oc();
        eye().click();
        trigger(c).click();
        await wait(500);
        const kept = one('.offcanvas', parse(ge().getHtml({ keepEditing: true })));
        const html = parse(ge().getHtml());
        const exported = one('.offcanvas', html);
        const result = {
            kept: attributes(kept),
            exported: attributes(exported),
            stillPreviewing: !editing() && eye().classList.contains('active'),
            stillOpen: target(c).classList.contains('show'),
            toggle: trigger(c).getAttribute('data-bs-toggle'),
            dismiss: dismiss(c).getAttribute('data-bs-dismiss'),
        };
        dismiss(c).click();
        await wait(500);
        result.closes = !target(c).classList.contains('show');
        eye().click();
        await wait(300);
        result.after = attributes(target(c));
        result.orphans = window.orphans;
        return result;
    `);
    t.check('a getHtml in the middle of a preview, keepEditing or not, exports the offcanvas closed, and the preview goes on with it open',
        !/aria-modal|role=|style=|\bshow\b/.test(read.exported) && !/aria-modal|role=|style=|\bshow\b/.test(read.kept) &&
        read.stillPreviewing && read.stillOpen &&
        read.toggle === 'offcanvas' && read.dismiss === 'offcanvas' && read.closes &&
        !/aria-modal|role=|\bshow\b/.test(read.after) && read.orphans === 0,
        read);

    var source = await page.eval(`
        start();
        eye().click();
        trigger(oc()).click();
        await wait(500);
        one('.ge-mainControls .gm-edit-mode').click();
        await wait(500);
        const result = {
            changes: window.changes.slice(),
            active: eye().classList.contains('active'),
            backdrops: all('.offcanvas-backdrop').length,
            bodyStyle: document.body.getAttribute('style'),
            textarea: !/\bshow\b|aria-modal/.test(one('textarea.ge-html-output, textarea').value),
        };
        one('.ge-mainControls .gm-edit-mode').click();
        result.editing = editing();
        return result;
    `);
    t.check('opening the source view in the middle of a preview lets it go, and what it opened closes',
        JSON.stringify(source.changes) === '[true,false]' && !source.active && source.backdrops === 0 &&
        !source.bodyStyle && source.textarea && source.editing,
        source);

    var destroyed = await page.eval(`
        start();
        eye().click();
        trigger(pop()).click();
        await wait(500);
        ge().destroy();
        await wait(500);
        const exported = one('#myGrid .modal');
        return {
            changes: window.changes.slice(),
            backdrops: all('.modal-backdrop').length,
            modalOpen: document.body.classList.contains('modal-open'),
            exported: attributes(exported),
        };
    `);
    t.check('destroy in the middle of a preview lets it go, closes the popup and leaves its markup closed',
        JSON.stringify(destroyed.changes) === '[true,false]' && destroyed.backdrops === 0 && !destroyed.modalOpen &&
        !/aria-modal|role=|style=|\bshow\b/.test(destroyed.exported),
        destroyed);
}

async function raceTests(t, page) {
    var opening = await page.eval(`
        start();
        const c = pop();
        const before = attributes(target(c));
        eye().click();
        trigger(c).click();
        await wait(20);
        eye().click();
        await wait(1000);
        return {
            same: attributes(target(c)) === before,
            attrs: attributes(target(c)),
            backdrops: all('.modal-backdrop').length,
            modalOpen: document.body.classList.contains('modal-open'),
        };
    `);
    t.check('let go while a popup is still opening, it closes once open and is left as editing had it',
        opening.same && opening.backdrops === 0 && !opening.modalOpen, opening);

    var closing = await page.eval(`
        start();
        const c = pop();
        const before = attributes(target(c));
        eye().click();
        trigger(c).click();
        await wait(600);
        dismiss(c).click();
        await wait(20);
        eye().click();
        await wait(1000);
        return {
            same: attributes(target(c)) === before,
            attrs: attributes(target(c)),
            backdrops: all('.modal-backdrop').length,
            unfolded: visible(target(c)),
        };
    `);
    t.check('let go while a popup is still closing, it is left as editing had it once Bootstrap is done',
        closing.same && closing.backdrops === 0 && closing.unfolded, closing);
}

async function noGlobalTests(t, page) {
    // An app that imports Bootstrap as a module has no window.bootstrap; its
    // data api still listens on the document
    var bare = await page.eval(`
        start();
        const c = oc();
        const before = attributes(target(c));
        const saved = window.bootstrap;
        eye().click();
        trigger(c).click();
        await wait(500);
        const shown = target(c).classList.contains('show');
        window.bootstrap = undefined;
        eye().click();
        await wait(500);
        window.bootstrap = saved;
        return {
            shown: shown,
            same: attributes(target(c)) === before,
            attrs: attributes(target(c)),
            backdrops: all('.offcanvas-backdrop').length,
        };
    `);
    t.check('without window.bootstrap, letting the preview go closes the offcanvas through its own close button',
        bare.shown && bare.same && bare.backdrops === 0, bare);
}

module.exports = {
    name: 'preview',
    description: 'the preview button: popups and offcanvases open from their triggers while it is pressed',
    run: async function(t) {
        var page = await start(t);

        await hoverTests(t, page);
        await offcanvasTests(t, page);
        await popupTests(t, page);
        await midwayTests(t, page);
        await raceTests(t, page);
        await noGlobalTests(t, page);

        var errors = page.errors();
        t.check('the preview tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['preview']);
}
