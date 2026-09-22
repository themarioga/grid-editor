/**
 * Browser tests for the visibility plugin: hiding a node at some breakpoints
 * and showing it at others, without ever hiding it from the editor.
 *
 * The engine underneath - the cascade, the events, the panel - is covered by
 * test/utilities.js. What is tested here is the plugin's own choices: which
 * classes a click on the eye writes, and how the canvas shows the result.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.col = function() { return jQuery('#myGrid .column').first(); };
    window.row = function() { return jQuery('#myGrid .row').first(); };
    window.classes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) {
            return /^d-/.test(name);
        }).sort().join(' ');
    };
    window.eye = function(node) { return node.children('.ge-tools-drawer').children('.ge-visibility-tool'); };
    window.state = function(node) {
        return {
            classes: classes(node),
            faded: node.hasClass('ge-hidden-in-view'),
            badge: node.attr('data-ge-hidden-in') || '',
            display: getComputedStyle(node[0]).display,
            title: eye(node).attr('title'),
            icon: eye(node).find('i').attr('class'),
        };
    };
    window.start = function(rowClasses, colClasses, settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html(
            '<div class="row ' + rowClasses + '"><div class="column col-6 ' + colClasses + '"><div class="ge-content"><p>a</p></div></div>' +
            '<div class="column col-6"><div class="ge-content"><p>b</p></div></div></div>'
        );
        window.fixture.init(jQuery.extend({ plugins: window.fixture.plugins(['visibility']) }, settings || {}));
    };
`;

async function toolTests(t, page) {
    var tools = await page.eval(`
        start('', '');
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid .column').first().find('.ge-content').append('<div data-ge-element="box">box</div>');
        jQuery('#myGrid .column').eq(1).append(
            '<div data-ge-container="tabs"><ul class="nav nav-tabs"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#p1">One</button></li></ul>' +
            '<div class="tab-content"><div class="tab-pane active" id="p1"><div class="row"><div class="column col-12"><div class="ge-content"><p>in</p></div></div></div></div></div></div>'
        );
        window.fixture.init({ plugins: window.fixture.plugins(['visibility']) });
        const has = function(selector) { return eye(jQuery(selector).first()).length; };
        return {
            row: has('#myGrid .row'),
            column: has('#myGrid .column'),
            element: has('#myGrid .ge-element'),
            container: has('#myGrid [data-ge-container]'),
            pane: jQuery('#myGrid .ge-pane-drawer .ge-visibility-tool').length,
            choices: col().find('> .ge-tools-drawer .ge-utility[data-ge-family="visibility"] select option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
            rowChoices: row().find('> .ge-tools-drawer .ge-utility[data-ge-family="visibility"] select option').map(function() { return this.value; }).get().join(','),
        };
    `);
    t.check('rows, columns, elements and containers get the eye; panes do not',
        tools.row === 1 && tools.column === 1 && tools.element === 1 && tools.container === 1 &&
        tools.pane === 0,
        tools);
    t.check('the field offers hidden and shown, and shown is flex on a row',
        tools.choices === '=Default,none=Hidden,block=Shown' && tools.rowChoices === ',none,flex', tools);

    var off = await page.eval(`
        start('', '', { utilities: { visibility: { drawer: false } } });
        return { eyes: jQuery('#myGrid .ge-visibility-tool').length, fields: jQuery('#myGrid .ge-utility[data-ge-family="visibility"]').length };
    `);
    t.check('utilities.visibility.drawer false leaves the eye out and keeps the field',
        off.eyes === 0 && off.fields === 3, off);
}

async function breakpointTests(t, page) {
    var hide = await page.eval(`
        start('', '');
        ge().changeView('md');
        eye(col()).trigger('click');
        const hidden = state(col());
        eye(col()).trigger('click');
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
        eye(col()).trigger('click');
        eye(row()).trigger('click');
        const md = { col: state(col()), row: state(row()) };
        ge().changeView('lg');
        const lg = state(col());
        eye(col()).trigger('click');
        const lgHidden = state(col());
        ge().changeView('md');
        eye(col()).trigger('click');
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
}

async function allViewTests(t, page) {
    var all = await page.eval(`
        start('', 'd-md-none');
        const partly = state(col());
        eye(col()).trigger('click');
        const everywhere = state(col());
        eye(col()).trigger('click');
        return { partly: partly, everywhere: everywhere, none: state(col()) };
    `);
    t.check('in the all view a node hidden at some breakpoints is shown, with a badge naming them',
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
        return { html: html, afterReinit: after, torndown: jQuery('#myGrid').html() };
    `);
    t.check('getHtml keeps the classes and none of the editing marks',
        /class="row d-lg-none"/.test(exported.html) && /d-none d-md-block/.test(exported.html) &&
        !/ge-visibility|ge-hidden-in-view|data-ge-hidden-in/.test(exported.html),
        exported.html.slice(0, 200));
    t.check('the marks come back after getHtml, and go for good on destroy',
        exported.afterReinit.faded && !/ge-visibility|ge-hidden-in-view|data-ge-hidden-in/.test(exported.torndown),
        exported.afterReinit);

    var spanish = await page.eval(`
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        start('', 'd-md-none', { locale: 'es' });
        return { badge: col().attr('data-ge-hidden-in'), title: eye(col()).attr('title') };
    `);
    t.check('the plugin\'s strings are translated',
        spanish.badge === 'Oculto en md, lg, xl, xxl' && spanish.title === 'Ocultar en esta vista', spanish);
}

module.exports = {
    name: 'visibility',
    description: 'the visibility utility plugin',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await toolTests(t, page);
        await breakpointTests(t, page);
        await allViewTests(t, page);
        await markupTests(t, page);

        var errors = page.errors();
        t.check('the visibility tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
