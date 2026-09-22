/**
 * Browser tests for the settings panel behind a row's or a column's gear.
 *
 * Its job is to let a host set the two things html has for saying what a node
 * is: its id and its classes. The editor's own classes are not its business,
 * and it must not take them away.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var CANVAS = `
    jQuery('#myGrid').gridEditor('destroy');
    jQuery('#myGrid').html(
        '<div class="row" id="the-row"><div class="column col-6 my-app-wide" id="the-column">' +
        '<div class="ge-content"><p>x</p></div></div></div>'
    );
`;

/** The panel of the first column. */
var PANEL = '#myGrid .column > .ge-tools-drawer .ge-details';

async function panelTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var fields = await page.eval(CANVAS + `
        window.fixture.init({ default_view: 'xs' });

        const drawer = jQuery('#myGrid .column > .ge-tools-drawer');
        const panel = drawer.find('.ge-details');

        return {
            hiddenAtRest: !panel.is(':visible'),
            id: panel.find('.ge-id').val(),
            classes: panel.find('.ge-classes').val(),
            placeholders: [panel.find('.ge-id').attr('placeholder'), panel.find('.ge-classes').attr('placeholder')],
            presetButtons: panel.find('.btn-group a').length,
        };
    `);
    t.check('the panel shows the id and the host\\u2019s own classes, and nothing of the editor\\u2019s',
        fields.hiddenAtRest && fields.id === 'the-column' && fields.classes === 'my-app-wide' &&
        fields.placeholders.join(',') === 'id,classes',
        fields);
    t.check('no preset class buttons are offered unless the host asks for them',
        fields.presetButtons === 0, fields);

    var opened = await page.eval(`
        jQuery('#myGrid .column > .ge-tools-drawer .ge-settings').trigger('click');
        return jQuery('${PANEL}').is(':visible');
    `);
    t.check('the gear opens the panel', opened === true, opened);

    var edited = await page.eval(`
        const panel = jQuery('${PANEL}');
        const column = jQuery('#myGrid .column').first();

        panel.find('.ge-classes').val('my-app-wide my-app-dark').trigger('change');
        panel.find('.ge-id').val('renamed').trigger('change');

        return {
            id: column.attr('id'),
            classes: column.attr('class'),
        };
    `);
    t.check('typing classes and an id puts them on the node, beside the grid classes',
        edited.id === 'renamed' && /my-app-wide/.test(edited.classes) &&
        /my-app-dark/.test(edited.classes) && /(^|\s)col-6(\s|$)/.test(edited.classes) &&
        /(^|\s)column(\s|$)/.test(edited.classes),
        edited);

    var removed = await page.eval(`
        const panel = jQuery('${PANEL}');
        const column = jQuery('#myGrid .column').first();

        panel.find('.ge-classes').val('my-app-dark').trigger('change');

        return { classes: column.attr('class'), width: column.width() > 0 };
    `);
    t.check('a class taken out of the field is taken off the node, and the grid classes stay',
        !/my-app-wide/.test(removed.classes) && /my-app-dark/.test(removed.classes) &&
        /(^|\s)col-6(\s|$)/.test(removed.classes) && removed.width,
        removed);

    var cleared = await page.eval(`
        const panel = jQuery('${PANEL}');
        const column = jQuery('#myGrid .column').first();

        panel.find('.ge-classes').val('').trigger('change');
        panel.find('.ge-id').val('').trigger('change');

        return {
            id: column.attr('id'),
            classes: column.attr('class'),
        };
    `);
    t.check('emptying a field takes the id away rather than leaving an empty one',
        cleared.id === undefined && !/my-app/.test(cleared.classes) &&
        /(^|\s)col-6(\s|$)/.test(cleared.classes),
        cleared);

    var rows = await page.eval(`
        const panel = jQuery('#myGrid > .row > .ge-tools-drawer .ge-details');
        const row = jQuery('#myGrid > .row').first();

        panel.find('.ge-classes').val('my-app-row').trigger('change');

        return { id: panel.find('.ge-id').val(), classes: row.attr('class') };
    `);
    t.check('a row has the same panel as a column',
        rows.id === 'the-row' && /my-app-row/.test(rows.classes) && /(^|\s)row(\s|$)/.test(rows.classes),
        rows);
}

async function presetTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var presets = await page.eval(CANVAS + `
        window.fixture.init({
            default_view: 'xs',
            col_classes: [{ label: 'Dark', cssClass: 'my-app-dark' }],
        });

        const panel = jQuery('${PANEL}');
        const column = jQuery('#myGrid .column').first();

        panel.find('.btn-group a').trigger('click');

        return {
            buttons: panel.find('.btn-group a').map(function() { return jQuery(this).text(); }).get(),
            classes: column.attr('class'),
            title: panel.find('.btn-group a').attr('title'),
        };
    `);
    t.check('a host that configures preset classes still gets its buttons',
        presets.buttons.join(',') === 'Dark' && /my-app-dark/.test(presets.classes) &&
        presets.title === 'Toggle "Dark" styling',
        presets);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            keptClass: /my-app-dark/.test(html),
            keptId: /id="the-column"/.test(html),
            panel: /ge-details|ge-classes/.test(html),
        };
    `);
    t.check('the classes and the id are the host\\u2019s markup, and survive getHtml',
        exported.keptClass && exported.keptId && !exported.panel,
        Object.assign({}, exported, { html: exported.html.slice(0, 160) }));

    var errors = page.errors();
    t.check('the settings tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'settings',
    description: 'the id and class panel behind a drawer\'s gear',
    run: async function(t) {
        await panelTests(t);
        await presetTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['settings']);
}
