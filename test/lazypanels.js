/**
 * Browser tests for the panels built when they open (spec lazy-panels): a
 * drawer carries only the general fields, and the plugins' sections and the
 * Responsive section are made when the panel opens, from the node as it is
 * then, and taken away when it closes.
 *
 * The fixture builds every panel for the suites that read them in the
 * drawer; this one turns that off.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.fixture.eagerPanels = false;
    window.sectionCalls = 0;
    GridEditor.utilities.testing = function() {
        return { families: [{ name: 'order', prefix: 'order', values: ['1', '2', '3'], appliesTo: ['column'] }] };
    };
    GridEditor.features.probe = function(handle) {
        window.probe = handle;
        return {
            panelSection: function(node, kind) {
                if (kind !== 'column') { return null; }
                window.sectionCalls++;
                return { labelKey: 'panel.section_general', body: document.createElement('div') };
            },
        };
    };
    window.q = function(selector) { return document.querySelector(selector); };
    window.count = function(selector) { return document.querySelectorAll(selector).length; };
    window.start = function(overrides) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        q('#myGrid').innerHTML = '<div class="row" id="r1"><div class="column col-6 order-md-2" id="a"><p>A</p></div>' +
            '<div class="column col-6" id="b"><p>B</p></div></div>';
        window.sectionCalls = 0;
        return window.fixture.init(Object.assign({
            default_view: 'md',
            plugins: window.fixture.plugins(['testing', 'probe']),
        }, overrides || {}));
    };
    window.orderSelect = function() { return q('.ge-utility[data-ge-family="order"] select'); };
    return true;
`;

async function closedTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var closed = await page.eval(`
        const ge = start();
        const headers = count('#myGrid .ge-details > .ge-details-general');
        const panels = count('#myGrid .ge-details');
        const before = { utilities: count('.ge-utilities'), sections: count('.ge-panel-section'), calls: window.sectionCalls };
        ge.changeView('lg');
        ge.setUtility(q('#a'), 'order', '3', 'md');
        return Object.assign(before, {
            headers: headers, panels: panels,
            afterViewAndWrite: count('.ge-utilities') + count('.ge-panel-section'),
            classed: q('#a').classList.contains('order-md-3'),
        });
    `);
    t.check('a panel nobody opened carries its general fields and nothing else',
        closed.panels > 0 && closed.headers === closed.panels &&
        closed.utilities === 0 && closed.sections === 0 && closed.calls === 0, closed);
    t.check('a change of view or of a utility builds nothing',
        closed.afterViewAndWrite === 0 && closed.classed, closed);

    var errors = page.errors();
    t.check('the closed panel tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function offcanvasTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var state = await page.eval(`
        const ge = start({ settings_panel: 'offcanvas' });
        ge.setUtility(q('#a'), 'order', '3', 'md');   // While closed: the panel opens with it

        q('#a > .ge-tools-drawer .ge-settings').click();
        const open = {
            inPanel: !!q('.ge-settings-offcanvas .ge-settings-body .ge-utilities'),
            value: orderSelect() ? orderSelect().value : null,
            sections: count('.ge-settings-offcanvas .ge-panel-section'),
            calls: window.sectionCalls,
            order: Array.from(q('.ge-settings-offcanvas .ge-details').children).map(function(child) {
                return child.className.split(' ')[0];
            }).join(','),
        };

        q('.ge-settings-offcanvas .ge-settings-close').click();
        const closed = {
            utilities: count('.ge-utilities'), sections: count('.ge-panel-section'),
            back: !!q('#a > .ge-tools-drawer > .ge-details > .ge-details-general'),
        };

        ge.setUtility(q('#a'), 'order', '1', 'md');
        q('#a > .ge-tools-drawer .ge-settings').click();
        const again = { value: orderSelect() ? orderSelect().value : null, calls: window.sectionCalls, utilities: count('.ge-utilities') };
        q('.ge-settings-offcanvas .ge-settings-close').click();

        return { open: open, closed: closed, again: again };
    `);
    t.check('opening a panel builds its sections and Responsive, after the general fields, from the node as it is',
        state.open.inPanel && state.open.value === '3' && state.open.sections === 1 && state.open.calls === 1 &&
        /^ge-section-title,ge-details-general,ge-panel-section,ge-utilities/.test(state.open.order), state.open);
    t.check('closing it takes them away, and its general fields go back to the drawer',
        state.closed.utilities === 0 && state.closed.sections === 0 && state.closed.back, state.closed);
    t.check('opening it again builds them again, as the node is now',
        state.again.value === '1' && state.again.calls === 2 && state.again.utilities === 1, state.again);

    var errors = page.errors();
    t.check('the offcanvas tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function inlineTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var state = await page.eval(`
        start({ settings_panel: 'inline' });
        const gear = q('#a > .ge-tools-drawer .ge-settings');
        gear.click();
        const open = { utilities: count('#a > .ge-tools-drawer .ge-utilities'), value: orderSelect() ? orderSelect().value : null };
        gear.click();
        const closed = { utilities: count('.ge-utilities'), sections: count('.ge-panel-section') };
        return { open: open, closed: closed };
    `);
    t.check('inline: unfolding a panel builds it in the drawer, folding it takes it away',
        state.open.utilities === 1 && state.open.value === '2' &&
        state.closed.utilities === 0 && state.closed.sections === 0, state);
}

async function sidebarTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var state = await page.eval(`
        const ge = start({ settings_panel: 'sidebar' });
        const none = count('.ge-utilities');
        ge.setActiveTarget(q('#a'));
        const first = { utilities: count('.ge-settings-sidebar .ge-utilities'), value: orderSelect() ? orderSelect().value : null };
        ge.setActiveTarget(q('#b'));
        const second = {
            utilities: count('.ge-utilities'),
            inSidebar: count('.ge-settings-sidebar .ge-utilities'),
            aBuilt: count('#a > .ge-tools-drawer .ge-utilities'),
            value: orderSelect() ? orderSelect().value : null,
        };
        ge.setActiveTarget(null);
        return { none: none, first: first, second: second, after: count('.ge-utilities') };
    `);
    t.check('sidebar: the target’s panel is built when it shows, and only that one',
        state.none === 0 && state.first.utilities === 1 && state.first.value === '2' &&
        state.second.utilities === 1 && state.second.inSidebar === 1 && state.second.aBuilt === 0 &&
        state.second.value === '', state);
    t.check('sidebar: no target, no panel built', state.after === 0, state);
}

async function apiTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var state = await page.eval(`
        start();
        const unbuilt = window.probe.detailsOf(q('#a'), { build: false });
        const plain = { general: !!unbuilt.querySelector('.ge-details-general'), utilities: !!unbuilt.querySelector('.ge-utilities') };
        const built = window.probe.detailsOf(q('#a'));
        const whole = {
            same: built === unbuilt,
            utilities: !!built.querySelector('.ge-utilities'),
            sections: built.querySelectorAll('.ge-panel-section').length,
            twice: (window.probe.detailsOf(q('#a')), built.querySelectorAll('.ge-utilities').length),
        };
        return { plain: plain, whole: whole, none: window.probe.detailsOf(q('#a p')) };
    `);
    t.check('ge.detailsOf(node, { build: false }) hands back the panel as it is',
        state.plain.general && !state.plain.utilities, state);
    t.check('ge.detailsOf(node) builds the rest of it, once',
        state.whole.same && state.whole.utilities && state.whole.sections === 1 && state.whole.twice === 1, state);
    t.check('and is null for a node with no panel', state.none === null, state);
}

async function snapshotTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    // The markup does not depend on which panels happen to be built
    var state = await page.eval(`
        const ge = start({ settings_panel: 'inline' });
        const closed = ge.getHtml({ keepEditing: true });
        q('#a > .ge-tools-drawer .ge-settings').click();
        const open = ge.getHtml({ keepEditing: true });
        return { same: closed === open, comment: /ge-details-body/.test(open), stillOpen: count('#a .ge-utilities') };
    `);
    t.check('snapshots are the same with a panel open or closed, and carry nothing of it',
        state.same && !state.comment && state.stillOpen === 1, state);

    await page.eval(`delete GridEditor.utilities.testing; delete GridEditor.features.probe; return true;`);
}

module.exports = {
    name: 'lazypanels',
    description: 'the panels built when they open',
    run: async function(t) {
        await closedTests(t);
        await offcanvasTests(t);
        await inlineTests(t);
        await sidebarTests(t);
        await apiTests(t);
        await snapshotTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['lazypanels']);
}
