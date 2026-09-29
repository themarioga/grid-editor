/**
 * Browser tests for the tabs plugin's variants: a tabs container's style,
 * width, alignment and vertical layout, chosen in its settings panel, given
 * to createContainer or to the tabs setting, and read back from the markup;
 * and how the canvas lays a vertical container out in each view.
 *
 * What a tabs container is and does otherwise is test/containers.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.ge = function() { return window.fixture.editor(); };
    window.column = function() { return document.querySelector('#myGrid .column'); };
    window.tabs = function() { return document.querySelector('#myGrid [data-ge-container="tabs"]'); };
    window.strip = function(container) { return (container || tabs()).querySelector(':scope > .nav'); };
    window.sorted = function(node) { return (node.getAttribute('class') || '').split(/\\s+/).filter(function(name) {
        return name && !/^ge-/.test(name) && name !== 'nav';
    }).sort().join(' '); };

    window.events = [];
    document.querySelector('#myGrid').addEventListener('grideditor:after-utility', function() { window.events.push('after-utility'); });

    /** A fresh editor on one column, with a tabs container in it unless html says otherwise. */
    window.start = function(settings, html) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        window.warnings = [];
        window.events = [];
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-12">' + (html || '') + '</div></div>';
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['tabs', 'accordion', 'clipboard']) }, settings || {}));
        if (!html) { ge().createContainer('tabs', { tabs: 3, labels: ['One', 'Two', 'Three'], appendTo: column() }); }
    };

    /** The container's Tabs section, in its drawer's panel. */
    window.section = function(node) {
        return (node || tabs()).querySelector(':scope > .ge-tools-drawer > .ge-details [data-ge-plugin="tabs"]');
    };
    window.field = function(key, node) {
        return section(node).querySelector('[data-ge-tabs-variant="' + key + '"] select');
    };
    window.choose = function(key, value, node) {
        const select = field(key, node);
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    window.values = function(node) {
        return ['variant', 'width', 'align', 'vertical'].map(function(key) { return field(key, node).value; }).join(',');
    };
    window.box = function(node) { return node.getBoundingClientRect(); };
    /** Where the strip and the active pane are: beside each other, or one above the other. */
    window.layout = function(container) {
        container = container || tabs();
        const nav = box(strip(container));
        const pane = box(container.querySelector('.tab-pane.active'));
        const drawer = box(container.querySelector(':scope > .ge-tools-drawer'));
        return {
            beside: pane.left >= nav.right - 1 && pane.top < nav.bottom,
            above: pane.top >= nav.bottom - 1,
            drawerOnTop: drawer.bottom <= nav.top + 1 && drawer.bottom <= pane.top + 1,
            drawerWide: Math.abs(drawer.width - container.getBoundingClientRect().width) < 16,
            marked: container.getAttribute('data-ge-tabs-layout'),
        };
    };
    return true;
`;

async function panel(t, page) {
    var built = await page.eval(`
        start();
        const details = tabs().querySelector(':scope > .ge-tools-drawer > .ge-details');
        const order = Array.from(details.children).map(function(child) { return child.className.split(' ')[0]; });
        const accordion = ge().createContainer('accordion', { items: 1, appendTo: column() });
        return {
            classes: sorted(strip()),
            container: sorted(tabs()),
            order: order.join(','),
            section: !!section(),
            fields: Array.from(section().querySelectorAll('[data-ge-tabs-variant]')).map(function(each) { return each.getAttribute('data-ge-tabs-variant'); }).join(','),
            labels: Array.from(section().querySelectorAll('label')).map(function(each) { return each.textContent; }).join(','),
            layouts: Array.from(field('vertical').options).map(function(option) { return option.value; }).join(','),
            values: values(),
            accordion: !!section(accordion),
            row: !!document.querySelector('#myGrid .row > .ge-tools-drawer [data-ge-plugin="tabs"]'),
        };
    `);
    t.check('a container made with no setting is nav-tabs and horizontal, as before (AC-01)',
        built.classes === 'nav-tabs' && built.container === '', built);
    t.check('its panel has a Tabs section with Style, Width, Alignment and Layout, at tabs, natural, start and horizontal (AC-02)',
        built.section && /ge-details-general,ge-panel-section/.test(built.order) &&
        built.fields === 'variant,width,align,vertical' && built.labels === 'Style,Width,Alignment,Layout' &&
        built.layouts === 'false,true,sm,md,lg,xl,xxl' && built.values === 'tabs,natural,start,false', built);
    t.check('an accordion and a row have none (AC-03)', !built.accordion && !built.row, built);

    var written = await page.eval(`
        start();
        const steps = {};
        choose('variant', 'pills'); steps.pills = sorted(strip());
        choose('variant', 'underline'); steps.underline = sorted(strip());
        start();
        choose('width', 'fill'); steps.fill = sorted(strip());
        choose('width', 'justified'); steps.justified = sorted(strip());
        choose('width', 'natural'); steps.natural = sorted(strip());
        choose('align', 'center'); steps.center = sorted(strip());
        choose('align', 'end'); steps.end = sorted(strip());
        choose('align', 'start'); steps.start = sorted(strip());
        choose('align', 'center');
        choose('width', 'fill');
        steps.fillOverCenter = { classes: sorted(strip()), alignOff: field('align').disabled };
        return steps;
    `);
    t.check('Style writes one of nav-pills and nav-underline in place of nav-tabs (AC-04)',
        written.pills === 'nav-pills' && written.underline === 'nav-underline', written);
    t.check('Width writes nav-fill, nav-justified or neither (AC-05)',
        written.fill === 'nav-fill nav-tabs' && written.justified === 'nav-justified nav-tabs' && written.natural === 'nav-tabs', written);
    t.check('Alignment writes justify-content-center, -end or neither (AC-06)',
        written.center === 'justify-content-center nav-tabs' && written.end === 'justify-content-end nav-tabs' &&
        written.start === 'nav-tabs', written);
    t.check('a full width takes the alignment off and turns it off (AC-07)',
        written.fillOverCenter.classes === 'nav-fill nav-tabs' && written.fillOverCenter.alignOff, written);

    var vertical = await page.eval(`
        start();
        choose('vertical', 'true');
        const always = { container: sorted(tabs()), strip: sorted(strip()), orientation: strip().getAttribute('aria-orientation'),
            widthOff: field('width').disabled, alignOff: field('align').disabled };
        start();
        choose('vertical', 'md');
        const md = { container: sorted(tabs()), strip: sorted(strip()), orientation: strip().getAttribute('aria-orientation') };
        choose('vertical', 'lg');
        const lg = { container: sorted(tabs()), strip: sorted(strip()) };
        start({}, '<div data-ge-container="tabs"><ul class="nav nav-tabs nav-justified justify-content-end" role="tablist">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#a">A</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="a"><div class="row"><div class="column col-12"></div></div></div></div></div>');
        choose('vertical', 'true');
        const cleared = sorted(strip());
        start({}, '<div data-ge-container="tabs" class="d-md-flex align-items-md-start shadow"><ul class="nav nav-pills flex-md-column me-md-3 mb-2" role="tablist" aria-orientation="vertical">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#b">B</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="b"><div class="row"><div class="column col-12"></div></div></div></div></div>');
        const read = values();
        choose('vertical', 'false');
        return { always: always, md: md, lg: lg, cleared: cleared, read: read,
            horizontal: { container: sorted(tabs()), strip: sorted(strip()), orientation: strip().getAttribute('aria-orientation') } };
    `);
    t.check('Vertical writes d-flex align-items-start and flex-column me-3, and turns width and alignment off (AC-08)',
        vertical.always.container === 'align-items-start d-flex' && vertical.always.strip === 'flex-column me-3 nav-tabs' &&
        vertical.always.orientation === 'vertical' && vertical.always.widthOff && vertical.always.alignOff, vertical.always);
    t.check('Vertical from md writes the md classes (AC-09)',
        vertical.md.container === 'align-items-md-start d-md-flex' && vertical.md.strip === 'flex-md-column me-md-3 nav-tabs' &&
        vertical.md.orientation === 'vertical', vertical.md);
    t.check('going vertical takes nav-justified and justify-content-end off (AC-10)', vertical.cleared === 'flex-column me-3 nav-tabs', vertical);
    t.check('another breakpoint leaves only its classes (AC-11)',
        vertical.lg.container === 'align-items-lg-start d-lg-flex' && vertical.lg.strip === 'flex-lg-column me-lg-3 nav-tabs', vertical.lg);
    t.check('markup is read back: pills, vertical from md', vertical.read === 'pills,natural,start,md', vertical);
    t.check('horizontal takes the layout classes off and keeps the others (AC-12)',
        vertical.horizontal.container === 'shadow' && vertical.horizontal.strip === 'mb-2 nav-pills' &&
        vertical.horizontal.orientation === null, vertical.horizontal);
}

async function markup(t, page) {
    var read = await page.eval(`
        const pane = function(id) {
            return '<div class="tab-content"><div class="tab-pane active" id="' + id + '"><div class="row"><div class="column col-12"></div></div></div></div>';
        };
        start({}, '<div data-ge-container="tabs"><ul class="nav nav-pills" role="tablist">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' + pane('p1') + '</div>');
        tabs().querySelector(':scope > .ge-tools-drawer .ge-add-pane').click();
        const pills = {
            drawers: tabs().querySelectorAll('.ge-tab > .ge-tools-drawer').length,
            tabs: tabs().querySelectorAll('.ge-tab').length,
            value: field('variant').value,
        };
        start({}, '<div data-ge-container="tabs"><ul class="nav" role="tablist">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p2">One</button></li></ul>' + pane('p2') + '</div>');
        const bare = { tab: tabs().querySelectorAll('.ge-tab').length, value: field('variant').value };
        choose('variant', 'pills');
        bare.after = sorted(strip());
        start({}, '<div data-ge-container="tabs" class="d-lg-flex"><ul class="nav nav-tabs flex-md-column" role="tablist">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p3">One</button></li></ul>' + pane('p3') + '</div>');
        ge().changeView('xl');
        const mixed = { value: field('vertical').value, marked: tabs().getAttribute('data-ge-tabs-layout') };
        return { pills: pills, bare: bare, mixed: mixed };
    `);
    t.check('a hand-written nav-pills strip is tabs: drawers, add a tab, and Style reads Pills (AC-18)',
        read.pills.drawers === 2 && read.pills.tabs === 2 && read.pills.value === 'pills', read.pills);
    t.check('a strip with no style class is tabs too, and Pills adds nav-pills (AC-19)',
        read.bare.tab === 1 && read.bare.value === 'tabs' && read.bare.after === 'nav-pills', read.bare);
    t.check('flex and column at different breakpoints read as horizontal, and are left alone on the canvas (AC-20)',
        read.mixed.value === 'false' && read.mixed.marked === null, read.mixed);
}

async function api(t, page) {
    var made = await page.eval(`
        start({}, ' ');
        const one = ge().createContainer('tabs', { variant: 'underline', width: 'fill', align: 'end', vertical: 'xl', appendTo: column() });
        const created = { strip: sorted(strip(one)), container: sorted(one) };
        start({ tabs: { variant: 'pills', vertical: 'md' } }, ' ');
        const byApi = ge().createContainer('tabs', { variant: 'tabs', appendTo: column() });
        const bySetting = ge().createContainer('tabs', { appendTo: column() });
        const defaulted = { api: sorted(strip(byApi)), apiContainer: sorted(byApi), setting: sorted(strip(bySetting)), settingContainer: sorted(bySetting) };
        start({ tabs: { variant: 'pills' } }, '<div data-ge-container="tabs"><ul class="nav nav-tabs" role="tablist">' +
            '<li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#e">E</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="e"><div class="row"><div class="column col-12"></div></div></div></div></div>');
        const existing = sorted(strip());
        start({ tabs: { vertical: 'xs' } }, ' ');
        const wrong = ge().createContainer('tabs', { variant: 'cards', appendTo: column() });
        return { created: created, defaulted: defaulted, existing: existing,
            wrong: { strip: sorted(strip(wrong)), container: sorted(wrong), warnings: window.warnings.filter(function(w) { return /^grid-editor: tabs:/.test(w); }) } };
    `);
    t.check('createContainer takes the variants, and vertical wins over width and alignment (AC-21)',
        made.created.strip === 'flex-xl-column me-xl-3 nav-underline' && made.created.container === 'align-items-xl-start d-xl-flex', made.created);
    t.check('the tabs setting is the default, and an option given wins (AC-22)',
        made.defaulted.setting === 'flex-md-column me-md-3 nav-pills' && made.defaulted.settingContainer === 'align-items-md-start d-md-flex' &&
        made.defaulted.api === 'flex-md-column me-md-3 nav-tabs', made.defaulted);
    t.check('a container already there keeps its classes (AC-23)', made.existing === 'nav-tabs', made);
    t.check('a value a variant does not take warns, naming the key and its values, and the default is used (AC-24)',
        made.wrong.strip === 'nav-tabs' && made.wrong.container === '' && made.wrong.warnings.length === 2 &&
        made.wrong.warnings.some(function(w) { return /"cards" is not a variant, which takes \["tabs","pills","underline"\]: "tabs" is used/.test(w); }) &&
        made.wrong.warnings.some(function(w) { return /"xs" is not a vertical/.test(w); }), made.wrong);

    var toolbar = await page.eval(`
        start({ tabs: { variant: 'pills', vertical: 'md' } }, ' ');
        const button = Array.from(document.querySelectorAll('.ge-mainControls button, .ge-mainControls a')).filter(function(each) {
            return /Tabs/.test(each.textContent) || each.getAttribute('title') === 'Tabs';
        })[0];
        button.click();
        return { strip: sorted(strip()), container: sorted(tabs()) };
    `);
    t.check('the toolbar makes it with the setting too (AC-22)',
        toolbar.strip === 'flex-md-column me-md-3 nav-pills' && toolbar.container === 'align-items-md-start d-md-flex', toolbar);

    var exported = await page.eval(`
        start();
        choose('variant', 'pills');
        choose('vertical', 'md');
        ge().changeView('md');
        const html = ge().getHtml();
        return { html: html, events: window.events.length };
    `);
    t.check('getHtml has the classes and aria-orientation, and nothing of the editor (AC-25)',
        /<div data-ge-container="tabs" class="d-md-flex align-items-md-start">/.test(exported.html) &&
        /<ul class="nav nav-pills flex-md-column me-md-3" role="tablist" aria-orientation="vertical">/.test(exported.html) &&
        !/data-ge-tabs-layout|ge-tabs-variant|style=/.test(exported.html), exported.html.slice(0, 400));
    t.check('choosing a variant fires none of the editor\'s events (AC-26)', exported.events === 0, exported);

    var spanish = await page.eval(`
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        start({ locale: 'es' });
        return {
            labels: Array.from(section().querySelectorAll('label')).map(function(each) { return each.textContent; }).join(','),
            pills: field('variant').options[1].textContent,
            md: field('vertical').options[3].textContent,
        };
    `);
    t.check('the section speaks Spanish (AC-28)',
        spanish.labels === 'Estilo,Ancho,Alineación,Disposición' && spanish.pills === 'Pills' && spanish.md === 'Vertical desde md', spanish);
}

async function canvas(t, page) {
    var views = await page.eval(`
        start();
        choose('vertical', 'md');
        const read = function(view) { ge().changeView(view); return layout(); };
        return { sm: read('sm'), md: read('md'), xl: read('xl'), back: (ge().changeView('sm'), ge().changeView('md'), layout()) };
    `);
    t.check('vertical from md: the strip above the panes at sm, beside them at md and xl (AC-13)',
        views.sm.above && !views.sm.beside && views.sm.marked === 'horizontal' &&
        views.md.beside && views.md.marked === 'vertical' && views.xl.beside, views);
    t.check('a view change turns it without reopening anything (AC-29)', views.back.beside, views.back);

    var alone = await page.eval(`
        start();
        choose('vertical', 'true');
        return layout();
    `);
    t.check('vertical, without style: the drawer on top and wide, the strip at the left and the pane beside it (AC-14)',
        alone.drawerOnTop && alone.drawerWide && alone.beside, alone);

    var withStyle = await page.eval(`
        if (window.fixture.editor()) { window.fixture.teardown(); }
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-12"></div></div>';
        window.fixture.init({ plugins: window.fixture.plugins(['tabs', 'style']) });
        ge().createContainer('tabs', { tabs: 2, vertical: true, appendTo: column() });
        const all = layout();
        ge().changeView('md');
        return { all: all, md: layout() };
    `);
    t.check('the same with style loaded (AC-15)',
        withStyle.all.drawerOnTop && withStyle.all.beside && withStyle.md.drawerOnTop && withStyle.md.beside, withStyle);

    var clicked = await page.eval(`
        start();
        choose('vertical', 'md');
        ge().changeView('md');
        tabs().querySelectorAll('.nav-link')[1].click();
        await new Promise(function(resolve) { setTimeout(resolve, 400); });
        const panes = Array.from(tabs().querySelectorAll('.tab-pane'));
        return { second: panes[1].classList.contains('active'), first: panes[0].classList.contains('active') };
    `);
    t.check('a click on another tab shows its pane (AC-16)', clicked.second && !clicked.first, clicked);

    await page.eval(`
        start();
        choose('vertical', 'true');
        const all = tabs().querySelectorAll('.ge-tab');
        all[0].id = 'vt-first';
        all[2].id = 'vt-third';
        return true;
    `);
    await page.drag('#vt-third > .ge-tools-drawer .ge-move', '#vt-first', { xRatio: 0.5, yRatio: 0.15 });
    var dragged = await page.eval(`
        return {
            strip: Array.from(tabs().querySelectorAll('.ge-pane-label')).map(function(label) { return label.textContent; }).join(','),
            panesInOrder: Array.from(tabs().querySelectorAll('.tab-pane')).map(function(pane) { return pane.id; }).join(',') ===
                Array.from(tabs().querySelectorAll('.nav-link')).map(function(link) { return link.getAttribute('data-bs-target').slice(1); }).join(','),
        };
    `);
    t.check('a tab drags up a vertical strip and its pane follows (AC-17)',
        dragged.strip === 'Three,One,Two' && dragged.panesInOrder, dragged);
}

async function clipboard(t, page) {
    var pasted = await page.eval(`
        localStorage.clear();
        start({}, ' ');
        const source = ge().createContainer('tabs', { tabs: 2, variant: 'pills', vertical: true, appendTo: column() });
        ge().createRow([12], { appendTo: ge().canvas });
        source.querySelectorAll(':scope > .ge-tools-drawer .ge-copy').forEach(function(tool) { tool.click(); });
        const target = document.querySelectorAll('#myGrid > .row')[1].querySelector('.column');
        target.querySelectorAll(':scope > .ge-tools-drawer .ge-paste').forEach(function(tool) { tool.click(); });
        const copy = target.querySelector('[data-ge-container="tabs"]');
        return {
            pasted: !!copy,
            strip: copy ? sorted(strip(copy)) : null,
            container: copy ? sorted(copy) : null,
            ownPanes: copy ? Array.from(copy.querySelectorAll('.nav-link')).every(function(link) {
                return copy.querySelectorAll(link.getAttribute('data-bs-target')).length === 1;
            }) : false,
        };
    `);
    t.check('a pills vertical container pastes with its classes, its tabs opening its own panes (AC-27)',
        pasted.pasted && pasted.strip === 'flex-column me-3 nav-pills' && pasted.container === 'align-items-start d-flex' && pasted.ownPanes,
        pasted);
}

module.exports = {
    name: 'tabsvariants',
    description: 'the tabs plugin\'s variants: style, width, alignment and vertical',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await panel(t, page);
        await markup(t, page);
        await api(t, page);
        await canvas(t, page);
        await clipboard(t, page);

        var errors = page.errors();
        t.check('the tabs variant tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
