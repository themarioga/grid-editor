/**
 * Browser tests for settings_panel: a node's settings opened in Bootstrap's
 * offcanvas, popover or modal, outside the canvas, instead of unfolded in
 * its drawer (test/settings.js has the fields themselves, 'inline').
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.startWith = function(overrides) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(
            '<div class="row" id="the-row"><div class="col-md-6" id="first"><p>First</p></div>' +
            '<div class="col-md-6" id="second"><p>Second</p></div></div>'
        );
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['textalign']) }, overrides || {}));
    };

    /** What is open, and where the first column's panel is. */
    window.state = function() {
        const panel = jQuery('body > .ge-settings-panel').filter(function() {
            return jQuery(this).is('.show') || jQuery(this).css('display') === 'block' && !jQuery(this).is('.modal');
        });
        const details = jQuery('#first').data('ge-details');
        return {
            open: panel.map(function() { return this.className.match(/ge-settings-(offcanvas|popover|modal)/)[1]; }).get(),
            title: panel.find('.ge-settings-title').text(),
            detailsInPanel: details.closest('.ge-settings-panel').length === 1,
            detailsHome: details.parent().is('#first > .ge-tools-drawer'),
            target: jQuery('.ge-settings-target').map(function() { return this.id; }).get().join(','),
        };
    };
    return true;
