/**
 * Browser tests for the inline-style plugin's display: how a node is displayed at
 * each breakpoint, hiding it and showing it again, without ever hiding it
 * from the editor.
 *
 * The engine underneath - the cascade, the events, the panel - is covered by
 * test/utilities.js. What is tested here is the part's own choices: what each
 * kind of node is offered, which classes a click on the eye writes, and how
 * the canvas shows the result.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return window.fixture.editor(); };
    window.col = function() { return document.querySelector('#myGrid .column'); };
    window.row = function() { return document.querySelector('#myGrid .row'); };
    window.classes = function(node) {
        return (node.getAttribute('class') || '').split(/\\s+/).filter(function(name) {
            return /^d-/.test(name);
        }).sort().join(' ');
    };
    /** A node's eye: the visibility tool in its own drawer, or null. */
    window.eye = function(node) {
        const drawer = node && node.querySelector(':scope > .ge-tools-drawer');
        return drawer ? drawer.querySelector(':scope > .ge-visibility-tool') : null;
    };
    window.state = function(node) {
        const tool = eye(node);
        return {
            classes: classes(node),
            faded: node.classList.contains('ge-hidden-in-view'),
            badge: node.getAttribute('data-ge-hidden-in') || '',
            display: getComputedStyle(node).display,
            title: tool ? tool.getAttribute('title') : undefined,
            icon: tool ? tool.querySelector('i').getAttribute('class') : undefined,
        };
    };
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
    window.log = [];
    document.querySelector('#myGrid').addEventListener('grideditor:after-utility', function(e) {
        window.log.push({ family: e.detail.family, breakpoint: e.detail.breakpoint, to: e.detail.to });
    });
    window.start = function(rowClasses, colClasses, settings) {
        window.warnings = [];
        window.log = [];
        if (window.fixture.editor()) { window.fixture.teardown(); }
        document.querySelector('#myGrid').innerHTML =
            '<div class="row ' + rowClasses + '"><div class="column col-6 ' + colClasses + '"><div class="ge-content" data-ge-content-type="tinymce"><p>a</p></div></div>' +
            '<div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>b</p></div></div></div>';
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['inline-style']) }, settings || {}));
    };
