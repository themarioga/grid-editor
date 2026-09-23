/**
 * Browser tests for element level controls: the level below a column.
 *
 * The question these answer is which nodes the editor is willing to treat as
 * elements, since that is a decision about someone else's markup: by default
 * only the ones the host marked, and every loose node of a column only when
 * the host asks for that. Since 6.0 an element is a block of the column,
 * beside the texts: markup 5.x saved, with elements inside a content area's
 * text, comes out of it (test/conversion.js has the rules).
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** A canvas whose one content area holds the markup given, as 5.x saved it. */
function canvasOf(inner) {
    return "jQuery('#myGrid').gridEditor('destroy');" +
        'jQuery("#myGrid").html(\'<div class="row"><div class="column col-12">' +
        '<div class="ge-content">' + inner + '</div></div></div>\');';
}

var MARKED = '<p>Ordinary text</p>' +
    '<div data-ge-element="image" data-ge-label="Hero"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></div>' +
    '<p>More text</p>';

/** What the editor decided is an element, and what each one shows. */
var ELEMENTS = `
    return jQuery('#myGrid .ge-element').map(function() {
        const element = jQuery(this);
        return [{
            type: element.attr('data-ge-element'),
            label: element.attr('data-ge-label'),
            tag: this.tagName.toLowerCase(),
            editable: element.attr('contenteditable'),
            inColumn: element.parent().is('.column'),
            drawers: element.find('> .ge-tools-drawer').length,
            info: element.find('> .ge-tools-drawer .ge-element-info').attr('title'),
            tools: element.find('> .ge-tools-drawer > a').map(function() {
                return jQuery(this).attr('class').split(' ')[0];
            }).get().join(','),
        }];
    }).get();
`;

async function detectionTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var marked = await page.eval(canvasOf(MARKED) + `
        window.fixture.init();
        ` + ELEMENTS);
    t.check('only the nodes the host marked become elements, as blocks of the column',
        marked.length === 1 && marked[0].type === 'image' && marked[0].label === 'Hero' &&
        marked[0].drawers === 1 && marked[0].inColumn,
        marked);
    t.check('an element is never marked contenteditable: it is never inside a text editor',
        marked[0].editable === undefined, marked[0]);
    t.check('an element drawer carries move, info, delete, and says what the element is',
        marked[0].tools === 'ge-move,ge-element-info,ge-settings,ge-delete-element' &&
        marked[0].info === 'Element: Hero (image)',
        marked[0]);

    var auto = await page.eval(canvasOf(MARKED) + `
        window.fixture.init({ elements: { enabled: 'auto', selector: '[data-ge-element]', auto: true } });
        window.texts = jQuery('#myGrid .ge-content').length;
        ` + ELEMENTS);
    var autoTexts = await page.eval(`return window.texts;`);
    t.check('elements.auto makes every loose node of a column an element, 5.x\'s content area children included',
        auto.length === 3 && auto.map(e => e.tag).join(',') === 'p,div,p' &&
        auto.every(e => e.drawers === 1 && e.inColumn) && autoTexts === 0,
        { auto: auto, texts: autoTexts });
    t.check('an auto element with no marking is named after its tag',
        auto[0].info === 'Element: p' && auto[1].info === 'Element: Hero (image)', auto);

    var off = await page.eval(canvasOf(MARKED) + `
        window.fixture.init({ elements: { enabled: false, selector: '[data-ge-element]', auto: true } });
        return {
            elements: jQuery('#myGrid .ge-element').length,
            drawers: jQuery('#myGrid .ge-content .ge-tools-drawer').length,
            markupKeptInText: jQuery('#myGrid .ge-content [data-ge-element]').length,
        };
    `);
    t.check('elements.enabled false leaves the content area alone, marked nodes and all',
        off.elements === 0 && off.drawers === 0 && off.markupKeptInText === 1, off);

    var nothingMarked = await page.eval(canvasOf('<p>Just text</p>') + `
        window.fixture.init();
        return {
            elements: jQuery('#myGrid .ge-element').length,
            texts: jQuery('#myGrid .ge-content').length,
        };
    `);
    t.check('a page with nothing marked gets no element handling at all',
        nothingMarked.elements === 0 && nothingMarked.texts === 1, nothingMarked);

    var partial = await page.eval(canvasOf(MARKED) + `
        window.fixture.init({ elements: { auto: true } });
        return {
            settings: jQuery('#myGrid').data('grideditor').settings.elements,
            elements: jQuery('#myGrid .ge-element').length,
        };
    `);
    t.check('naming one key of the elements setting keeps the defaults for the others',
        partial.settings.selector === '[data-ge-element]' && partial.settings.enabled === 'auto' &&
        partial.settings.auto === true && partial.elements === 3,
        partial);

    var hostTools = await page.eval(canvasOf(MARKED) + `
        window.clicked = 0;
        window.fixture.init({
            element_tools: [{
                title: 'Edit this element',
                className: 'my-app-edit',
                iconClass: 'bi bi-pencil',
                on: { click: function() { window.clicked++; } },
            }],
        });
        jQuery('#myGrid .ge-element .my-app-edit').trigger('click');
        return {
            tools: jQuery('#myGrid .ge-element > .ge-tools-drawer > a').map(function() {
                return jQuery(this).attr('class').split(' ')[0];
            }).get(),
            clicked: window.clicked,
        };
    `);
    t.check('element_tools are added to the drawer like row and column tools',
        hostTools.tools.join(',') === 'ge-move,ge-element-info,ge-settings,my-app-edit,ge-delete-element' &&
        hostTools.clicked === 1,
        hostTools);
}

