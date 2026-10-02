/**
 * Browser tests for ge.refreshToolbar() and a feature plugin's toolbar given
 * as a function: a plugin whose buttons come and go - widgets a user saves,
 * offered on the toolbar to add again - builds the toolbar again when they do.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.q = function(selector) { return document.querySelector(selector); };
    window.qa = function(selector) { return Array.from(document.querySelectorAll(selector)); };
    window.ge = function() { return window.fixture.editor(); };
    window.errorsLogged = [];
    const error = console.error;
    console.error = function() { window.errorsLogged.push(Array.prototype.join.call(arguments, ' ')); error.apply(console, arguments); };

    // Widgets a user saved: each a button that adds its html again
    window.widgets = [{ name: 'Hero', html: '<div class="widget" data-widget="hero"><p>Hero</p></div>' }];
    window.refreshedEarly = null;
    GridEditor.features.widgets = function(handle) {
        window.handle = handle;
        // Before the toolbar exists: nothing to build again, and no error
        try { handle.refreshToolbar(); window.refreshedEarly = 'ok'; } catch (e) { window.refreshedEarly = String(e); }

        return {
            toolbar: function() {
                return window.widgets.map(function(widget) {
                    return {
                        label: widget.name,
                        kind: 'element',
                        group: 'widgets',
                        inColumn: true,
                        create: function() {
                            const holder = document.createElement('div');
                            holder.innerHTML = widget.html;
                            return holder.firstChild;
                        },
                    };
                });
            },
        };
    };

    window.start = function(overrides) {
        if (ge()) { ge().destroy(); }
        window.widgets = [{ name: 'Hero', html: '<div class="widget" data-widget="hero"><p>Hero</p></div>' }];
        q('#myGrid').innerHTML = '<div class="row"><div class="col-md-12"><p>Start</p></div></div>';
        return window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['widgets']) }, overrides || {}));
    };
    window.labels = function() {
        return handle.toolbarItems('widgets').map(function(button) { return button.getAttribute('title') || button.textContent.trim(); });
    };
    window.added = function() { return qa('#myGrid [data-widget]').map(function(node) { return node.getAttribute('data-widget'); }); };
    return true;
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var built = await page.eval(`
        start();
        const first = labels();
        window.widgets.push({ name: 'Footer', html: '<div class="widget" data-widget="footer"><p>Footer</p></div>' });
        const before = labels();
        handle.refreshToolbar();
        return { early: window.refreshedEarly, first: first, before: before, after: labels() };
    `);
    t.check('refreshToolbar before the toolbar exists does nothing, and throws nothing', built.early === 'ok', built);
    t.check('a toolbar given as a function is read when the toolbar is built', JSON.stringify(built.first) === '["Hero"]', built);
    t.check('a saved widget is not on the toolbar until it is built again', JSON.stringify(built.before) === '["Hero"]', built);
    t.check('refreshToolbar builds it from what the function gives now', JSON.stringify(built.after) === '["Hero","Footer"]', built);

    var clicked = await page.eval(`
        handle.toolbarItems('widgets')[1].click();
        handle.toolbarItems('widgets')[1].click();
        return added();
    `);
    t.check('its button adds the widget, as many times as it is clicked, once a click', JSON.stringify(clicked) === '["footer","footer"]', clicked);

    var stale = await page.eval(`
        start();
        const hero = handle.toolbarItems('widgets')[0];
        window.widgets = [{ name: 'Other', html: '<div class="widget" data-widget="other"><p>Other</p></div>' }];
        hero.click();
        const fromStale = added();
        window.widgets = [];
        handle.refreshToolbar();
        return { fromStale: fromStale, left: labels() };
    `);
    t.check('a button not yet rebuilt adds what it was built from, not what the list says now', JSON.stringify(stale.fromStale) === '["hero"]', stale);
    t.check('a widget taken away goes from the toolbar with the next refresh', stale.left.length === 0, stale);

    var once = await page.eval(`
        start();
        handle.refreshToolbar();
        handle.refreshToolbar();
        handle.refreshToolbar();
        return { toolbars: qa('.ge-mainControls').length, before: added().length };
    `);
    await page.click('.ge-mainControls [data-ge-feature="widgets"]');
    await sleep(200);
    var afterClick = await page.eval(`return added().length;`);
    t.check('built again three times: one toolbar, and a real click adds one widget, not three',
        once.toolbars === 1 && once.before === 0 && afterClick === 1, { once: once, afterClick: afterClick });

    var grouped = await page.eval(`
        start({ toolbar_groups: true });
        q('.ge-toolbar-groups [data-ge-group="widgets"]').click();
        window.widgets.push({ name: 'Footer', html: '<div class="widget" data-widget="footer"><p>Footer</p></div>' });
        handle.refreshToolbar();
        const chosen = q('.ge-toolbar-groups [aria-selected="true"]');
        return { chosen: chosen && chosen.getAttribute('data-ge-group'),
            showing: handle.toolbarItems('widgets').filter(function(b) { return !b.closest('.ge-toolbar-stash'); }).length };
    `);
    t.check('with toolbar_groups, the category shown stays shown, its new button with it',
        grouped.chosen === 'widgets' && grouped.showing === 2, grouped);

    var states = await page.eval(`
        start();
        // The preview as a pointer turns it on: over the button, a click, away
        q('.gm-preview').dispatchEvent(new MouseEvent('mouseenter'));
        q('.gm-preview').click();
        q('.gm-preview').dispatchEvent(new MouseEvent('mouseleave'));
        handle.refreshToolbar();
        const preview = q('.gm-preview').classList.contains('active') && !q('#myGrid').classList.contains('ge-editing');
        q('.gm-preview').click();
        const editingAgain = q('#myGrid').classList.contains('ge-editing');
        q('.gm-edit-mode').click();
        handle.refreshToolbar();
        const source = q('.gm-edit-mode').classList.contains('active') && q('.ge-html-output').style.display !== 'none';
        q('.gm-edit-mode').click();
        return { preview: preview, editingAgain: editingAgain, source: source, closed: q('.ge-html-output').style.display === 'none' };
    `);
    t.check('the preview and the source view stay on, and their buttons toggle them off again',
        states.preview && states.editingAgain && states.source && states.closed, states);

    var locale = await page.eval(`
        start();
        window.widgets.push({ name: 'Footer', html: '<p data-widget="footer">Footer</p>' });
        ge().setLocale('en');
        return labels();
    `);
    t.check('setLocale builds it again from the function too', JSON.stringify(locale) === '["Hero","Footer"]', locale);

    var destroyed = await page.eval(`
        start();
        const instance = ge();
        instance.destroy();
        handle.refreshToolbar();
        return qa('.ge-mainControls').length;
    `);
    t.check('after destroy, refreshToolbar does not bring the toolbar back', destroyed === 0, destroyed);

    var errors = await page.eval(`return window.errorsLogged;`);
    t.check('nothing was logged as an error', errors.length === 0 && page.errors().length === 0, { logged: errors, page: page.errors() });
}

module.exports = {
    name: 'refreshtoolbar',
    description: 'ge.refreshToolbar(), and a feature plugin\'s toolbar given as a function',
    run: run,
};
