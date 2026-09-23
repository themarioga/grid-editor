/**
 * Browser tests for the utility engine: the part of the core that reads,
 * writes, shows and previews Bootstrap's responsive utility classes for the
 * utility plugins.
 *
 * No shipped plugin is needed. The page declares its own, the way a host
 * would, with two families: `order` on columns, elements and containers, and
 * `justify` on rows. What is tested is the engine's side of the contract -
 * the cascade, the two ways a view writes, the events, the panel and the
 * preview - so that each shipped plugin only has to test its own choices.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** Registered before the editor starts, like a plugin file loaded after it. */
var PLUGIN = `
    const ORDER = { first: '-1', last: '6' };
    const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end' };

    jQuery.fn.gridEditor.utilities.testing = function(ge) {
        return {
            families: [
                {
                    name: 'order', prefix: 'order',
                    values: ['first', 0, 1, 2, 3, 'last'],
                    appliesTo: ['column', 'element', 'container'],
                    preview: function(value) {
                        return { order: value === null ? '0' : (ORDER[value] || value) };
                    },
                },
                {
                    name: 'justify', prefix: 'justify-content',
                    values: ['start', 'center', 'end'],
                    appliesTo: ['row'],
                    preview: function(value) {
                        return { 'justify-content': value === null ? 'flex-start' : JUSTIFY[value] };
                    },
                },
            ],
            drawerTools: function(drawer, node, kind) {
                window.toolKinds.push(kind);
                ge.createTool(drawer, 'Testing', 'ge-testing-tool', 'bi bi-star');
            },
            onViewChange: function(view) { window.viewHooks.push(view); },
        };
    };

    window.fixture.settings.plugins = window.fixture.plugins(['testing']);
    window.toolKinds = [];
    window.viewHooks = [];
    window.log = [];
    ['before-utility', 'after-utility', 'view-change'].forEach(function(name) {
        jQuery('#myGrid').on('grideditor:' + name, function(e, payload) {
            window.log.push({
                name: name,
                kind: payload.kind,
                family: payload.family,
                breakpoint: payload.breakpoint,
                tiers: payload.tiers,
                from: payload.from,
                to: payload.to,
                cleared: payload.cleared,
                source: payload.source,
            });
            if (name === 'before-utility' && window.cancelNext) {
                window.cancelNext = false;
                e.preventDefault();
            }
        });
    });

    window.ge = function() { return jQuery('#myGrid').data('grideditor'); };
    window.col = function() { return jQuery('#myGrid .column').first(); };
    window.classes = function(node) {
        return (node.attr('class') || '').split(/\\s+/).filter(function(name) {
            return /^(order|justify-content)-/.test(name);
        }).sort().join(' ');
    };
    window.field = function(node, family) {
        return node.children('.ge-tools-drawer').children('.ge-details')
            .find('.ge-utility[data-ge-family="' + family + '"]');
    };
`;

/** A canvas of one row and two columns, the first carrying `classes`. */
function canvasWith(classes) {
    return `
        jQuery('#myGrid').html(
            '<div class="row"><div class="column col-6 ${classes}"><div class="ge-content"><p>a</p></div></div>' +
            '<div class="column col-6"><div class="ge-content"><p>b</p></div></div></div>'
        );
    `;
}