async function operationTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var deleted = await page.eval(canvasOf(MARKED) + `
        window.log = [];
        window.fixture.init({ confirm_delete: false });
        jQuery('#myGrid').on('grideditor:before-delete grideditor:after-delete', function(e, payload) {
            window.log.push([e.type.replace('grideditor:', ''), payload.kind, payload.parent.attr('class')]);
        });
        jQuery('#myGrid .ge-element .ge-delete-element').trigger('click');
        return true;
    `);
    await cdp.sleep(600);
    var afterDelete = await page.eval(`
        return {
            elements: jQuery('#myGrid .ge-element').length,
            textKept: jQuery('#myGrid .ge-content').text().indexOf('Ordinary text') !== -1,
            log: window.log,
        };
    `);
    t.check('deleting an element announces itself as one, from its column, and leaves the text around it',
        afterDelete.elements === 0 && afterDelete.textKept &&
        afterDelete.log.length === 2 && afterDelete.log[0][1] === 'element' &&
        /(^|\s)column(\s|$)/.test(afterDelete.log[0][2]),
        afterDelete);

    var created = await page.eval(`
        const warnings = [];
        const warn = console.warn;
        console.warn = function(message) { warnings.push(message); warn.apply(console, arguments); };

        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();
        const element = ge.createElement('<span class="my-app-tag">Analytics tag</span>', {
            type: 'analytics-tag',
            label: 'Analytics',
            appendTo: column,
        });

        // 5.x put it into a content area's text; it goes beside it now
        const contentArea = jQuery('#myGrid .ge-content').first();
        const beside = ge.createElement('<p>Beside</p>', { type: 'beside', appendTo: contentArea });
        const besideAgain = ge.createElement('<p>Before</p>', { type: 'before', prependTo: contentArea });
        console.warn = warn;

        return {
            marked: element.hasClass('ge-element'),
            drawer: element.find('> .ge-tools-drawer').length,
            editable: element.attr('contenteditable'),
            info: element.find('.ge-element-info').attr('title'),
            inPlace: element.parent()[0] === column[0] && column.children().last()[0] === element[0],
            beside: beside.prev()[0] === contentArea.parent()[0] && beside.parent().is('.column'),
            before: besideAgain.next()[0] === contentArea.parent()[0],
            warned: warnings.filter(function(w) { return /an element is a block of the column since 6\.0/.test(w); }).length,
        };
    `);
    t.check('an element created through the api is marked and drawn like any other',
        created.marked && created.drawer === 1 && created.editable === undefined &&
        created.info === 'Element: Analytics (analytics-tag)' && created.inPlace,
        created);
    t.check('createElement into a content area puts it beside that text instead, and warns once',
        created.beside && created.before && created.warned === 1, created);

    var exported = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            drawer: /ge-tools-drawer/.test(html),
            marking: /class="[^"]*ge-element/.test(html) || /class=""/.test(html),
            editable: /contenteditable/i.test(html),
            keptType: /data-ge-element="analytics-tag"/.test(html),
            keptLabel: /data-ge-label="Analytics"/.test(html),
            keptHostMarkup: /class="my-app-tag"/.test(html),
        };
    `);
    t.check('getHtml keeps the host\\u2019s marking and drops the editor\\u2019s',
        !exported.drawer && !exported.marking && !exported.editable &&
        exported.keptType && exported.keptLabel && exported.keptHostMarkup,
        Object.assign({}, exported, { html: exported.html.slice(0, 200) }));

    var roundTrip = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        const before = jQuery('#myGrid .ge-element').length;

        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(html);
        window.fixture.init();

        return { before: before, after: jQuery('#myGrid .ge-element').length };
    `);
    t.check('feeding that output back in finds the same elements',
        roundTrip.before === roundTrip.after && roundTrip.after === 3, roundTrip);

    var errors = page.errors();
    t.check('the element operation tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Moving elements, with real drags, within a column and between two, and the
 * canvas and the sections turning one away.
 */
async function moveTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(
            '<div class="row">' +
            '<div class="column col-6" id="left">' +
            '<div data-ge-element="one" id="first"><p>Element one, which is tall enough to drag onto.</p></div>' +
            '<div data-ge-element="two" id="second"><p>Element two, which is also tall enough.</p></div>' +
            '</div>' +
            '<div class="column col-6" id="right">' +
            '<div data-ge-element="three" id="third"><p>Element three, in the other column.</p></div>' +
            '</div>' +
            '</div>'
        );
        window.moves = [];
        window.fixture.init();
        jQuery('#myGrid').on('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.parent.attr('id'), payload.to.parent.attr('id'), payload.from.index, payload.to.index]);
        });
        return true;
    `);

    await page.drag('#second > .ge-tools-drawer .ge-move', '#first', { yRatio: 0.15 });
    var within = await page.eval(`
        return {
            order: jQuery('#left > .ge-element').map(function() { return this.id; }).get().join(','),
            moves: window.moves,
        };
    `);
    t.check('an element moves within its column and reports itself as an element',
        within.order === 'second,first' && within.moves.length === 1 &&
        within.moves[0][0] === 'element' && within.moves[0][1] === 'left' && within.moves[0][2] === 'left',
        within);

    await page.drag('#third > .ge-tools-drawer .ge-move', '#first', { yRatio: 0.15 });
    var between = await page.eval(`
        return {
            left: jQuery('#left > .ge-element').map(function() { return this.id; }).get().join(','),
            right: jQuery('#right > .ge-element').length,
            moves: window.moves,
        };
    `);
    t.check('an element moves between columns, and the payload says which',
        between.left.indexOf('third') !== -1 && between.right === 0 &&
        between.moves.length === 2 && between.moves[1][0] === 'element' &&
        between.moves[1][1] === 'right' && between.moves[1][2] === 'left',
        between);

    // Asked the way SortableJS asks, as a drag goes over each list
    var refused = await page.eval(`
        const canvas = Sortable.get(jQuery('#myGrid')[0]);
        const column = Sortable.get(jQuery('#left')[0]);
        const other = Sortable.get(jQuery('#right')[0]);
        const element = jQuery('#first')[0];
        const row = jQuery('#myGrid > .row')[0];
        return {
            intoCanvas: !!canvas.options.group.checkPut(canvas, column, element),
            intoColumn: !!other.options.group.checkPut(other, column, element),
            rowIntoCanvas: !!canvas.options.group.checkPut(canvas, column, row),
        };
    `);
    t.check('an element is a block of a column only: the canvas turns it away, as it takes rows',
        !refused.intoCanvas && refused.intoColumn && refused.rowIntoCanvas, refused);

    var errors = page.errors();
    t.check('the element move tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'elements',
    description: 'element level controls: blocks of a column, beside the texts',
    run: async function(t) {
        await detectionTests(t);
        await operationTests(t);
        await moveTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['elements']);
}
