/**
 * Browser tests for the inline-style plugin's flex: a flex container's direction,
 * wrap, alignment and gaps, and how its children grow, shrink and fill, per
 * breakpoint.
 *
 * The part is families and their previews, so that is what is tested: which
 * class a choice writes, that families sharing the flex prefix keep apart,
 * and what each view shows. Which node gets which field is test/inlinestyle.js;
 * the engine underneath is test/utilities.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.ge = function() { return window.fixture.editor(); };
    window.row = function() { return document.querySelector('#myGrid > .row'); };
    window.col = function() { return row().querySelector(':scope > .column'); };
    window.log = [];
    document.querySelector('#myGrid').addEventListener('grideditor:after-utility', function(e) {
        window.log.push({ family: e.detail.family, breakpoint: e.detail.breakpoint, to: e.detail.to });
    });
    window.flexClasses = function(node) {
        return (node.getAttribute('class') || '').split(/\\s+/).filter(function(name) {
            return /^(flex-|justify-content-|align-content-|gap-|row-gap-|column-gap-)/.test(name);
        }).sort().join(' ');
    };
    /** Choose a value in a node's field, the way the user does. */
    window.choose = function(node, family, value) {
        const select = node.querySelector(':scope > .ge-tools-drawer [data-ge-inline-style-section="flex"] .ge-utility[data-ge-family="' + family + '"] select');
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    window.start = function(colClasses, settings) {
        if (window.fixture.editor()) { window.fixture.teardown(); }
        window.log = [];
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="column col-6 ' + colClasses + '">' +
            '<div class="ge-content"><p>a</p></div><div class="ge-content"><p>b</p></div></div></div>';
        window.fixture.init(Object.assign({ plugins: window.fixture.plugins(['inline-style']) }, settings || {}));
    };
`;

async function writes(t, page) {
    var written = await page.eval(`
        start('');
        ge().changeView('md');
        choose(col(), 'flex-direction', 'column');
        const direction = flexClasses(col());
        choose(col(), 'justify-content', 'center');
        const justify = { classes: flexClasses(col()), event: window.log[window.log.length - 1] };
        choose(col(), 'align-content', 'between');
        const content = flexClasses(col());
        ge().changeView('all');
        choose(col(), 'flex-grow', 'grow-1');
        ge().changeView('md');
        choose(col(), 'flex-fill', 'fill');
        return { direction: direction, justify: justify, content: content, children: flexClasses(col()) };
    `);
    t.check('flex-direction column in md writes flex-md-column (AC-34)', written.direction === 'flex-md-column', written);
    t.check('justify-content center in md writes justify-content-md-center, and the event says justify-content (AC-39)',
        written.justify.classes === 'flex-md-column justify-content-md-center' &&
        written.justify.event.family === 'justify-content' && written.justify.event.to === 'center', written.justify);
    t.check('align-content between in md writes align-content-md-between (AC-42)',
        written.content === 'align-content-md-between flex-md-column justify-content-md-center', written);
    t.check('grow in the all view and fill in md write flex-grow-1 and flex-md-fill (AC-38)',
        / flex-grow-1 /.test(' ' + written.children + ' ') && / flex-md-fill /.test(' ' + written.children + ' '), written);

    var apart = await page.eval(`
        start('flex-md-column flex-lg-nowrap');
        return {
            direction: ge().getUtility(col(), 'flex-direction', 'xl'),
            wrap: ge().getUtility(col(), 'flex-wrap', 'xl'),
            fill: ge().getUtility(col(), 'flex-fill', 'xl'),
        };
    `);
    t.check('the families that share the flex prefix read their own classes (AC-35)',
        apart.direction === 'column' && apart.wrap === 'nowrap' && apart.fill === null, apart);
}

async function previews(t, page) {
    var gaps = await page.eval(`
        start('d-md-flex');
        ge().changeView('md');
        choose(col(), 'gap', '3');
        const md = { classes: flexClasses(col()), gap: col().style.getPropertyValue('gap'), computed: getComputedStyle(col()).rowGap };
        start('d-md-flex', { inline_style: { spacing: { scale: ['0', '.25rem', '.5rem', '2rem', '1.5rem', '3rem'] } } });
        ge().changeView('md');
        choose(col(), 'gap', '3');
        return { md: md, scaled: col().style.getPropertyValue('gap') };
    `);
    t.check('gap 3 in md writes gap-md-3, previewed as 1rem (AC-36)',
        gaps.md.classes === 'gap-md-3' && gaps.md.gap === '1rem' && gaps.md.computed === '16px', gaps.md);
    t.check('the gaps follow style.spacing.scale (AC-37)', gaps.scaled === '2rem', gaps);

    var views = await page.eval(`
        start('d-flex flex-md-column justify-content-lg-end');
        const read = function(view) {
            ge().changeView(view);
            const style = getComputedStyle(col());
            return { direction: style.flexDirection, justify: style.justifyContent };
        };
        return { sm: read('sm'), md: read('md'), lg: read('lg') };
    `);
    t.check('each breakpoint view shows the direction and alignment its classes give there',
        views.sm.direction === 'row' && views.sm.justify === 'normal' &&
        views.md.direction === 'column' && views.lg.direction === 'column' && views.lg.justify === 'flex-end', views);

    var exported = await page.eval(`
        start('d-flex gap-2 flex-md-column');
        ge().changeView('md');
        return ge().getHtml();
    `);
    t.check('getHtml keeps the classes and none of the preview',
        /d-flex gap-2 flex-md-column/.test(exported) && !/data-ge-preview|style=/.test(exported), exported.slice(0, 200));
}

module.exports = {
    name: 'flex',
    description: 'the inline-style plugin\'s flex families',
    run: async function(t) {
        var page = await t.page(FIXTURE, `window.fixture`);
        await page.eval(HELPERS);

        await writes(t, page);
        await previews(t, page);

        var errors = page.errors();
        t.check('the flex tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};