async function cascadeTests(t, page) {
    var read = await page.eval(canvasWith('order-1 order-md-3') + `
        window.fixture.init();
        const views = ['all', 'xs', 'sm', 'md', 'lg', 'xxl'];
        return views.map(function(view) { return view + ':' + ge().getUtility(col(), 'order', view); }).join(' ');
    `);
    t.check('a breakpoint reads its own class or the nearest smaller one, the all view reads the base class',
        read === 'all:1 xs:1 sm:1 md:3 lg:3 xxl:3', read);

    var tierWrites = await page.eval(`
        ge().changeView('md');
        const written = ge().setUtility(col(), 'order', 2);
        const afterWrite = classes(col());
        const unchanged = ge().setUtility(col(), 'order', '2');
        ge().setUtility(col(), 'order', null);
        return { written: written, afterWrite: afterWrite, unchanged: unchanged, afterInherit: classes(col()) };
    `);
    t.check('a breakpoint view writes its own tier and nothing else',
        tierWrites.written === true && tierWrites.afterWrite === 'order-1 order-md-2', tierWrites);
    t.check('writing the value a tier already has changes nothing and says so',
        tierWrites.unchanged === false, tierWrites);
    t.check('null is inherit: it removes the tier\'s class',
        tierWrites.afterInherit === 'order-1', tierWrites);

    var allWrites = await page.eval(canvasWith('order-1 order-md-3 order-lg-2') + `
        window.fixture.teardown();
        window.fixture.init();
        window.log = [];
        const written = ge().setUtility(col(), 'order', 'last', 'all');
        return { written: written, classes: classes(col()), log: window.log };
    `);
    var after = allWrites.log[1] || {};
    t.check('the all view writes the base class and clears the family from every breakpoint',
        allWrites.written === true && allWrites.classes === 'order-last', allWrites);
    t.check('the payload says which tiers were written and what was cleared',
        after.name === 'after-utility' && after.kind === 'column' && after.family === 'order' &&
        after.breakpoint === 'all' && after.from === '1' && after.to === 'last' &&
        after.tiers.join(',') === 'xs,md,lg' &&
        JSON.stringify(after.cleared) === '[{"breakpoint":"md","value":"3"},{"breakpoint":"lg","value":"2"}]',
        after);

    var refused = await page.eval(`
        return {
            badValue: ge().setUtility(col(), 'order', 7),
            wrongKind: ge().setUtility(jQuery('#myGrid .row').first(), 'order', 1),
            unknown: ge().setUtility(col(), 'nonsense', 1),
            unknownRead: ge().getUtility(col(), 'nonsense'),
            classes: classes(col()),
        };
    `);
    t.check('a value the family does not have, a node it does not apply to, and an unknown family are refused',
        refused.badValue === false && refused.wrongKind === false && refused.unknown === false &&
        refused.unknownRead === null && refused.classes === 'order-last',
        refused);

    var dispatched = await page.eval(`
        const set = jQuery('#myGrid').gridEditor('setUtility', col(), 'order', 'first', 'sm');
        return {
            set: set,
            get: jQuery('#myGrid').gridEditor('getUtility', col(), 'order', 'md'),
            classes: classes(col()),
        };
    `);
    t.check('getUtility and setUtility dispatch through the plugin and return their values',
        dispatched.set === true && dispatched.get === 'first' &&
        dispatched.classes === 'order-last order-sm-first',
        dispatched);
}

async function eventTests(t, page) {
    var canceled = await page.eval(canvasWith('order-1') + `
        window.fixture.teardown();
        window.fixture.init();
        ge().changeView('md');
        window.log = [];
        window.cancelNext = true;
        const written = ge().setUtility(col(), 'order', 3);
        return { written: written, classes: classes(col()), names: window.log.map(e => e.name).join(',') };
    `);
    t.check('canceling before-utility leaves the class as it was',
        canceled.written === false && canceled.classes === 'order-1' && canceled.names === 'before-utility',
        canceled);

    var fromPanel = await page.eval(`
        window.log = [];
        const select = field(col(), 'order').find('select');
        select.val('2').trigger('change');
        const panelWrite = { classes: classes(col()), log: window.log.slice() };

        window.cancelNext = true;
        select.val('3').trigger('change');
        return { panelWrite: panelWrite, afterCancel: select.val(), classes: classes(col()) };
    `);
    var panelEvent = fromPanel.panelWrite.log[1] || {};
    t.check('choosing in the panel writes the view\'s tier and reports source panel',
        fromPanel.panelWrite.classes === 'order-1 order-md-2' && panelEvent.source === 'panel' &&
        panelEvent.from === '1' && panelEvent.to === '2' && panelEvent.tiers.join(',') === 'md',
        fromPanel);
    t.check('a canceled panel change puts the field back',
        fromPanel.afterCancel === '2' && fromPanel.classes === 'order-1 order-md-2', fromPanel);

    var views = await page.eval(`
        window.log = [];
        window.viewHooks = [];
        ge().changeView('lg');
        ge().changeView('lg');
        ge().changeView('all');
        return { log: window.log, hooks: window.viewHooks.join(',') };
    `);
    t.check('changing view fires view-change once per real change, and the plugins\' onViewChange',
        views.log.length === 2 && views.log[0].name === 'view-change' &&
        views.log[0].from === 'md' && views.log[0].to === 'lg' && views.log[1].to === 'all' &&
        views.hooks === 'lg,all',
        views);
}

