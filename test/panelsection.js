/**
 * Browser tests for what the core gives a plugin to put in a settings panel:
 * a section of its own (panelSection), the dialog it opens in when the
 * panel has no room (ge.openDialog), utility fields that follow the view and
 * the classes wherever they are, the host's style under the preview
 * (ge.hostStyle, ge.setHostStyle), and that `replaces`, gone in 8.0, does
 * nothing.
 *
 * The plugins here are written in the page, so what is tested is the core
 * and not the inline-style plugin, which is test/inlinestyle.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    // A feature plugin with a section for rows, holding a text-align field
    // (the inline-style plugin, which the fixture loads, declares the family)
    GridEditor.features.probe = function(ge) {
        window.handle = ge;
        return {
            panelSection: function(node, kind) {
                if (kind !== 'row') { return null; }
                const body = document.createElement('div');
                body.className = 'probe-body';
                body.appendChild(ge.utilityField(node, 'text-align'));
                return { labelKey: 'panel.done', titleKey: 'panel.title', body: body };
            },
        };
    };

    window.startWith = function(overrides, html) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        window.warnings = [];
        document.querySelector('#myGrid').innerHTML = html || (
            '<div class="row" id="the-row"><div class="col-md-6" id="first"><p>First</p></div>' +
            '<div class="col-md-6" id="second"><p>Second</p></div></div>'
        );
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['probe', 'inline-style']) }, overrides || {}));
    };

    window.row = function() { return document.getElementById('the-row'); };
    window.dialog = function() { return document.querySelector('body > .ge-dialog'); };
    window.dialogOpen = function() {
        const panel = dialog();
        return !!panel && panel.classList.contains('show') && getComputedStyle(panel).display === 'block';
    };
    /** Open and done opening: Bootstrap hands the focus to a modal once it is in. */
    window.dialogShown = function() {
        return dialogOpen() && dialog().contains(document.activeElement);
    };
    window.popoverOpen = function() {
        const panel = document.querySelector('body > .ge-settings-popover');
        return !!panel && getComputedStyle(panel).display !== 'none';
    };
    window.rowDetails = function() {
        const home = document.querySelector('#the-row > .ge-tools-drawer > .ge-details');
        return home || document.querySelector('body > .ge-settings-panel .ge-settings-body > .ge-details');
    };
    window.openRowSettings = function() {
        document.querySelector('#the-row > .ge-tools-drawer > .ge-settings').click();
    };
    window.sectionOf = function(details) {
        return details.querySelector(':scope > .ge-panel-section[data-ge-plugin="probe"]');
    };
    window.order = function(details) {
        return Array.from(details.children).map(function(child) {
            return child.classList.contains('ge-section-title') ? 'title' :
                child.classList.contains('ge-details-general') ? 'general' :
                child.getAttribute('data-ge-plugin') || (child.classList.contains('ge-utilities') ? 'responsive' : '?');
        }).join(',');
    };
    window.type = function(field, value) {
        field.value = value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    return true;
`;

async function placement(t, page) {
    var offcanvas = await page.eval(`
        startWith();
        const details = rowDetails();
        const section = sectionOf(details);
        return {
            order: order(details),
            embedded: !!section && !!section.querySelector(':scope > .probe-body'),
            heading: section ? (section.querySelector(':scope > .ge-section-title') || {}).textContent : null,
            general: (details.querySelector(':scope > .ge-section-title') || {}).textContent,
            button: !!details.querySelector('.ge-panel-section-open'),
            column: !!document.querySelector('#first > .ge-tools-drawer .ge-panel-section[data-ge-plugin="probe"]'),
        };
    `);
    t.check('offcanvas: the section sits between the general fields and Responsive, in registration order (AC-01)',
        /^title,general,(probe,inline-style|inline-style,probe),responsive$/.test(offcanvas.order) && offcanvas.embedded && !offcanvas.button, offcanvas);
    t.check('offcanvas: the general fields and each section have a heading',
        offcanvas.general === 'Id and classes' && offcanvas.heading === 'Done', offcanvas);
    t.check('a plugin that answers null for a node adds nothing there (AC-11)',
        !offcanvas.column, offcanvas);

    var modal = await page.eval(`
        startWith({ settings_panel: 'modal' });
        const section = sectionOf(rowDetails());
        return { embedded: !!section && !!section.querySelector(':scope > .probe-body'), button: !!section.querySelector('.ge-panel-section-open') };
    `);
    t.check('modal: the section is in the panel, not behind a button (AC-02)', modal.embedded && !modal.button, modal);

    for (var mode of ['popover', 'inline']) {
        await page.eval(`startWith({ settings_panel: '${mode}' }); openRowSettings(); return true;`);
        var closed = await page.eval(`
            const section = sectionOf(rowDetails());
            const body = section.querySelector('.probe-body');
            return {
                button: !!section.querySelector(':scope > .ge-panel-section-open'),
                hidden: getComputedStyle(body).display === 'none',
                heading: !!section.querySelector('.ge-section-title'),
            };
        `);
        await page.click('.ge-panel-section[data-ge-plugin="probe"] > .ge-panel-section-open');
        await page.waitFor('dialogShown()', { label: 'the dialog opening' });
        var open = await page.eval(`
            return {
                title: dialog().querySelector('.ge-dialog-title').textContent,
                body: !!dialog().querySelector('.ge-dialog-body > .probe-body'),
                popover: popoverOpen(),
            };
        `);
        t.check(mode + ': a button stands for the section, which opens in the dialog (AC-0' + (mode === 'popover' ? '3' : '4') + ')',
            closed.button && closed.hidden && !closed.heading && open.body && open.title === 'Row settings' &&
            (mode === 'inline' || open.popover), { closed: closed, open: open });

        await page.eval(`dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
        await page.waitFor('!dialogOpen() && !document.querySelector(".modal-backdrop")', { label: 'the dialog closing' });
        var after = await page.eval(`
            const section = sectionOf(rowDetails());
            return {
                back: !!section.querySelector(':scope > .probe-body'),
                popover: popoverOpen(),
                focus: document.activeElement === section.querySelector('.ge-panel-section-open'),
            };
        `);
        if (mode === 'popover') {
            t.check('Escape closes the dialog only: the popover stays, and the button has the focus (AC-05)',
                after.back && after.popover && after.focus, after);
        } else {
            t.check('inline: closing the dialog puts the section back', after.back && after.focus, after);
        }
    }

    var bare = await page.eval(`
        const bootstrapWas = window.bootstrap;
        window.bootstrap = undefined;
        try {
            startWith({ settings_panel: 'popover' });
            openRowSettings();
            document.querySelector('.ge-panel-section[data-ge-plugin="probe"] > .ge-panel-section-open').click();
            const opened = { open: dialogOpen(), backdrop: document.querySelectorAll('body > .ge-settings-backdrop').length };
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            const escaped = { open: dialogOpen(), popover: popoverOpen() };
            document.querySelector('.ge-panel-section[data-ge-plugin="probe"] > .ge-panel-section-open').click();
            dialog().querySelector('.modal-footer .ge-dialog-close').click();
            return { opened: opened, escaped: escaped, done: dialogOpen(), backdrops: document.querySelectorAll('.modal-backdrop').length };
        } finally {
            window.fixture.editor().destroy();
            window.bootstrap = bootstrapWas;
        }
    `);
    t.check('without Bootstrap\'s javascript the dialog opens over a backdrop of its own and closes with Escape or Done (AC-06)',
        bare.opened.open && bare.opened.backdrop === 1 && !bare.escaped.open && bare.escaped.popover &&
        !bare.done && bare.backdrops === 0, bare);
}

