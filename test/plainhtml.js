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
    document.querySelector('#myGrid').innerHTML =
        '<div class="row"><div class="col-12"><div class="ge-content">' +
            '<p class="column-note badge" data-gear="host" data-foo="bar">Host paragraph</p>' +
        '</div></div></div>';
    const ge = window.fixture.init();
    const column = document.querySelector('#myGrid .column');

    ge.createElement('<blockquote>Quoted</blockquote>', { type: 'quote', label: 'Pull quote', appendTo: column.querySelector('.ge-content') });
    ge.createElement('<p>Ordered</p>', { type: 'callout', appendTo: column.querySelector('.ge-content') })
        .classList.add('order-md-2');
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
        const drawersBefore = document.querySelectorAll('#myGrid .ge-tools-drawer').length;
        const marked = ge.getHtml();
        const plain = ge.getPlainHtml();
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
            editorBack: document.querySelector('#myGrid').classList.contains('ge-editing') &&
                document.querySelectorAll('#myGrid .ge-tools-drawer').length === drawersBefore,
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
        const plain = window.fixture.editor().getPlainHtml();
        window.fixture.editor().destroy();
        document.querySelector('#myGrid').innerHTML = plain;

        const second = document.querySelectorAll('#myGrid .nav-link')[1];
        bootstrap.Tab.getOrCreateInstance(second).show();
        const pane = document.querySelector(second.getAttribute('data-bs-target'));
        return { tabShown: !!pane && pane.classList.contains('active') };
    `);
    t.check('the plain markup still works with Bootstrap alone', published.tabShown, published);

    var noInstance = await page.eval(`
        const saved = document.createElement('div');
        saved.innerHTML = '<div class="row"><div class="column col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>Saved</p></div></div></div>';
        document.body.appendChild(saved);
        const editor = GridEditor.create(saved, { content_types: [] });
        editor.destroy();
        const plain = editor.getPlainHtml();
        saved.remove();
        return plain;
    `);
    t.check('on an editor that has been destroyed it cleans the element\'s html',
        noInstance === '<div class="row"><div class="col-6"><p>Saved</p></div></div>', noInstance);

    var errors = page.errors();
    t.check('the plain html tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** With no content types a content area is a content area, and no more. */
async function contentTypeTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var html = await page.eval(`
        const ge = window.fixture.init();
        ge.createRow([6, 6], { appendTo: '#myGrid' });
        ge.reset();
        return ge.getHtml();
    `);
    t.check('with no content types, a content area names no type',
        html.indexOf('ge-content') !== -1 && html.indexOf('undefined') === -1 &&
        html.indexOf('data-ge-content-type') === -1,
        html.slice(0, 400));
}

/**
 * The plainMarkup hook: a plugin changes the markup getPlainHtml read before
 * the editor's marking comes off, and can refuse the request.
 */
async function hookTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var result = await page.eval(`
        const q = function(selector) { return document.querySelector(selector); };
        q('#myGrid').innerHTML = '<div class="row"><div class="col-12"><div class="ge-content">' +
            '<p data-ge-i18n=\\'{"en":"Hello"}\\' data-ge-lang="es">Hola</p></div></div></div>';

        // Without a plugin that has the hook, the data-ge-* attributes just go
        const bare = window.fixture.init();
        const without = bare.getPlainHtml();
        bare.destroy();

        const seen = [];
        GridEditor.features.zzfirst = function() {
            return {
                plainMarkup: function(root, options) {
                    const p = root.querySelector('p');
                    seen.push({
                        isBody: root.tagName === 'BODY',
                        inert: root.ownerDocument !== document,
                        stillMarked: p.hasAttribute('data-ge-i18n'),
                        gridMarking: !!root.querySelector('.row, .ge-content, [data-ge-content-type], .column'),
                        options: options && JSON.stringify(options),
                    });
                    if (options && options.lang === 'en') { p.textContent = JSON.parse(p.getAttribute('data-ge-i18n')).en; }
                    if (options && options.lang === 'nope') { return false; }
                    if (options && options.lang === 'boom') { throw new Error('write failed'); }
                },
            };
        };
        let later = 0;
        GridEditor.features.zzsecond = function() {
            return { plainMarkup: function() { later++; } };
        };
        const ge = window.fixture.init({ plugins: window.fixture.plugins(['zzfirst', 'zzsecond']) });

        const out = { without: without };
        out.en = ge.getPlainHtml({ lang: 'en' });
        out.fallback = ge.getPlainHtml();
        out.laterAfterTwo = later;
        out.refused = ge.getPlainHtml({ lang: 'nope' });
        out.laterAfterRefused = later;
        try { ge.getPlainHtml({ lang: 'boom' }); out.thrown = null; } catch (error) { out.thrown = error.message; }
        out.html = ge.getHtml();
        out.editing = q('#myGrid').classList.contains('ge-editing');
        out.seen = seen;
        ge.destroy();
        const afterDestroy = later;
        out.afterDestroy = ge.getPlainHtml({ lang: 'en' });
        out.laterAfterDestroy = later - afterDestroy;
        delete GridEditor.features.zzfirst;
        delete GridEditor.features.zzsecond;
        return out;
    `);

    t.check('without a plugin, getPlainHtml gives the default language: the data-ge-* attributes just go (multilang AC-53)',
        result.without.indexOf('data-ge-') === -1 && result.without.indexOf('Hola') !== -1 && result.without.indexOf('Hello') === -1,
        result.without);
    t.check('a plugin\'s plainMarkup changes the markup, and the editor\'s marking comes off after it',
        result.en.indexOf('Hello') !== -1 && result.en.indexOf('Hola') === -1 && result.en.indexOf('data-ge-') === -1,
        result.en);
    t.check('plainMarkup gets the markup in an inert document, still marked, and the options getPlainHtml was given',
        result.seen[0].isBody && result.seen[0].inert && result.seen[0].stillMarked &&
        result.seen[0].gridMarking && result.seen[0].options === '{"lang":"en"}' && result.seen[1].options === undefined,
        result.seen);
    t.check('every plugin with the hook is asked, and an editor that is back editing is not left changed',
        result.laterAfterTwo === 2 && result.html.indexOf('Hola') !== -1 && result.editing, result);
    t.check('false from a hook makes getPlainHtml answer null, and the plugins after it are not asked',
        result.refused === null && result.laterAfterRefused === result.laterAfterTwo, result);
    t.check('an error a hook throws reaches the caller', result.thrown === 'write failed', result);
    t.check('after destroy getPlainHtml reads the element as it is: no hook runs',
        result.afterDestroy.indexOf('Hola') !== -1 && result.laterAfterDestroy === 0, result);

    var errors = page.errors();
    t.check('the hook tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'plainhtml',
    description: 'getPlainHtml, the markup without the editor\'s marking',
    run: async function(t) {
        await plainTests(t);
        await contentTypeTests(t);
        await hookTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['plainhtml']);
}
