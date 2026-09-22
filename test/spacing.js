/**
 * Browser tests for the spacing plugin: padding and margin, per side and per
 * breakpoint.
 *
 * Two things set it apart from the other utility plugins, and they are what
 * is tested: a panel of its own, a side and a value per group rather than a
 * field per family, and a preview that settles fourteen families between them
 * the way Bootstrap's css does.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.row = function() { return jQuery('#myGrid > .row').first(); };
    window.col = function() { return row().children('.column').first(); };
    window.other = function() { return row().children('.column').eq(1); };
    window.group = function(node, key) {
        return node.find('> .ge-tools-drawer .ge-spacing-group[data-ge-spacing="' + key + '"]');
    };
    window.padding = function(node) {
        const style = getComputedStyle(node[0]);
        return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].join(' ');
    };
    window.classes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) { return /^[pm][xytbse]?-/.test(name); }).sort().join(' ');
    };
    window.start = function(colClasses, settings) {
        if (jQuery('#myGrid').data('grideditor')) { window.fixture.teardown(); }
        jQuery('#myGrid').html('<div class="row">' +
            '<div class="column col-6 ' + colClasses + '"><div class="ge-content"><p>a</p><div data-ge-element="box">box</div></div></div>' +
            '<div class="column col-6"><div class="ge-content"><p>b</p></div></div></div>');
        window.fixture.init(jQuery.extend({ plugins: window.fixture.plugins(['spacing']) }, settings || {}));
    };
`;

async function panelTests(t, page) {
    var panel = await page.eval(`
        start('mx-md-auto');
        const side = function(key) { return group(col(), key).children('.ge-spacing-side'); };
        return {
            groups: col().find('> .ge-tools-drawer .ge-spacing-group').length,
            fields: col().find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(','),
            sides: side('p').find('option').map(function() { return this.value + '=' + this.textContent; }).get().join(','),
            startsOn: side('p').val() + '|' + side('m').val(),
            elementGroups: jQuery('#myGrid .ge-element > .ge-tools-drawer .ge-spacing-group').length,
            rowGroups: group(row(), 'p').length,
        };
    `);
    t.check('the panel has a padding and a margin group, not a field per family',
        panel.groups === 2 && panel.fields === 'p,mx' &&
        panel.sides === '=All sides,x=Left and right,y=Top and bottom,t=Top,e=End,b=Bottom,s=Start',
        panel);
    t.check('a group starts on a side the node has a class for',
        panel.startsOn === '|x', panel);
    t.check('rows and elements get the groups too',
        panel.elementGroups === 2 && panel.rowGroups === 1, panel);

    var chosen = await page.eval(`
        start('');
        ge().changeView('md');
        group(col(), 'p').children('.ge-spacing-side').val('t').trigger('change');
        const field = group(col(), 'p').find('.ge-utility');
        const family = field.attr('data-ge-family');
        field.find('select').val('4').trigger('change');
        group(col(), 'm').find('.ge-utility select').val('auto').trigger('change');
        return { family: family, classes: classes(col()), value: group(col(), 'p').find('.ge-utility select').val() };
    `);
    t.check('choosing a side swaps in that side\'s field, which writes for the breakpoint',
        chosen.family === 'pt' && chosen.classes === 'm-md-auto pt-md-4' && chosen.value === '4', chosen);

    var narrowed = await page.eval(`
        start('', { utilities: { spacing: { values: ['0', '2'] } } });
        const values = function(key) { return group(col(), key).find('.ge-utility option').map(function() { return this.value; }).get().join(','); };
        return { p: values('p'), m: values('m') };
    `);
    t.check('utilities.spacing.values narrows what is offered, and margin keeps auto',
        narrowed.p === ',0,2' && narrowed.m === ',0,2,auto', narrowed);

    var note = await page.eval(`
        start('px-2');
        const shown = function(node) { return node.find('> .ge-tools-drawer .ge-spacing-gutter').css('display') !== 'none'; };
        return {
            padded: shown(col()),
            plain: shown(other()),
            row: row().find('> .ge-tools-drawer .ge-spacing-gutter').length,
        };
    `);
    t.check('a column padded at the sides is told that is its gutter; others are not',
        note.padded && !note.plain && note.row === 0, note);
}

async function previewTests(t, page) {
    var views = await page.eval(`
        start('p-2 pt-md-4');
        const read = function(view) { ge().changeView(view); return padding(col()); };
        return { xs: read('xs'), md: read('md'), plain: padding(other()) };
    `);
    t.check('each breakpoint view shows the padding its classes give there',
        views.xs === '8px 8px 8px 8px' && views.md === '24px 8px 8px 8px', views);
    t.check('a node with no spacing class keeps the editor\'s frame',
        views.plain === '0px 5px 5px 5px', views);

    var settled = await page.eval(`
        start('pt-2 p-md-3 px-md-1');
        const read = function(view) { ge().changeView(view); return padding(col()); };
        return { xs: read('xs'), md: read('md') };
    `);
    t.check('a side nothing reaches shows the frame, not a wider breakpoint\'s class',
        settled.xs === '8px 5px 5px 5px', settled);
    t.check('the widest breakpoint wins, then the side written later in Bootstrap\'s css',
        settled.md === '16px 4px 16px 4px', settled);

    var auto = await page.eval(`
        start('mx-auto');
        ge().changeView('sm');
        const inline = col()[0].style.marginLeft + ' ' + col()[0].style.marginRight;
        const html = ge().getHtml();
        return { inline: inline, html: html };
    `);
    t.check('margin auto is previewed as auto',
        auto.inline === 'auto auto', auto);
    t.check('getHtml has the classes and no preview',
        /mx-auto/.test(auto.html) && !/data-ge-preview|style=/.test(auto.html), auto.html.slice(0, 160));

    var edges = await page.eval(`
        start('py-md-4 px-2');
        ge().changeView('md');
        const edge = function(node) {
            const box = node[0].getBoundingClientRect();
            const drawer = node.children('.ge-tools-drawer')[0].getBoundingClientRect();
            return [Math.round(drawer.top - box.top), Math.round(drawer.left - box.left), Math.round(box.right - drawer.right)].join(' ');
        };
        const padded = edge(col());
        ge().changeView('xs');
        return { md: padded, xs: edge(col()), plain: edge(other()) };
    `);
    t.check('a padded node\'s drawer stays on its edges, in every view',
        edges.md === '1 1 1' && edges.xs === '1 1 1' && edges.plain === '1 1 1', edges);

    var scaled = await page.eval(`
        start('p-1', { default_view: 'sm', utilities: { spacing: { scale: ['0', '10px', '20px', '30px', '40px', '50px'] } } });
        return padding(col());
    `);
    t.check('utilities.spacing.scale is what the values come to in the preview',
        scaled === '10px 10px 10px 10px', scaled);
}

module.exports = {
    name: 'spacing',
    description: 'the spacing utility plugin',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await panelTests(t, page);
        await previewTests(t, page);

        var errors = page.errors();
        t.check('the spacing tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