`;

var gear = function(id) { return '#' + id + ' > .ge-tools-drawer > .ge-settings'; };

/**
 * A real click on a gear, once the icons' font has come in and the drawers
 * have their final layout, and a wait for the panel to open or close,
 * however long its transition takes.
 */
async function clickGear(t, page, id, open) {
    await page.eval(`await document.fonts.ready; return true;`);
    await page.click(gear(id));
    await page.waitFor(open ? `state().open.length === 1 && state().target === '${id}'` : `state().open.length === 0`,
        { label: 'the settings of ' + id + (open ? ' opening' : ' closing') });
    await t.sleep(200);
}

async function modeTests(t, mode) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var closed = await page.eval(`
        startWith(${mode === 'default' ? '{}' : JSON.stringify({ settings_panel: mode })});
        const drawer = jQuery('#first > .ge-tools-drawer');
        window.detailsIndex = drawer.children().index(jQuery('#first').data('ge-details'));
        return state();
    `);
    var name = mode === 'default' ? 'offcanvas' : mode;
    var label = mode === 'default' ? 'with no settings_panel, the offcanvas' : 'settings_panel ' + mode;

    t.check(label + ': nothing is open until a gear is clicked',
        closed.open.length === 0 && closed.detailsHome && closed.target === '', closed);

    await clickGear(t, page, 'first', true);
    var opened = await page.eval(`return state();`);
    t.check(label + ': the gear opens the panel there, titled after the node, and marks the node',
        opened.open.join(',') === name && opened.title === 'Column settings' && opened.detailsInPanel &&
        opened.target === 'first',
        opened);

    var edited = await page.eval(`
        const details = jQuery('#first').data('ge-details');
        details.find('.ge-id').val('renamed').trigger('change');
        details.find('.ge-classes').val('my-app-class').trigger('change');
        return { id: jQuery('#myGrid .column').first().attr('id'), classes: jQuery('#myGrid .column').first().attr('class') };
    `);
    t.check(label + ': its fields write to the node as in the drawer',
        edited.id === 'renamed' && /my-app-class/.test(edited.classes), edited);
    await page.eval(`jQuery('#renamed').attr('id', 'first'); return true;`);

    var reviewed = await page.eval(`
        const before = jQuery('#first').data('ge-details').find('.ge-utilities-toggle').text();
        jQuery('#myGrid').gridEditor('changeView', 'md');
        const after = jQuery('#first').data('ge-details').find('.ge-utilities-toggle').text();
        jQuery('#myGrid').gridEditor('changeView', 'all');
        return { before: before, after: after };
    `);
    t.check(label + ': a view change reaches the fields while they are outside the canvas',
        reviewed.before !== reviewed.after && /Small desktop/.test(reviewed.after), reviewed);

    if (mode === 'modal') {
        // The modal is in the way of the other gear: that is what a modal is
        await page.click(gear('second'));
        await t.sleep(500);
    } else {
        await clickGear(t, page, 'second', true);
    }
    var switched = await page.eval(`
        const s = state();
        s.secondIn = jQuery('#second').data('ge-details').closest('.ge-settings-panel').length === 1;
        return s;
    `);
    t.check(label + ': another gear puts the first panel back in its drawer and shows the second',
        mode === 'modal' || (switched.detailsHome && switched.secondIn && switched.target === 'second'),
        switched);

    // Closed the way each is closed
    if (mode === 'modal') {
        await page.eval(`jQuery('body > .ge-settings-modal .modal-footer .ge-settings-close').trigger('click'); return true;`);
    } else {
        await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
    }
    await t.sleep(600);
    var shut = await page.eval(`
        const s = state();
        s.index = jQuery('#first > .ge-tools-drawer').children().index(jQuery('#first').data('ge-details'));
        return s;
    `);
    t.check(label + ': closing puts the panel back where it was in its drawer, and unmarks the node',
        shut.open.length === 0 && shut.detailsHome && shut.target === '' && shut.index === (await page.eval(`return window.detailsIndex;`)),
        shut);

    await clickGear(t, page, 'first', true);
    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return { html: /ge-settings|ge-details|ge-id/.test(html) };
    `);
    // A modal still fading in is closed once it has: Bootstrap would ignore
    // a hide before, and leave it open and empty
    await page.waitFor(`state().open.length === 0`, { label: 'the ' + name + ' closing after getHtml' });
    exported.after = await page.eval(`return state();`);
    t.check(label + ': getHtml with the panel open closes it, and hands back none of it',
        !exported.html && exported.after.open.length === 0 && exported.after.target === '', exported);

    var errors = page.errors();
    t.check(label + ': logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function popoverTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    await page.eval(`startWith({ settings_panel: 'popover' }); return true;`);
    await clickGear(t, page, 'first', true);
    var placed = await page.eval(`
        const pop = document.querySelector('body > .ge-settings-popover').getBoundingClientRect();
        const tool = document.querySelector('#first > .ge-tools-drawer > .ge-settings').getBoundingClientRect();
        return {
            below: pop.top >= tool.bottom && pop.top - tool.bottom < 20,
            overTool: pop.left <= tool.left + tool.width && pop.right >= tool.left,
            inWindow: pop.left >= 0 && pop.right <= innerWidth,
        };
    `);
    t.check('the popover opens under its gear, pointing at it, inside the window',
        placed.below && placed.overTool && placed.inWindow, placed);

    await page.click('#second > .ge-text-block > .ge-content');
    await t.sleep(300);
    var away = await page.eval(`return state();`);
    t.check('a press anywhere else puts the popover away', away.open.length === 0 && away.detailsHome, away);

    await clickGear(t, page, 'first', true);
    await clickGear(t, page, 'first', false);
    var again = await page.eval(`return state();`);
    t.check('its own gear, clicked again, puts it away', again.open.length === 0, again);

    var errors = page.errors();
    t.check('the popover tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function edgeTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var deleted = await page.eval(`
        startWith({ settings_panel: 'offcanvas', confirm_delete: false });
        jQuery(${JSON.stringify(gear('first'))}).trigger('click');
        const open = state().open.join(',');
        jQuery('#first > .ge-tools-drawer > .ge-delete-column').trigger('click');
        return new Promise(function(resolve) {
            setTimeout(function() {
                resolve({ open: open, after: jQuery('body > .ge-settings-panel.show').length, left: jQuery('body .ge-details').closest('.ge-settings-panel').length });
            }, 800);
        });
    `);
    t.check('deleting the node whose settings are open puts them away with it',
        deleted.open === 'offcanvas' && deleted.after === 0 && deleted.left === 0, deleted);

    var plain = await page.eval(`
        const bootstrapWas = window.bootstrap;
        window.bootstrap = undefined;
        startWith({ settings_panel: 'modal' });
        jQuery(${JSON.stringify(gear('first'))}).trigger('click');
        const opened = { shown: jQuery('body > .ge-settings-modal').is('.show'), backdrop: jQuery('body > .ge-settings-backdrop').length };
        jQuery('body > .ge-settings-backdrop').trigger('click');
        const closed = { shown: jQuery('body > .ge-settings-modal').is('.show'), backdrop: jQuery('body > .ge-settings-backdrop').length, home: state().detailsHome };
        jQuery('#myGrid').gridEditor('destroy');
        window.bootstrap = bootstrapWas;
        return { opened: opened, closed: closed };
    `);
    t.check('without Bootstrap\'s javascript the modal still opens, with a backdrop that closes it',
        plain.opened.shown && plain.opened.backdrop === 1 && !plain.closed.shown && plain.closed.backdrop === 0 && plain.closed.home,
        plain);

    var wrong = await page.eval(`
        window.warnings = [];
        startWith({ settings_panel: 'sidebar' });
        jQuery(${JSON.stringify(gear('first'))}).trigger('click');
        return { open: state().open, warned: window.warnings.some(function(w) { return /settings_panel "sidebar"/.test(w); }) };
    `);
    t.check('a settings_panel it does not know warns and opens the offcanvas',
        wrong.open.join(',') === 'offcanvas' && wrong.warned, wrong);

    await page.eval(`
        const script = document.createElement('script');
        script.src = '/dist/locales/grideditor.es.js';
        script.onload = function() { window.spanishLoaded = true; };
        document.head.appendChild(script);
        return true;
    `);
    await page.waitFor(`window.spanishLoaded`, { label: 'the Spanish locale' });

    var relocalized = await page.eval(`
        jQuery('#myGrid').gridEditor('setLocale', 'es');
        jQuery(${JSON.stringify(gear('first'))}).trigger('click');
        const s = state();
        const panels = jQuery('body > .ge-settings-offcanvas').length;
        jQuery('#myGrid').gridEditor('setLocale', 'en');
        return { title: s.title, panels: panels };
    `);
    t.check('setLocale rebuilds the panels in the new language',
        relocalized.title === 'Ajustes: Columna' && relocalized.panels === 1, relocalized);

    var destroyed = await page.eval(`
        jQuery(${JSON.stringify(gear('first'))}).trigger('click');
        jQuery('#myGrid').gridEditor('destroy');
        return { panels: jQuery('body > .ge-settings-panel').length };
    `);
    t.check('destroy takes the panels away', destroyed.panels === 0, destroyed);

    var errors = page.errors();
    t.check('the panel edge tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'panels',
    description: 'settings_panel: offcanvas, popover and modal',
    run: async function(t) {
        await modeTests(t, 'default');
        await modeTests(t, 'popover');
        await modeTests(t, 'modal');
        await popoverTests(t);
        await edgeTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['panels']);
}