async function panelTests(t, page) {
    var panels = await page.eval(canvasWith('order-1') + `
        window.fixture.teardown();
        window.toolKinds = [];
        window.fixture.init();
        const row = jQuery('#myGrid .row').first();
        return {
            columnFamilies: col().find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(','),
            rowFamilies: row.find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(','),
            folded: !col().find('> .ge-tools-drawer .ge-utilities').hasClass('ge-open'),
            toolKinds: window.toolKinds.slice().sort().join(','),
            toolAfterGear: col().find('> .ge-tools-drawer > .ge-settings').next().hasClass('ge-testing-tool'),
        };
    `);
    t.check('each node\'s panel offers the families that apply to its kind',
        panels.columnFamilies === 'col,order' && panels.rowFamilies === 'row-cols,justify', panels);
    t.check('the Responsive section starts folded',
        panels.folded, panels);
    t.check('drawerTools runs for every drawer with a gear, right after it',
        panels.toolKinds === 'column,column,row,text,text' && panels.toolAfterGear, panels);

    var unfolded = await page.eval(`
        col().find('> .ge-tools-drawer .ge-utilities-toggle').trigger('click');
        return jQuery('#myGrid .ge-utilities').map(function() { return jQuery(this).hasClass('ge-open'); }).get();
    `);
    t.check('unfolding one section unfolds them all',
        unfolded.length === 3 && unfolded.every(Boolean), unfolded);

    var labels = await page.eval(canvasWith('order-1 order-md-3') + `
        window.fixture.teardown();
        window.fixture.init();
        const select = function() { return field(col(), 'order').find('select'); };
        const read = function() {
            return {
                toggle: col().find('> .ge-tools-drawer .ge-utilities-toggle').text(),
                blank: select().find('option').first().text(),
                value: select().val(),
                note: field(col(), 'order').find('.ge-utility-note').text(),
            };
        };
        const all = read();
        ge().changeView('sm');
        const sm = read();
        ge().changeView('xs');
        const xs = read();
        return { all: all, sm: sm, xs: xs };
    `);
    t.check('in the all view a field shows the base class and says which breakpoints differ',
        labels.all.toggle === 'Responsive: All sizes' && labels.all.blank === 'Default' &&
        labels.all.value === '1' && /md/.test(labels.all.note),
        labels.all);
    t.check('in a breakpoint view the empty choice says what it inherits, and from where',
        labels.sm.toggle === 'Responsive: Tablet' && labels.sm.value === '' &&
        labels.sm.blank === 'Inherit: 1 (from xs)' && labels.sm.note === '',
        labels.sm);
    t.check('the smallest breakpoint has nothing to inherit from',
        labels.xs.value === '1' && labels.xs.blank === 'Default', labels.xs);

    var typed = await page.eval(`
        const input = col().find('> .ge-tools-drawer .ge-classes');
        input.val(input.val().replace('order-1', 'order-2')).trigger('change');
        return { value: field(col(), 'order').find('select').val(), classes: classes(col()) };
    `);
    t.check('typing a class in the classes field updates the field that reads it',
        typed.value === '2' && typed.classes === 'order-2 order-md-3', typed);

    var written = await page.eval(`
        ge().setUtility(col(), 'order', 'first');
        return col().find('> .ge-tools-drawer .ge-classes').val();
    `);
    t.check('a utility written through the API shows in the classes field',
        /order-first/.test(written) && !/order-2/.test(written), written);
}

