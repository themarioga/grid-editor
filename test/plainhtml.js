/**
 * Browser tests for getPlainHtml: getHtml with grid-editor's own marking
 * taken off, for a host that publishes the markup rather than saving it to
 * edit again.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * A canvas with a bit of everything that carries marking: content areas, an
 * element on a bare wrapper and one with a class of its own, and each
 * container. Plus host markup whose names only look like the editor's.
 */
var BUILD = `
    jQuery('#myGrid').html(
        '<div class="row"><div class="col-12"><div class="ge-content">' +
            '<p class="column-note badge" data-gear="host" data-foo="bar">Host paragraph</p>' +
        '</div></div></div>'
    );
    window.fixture.init();
    const ge = jQuery('#myGrid').data('grideditor');
    const column = jQuery('#myGrid .column').first();

    ge.createElement('<blockquote>Quoted</blockquote>', { type: 'quote', label: 'Pull quote', appendTo: column.find('.ge-content') });
    ge.createElement('<p>Ordered</p>', { type: 'callout', appendTo: column.find('.ge-content') })
        .addClass('order-md-2');
    ge.createContainer('tabs', { tabs: 2, labels: ['One', 'Two'], appendTo: column });
    ge.createContainer('accordion', { items: 2, appendTo: column });
    ge.createContainer('popup', { title: 'Terms', trigger_label: 'Read them', appendTo: column });
    ge.createContainer('card', { title: 'Pricing', appendTo: column });
    ge.reset();
`;

/** What a piece of html says about itself, for comparing two of them. */
var DESCRIBE = `
    function describe(html) {
        const root = document.createElement('div');
        root.innerHTML = html;
        const all = Array.from(root.querySelectorAll('*'));
        return {
            geClasses: all.flatMap(n => Array.from(n.classList)).filter(c => c === 'column' || c.indexOf('ge-') === 0),
            geAttributes: all.flatMap(n => Array.from(n.attributes).map(a => a.name)).filter(a => a.indexOf('data-ge-') === 0),
            emptyClass: all.filter(n => n.getAttribute('class') === '').length,
            bareDivs: all.filter(n => n.tagName === 'DIV' && !n.attributes.length).length,
            text: root.textContent.replace(/\\s+/g, ' ').trim(),
            ids: all.map(n => n.id).filter(Boolean).sort().join(','),
            targets: all.map(n => n.getAttribute('data-bs-target')).filter(Boolean).sort().join(','),
            toggles: all.map(n => n.getAttribute('data-bs-toggle')).filter(Boolean).sort().join(','),
        };
    }
`;

async function plainTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var result = await page.eval(BUILD + DESCRIBE + `
        const drawersBefore = jQuery('#myGrid .ge-tools-drawer').length;
        const marked = jQuery('#myGrid').gridEditor('getHtml');
        const plain = jQuery('#myGrid').gridEditor('getPlainHtml');
        const root = document.createElement('div');
        root.innerHTML = plain;
        const host = root.querySelector('p.badge');

        return {
            marked: describe(marked),
            plain: describe(plain),
            plainHtml: plain.slice(0, 400),
            columnHoldsTheParagraph: host && host.parentNode.matches('.col-12'),
            hostKept: host && host.getAttribute('class') === 'column-note badge' &&
                host.getAttribute('data-gear') === 'host' && host.getAttribute('data-foo') === 'bar',
            quoteUnwrapped: !!root.querySelector('.col-12 > blockquote'),
            orderedKept: !!root.querySelector('div.order-md-2 > p'),
            editorBack: jQuery('#myGrid').hasClass('ge-editing') &&
                jQuery('#myGrid .ge-tools-drawer').length === drawersBefore,
        };
    `);

    t.check('getHtml still carries the marking the editor reads back',
        result.marked.geClasses.length > 0 && result.marked.geAttributes.length > 0, result.marked);
    t.check('getPlainHtml carries no ge-* class, no column class and no data-ge-* attribute',
        result.plain.geClasses.length === 0 && result.plain.geAttributes.length === 0 &&
        result.plain.emptyClass === 0,
        result.plain);
    t.check('a div that was only there for the editor goes, its children taking its place',
        result.plain.bareDivs === 0 && result.columnHoldsTheParagraph && result.quoteUnwrapped,
        result);
    t.check('a wrapper with a class of its own stays',
        result.orderedKept, result.plainHtml);
    t.check('host classes and attributes that only look like the editor\'s are kept',
        result.hostKept, result.plainHtml);
    t.check('the text, the ids and the Bootstrap wiring are the same as in getHtml',
        result.plain.text === result.marked.text && result.plain.ids === result.marked.ids &&
        result.plain.targets === result.marked.targets && result.plain.toggles === result.marked.toggles,
        { marked: result.marked, plain: result.plain });
    t.check('the editor goes back to editing afterwards', result.editorBack, result);

    var published = await page.eval(`
        const plain = jQuery('#myGrid').gridEditor('getPlainHtml');
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(plain);

        const second = document.querySelectorAll('#myGrid .nav-link')[1];
        bootstrap.Tab.getOrCreateInstance(second).show();
        const pane = document.querySelector(second.getAttribute('data-bs-target'));
        return { tabShown: !!pane && pane.classList.contains('active') };
    `);
    t.check('the plain markup still works with Bootstrap alone', published.tabShown, published);

    var noInstance = await page.eval(`
        const plain = jQuery('<div><div class="row"><div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>Saved</p></div></div></div></div>');
        return plain.gridEditor('getPlainHtml');
    `);
    t.check('on an element with no editor it cleans the element\'s html',
        noInstance === '<div class="row"><div class="col-6"><p>Saved</p></div></div>', noInstance);

    var errors = page.errors();
    t.check('the plain html tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** With no content types a content area is a content area, and no more. */
async function contentTypeTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var html = await page.eval(`
        window.fixture.init();
        jQuery('#myGrid').data('grideditor').createRow([6, 6], { appendTo: jQuery('#myGrid') });
        jQuery('#myGrid').gridEditor('reset');
        return jQuery('#myGrid').gridEditor('getHtml');
    `);
    t.check('with no content types, a content area names no type',
        html.indexOf('ge-content') !== -1 && html.indexOf('undefined') === -1 &&
        html.indexOf('data-ge-content-type') === -1,
        html.slice(0, 400));
}

module.exports = {
    name: 'plainhtml',
    description: 'getPlainHtml, the markup without the editor\'s marking',
    run: async function(t) {
        await plainTests(t);
        await contentTypeTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['plainhtml']);
}