`;

async function toolTests(t, page) {
    var tools = await page.eval(`
        start('', '');
        window.fixture.editor().destroy();
        document.querySelector('#myGrid .column .ge-content').insertAdjacentHTML('beforeend', '<div data-ge-element="box">box</div>');
        document.querySelectorAll('#myGrid .column')[1].insertAdjacentHTML('beforeend',
            '<div data-ge-container="tabs"><ul class="nav nav-tabs"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="column col-12"><div class="ge-content" data-ge-content-type="tinymce"><p>in</p></div></div></div></div></div></div>'
        );
        window.fixture.init({ plugins: window.fixture.plugins(['inline-style']) });
        const has = function(selector) { return eye(document.querySelector(selector)) ? 1 : 0; };
        const options = function(node) {
            return Array.from(node.querySelectorAll(':scope > .ge-tools-drawer .ge-utility[data-ge-family="display"] select option'));
        };
        return {
            row: has('#myGrid .row'),
            column: has('#myGrid .column'),
            element: has('#myGrid .ge-element'),
            text: document.querySelector('#myGrid .ge-text-block').querySelectorAll(':scope > .ge-tools-drawer > .ge-visibility-tool').length,
            container: has('#myGrid [data-ge-container]'),
            pane: document.querySelectorAll('#myGrid .ge-pane-drawer .ge-visibility-tool').length,
            choices: options(col()).map(function(option) { return option.value + '=' + option.textContent; }).join(','),
            rowChoices: options(row()).map(function(option) { return option.value; }).join(','),
            elementChoices: options(document.querySelector('#myGrid .ge-element')).map(function(option) { return option.value; }).join(','),
            containerChoices: options(document.querySelector('#myGrid [data-ge-container]')).map(function(option) { return option.value; }).join(','),
            textChoices: Array.from(document.querySelector('#myGrid .ge-text-block').querySelectorAll(':scope > .ge-tools-drawer .ge-utility[data-ge-family="display"] select option')).map(function(option) { return option.value; }).join(','),
            label: col().querySelector(':scope > .ge-tools-drawer .ge-utility[data-ge-family="display"] .ge-utility-label').textContent,
        };
    `);
    t.check('rows, columns, texts, elements and containers get the eye; panes do not',
        tools.row === 1 && tools.column === 1 && tools.text === 1 && tools.element === 1 && tools.container === 1 &&
        tools.pane === 0,
        tools);
    var eight = ',none,inline,inline-block,block,grid,inline-grid,flex,inline-flex';
    t.check('a column, an element and a container are offered every display, none as Hidden (AC-18)',
        tools.choices === '=Default,none=Hidden,inline=inline,inline-block=inline-block,block=block,grid=grid,' +
            'inline-grid=inline-grid,flex=flex,inline-flex=inline-flex' &&
        tools.elementChoices === eight && tools.containerChoices === eight && tools.label === 'Display', tools);
    t.check('a row is offered hidden or flex (AC-19)', tools.rowChoices === ',none,flex', tools);
    t.check('a text is offered hidden or block (AC-20)', tools.textChoices === ',none,block', tools);

    var off = await page.eval(`
        start('', '', { inline_style: { visibility: { drawer: false } } });
        return { eyes: document.querySelectorAll('#myGrid .ge-visibility-tool').length, fields: document.querySelectorAll('#myGrid .ge-utility[data-ge-family="display"]').length };
    `);
    t.check('inline_style.visibility.drawer false leaves the eye out and keeps the field (AC-30)',
        off.eyes === 0 && off.fields === 5, off);
}

async function apiTests(t, page) {
    var api = await page.eval(`
        start('', '');
        ge().changeView('md');
        const select = col().querySelector(':scope > .ge-tools-drawer .ge-utility[data-ge-family="display"] select');
        select.value = 'flex';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        const field = { classes: classes(col()), event: window.log[window.log.length - 1] };
        ge().setUtility(col(), 'display', 'inline-flex', 'lg');
        const lg = { classes: classes(col()), xl: ge().getUtility(col(), 'display', 'xl') };
        window.warnings = [];
        const before = col().getAttribute('class');
        const old = {
            read: ge().getUtility(col(), 'visibility', 'md'),
            written: ge().setUtility(col(), 'visibility', 'none'),
            same: col().getAttribute('class') === before,
        };
        ge().getUtility(col(), 'visibility', 'md');
        old.warnings = window.warnings.filter(function(w) { return /no loaded plugin declares that utility/.test(w); });
        return { field: field, lg: lg, old: old };
    `);
    t.check('choosing flex in the field writes the breakpoint\'s d-*-flex, and the event says display (AC-21)',
        api.field.classes === 'd-md-flex' && api.field.event && api.field.event.family === 'display' &&
        api.field.event.to === 'flex' && api.field.event.breakpoint === 'md', api.field);
    t.check('setUtility and getUtility take display, and a wider breakpoint inherits it (AC-22)',
        api.lg.classes === 'd-lg-inline-flex d-md-flex' && api.lg.xl === 'inline-flex', api.lg);
    t.check('visibility is no family any more: nothing is read or written, and it warns once (AC-23)',
        api.old.read === null && api.old.written === false && api.old.same && api.old.warnings.length === 1 &&
        /getUtility\("visibility"\)/.test(api.old.warnings[0]), api.old);
}

async function breakpointTests(t, page) {
    var hide = await page.eval(`
        start('', '');
        ge().changeView('md');
        eye(col()).click();
        const hidden = state(col());
        eye(col()).click();
        return { hidden: hidden, shown: state(col()) };
    `);
    t.check('hiding in a breakpoint view writes that breakpoint\'s d-*-none',
        hide.hidden.classes === 'd-md-none', hide.hidden);
    t.check('a node hidden in the view stays on the canvas, faded, and its eye says so',
        hide.hidden.faded && hide.hidden.display === 'block' &&
        hide.hidden.title === 'Show in this view' && hide.hidden.icon === 'bi bi-eye-slash',
        hide.hidden);
    t.check('showing it again removes the class rather than writing d-md-block',
        hide.shown.classes === '' && !hide.shown.faded && hide.shown.title === 'Hide in this view', hide.shown);

    var shownOver = await page.eval(`
        start('d-none', 'd-none');
        ge().changeView('md');
        eye(col()).click();
        eye(row()).click();
        const md = { col: state(col()), row: state(row()) };
        ge().changeView('lg');
        const lg = state(col());
        eye(col()).click();
        const lgHidden = state(col());
        ge().changeView('md');
        eye(col()).click();
        return { md: md, lg: lg, lgHidden: lgHidden, back: state(col()) };
    `);
    t.check('showing a node hidden below writes d-*-block, and d-*-flex on a row',
        shownOver.md.col.classes === 'd-md-block d-none' && shownOver.md.row.classes === 'd-md-flex d-none' &&
        shownOver.md.row.display === 'flex' && !shownOver.md.col.faded,
        shownOver.md);
    t.check('a wider breakpoint inherits being shown, and hides with its own class',
        !shownOver.lg.faded && shownOver.lgHidden.classes === 'd-lg-none d-md-block d-none' &&
        shownOver.lgHidden.faded,
        shownOver);
    t.check('hiding where the breakpoint below hides takes this breakpoint\'s class off',
        shownOver.back.classes === 'd-lg-none d-none' && shownOver.back.faded, shownOver.back);

    var flex = await page.eval(`
        start('', 'd-flex');
        ge().changeView('md');
        eye(col()).click();
        const hidden = state(col());
        ge().changeView('lg');
        eye(col()).click();
        const flexed = state(col());
        start('', '');
        ge().changeView('md');
        eye(col()).click();
        ge().changeView('lg');
        eye(col()).click();
        const block = state(col());
        start('', '');
        ge().changeView('md');
        eye(row()).click();
        ge().changeView('lg');
        eye(row()).click();
        return { hidden: hidden, flexed: flexed, block: block, row: state(row()) };
    `);
    t.check('a flex column hidden at md and shown at lg comes back flex (AC-24)',
        flex.hidden.classes === 'd-flex d-md-none' && flex.flexed.classes === 'd-flex d-lg-flex d-md-none' &&
        flex.flexed.display === 'flex', flex);
    t.check('a column with nothing below comes back block (AC-25)',
        flex.block.classes === 'd-lg-block d-md-none', flex.block);
    t.check('a row comes back flex (AC-26)', flex.row.classes === 'd-lg-flex d-md-none', flex.row);

    // An element, not a column: a column is an item of its flex row, and an
    // item's inline-flex is a flex
    var shownAs = await page.eval(`
        start('', '');
        window.fixture.editor().destroy();
        col().insertAdjacentHTML('beforeend', '<div data-ge-element="box" class="d-inline-flex d-md-none">box</div>');
        window.fixture.init({ plugins: window.fixture.plugins(['inline-style']) });
        ge().changeView('md');
        const hidden = state(document.querySelector('#myGrid .ge-element'));
        start('', 'd-md-flex');
        ge().changeView('sm');
        return { hidden: hidden, sm: state(col()) };
    `);
    t.check('a node hidden in the view is faded and shown with the display below it (AC-27)',
        shownAs.hidden.faded && shownAs.hidden.display === 'inline-flex', shownAs.hidden);
    t.check('below its breakpoint, a node is displayed as it is without the class (AC-28)',
        shownAs.sm.display === 'block', shownAs.sm);
}

async function allViewTests(t, page) {
    var all = await page.eval(`
        start('', 'd-md-none');
        const partly = state(col());
        eye(col()).click();
        const everywhere = state(col());
        eye(col()).click();
        return { partly: partly, everywhere: everywhere, none: state(col()) };
    `);
    t.check('in the all view a node hidden at some breakpoints is shown, with a badge naming them (AC-29)',
        all.partly.badge === 'Hidden at md, lg, xl, xxl' && !all.partly.faded &&
        all.partly.display === 'block' && all.partly.title === 'Hide in this view',
        all.partly);
    t.check('hiding in the all view hides everywhere with one class, and fades the node',
        all.everywhere.classes === 'd-none' && all.everywhere.faded && all.everywhere.badge === '' &&
        all.everywhere.display === 'block',
        all.everywhere);
    t.check('showing in the all view takes every class off',
        all.none.classes === '' && !all.none.faded, all.none);
}

async function markupTests(t, page) {
    var exported = await page.eval(`
        start('d-lg-none', 'd-none d-md-block');
        ge().changeView('sm');
        const html = ge().getHtml();
        const after = state(col());
        window.fixture.teardown();
        return { html: html, afterReinit: after, torndown: document.querySelector('#myGrid').innerHTML };
    `);
    t.check('getHtml keeps the classes and none of the editing marks',
        /class="row d-lg-none"/.test(exported.html) && /d-none d-md-block/.test(exported.html) &&
        !/ge-hidden-in-view|data-ge-hidden-in|data-ge-display/.test(exported.html),
        exported.html.slice(0, 200));
    t.check('the marks come back after getHtml, and go for good on destroy',
        exported.afterReinit.faded && !/ge-hidden-in-view|data-ge-hidden-in|data-ge-display/.test(exported.torndown),
        exported.afterReinit);

    var spanish = await page.eval(`
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        start('', 'd-md-none', { locale: 'es' });
        return { badge: col().getAttribute('data-ge-hidden-in'), title: eye(col()).getAttribute('title') };
    `);
    t.check('the plugin\'s strings are translated',
        spanish.badge === 'Oculto en md, lg, xl, xxl' && spanish.title === 'Ocultar en esta vista', spanish);
}

module.exports = {
    name: 'display',
    description: 'the inline-style plugin\'s display, and its eye',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await toolTests(t, page);
        await apiTests(t, page);
        await breakpointTests(t, page);
        await allViewTests(t, page);
        await markupTests(t, page);

        var errors = page.errors();
        t.check('the display tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