async function liveFields(t, page) {
    await page.eval(`
        startWith({ settings_panel: 'popover' }, '<div class="row text-md-center" id="the-row"><div class="col-md-6" id="first"><p>a</p></div></div>');
        window.fixture.editor().changeView('md');
        openRowSettings();
        return true;
    `);
    await page.click('.ge-panel-section[data-ge-plugin="probe"] > .ge-panel-section-open');
    await page.waitFor('dialogShown()', { label: 'the dialog opening' });

    var followed = await page.eval(`
        const select = function() { return dialog().querySelector('.probe-body .ge-utility select'); };
        const md = select().value;
        window.fixture.editor().changeView('lg');
        const lg = { value: select().value, blank: select().options[0].textContent };
        type(rowDetails().querySelector('.ge-classes'), 'text-md-center text-lg-end');
        return { md: md, lg: lg, typed: select().value };
    `);
    t.check('a field made with ge.utilityField, open in the dialog, follows a change of view (AC-60)',
        followed.md === 'center' && followed.lg.value === '' && /md/.test(followed.lg.blank), followed);
    t.check('and what the user types in the classes field of the popover (AC-61)', followed.typed === 'end', followed);
}

async function hostStyle(t, page) {
    var under = await page.eval(`
        startWith({}, '<div class="row p-3" id="the-row"><div class="col-md-6" id="first"><p>a</p></div></div>');
        window.fixture.editor().changeView('md');
        const previewed = row().style.getPropertyPriority('padding-top') === 'important';
        const read = handle.hostStyle(row(), 'padding-top');
        const refused = handle.setHostStyle(row(), 'padding-top', 'abc');
        const wrote = handle.setHostStyle(row(), 'padding-top', '5px');
        const stillPreviewed = row().style.getPropertyPriority('padding-top') === 'important';
        const readBack = handle.hostStyle(row(), 'padding-top').value;
        window.fixture.editor().changeView('all');
        return {
            previewed: previewed, read: read, refused: refused, wrote: wrote, stillPreviewed: stillPreviewed, readBack: readBack,
            after: row().getAttribute('style'),
            record: row().hasAttribute('data-ge-preview'),
            html: window.fixture.editor().getHtml(),
        };
    `);
    t.check('under a breakpoint preview, hostStyle reads the host\'s style, not the preview\'s (AC-33)',
        under.previewed && under.read.value === '' && under.read.priority === '', under);
    t.check('setHostStyle refuses what the browser does not take, and writes nothing', under.refused === false, under);
    t.check('what setHostStyle writes under the preview is the host\'s once the preview comes off (AC-34)',
        under.wrote && under.stillPreviewed && under.readBack === '5px' && under.after === 'padding-top: 5px;' &&
        !under.record && /style="padding-top: 5px;"/.test(under.html), under);

    var cleared = await page.eval(`
        startWith({}, '<div class="row p-3" id="the-row" style="padding-top: 5px"><div class="col-md-6" id="first"><p>a</p></div></div>');
        window.fixture.editor().changeView('md');
        handle.setHostStyle(row(), 'padding-top', '');
        window.fixture.editor().changeView('all');
        return { style: row().getAttribute('style'), whole: handle.hostStyle(row()) };
    `);
    t.check('an empty value takes the property off, and no empty style is left (AC-35)',
        cleared.style === null && cleared.whole === '', cleared);

    var important = await page.eval(`
        startWith({}, '<div class="row" id="the-row" style="color: red !important"><div class="col-md-6" id="first"><p>a</p></div></div>');
        handle.setHostStyle(row(), 'color', 'blue');
        return row().getAttribute('style');
    `);
    t.check('a priority left out keeps the one the property had', important === 'color: blue !important;', important);
}

