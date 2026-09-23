/**
 * Browser tests for 6.0's conversion of 5.x markup: elements, containers and
 * rows that sit inside a content area's text come out of it, into the column.
 *
 * The first half is a record: test/fixtures/5x holds canvases as 5.x saved
 * them, and what 5.3.1's getPlainHtml gave for each, and 6.0 has to publish
 * the same. The second half is each rule on its own.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var fs = require('fs');
var path = require('path');

var FIXTURE = '/test/fixtures/grid.html?init=manual';
var RECORDED = path.join(__dirname, 'fixtures', '5x');

/**
 * Start the editor on some markup, in the page. What 5.x recorded and what
 * 6.0 gives differ in whitespace only where a content area was cut, so the
 * two are compared with whitespace-only text dropped.
 */
var HELPERS = `
    window.startOn = function(html, overrides) {
        if (jQuery('#myGrid').data('grideditor')) { jQuery('#myGrid').gridEditor('destroy'); }
        jQuery('#myGrid').html(html);
        window.fixture.init(Object.assign({ content_types: [], plugins: window.fixture.plugins([]) }, overrides || {}));
    };
    window.normalized = function(html) {
        const root = document.createElement('div');
        root.innerHTML = html;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const blank = [];
        while (walker.nextNode()) {
            if (!/\\S/.test(walker.currentNode.nodeValue)) { blank.push(walker.currentNode); }
        }
        blank.forEach(function(node) { node.remove(); });
        return root.innerHTML;
    };
    /** A column's blocks, in order: text, a type of element, a container or a row. */
    window.blocksOf = function(column) {
        return jQuery(column).children().not('.ge-tools-drawer, .ge-resize-handle').map(function() {
            const node = jQuery(this);
            if (node.is('.ge-text-block')) { return 'text'; }
            if (node.is('.ge-element')) { return node.attr('data-ge-element') || this.tagName.toLowerCase(); }
            if (node.is('[data-ge-container]')) { return node.attr('data-ge-container'); }
            if (node.is('.row')) { return 'row'; }
            return '?' + this.tagName.toLowerCase();
        }).get().join(',');
    };
    return true;
`;

function recorded(name) {
    return {
        html: fs.readFileSync(path.join(RECORDED, name + '.html'), 'utf8'),
        plain: fs.readFileSync(path.join(RECORDED, name + '.plain.html'), 'utf8'),
    };
}

