/**
 * Browser tests for what settings_panel 'sidebar' shows while nothing is
 * selected: the host's sidebar.empty, a plugin's sidebarEmpty, or its own
 * message (spec permanent-settings-panel, AC-43 to AC-50).
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.q = function(selector) { return document.querySelector(selector); };
    window.ge = function() { return window.fixture.editor(); };

    /** Content of the plugins below, by name: what each one's sidebarEmpty returns. */
    window.pluginContent = {};
    ['firstEmpty', 'secondEmpty'].forEach(function(name) {
        GridEditor.features[name] = function() {
            return { sidebarEmpty: function() { return window.pluginContent[name] || null; } };
        };
    });

    window.element = function(id) {
        const node = document.createElement('div');
        node.id = id;
        node.textContent = id;
        return node;
    };

    window.start = function(overrides, plugins) {
        if (ge()) { ge().destroy(); }
        window.warnings = [];
        q('#myGrid').innerHTML = '<div class="row"><div class="col-md-6" id="a"><p>A</p></div></div>';
        return window.fixture.init(Object.assign({
            settings_panel: 'sidebar',
            locale_strings: { 'test.first': 'From the first', 'test.second': 'From the second' },
            plugins: window.fixture.plugins(plugins || []),
        }, overrides || {}));
    };

    /** What the sidebar shows: its title, and the ids or the message in its body. */
    window.showing = function() {
        const sidebar = q('.ge-settings-sidebar');
        const body = sidebar.querySelector('.ge-settings-body');
        return {
            title: sidebar.querySelector('.ge-settings-title').textContent,
            body: Array.from(body.children).map(function(child) {
                return child.id || (child.matches('.ge-sidebar-empty') ? 'message' : child.className);
            }).join(','),
        };
    };
    return true;
`;

module.exports = {
    name: 'sidebarempty',
    description: 'settings_panel sidebar: what it shows with nothing selected',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(SETUP);

        var host = await page.eval(`
            const page = element('page');
            start({ sidebar: { empty: function() { return { title: '<b>Page</b>', body: page }; } } });
            return showing();
        `);
        t.check('the host’s sidebar.empty puts its title, as text, and its body in the sidebar (AC-43)',
            host.title === '<b>Page</b>' && host.body === 'page', host);

        var cycle = await page.eval(`
            const page = element('page');
            let calls = 0;
            let given = page;
            start({ sidebar: { empty: function(editor) {
                calls++;
                window.handedEditor = editor === ge();
                return { title: 'Page', body: given };
            } } });
            const first = calls;
            ge().setSelected('#a');
            const selected = { body: showing().body, attached: page.isConnected, calls: calls };
            given = element('page-again');
            ge().setSelected(null);
            return { first: first, selected: selected, after: showing(), calls: calls, handedEditor: window.handedEditor, kept: page.id === 'page' && !page.isConnected };
        `);
        t.check('a node selected takes the host’s body out, not destroyed; deselecting calls it again and shows what it gives (AC-44)',
            cycle.first === 1 && cycle.selected.body === 'ge-details' && !cycle.selected.attached && cycle.selected.calls === 1 &&
            cycle.calls === 2 && cycle.after.body === 'page-again' && cycle.handedEditor && cycle.kept, cycle);

        var plugin = await page.eval(`
            pluginContent = { firstEmpty: { titleKey: 'test.first', body: element('from-first') } };
            start({}, ['firstEmpty']);
            return showing();
        `);
        t.check('a plugin’s sidebarEmpty shows its titleKey, translated, and its body (AC-45)',
            plugin.title === 'From the first' && plugin.body === 'from-first', plugin);

        var hostFirst = await page.eval(`
            pluginContent = { firstEmpty: { titleKey: 'test.first', body: element('from-first') } };
            start({ sidebar: { empty: function() { return { title: 'Host', body: element('from-host') }; } } }, ['firstEmpty']);
            return showing();
        `);
        t.check('with both, the host’s wins (AC-46)', hostFirst.title === 'Host' && hostFirst.body === 'from-host', hostFirst);

        var hostNull = await page.eval(`
            pluginContent = { firstEmpty: { titleKey: 'test.first', body: element('from-first') } };
            start({ sidebar: { empty: function() { return null; } } }, ['firstEmpty']);
            return showing();
        `);
        t.check('the host’s returning null leaves it to the plugin (AC-47)',
            hostNull.title === 'From the first' && hostNull.body === 'from-first', hostNull);

        var order = await page.eval(`
            pluginContent = {
                firstEmpty: { titleKey: 'test.first', body: element('from-first') },
                secondEmpty: { titleKey: 'test.second', body: element('from-second') },
            };
            start({}, ['firstEmpty', 'secondEmpty']);
            return showing();
        `);
        t.check('with two plugins, the one registered first wins (AC-48)',
            order.title === 'From the first' && order.body === 'from-first', order);

        var notFunction = await page.eval(`
            pluginContent = {};
            start({ sidebar: { empty: 'x' } });
            ge().setSelected('#a').setSelected(null);
            return { showing: showing(), warned: warnings.filter(function(w) { return /sidebar\\.empty/.test(w); }).length };
        `);
        t.check('a sidebar.empty that is not a function warns once and the message shows (AC-49)',
            notFunction.warned === 1 && notFunction.showing.title === 'Settings' && notFunction.showing.body === 'message', notFunction);

        var noBody = await page.eval(`
            pluginContent = { firstEmpty: { titleKey: 'test.first', body: element('from-first') } };
            start({ sidebar: { empty: function() { return { title: 'P' }; } } }, ['firstEmpty']);
            const toPlugin = showing();
            pluginContent = {};
            start({ sidebar: { empty: function() { return { title: 'P' }; } } });
            return { toPlugin: toPlugin, toMessage: showing() };
        `);
        t.check('a result with no body counts as null: the next in line, or the message (AC-50)',
            noBody.toPlugin.title === 'From the first' && noBody.toPlugin.body === 'from-first' &&
            noBody.toMessage.title === 'Settings' && noBody.toMessage.body === 'message', noBody);

        var errors = page.errors();
        t.check('the empty sidebar tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['sidebarempty']);
}