async function lifecycle(t, page) {
    var closing = [];

    for (var what of ['getHtml', 'delete', 'setLocale', 'destroy']) {
        await page.eval(`
            startWith({ settings_panel: 'inline', confirm_delete: false });
            openRowSettings();
            document.querySelector('.ge-panel-section[data-ge-plugin="probe"] > .ge-panel-section-open').click();
            return true;
        `);
        await page.waitFor('dialogShown()', { label: 'the dialog opening' });

        var html = await page.eval({
            getHtml: `return window.fixture.editor().getHtml();`,
            'delete': `document.querySelector('#the-row > .ge-tools-drawer > .ge-delete-row').click(); return '';`,
            setLocale: `window.fixture.editor().setLocale('es'); return '';`,
            destroy: `window.fixture.editor().destroy(); return '';`,
        }[what]);
        await page.waitFor('!dialogOpen() && !document.querySelector(".modal-backdrop")', { label: 'the dialog closing on ' + what });

        closing.push(await page.eval(`return {
            what: '${what}',
            dialogs: document.querySelectorAll('body > .ge-dialog').length,
            stray: /ge-dialog|probe-body/.test(${JSON.stringify(html)}),
        };`));
    }

    t.check('getHtml, deleting the node, setLocale and destroy close the dialog; the html has none of it (AC-68..70)',
        closing.every(function(entry) { return !entry.stray; }) &&
        closing.filter(function(entry) { return entry.what === 'destroy'; })[0].dialogs === 0, closing);
}

async function replaces(t, page) {
    var result = await page.eval(`
        const calls = [];
        GridEditor.utilities.oldprobe = function() { calls.push('old'); return { families: [] }; };
        GridEditor.utilities.newprobe = function() { calls.push('new'); return { families: [] }; };
        GridEditor.utilities.newprobe.replaces = ['oldprobe'];
        try {
            startWith({ plugins: window.fixture.plugins(['oldprobe', 'newprobe']) });
            return { calls: calls.slice().sort().join(), warnings: window.warnings.filter(function(w) { return /probe/.test(w); }) };
        } finally {
            delete GridEditor.utilities.oldprobe;
            delete GridEditor.utilities.newprobe;
        }
    `);
    t.check('replaces on a factory does nothing: both plugins are used, and nothing is said (AC-03)',
        result.calls === 'new,old' && result.warnings.length === 0, result);
}

module.exports = {
    name: 'panelsection',
    description: 'plugin sections in the settings panel, the dialog, and the host style hooks',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await placement(t, page);
        await liveFields(t, page);
        await hostStyle(t, page);
        await lifecycle(t, page);
        await replaces(t, page);

        var errors = page.errors();
        t.check('the panel section tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