async function recordTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var names = fs.readdirSync(RECORDED)
        .filter(function(file) { return /^[a-z]+\.html$/.test(file); })
        .map(function(file) { return file.replace('.html', ''); })
        .filter(function(name) { return name !== 'hosted'; });

    for (var name of names) {
        var fixture = recorded(name);
        var result = await page.eval(`
            startOn(${JSON.stringify(fixture.html)}, ${name === 'auto' ? '{ elements: { enabled: true, auto: true } }' : '{}'});
            const plain = jQuery('#myGrid').gridEditor('getPlainHtml');
            return { now: normalized(plain), then: normalized(${JSON.stringify(fixture.plain)}) };
        `);
        t.check('test/fixtures/5x/' + name + '.html publishes what 5.x published',
            result.now === result.then, result.now === result.then ? undefined : result);
    }

    var hosted = recorded('hosted');
    var own = await page.eval(`
        startOn(${JSON.stringify(hosted.html)});
        return normalized(jQuery('#myGrid').gridEditor('getPlainHtml'));
    `);
    t.check('a content area with an id and a class of its own keeps them on its first part only, on purpose',
        own === '<div class="row"><div class="col-lg-12"><div class="lead" id="intro"><p>A content area with an id and a class of the host\'s.</p></div>' +
            '<blockquote><p>A quote.</p></blockquote><p>Text after it.</p></div></div>',
        own);

    var errors = page.errors();
    t.check('the recorded canvases logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function ruleTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var between = await page.eval(`
        startOn(${JSON.stringify(recorded('between').html)});
        const texts = jQuery('#myGrid .ge-content').map(function() { return jQuery(this).text().trim(); }).get();
        return {
            blocks: blocksOf(jQuery('#myGrid .column').first()),
            texts: texts,
            types: jQuery('#myGrid .ge-content').map(function() { return jQuery(this).attr('data-ge-content-type'); }).get().join(','),
        };
    `);
    t.check('elements cut a content area: the text before, the element, the text after, each a block of the column',
        between.blocks === 'text,quote,text,figure,text' &&
        between.texts.join('|') === 'Text before the quote.|Text between the quote and the figure.|Text after the figure.',
        between);
    t.check('each new part is a content area of the same type', between.types === 'tinymce,tinymce,tinymce', between);

    var edges = await page.eval(`
        startOn(${JSON.stringify(recorded('edges').html)});
        return {
            first: blocksOf(jQuery('#myGrid .column').eq(0)),
            second: blocksOf(jQuery('#myGrid .column').eq(1)),
        };
    `);
    t.check('an element first or last leaves no empty text before or after it, and one alone leaves none at all',
        edges.first === 'quote,text,callout' && edges.second === 'callout', edges);

    var inline = await page.eval(`
        startOn(${JSON.stringify(recorded('inline').html)});
        return { blocks: blocksOf(jQuery('#myGrid .column').first()), elements: jQuery('#myGrid .ge-element').length };
    `);
    t.check('a marked node inside a paragraph or a list is text, as it was in 5.x: only a content area\'s children cut it',
        inline.blocks === 'text' && inline.elements === 0, inline);

    var nested = await page.eval(`
        startOn(${JSON.stringify(recorded('nested').html)});
        return {
            outer: blocksOf(jQuery('#myGrid .column').first()),
            inCard: blocksOf(jQuery('#myGrid [data-ge-container="card"] .column').first()),
        };
    `);
    t.check('texts inside a container are cut the same way', nested.outer === 'text,card' && nested.inCard === 'text,quote', nested);

    var loose = await page.eval(`
        startOn(${JSON.stringify(recorded('loose').html)});
        return blocksOf(jQuery('#myGrid .column').first());
    `);
    t.check('loose markup in a column becomes texts, and a marked node in it an element', loose === 'text,quote,text', loose);

    var auto = await page.eval(`
        startOn(${JSON.stringify(recorded('auto').html)}, { elements: { enabled: true, auto: true } });
        return blocksOf(jQuery('#myGrid .column').first());
    `);
    t.check('with elements.auto every child of a 5.x content area is an element, and no text is left', auto === 'h2,p,blockquote', auto);

    var hosted = await page.eval(`
        startOn(${JSON.stringify(recorded('hosted').html)});
        const areas = jQuery('#myGrid .ge-content');
        return {
            first: { id: areas.eq(0).attr('id'), lead: areas.eq(0).hasClass('lead') },
            second: { id: areas.eq(1).attr('id'), lead: areas.eq(1).hasClass('lead') },
        };
    `);
    t.check('the first part keeps the content area, id and classes; the next is a new one without them',
        hosted.first.id === 'intro' && hosted.first.lead && hosted.second.id === undefined && !hosted.second.lead, hosted);

    var inside = await page.eval(`
        startOn('<div class="row"><div class="col-12"><div class="ge-content"><p>Before</p>' +
            '<div class="row"><div class="col-6"><p>A row that was text</p></div></div>' +
            '<div data-ge-container="card"><div class="card"><div class="card-body"><div class="row"><div class="col-12"><p>A card that was text</p></div></div></div></div></div>' +
            '<p>After</p></div></div></div>');
        return blocksOf(jQuery('#myGrid > .row > .column').first());
    `);
    t.check('a row or a container inside a content area comes out of it too', inside === 'text,row,card,text', inside);

    var idempotent = await page.eval(`
        startOn(${JSON.stringify(recorded('between').html)});
        const once = jQuery('#myGrid').gridEditor('getHtml');
        startOn(once);
        const twice = jQuery('#myGrid').gridEditor('getHtml');
        jQuery('#myGrid').gridEditor('reset');
        const thrice = jQuery('#myGrid').gridEditor('getHtml');
        return { same: once === twice && twice === thrice, once: once.slice(0, 300) };
    `);
    t.check('the conversion is idempotent: 6.0 markup comes back as it went in', idempotent.same, idempotent);

    var disabled = await page.eval(`
        startOn(${JSON.stringify(recorded('between').html)}, { plugins: ['card'] });
        return { blocks: blocksOf(jQuery('#myGrid .column').first()), inText: jQuery('#myGrid .ge-content [data-ge-element]').length };
    `);
    t.check('without the elements plugin a marked node is markup like any other, and stays in its text',
        disabled.blocks === 'text' && disabled.inText === 2, disabled);

    // A content area whose editor is open is left alone until the next init
    var open = await page.eval(`
        $.fn.gridEditor.texts.plain = function(ge) {
            return {
                start: function(block) { block.addClass('active'); ge.textReady(block); },
                stop: function(block) { block.removeClass('active'); },
            };
        };
        startOn('<div class="row"><div class="col-12"><div class="ge-content" data-ge-content-type="plain"><p>Being edited</p></div></div></div>',
            { content_types: ['plain'] });
        const area = jQuery('#myGrid .ge-content').first();
        area.trigger('click');
        area.append('<div data-ge-element="late"><p>Pasted into the open editor</p></div>');
        jQuery('#myGrid').data('grideditor').createRow([12], { appendTo: jQuery('#myGrid') });
        const whileOpen = blocksOf(jQuery('#myGrid .column').first());
        jQuery('#myGrid').gridEditor('getHtml');
        const afterClose = blocksOf(jQuery('#myGrid .column').first());
        delete $.fn.gridEditor.texts.plain;
        return { whileOpen: whileOpen, afterClose: afterClose };
    `);
    t.check('a content area with its editor open is not cut under it; the next init cuts it',
        open.whileOpen === 'text' && open.afterClose === 'text,late', open);

    var errors = page.errors();
    t.check('the conversion rule tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'conversion',
    description: '5.x markup, with elements in the text, taken apart into blocks',
    run: async function(t) {
        await recordTests(t);
        await ruleTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['conversion']);
}