async function previewTests(t, page) {
    var preview = await page.eval(canvasWith('order-1 order-md-3') + `
        window.fixture.teardown();
        jQuery('#myGrid .column').first().attr('style', 'color: red; order: 9');
        window.fixture.init();
        const read = function() {
            return {
                order: getComputedStyle(col()[0]).order,
                priority: col()[0].style.getPropertyPriority('order'),
                recorded: col().attr('data-ge-preview') !== undefined,
                untouched: jQuery('#myGrid .column').eq(1).attr('style'),
            };
        };
        const all = read();
        ge().changeView('xs');
        const xs = read();
        ge().changeView('md');
        const md = read();
        ge().setUtility(col(), 'order', 'last');
        const written = read();
        const html = ge().getHtml();
        ge().changeView('all');
        return { all: all, xs: xs, md: md, written: written, html: html, afterAll: col().attr('style') };
    `);
    // What the page shows there is Bootstrap's business: its !important
    // classes against the real viewport, over the host's inline order
    t.check('the all view previews nothing',
        !preview.all.recorded && preview.all.priority === '', preview.all);
    t.check('a breakpoint view shows what the classes mean there, over Bootstrap\'s !important',
        preview.xs.order === '1' && preview.xs.priority === 'important' && preview.md.order === '3' &&
        preview.xs.untouched === undefined,
        preview);
    t.check('the preview follows a write at once',
        preview.written.order === '6', preview.written);
    t.check('getHtml has no preview in it, and the host\'s inline style comes back as it was',
        !/data-ge-preview|important/.test(preview.html) && /style="color: red; order: 9;?"/.test(preview.html),
        preview.html.slice(0, 200));
    t.check('back in the all view the host\'s style is restored on the canvas too',
        /^color: red; order: 9;?$/.test(preview.afterAll), preview.afterAll);
}

async function nodeKindTests(t, page) {
    var kinds = await page.eval(`
        window.fixture.teardown();
        jQuery('#myGrid').html(
            '<div class="row"><div class="column col-12"><div class="ge-content">' +
                '<p>text</p><div data-ge-element="box" class="order-2">element</div>' +
            '</div>' +
            '<div data-ge-container="card" class="order-md-1"><div class="card">' +
                '<div class="card-header"><span class="ge-pane-label">Card</span></div>' +
                '<div class="card-body"><div class="row"><div class="column col-12"><div class="ge-content"><p>in</p></div></div></div></div>' +
            '</div></div>' +
            '</div></div>'
        );
        window.fixture.init();
        const element = jQuery('#myGrid .ge-element');
        const card = jQuery('#myGrid [data-ge-container="card"]');
        window.log = [];
        ge().changeView('md');
        ge().setUtility(card, 'order', 'last');
        return {
            elementField: field(element, 'order').find('select').val(),
            cardField: field(card, 'order').find('select').val(),
            cardKind: (window.log[1] || {}).kind,
            elementPreview: getComputedStyle(element[0]).order,
            html: ge().getHtml(),
        };
    `);
    t.check('elements and containers get the fields of the families that apply to them',
        kinds.elementField === '' && kinds.cardField === 'last', kinds);
    t.check('a container reports its type as the payload kind',
        kinds.cardKind === 'card', kinds);
    t.check('elements are previewed like any other node',
        kinds.elementPreview === '2', kinds);
    t.check('getHtml keeps the classes and drops the preview on elements and containers',
        /class="order-2"/.test(kinds.html) && /class="order-md-last"/.test(kinds.html) &&
        !/data-ge-preview|style=/.test(kinds.html),
        kinds.html.slice(0, 300));
}

