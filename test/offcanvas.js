/**
 * Browser tests for the offcanvas plugin (spec offcanvas): the markup it
 * makes, the panel rendered in place while editing, its triggers and the
 * orphaned ones, the options given to createContainer and the offcanvas
 * setting, the Offcanvas section of the settings panel, the markup a host
 * wrote, the trigger's d-*-none with responsive, and what getHtml gives,
 * opened by Bootstrap's own javascript.
 *
 * Each check names the acceptance criteria it covers. Copy and paste, and
 * freshNode following `references`, are test/clipboard.js; the core naming
 * no plugin is test/removed.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    await new Promise(function(resolve) {
        const script = document.createElement('script');
        script.src = '../../dist/plugins/grideditor.history.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });

    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.all = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.one = function(selector, root) { return (root || document).querySelector(selector); };
    window.ge = function() { return window.fixture.editor(); };
    window.grid = function() { return one('#myGrid'); };
    window.column = function() { return one('#myGrid .column'); };
    window.containers = function() { return all('#myGrid [data-ge-container="offcanvas"]'); };
    window.oc = function() { return containers()[0]; };
    /** The panel: the child carrying the container's id, .offcanvas or .offcanvas-{bp}. */
    window.panel = function(c) {
        c = c || oc();
        return Array.from(c.children).filter(function(child) { return child.id === c.getAttribute('data-ge-offcanvas-id'); })[0];
    };
    window.trigger = function(c) { return one(':scope > [data-ge-offcanvas-target]', c || oc()); };
    window.drawer = function(c) { return one(':scope > .ge-container-drawer', c || oc()); };
    window.visible = function(node) { return getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0; };
    window.parse = function(html) { const holder = document.createElement('div'); holder.innerHTML = html; return holder; };
    window.exported = function() { return parse(ge().getHtml()); };
    window.wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };
    window.attributes = function(node) {
        return Array.from(node.attributes).map(function(each) { return each.name + '=' + each.value; }).sort().join(' ');
    };

    window.orphans = [];
    grid().addEventListener('grideditor:offcanvas-orphan', function(e) { window.orphans.push(e.detail.missing); });

    /** A fresh editor on one column, with an offcanvas in it unless html says otherwise or create is false. */
    window.start = function(settings, html, create) {
        if (ge()) { window.fixture.teardown(); }
        window.warnings = [];
        window.orphans = [];
        grid().innerHTML = '<div class="row"><div class="column col-12">' + (html || '') + '</div></div>';
        window.fixture.init(Object.assign({
            plugins: window.fixture.plugins(['offcanvas', 'history']),
            confirm_delete: false,
            history: { delay: 20 },
        }, settings || {}));
        if (!html && create !== false) {
            ge().createContainer('offcanvas', Object.assign({ appendTo: column() }, create || {}));
        }
    };

    /** The Offcanvas section of a container's settings panel, opened from its gear. */
    window.section = function(c) {
        c = c || oc();
        one(':scope > .ge-settings', drawer(c)).click();
        return one('[data-ge-plugin="offcanvas"]');
    };
    window.field = function(key, sec) { return one('[data-ge-offcanvas-option="' + key + '"] select, [data-ge-offcanvas-option="' + key + '"] input', sec); };
    window.change = function(input, value) {
        if (input.type === 'checkbox') { input.checked = value; } else { input.value = value; }
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    return true;
`;

async function start(t) {
    var page = await t.page(FIXTURE, 'window.fixture');
    await page.eval(HELPERS);
    return page;
}

async function creationTests(t, page) {
    var offered = await page.eval(`
        start({ toolbar_groups: true }, '', false);
        const tabs = all('.ge-toolbar-groups [data-ge-group]');
        const inGroup = {};
        tabs.forEach(function(tab) {
            tab.click();
            inGroup[tab.getAttribute('data-ge-group')] = all('.ge-toolbar-start [data-ge-toolbar]').filter(visible)
                .map(function(b) { return b.getAttribute('data-ge-container-type'); });
        });
        return { registered: typeof GridEditor.containers.offcanvas, content: inGroup.content || [] };
    `);
    t.check('AC-01 the plugin registers an offcanvas container, and the toolbar offers it in the content tab',
        offered.registered === 'function' && offered.content.indexOf('offcanvas') !== -1, offered);

    var made = await page.eval(`
        start({}, '', { title: 'Menú', trigger_label: 'Ver' });
        const c = oc();
        const p = panel(c);
        const title = one('.offcanvas-title', p);
        return {
            title: title.textContent.trim(),
            label: trigger(c).textContent.trim(),
            id: c.getAttribute('data-ge-offcanvas-id'),
            panelId: p.id,
            target: trigger(c).getAttribute('data-ge-offcanvas-target'),
            labelledBy: p.getAttribute('aria-labelledby'),
            titleId: title.id,
            region: all('.offcanvas-body > .row > .column', p).length,
        };
    `);
    t.check('AC-02 an offcanvas takes its title and trigger label, and its trigger, panel and title point at each other',
        made.title === 'Menú' && made.label === 'Ver' && /^ge-offcanvas-/.test(made.id) &&
        made.panelId === made.id && made.target === made.id && made.labelledBy === made.titleId && made.region === 1,
        made);

    var bare = await page.eval(`
        start({}, '', { trigger: false });
        return { triggers: all(':scope > button, :scope > [data-ge-offcanvas-target]', oc()).length, warnings: window.warnings.length };
    `);
    t.check('AC-12 trigger: false makes no trigger', bare.triggers === 0 && bare.warnings === 0, bare);

    var defaults = await page.eval(`
        start();
        const p = panel();
        return { classes: p.className, attrs: attributes(p) };
    `);
    t.check('AC-13 with no setting, the panel is offcanvas offcanvas-start, with no backdrop, scroll, keyboard or theme attribute',
        defaults.classes === 'offcanvas offcanvas-start' && !/data-bs-/.test(defaults.attrs), defaults);

    var everything = await page.eval(`
        start({}, '', { placement: 'end', backdrop: 'static', scroll: true, keyboard: false, responsive: 'lg', dark: true });
        const p = panel();
        return {
            classes: p.className,
            backdrop: p.getAttribute('data-bs-backdrop'),
            scroll: p.getAttribute('data-bs-scroll'),
            keyboard: p.getAttribute('data-bs-keyboard'),
            theme: p.getAttribute('data-bs-theme'),
            trigger: trigger().className,
        };
    `);
    t.check('AC-14 every option given lands in the panel\'s classes and attributes',
        everything.classes === 'offcanvas-lg offcanvas-end' && everything.backdrop === 'static' &&
        everything.scroll === 'true' && everything.keyboard === 'false' && everything.theme === 'dark',
        everything);
    t.check('AC-34 responsive puts d-{bp}-none on the offcanvas\'s own trigger',
        everything.trigger.split(' ').indexOf('d-lg-none') !== -1, everything);

    var noBackdrop = await page.eval(`
        start({}, '', { backdrop: false });
        return panel().getAttribute('data-bs-backdrop');
    `);
    t.check('AC-15 backdrop: false is data-bs-backdrop="false"', noBackdrop === 'false', noBackdrop);

    var setting = await page.eval(`
        start({ offcanvas: { placement: 'top', dark: true } }, '', { placement: 'bottom' });
        return { classes: panel().className, theme: panel().getAttribute('data-bs-theme') };
    `);
    t.check('AC-16 the call wins over the offcanvas setting, and the setting over the default',
        setting.classes === 'offcanvas offcanvas-bottom' && setting.theme === 'dark', setting);

    var wrong = await page.eval(`
        const each = {};
        [['placement', 'left'], ['responsive', 'xs'], ['backdrop', 'true']].forEach(function(pair) {
            const options = {};
            options[pair[0]] = pair[1];
            start({}, '', options);
            each[pair[0]] = { warnings: window.warnings.slice(), classes: panel().className, backdrop: panel().getAttribute('data-bs-backdrop') };
        });
        return each;
    `);
    t.check('AC-17 a placement it does not take is warned about, naming the key and its values, and start used',
        wrong.placement.warnings.length === 1 && /offcanvas: "left" is not a placement, which takes \["start","end","top","bottom"\]: "start" is used/.test(wrong.placement.warnings[0]) &&
        wrong.placement.classes === 'offcanvas offcanvas-start',
        wrong.placement);
    t.check('AC-18 responsive: \'xs\' is warned about, and the panel stays .offcanvas',
        wrong.responsive.warnings.length === 1 && /is not a responsive/.test(wrong.responsive.warnings[0]) &&
        wrong.responsive.classes === 'offcanvas offcanvas-start',
        wrong.responsive);
    t.check('AC-19 backdrop: \'true\' as a string is warned about, and no data-bs-backdrop is written',
        wrong.backdrop.warnings.length === 1 && /is not a backdrop/.test(wrong.backdrop.warnings[0]) &&
        wrong.backdrop.backdrop === null,
        wrong.backdrop);

    var notOwn = await page.eval(`
        start({}, '', { responsive: 'lg', trigger: false });
        return { triggers: all('[data-ge-offcanvas-target]', oc()).length, warnings: window.warnings.length };
    `);
    t.check('AC-39 responsive with trigger: false makes no trigger and warns about nothing',
        notOwn.triggers === 0 && notOwn.warnings === 0, notOwn);
}

async function canvasTests(t, page) {
    var shapes = await page.eval(`
        const out = {};
        ['start', 'end', 'top', 'bottom'].forEach(function(placement) {
            start({}, '', { placement: placement });
            const p = panel();
            const style = getComputedStyle(p);
            out[placement] = {
                position: style.position,
                visibility: style.visibility,
                transform: style.transform,
                width: Math.round(p.getBoundingClientRect().width),
                room: Math.round(oc().getBoundingClientRect().width),
            };
        });
        return out;
    `);
    t.check('AC-03 every placement is rendered static, visible and unshifted, as wide as its container',
        Object.keys(shapes).every(function(placement) {
            var shape = shapes[placement];
            return shape.position === 'static' && shape.visibility === 'visible' && shape.transform === 'none' &&
                shape.width > shape.room * 0.9;
        }),
        shapes);

    var clicks = await page.eval(`
        start();
        const c = oc();
        const p = panel(c);
        const link = document.createElement('a');
        link.href = '#somewhere';
        link.setAttribute('data-ge-offcanvas-target', c.getAttribute('data-ge-offcanvas-id'));
        link.textContent = 'Menu';
        column().appendChild(link);

        trigger(c).click();
        one('.btn-close', p).click();
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });
        link.dispatchEvent(click);
        await wait(400);

        return {
            shown: p.classList.contains('show') || p.classList.contains('showing'),
            instance: !!(window.bootstrap && bootstrap.Offcanvas.getInstance(p)),
            backdrops: all('.offcanvas-backdrop').length,
            dismiss: one('.btn-close', p).getAttribute('data-bs-dismiss'),
            linkPrevented: click.defaultPrevented,
            hash: location.hash,
        };
    `);
    t.check('AC-04 clicking the trigger and the close button opens and closes nothing, and a link trigger does not navigate',
        !clicks.shown && !clicks.instance && clicks.backdrops === 0 && clicks.dismiss === null &&
        clicks.linkPrevented && clicks.hash === '',
        clicks);

    var folding = await page.eval(`
        start();
        const tool = one(':scope > .ge-toggle-offcanvas', drawer());
        tool.click();
        const folded = visible(panel());
        tool.click();
        return { folded: folded, unfolded: visible(panel()), html: /ge-offcanvas-collapsed/.test(ge().getHtml()) };
    `);
    t.check('AC-10 the fold tool hides the panel and shows it again, and the folding is not in getHtml',
        !folding.folded && folding.unfolded && !folding.html, folding);

    var responsive = await page.eval(`
        start({}, '', { responsive: 'lg' });
        const header = one('.offcanvas-header', panel());
        const title = one('.offcanvas-title', panel());
        const label = one('.ge-pane-label', title);
        return {
            width: window.innerWidth,
            header: getComputedStyle(header).display,
            titleVisible: visible(title),
            editable: !!label,
            trigger: getComputedStyle(trigger()).display,
            exported: one('[data-ge-offcanvas-target]', exported()).className,
        };
    `);
    t.check('AC-27 a responsive panel from lg up still shows its header, with the title editable',
        responsive.width >= 992 && responsive.header !== 'none' && responsive.titleVisible && responsive.editable,
        responsive);
    t.check('AC-40 its trigger, d-lg-none and all, shows while editing and keeps d-lg-none in getHtml',
        responsive.width >= 992 && responsive.trigger !== 'none' &&
        responsive.exported.split(' ').indexOf('d-lg-none') !== -1,
        responsive);
}

async function exportTests(t, page) {
    var exportedMarkup = await page.eval(`
        start({}, '', { title: 'Menu' });
        window.offcanvasId = oc().getAttribute('data-ge-offcanvas-id');
        const html = exported();
        const c = one('[data-ge-container="offcanvas"]', html);
        const classes = all('[class]', c).concat([c]).map(function(node) { return node.getAttribute('class') || ''; }).join(' ');
        return {
            toggle: trigger(c).getAttribute('data-bs-toggle'),
            target: trigger(c).getAttribute('data-bs-target'),
            dismiss: one('.btn-close', c).getAttribute('data-bs-dismiss'),
            leftovers: classes.split(/\\s+/).filter(function(name) { return /^ge-offcanvas-/.test(name); }),
            title: one('.offcanvas-title', c).innerHTML,
            id: window.offcanvasId,
        };
    `);
    t.check('AC-05 getHtml gives the trigger Bootstrap\'s toggle and target, the close button its dismiss, and no ge-offcanvas-* class',
        exportedMarkup.toggle === 'offcanvas' && exportedMarkup.target === '#' + exportedMarkup.id &&
        exportedMarkup.dismiss === 'offcanvas' && exportedMarkup.leftovers.length === 0 && exportedMarkup.title === 'Menu',
        exportedMarkup);

    await page.eval(`
        const html = ge().getHtml();

        // The editor's own copy carries the same ids, and Bootstrap looks up
        // its target by id, so the canvas is emptied first
        ge().destroy();
        grid().innerHTML = '';
        if (one('#authored')) { one('#authored').remove(); }
        const holder = document.createElement('div');
        holder.id = 'authored';
        holder.innerHTML = html;
        document.body.appendChild(holder);
        return true;
    `);
    await page.click('#authored [data-ge-offcanvas-target]');
    await cdp.sleep(600);
    var opened = await page.eval(`
        const p = one('#authored .offcanvas');
        const result = { shown: p.classList.contains('show'), instance: !!bootstrap.Offcanvas.getInstance(p) };
        bootstrap.Offcanvas.getInstance(p).hide();
        await wait(500);
        one('#authored').remove();
        return result;
    `);
    t.check('AC-06 the exported offcanvas opens from its trigger with Bootstrap\'s own javascript',
        opened.shown && opened.instance, opened);
}

async function orphanTests(t, page) {
    var orphans = await page.eval(`
        const host = function(target) { return '<button type="button" class="host" data-ge-offcanvas-target="' + target + '">Open</button>'; };
        const offcanvas = function(id) {
            return '<div data-ge-container="offcanvas" data-ge-offcanvas-id="' + id + '">' +
                '<div class="offcanvas offcanvas-start" id="' + id + '"><div class="offcanvas-header"><h5 class="offcanvas-title">T</h5></div>' +
                '<div class="offcanvas-body"></div></div></div>';
        };
        const out = {};
        [0, 1, 2].forEach(function(count) {
            let html = host('gone');
            for (let i = 1; i <= count; i++) { html += offcanvas('oc-' + i); }
            start({}, html);
            const button = one('#myGrid .host');
            out[count] = {
                target: button.getAttribute('data-ge-offcanvas-target'),
                orphan: button.classList.contains('ge-offcanvas-orphan'),
                events: window.orphans.slice(),
            };
        });
        return out;
    `);
    t.check('AC-07 a trigger pointing at nothing, with one offcanvas in its column, is re-pointed at it quietly',
        orphans[1].target === 'oc-1' && !orphans[1].orphan && orphans[1].events.length === 0, orphans[1]);
    t.check('AC-08 with none in its column, it is marked and offcanvas-orphan says the id it wanted',
        orphans[0].target === 'gone' && orphans[0].orphan && orphans[0].events.join() === 'gone', orphans[0]);
    t.check('AC-09 with two in its column, the same',
        orphans[2].target === 'gone' && orphans[2].orphan && orphans[2].events.join() === 'gone', orphans[2]);

    var mixed = await page.eval(`
        start({ plugins: window.fixture.plugins(['offcanvas']) }, '', false);
        const popupOrphans = [];
        grid().addEventListener('grideditor:popup-orphan', function(e) { popupOrphans.push(e.detail.missing); });
        const popup = ge().createContainer('popup', { trigger: false, appendTo: column() });
        const offcanvas = ge().createContainer('offcanvas', { trigger: false, appendTo: column() });
        column().insertAdjacentHTML('beforeend',
            '<button class="to-popup" data-ge-popup-target="lost-popup">P</button>' +
            '<button class="to-offcanvas" data-ge-offcanvas-target="lost-offcanvas">O</button>');
        ge().reset();
        return {
            popup: one('.to-popup').getAttribute('data-ge-popup-target') === popup.getAttribute('data-ge-popup-id'),
            offcanvas: one('.to-offcanvas').getAttribute('data-ge-offcanvas-target') === offcanvas.getAttribute('data-ge-offcanvas-id'),
            crossed: one('.to-popup').hasAttribute('data-ge-offcanvas-target') || one('.to-offcanvas').hasAttribute('data-ge-popup-target'),
            events: popupOrphans.length + window.orphans.length,
        };
    `);
    t.check('AC-32 beside a popup, each orphan is re-pointed at its own kind only',
        mixed.popup && mixed.offcanvas && !mixed.crossed && mixed.events === 0, mixed);

    var listening = await page.eval(`
        start();
        const id = oc().getAttribute('data-ge-offcanvas-id');
        column().insertAdjacentHTML('beforeend', '<a href="#x" class="link" data-ge-offcanvas-target="' + id + '">Menu</a>');
        ge().reset();
        ge().getHtml();
        ge().reset();

        const prevents = function() {
            let calls = 0;
            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            click.preventDefault = function() { calls++; Event.prototype.preventDefault.call(this); };
            one('#myGrid .link').dispatchEvent(click);
            return calls;
        };
        const editing = prevents();

        ge().destroy();
        // Editing or not, a destroyed editor's guard must be gone. The link is
        // Bootstrap's now, whose own handler would prevent the click too
        one('#myGrid .link').removeAttribute('data-bs-toggle');
        grid().classList.add('ge-editing');
        const destroyed = prevents();
        grid().classList.remove('ge-editing');
        return { editing: editing, destroyed: destroyed };
    `);
    t.check('AC-33 after resets and a getHtml the click guard runs once, and destroy takes it off',
        listening.editing === 1 && listening.destroyed === 0, listening);
}

async function panelTests(t, page) {
    var fields = await page.eval(`
        start({}, '', { placement: 'end', backdrop: 'static', scroll: true, dark: true });
        const sec = section();
        return {
            heading: one('.ge-section-title', sec.closest('.ge-panel-section')).textContent,
            placement: field('placement', sec).value,
            backdrop: field('backdrop', sec).value,
            responsive: field('responsive', sec).value,
            scroll: field('scroll', sec).checked,
            keyboard: field('keyboard', sec).checked,
            dark: field('dark', sec).checked,
        };
    `);
    t.check('AC-20 the Offcanvas section has the six fields, filled from the markup',
        fields.heading === 'Offcanvas' && fields.placement === 'end' && fields.backdrop === 'static' &&
        fields.responsive === '' && fields.scroll && fields.keyboard && fields.dark,
        fields);

    var changes = await page.eval(`
        start();
        const sec = section();
        const steps = {};
        change(field('placement', sec), 'bottom');
        change(field('responsive', sec), 'md');
        steps.md = { panel: panel().className, trigger: trigger().className };
        change(field('responsive', sec), 'lg');
        steps.lg = { panel: panel().className, trigger: trigger().className };
        change(field('responsive', sec), '');
        steps.never = { panel: panel().className, trigger: trigger().className };
        change(field('backdrop', sec), 'static');
        steps.statically = panel().getAttribute('data-bs-backdrop');
        change(field('backdrop', sec), 'true');
        steps.backdrop = panel().getAttribute('data-bs-backdrop');
        return steps;
    `);
    t.check('AC-21 Bottom and md make the panel offcanvas-md offcanvas-bottom, without offcanvas or offcanvas-start',
        changes.md.panel === 'offcanvas-md offcanvas-bottom', changes.md);
    t.check('AC-35 from md to lg, the trigger trades d-md-none for d-lg-none',
        changes.md.trigger.split(' ').indexOf('d-md-none') !== -1 &&
        changes.lg.trigger.split(' ').indexOf('d-lg-none') !== -1 && changes.lg.trigger.split(' ').indexOf('d-md-none') === -1,
        changes);
    t.check('AC-22 Always offcanvas puts .offcanvas back and takes offcanvas-md off',
        changes.never.panel === 'offcanvas offcanvas-bottom', changes.never);
    t.check('AC-36 and the trigger has no d-*-none the plugin put',
        !/d-\\w+-none/.test(changes.never.trigger), changes.never);
    t.check('AC-23 backdrop back to Yes takes data-bs-backdrop off',
        changes.statically === 'static' && changes.backdrop === null, changes);

    var history = await page.eval(`
        start();
        await wait(60);
        const sec = section();
        change(field('placement', sec), 'top');
        await wait(80);
        const changed = panel().className;
        ge().undo();
        await wait(40);
        return { changed: changed, undone: panel().className };
    `);
    t.check('AC-26 a placement chosen in the section is undone like any other change',
        history.changed === 'offcanvas offcanvas-top' && history.undone === 'offcanvas offcanvas-start', history);
}

async function markupTests(t, page) {
    var authored = await page.eval(`
        start({}, '<div data-ge-container="offcanvas" data-ge-offcanvas-id="o1">' +
            '<button type="button" class="btn" data-ge-offcanvas-target="o1">Open</button>' +
            '<div class="offcanvas-xl offcanvas-top" id="o1" data-bs-scroll="true">' +
            '<div class="offcanvas-header"><h5 class="offcanvas-title">T</h5></div><div class="offcanvas-body"></div></div></div>');
        const sec = section();
        return { placement: field('placement', sec).value, responsive: field('responsive', sec).value, scroll: field('scroll', sec).checked };
    `);
    t.check('AC-24 a host\'s responsive, top, scrolling offcanvas is read back into the section',
        authored.placement === 'top' && authored.responsive === 'xl' && authored.scroll, authored);

    var unplaced = await page.eval(`
        const markup = '<div data-ge-container="offcanvas" data-ge-offcanvas-id="o2">' +
            '<div class="offcanvas" id="o2"><div class="offcanvas-header"><h5 class="offcanvas-title">T</h5></div><div class="offcanvas-body"></div></div></div>';
        start({}, markup);
        const sec = section();
        const shown = field('placement', sec).value;
        one(':scope > .ge-settings', drawer()).click();
        const out = one('[data-ge-container="offcanvas"] > .offcanvas', exported());
        return { shown: shown, classes: out.className };
    `);
    t.check('AC-25 with no placement class it shows Start, and opening and closing the section writes nothing',
        unplaced.shown === 'start' && unplaced.classes === 'offcanvas', unplaced);

    var manual = await page.eval(`
        start({}, '<div data-ge-container="offcanvas" data-ge-offcanvas-id="o3">' +
            '<button type="button" class="btn d-sm-none" data-ge-offcanvas-target="o3">Open</button>' +
            '<div class="offcanvas offcanvas-end" id="o3"><div class="offcanvas-header"><h5 class="offcanvas-title">T</h5></div><div class="offcanvas-body"></div></div></div>' +
            '<button type="button" class="outside" data-ge-offcanvas-target="o3">Also</button>');
        change(field('responsive', section()), 'lg');
        return {
            own: trigger().className.split(' '),
            outside: one('#myGrid .outside').className.split(' '),
        };
    `);
    t.check('AC-37 a d-sm-none written by hand stays beside the plugin\'s d-lg-none',
        manual.own.indexOf('d-sm-none') !== -1 && manual.own.indexOf('d-lg-none') !== -1, manual);
    t.check('AC-38 a trigger outside the container gets no d-lg-none',
        manual.outside.indexOf('d-lg-none') === -1, manual);
}

module.exports = {
    name: 'offcanvas',
    description: 'the offcanvas plugin: markup, triggers, options and the settings section',
    run: async function(t) {
        var page = await start(t);

        await creationTests(t, page);
        await canvasTests(t, page);
        await orphanTests(t, page);
        await panelTests(t, page);
        await markupTests(t, page);
        await exportTests(t, page);

        var errors = page.errors();
        t.check('the offcanvas tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['offcanvas']);
}
