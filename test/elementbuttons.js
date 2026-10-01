/**
 * Browser tests for elements.types: the elements the toolbar offers, and
 * what their buttons make.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/**
 * Two rows of plain content - #a in the first, #second the second row - and
 * an editor with the fixture's plugins, elements among them, and the types
 * given. `types` is source, so a type can carry a function.
 */
function start(types, settings) {
    return `
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        const grid = document.querySelector('#myGrid');
        grid.innerHTML =
            '<div class="row" id="first"><div class="column col-12" id="a"><div class="ge-content"><p>First row</p></div></div></div>' +
            '<div class="row" id="second"><div class="column col-12"><div class="ge-content"><p>Second row</p></div></div></div>';
        window.adds = [];
        if (window.onAdd) { grid.removeEventListener('grideditor:after-add', window.onAdd); }
        window.onAdd = function(e) { window.adds.push([e.detail.kind, e.detail.source]); };
        grid.addEventListener('grideditor:after-add', window.onAdd);
        const settings = Object.assign({ default_view: 'xs' }, ${JSON.stringify(settings || {})});
        settings.elements = Object.assign({}, settings.elements, { types: ${types || 'undefined'} });
        window.fixture.init(settings);
    `;
}

var QUOTE = `{ type: 'quote', label: 'Pull quote', iconClass: 'bi bi-quote',
    html: '<blockquote class="my-quote"><p>Quote</p></blockquote>' }`;
var FIGURE = `{ type: 'figure', html: '<figure class="my-figure"><figcaption>Figure</figcaption></figure>' }`;

/** The element buttons on the toolbar, as their titles and faces. */
var BUTTONS = `
    return Array.from(document.querySelectorAll('.ge-mainControls [data-ge-feature="elements"]')).map(function(button) {
        const icon = button.querySelector(':scope > i');
        return {
            title: button.getAttribute('title'),
            icon: icon ? icon.getAttribute('class') : null,
            label: (button.querySelector(':scope > span') || {}).textContent || '',
        };
    });
`;

function button(index) {
    return `.ge-mainControls [data-ge-feature="elements"][data-ge-item="${index}"]`;
}

/** The top level rows: an id, or 'new:<what its column holds>' for a row the editor made. */
var ROWS = `
    return Array.from(document.querySelectorAll('#myGrid > .row')).map(function(row) {
        if (row.id) { return row.id; }
        const held = row.querySelector(':scope > .column > [data-ge-element]');
        return 'new:' + (held ? held.getAttribute('data-ge-element') : '?');
    }).join(',');
`;

function warningsLike(page, pattern) {
    return page.logs.filter(function(entry) {
        return /^console\.warn/.test(entry.kind) && pattern.test(entry.text);
    });
}