async function customPanelTests(t, page) {
    var custom = await page.eval(canvasWith('order-2') + `
        window.fixture.teardown();
        jQuery.fn.gridEditor.utilities.custom = function(ge) {
            return {
                families: [{ name: 'quiet', prefix: 'quiet', values: ['a'], appliesTo: ['column'], panel: false }],
                panel: function(node, kind) {
                    if (kind !== 'row') { return null; }
                    return jQuery('<div class="ge-custom" />').append(ge.utilityField(node, 'justify'));
                },
                preview: function(node, kind, breakpoint) {
                    return kind === 'column' ? { 'outline-offset': breakpoint === 'md' ? '7px' : '3px' } : {};
                },
            };
        };
        window.fixture.init({ plugins: window.fixture.plugins(['testing', 'custom']) });
        const row = jQuery('#myGrid .row').first();
        const read = {
            columnFamilies: col().find('> .ge-tools-drawer .ge-utility').map(function() { return jQuery(this).attr('data-ge-family'); }).get().join(','),
            rowFields: row.find('> .ge-tools-drawer .ge-utility').length,
            customField: row.find('> .ge-tools-drawer .ge-custom .ge-utility[data-ge-family="justify"]').length,
            allView: col()[0].style.outlineOffset,
        };
        ge().changeView('md');
        read.md = col()[0].style.outlineOffset;
        read.customValue = (ge().setUtility(row, 'justify', 'end'), row.find('> .ge-tools-drawer .ge-custom select').val());
        return read;
    `);
    t.check('a family with panel false gets no field of its own',
        custom.columnFamilies === 'col,order', custom);
    t.check('a plugin\'s own panel is placed in the section, and its utilityField follows the classes',
        custom.customField === 1 && custom.rowFields === 3 && custom.customValue === 'end', custom);
    t.check('a plugin\'s own preview is applied per breakpoint view, and not in the all view',
        custom.allView === '' && custom.md === '7px', custom);
}

async function bareStyleTests(t, page) {
    var read = await page.eval(canvasWith('order-1 order-md-3') + `
        let handle = null;
        jQuery.fn.gridEditor.utilities.probe = function(ge) { handle = ge; return { families: [] }; };
        window.fixture.teardown();
        window.fixture.init({ plugins: window.fixture.plugins(['testing', 'probe']) });
        const before = col().attr('class');
        const bare = handle.bareStyle(col(), 'order', 'order');
        const unknown = handle.bareStyle(col(), 'nonsense', 'order');
        return { bare: bare, unknown: unknown, before: before, after: col().attr('class') };
    `);
    t.check('bareStyle reads a property with the family\'s classes out of the way, and puts them back',
        read.bare === '0' && read.unknown === null && read.before === read.after && /order-md-3/.test(read.after),
        read);
}

async function pluginSettingTests(t, page) {
    var off = await page.eval(canvasWith('order-1') + `
        window.fixture.teardown();
        window.fixture.init({ plugins: ['card'] });
        return {
            fields: jQuery('#myGrid .ge-utility:not([data-ge-family="col"]):not([data-ge-family="row-cols"])').length,
            tools: jQuery('#myGrid .ge-testing-tool').length,
            set: ge().setUtility(col(), 'order', 2),
            classes: classes(col()),
        };
    `);
    t.check('a utility plugin left out of the plugins setting is not used',
        off.fields === 0 && off.tools === 0 && off.set === false && off.classes === 'order-1', off);
}

module.exports = {
    name: 'utilities',
    description: 'the utility engine: cascade, writes, events, panel and preview',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(PLUGIN);

        await cascadeTests(t, page);
        await eventTests(t, page);
        await panelTests(t, page);
        await previewTests(t, page);
        await nodeKindTests(t, page);
        await customPanelTests(t, page);
        await bareStyleTests(t, page);
        await pluginSettingTests(t, page);

        var errors = page.errors();
        t.check('the utility tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