/** Q01: the buttons, and what they make. */
async function buttonTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var none = await page.eval(start() + BUTTONS);
    t.check('AC-01 without types there are no element buttons', none.length === 0, none);

    var two = await page.eval(start('[' + QUOTE + ', ' + FIGURE + ']') + BUTTONS);
    t.check('AC-02 a button per type, in order: an icon alone with the label as title, or a plus and the label',
        two.length === 2 && two[0].title === 'Pull quote' && two[0].icon === 'bi bi-quote' && two[0].label === '' &&
        two[1].icon === 'bi bi-plus', two);
    t.check('AC-22 a type with no label nor labelKey is labelled with its type', two[1].title === 'figure' && two[1].label === 'figure', two[1]);

    await page.click(button(0));
    var made = await page.eval(`
        const quote = document.querySelector('#myGrid blockquote');
        return {
            rows: (function() { ${ROWS} })(),
            element: quote && quote.getAttribute('data-ge-element'),
            label: quote && quote.getAttribute('data-ge-label'),
            marked: !!quote && quote.classList.contains('ge-element'),
            drawer: !!quote && !!quote.querySelector(':scope > .ge-element-drawer'),
            inColumn: !!quote && quote.parentElement.classList.contains('column'),
            adds: window.adds,
        };
    `);
    t.check('AC-03 on a page with no elements, enabled auto, the plugin is on: what the button makes is marked',
        made.marked && made.drawer, made);
    t.check('AC-04 a click makes the template\'s root at the end of the canvas, in a row and a column, marked with its type and label',
        made.rows === 'first,second,new:quote' && made.element === 'quote' && made.label === 'Pull quote' && made.inColumn, made);
    t.check('AC-21 announced as an element added from the toolbar',
        JSON.stringify(made.adds) === JSON.stringify([['element', 'tool']]), made.adds);

    var html = await page.eval(`
        const out = document.createElement('div');
        out.innerHTML = window.fixture.editor().getHtml();
        const quote = out.querySelector('blockquote');
        return {
            className: quote.getAttribute('class'),
            element: quote.getAttribute('data-ge-element'),
            label: quote.getAttribute('data-ge-label'),
            parentIsColumn: /\\bcol-12\\b/.test(quote.parentElement.getAttribute('class') || ''),
            text: quote.textContent,
        };
    `);
    t.check('AC-05 getHtml gives the blockquote back with its data-ge attributes and no wrapper',
        html.className === 'my-quote' && html.element === 'quote' && html.label === 'Pull quote' && html.parentIsColumn && html.text === 'Quote', html);

    await page.eval(start('[' + QUOTE + ']', { toolbar_drag: true }) + 'return true;');
    await page.drag(button(0), '#a .ge-content', { yRatio: 0.5 });
    var dropped = await page.eval(`return { inA: !!document.querySelector('#a > blockquote[data-ge-element="quote"]'), rows: (function() { ${ROWS} })() };`);
    t.check('AC-06 dragged into a column, it is made in that column', dropped.inA && dropped.rows === 'first,second', dropped);

    await page.eval(start('[' + QUOTE + ']', { toolbar_drag: true }) + 'return true;');
    await page.drag(button(0), '#second > .ge-tools-drawer');
    var between = await page.eval(ROWS);
    t.check('AC-07 dropped between two rows, it is made in a row and a column of its own there', between === 'first,new:quote,second', between);

    await page.eval(start('[' + QUOTE + ']', { active_target: true }) + `window.fixture.editor().setActiveTarget('#a'); return true;`);
    await page.click(button(0));
    var targeted = await page.eval(`return { inA: !!document.querySelector('#a > blockquote[data-ge-element="quote"]'), rows: (function() { ${ROWS} })() };`);
    t.check('AC-08 with an active column, it goes at its end', targeted.inA && targeted.rows === 'first,second', targeted);

    await page.eval(start(`[{ type: 'figure', html: function() { window.made = (window.made || 0) + 1; return '<figure id="fig-' + window.made + '"></figure>'; } }]`) + 'window.made = 0; return true;');
    await page.click(button(0));
    await page.click(button(0));
    var ids = await page.eval(`return Array.from(document.querySelectorAll('#myGrid figure')).map(function(f) { return f.id; });`);
    t.check('AC-09 an html function is called for each one made', JSON.stringify(ids) === JSON.stringify(['fig-1', 'fig-2']), ids);

    await page.eval(start(`[{ type: 'widget', html: function() { const node = document.createElement('section'); node.className = 'mine'; window.given = node; return node; } }]`) + 'return true;');
    await page.click(button(0));
    var node = await page.eval(`return { same: document.querySelector('#myGrid section.mine') === window.given, element: window.given.getAttribute('data-ge-element') };`);
    t.check('AC-10 a node the function returns is the element itself', node.same && node.element === 'widget', node);

    await page.eval(start(`[{ type: 'pair', html: '<p>a</p><p>b</p>' }]`) + 'return true;');
    await page.click(button(0));
    var wrapped = await page.eval(`
        const element = document.querySelector('#myGrid [data-ge-element="pair"]');
        return element && { tag: element.tagName, paragraphs: element.querySelectorAll(':scope > p').length };
    `);
    t.check('AC-11 html with no single root is wrapped in a div', wrapped && wrapped.tag === 'DIV' && wrapped.paragraphs === 2, wrapped);

    await page.eval(start(`[{ type: 'risky', html: '<div><script>window.ran = true;<\\/script>Risky</div>' }]`) + 'window.ran = false; return true;');
    await page.click(button(0));
    var ran = await page.eval(`return { ran: window.ran, made: !!document.querySelector('#myGrid [data-ge-element="risky"]') };`);
    t.check('AC-12 a script in the html does not run', ran.made && ran.ran === false, ran);

    var off = await page.eval(start('[' + QUOTE + ']', { elements: { enabled: false } }) + BUTTONS);
    t.check('AC-16 enabled false takes the buttons away too', off.length === 0, off);

    await page.eval(`
        await new Promise(function(resolve, reject) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        Object.assign(GridEditor.locales.en, { 'element.figure': 'Figure' });
        Object.assign(GridEditor.locales.es, { 'element.figure': 'Figura' });
        return true;
    `);
    var relabelled = await page.eval(start(`[{ type: 'figure', label: 'Ignored', labelKey: 'element.figure', html: '<figure></figure>' }]`) + `
        const before = document.querySelector('${button(0)}').getAttribute('title');
        window.fixture.editor().setLocale('es');
        return { before: before, after: document.querySelector('${button(0)}').getAttribute('title') };
    `);
    t.check('AC-17 a labelKey wins over label, and follows setLocale', relabelled.before === 'Figure' && relabelled.after === 'Figura', relabelled);

    var errors = page.errors();
    t.check('the element button tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** Q02: what can't be made, and the word the host gets. */
async function warningTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var invalid = await page.eval(start(`[{ html: '<p>No type</p>' }, { type: 'empty' }, { type: 'blank', html: '  ' }, ` + QUOTE + ']') + BUTTONS);
    var invalidWarnings = warningsLike(page, /elements\.types\[\d\]/);
    t.check('AC-13 a type with no type name or no html has no button, and a warning each',
        invalid.length === 1 && invalid[0].title === 'Pull quote' && invalidWarnings.length === 3, { buttons: invalid, warnings: invalidWarnings.length });

    await page.eval(start(`[{ type: 'broken', html: function() { throw new Error('nope'); } }, { type: 'nothing', html: function() { return ''; } }]`) + 'return true;');
    await page.click(button(0));
    await page.click(button(1));
    var failed = await page.eval(`return { rows: document.querySelectorAll('#myGrid > .row').length, adds: window.adds.length };`);
    var failedWarnings = warningsLike(page, /"broken": its html function threw|"nothing": its html came out empty/);
    t.check('AC-14 an html function that throws or gives nothing adds nothing, with a warning',
        failed.rows === 2 && failed.adds === 0 && failedWarnings.length === 2, { failed: failed, warnings: failedWarnings.length });

    await page.eval(start(`[{ type: 'plain', html: '<div class="not-a-widget">Plain</div>' }]`, { elements: { selector: '.widget' } }) + 'return true;');
    await page.click(button(0));
    await page.click(button(0));
    var mismatched = await page.eval(`return document.querySelectorAll('#myGrid [data-ge-element="plain"]').length;`);
    var selectorWarnings = warningsLike(page, /"plain": what it makes does not match elements\.selector/);
    t.check('AC-15 a type that does not match a custom selector is still made, with one warning for the type',
        mismatched === 2 && selectorWarnings.length === 1, { made: mismatched, warnings: selectorWarnings.length });

    var errors = page.errors();
    t.check('the element button warning tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'elementbuttons',
    description: 'the elements the toolbar offers, and what their buttons make',
    run: async function(t) {
        await buttonTests(t);
        await warningTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['elementbuttons']);
}
