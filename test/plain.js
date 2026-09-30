/**
 * Browser tests for the host's plain content: what the editor wraps the
 * markup that is not the grid's in, while no text editor has taken it.
 *
 * Plain content is a content area with no type. It is moved and deleted,
 * edited only in the source, and never made from the editor's tools; a click
 * makes it a text when an editor is offered, which is test/convert.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** Warnings collected, the events recorded, and a fresh editor on some markup. */
var SETUP = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.$$ = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.kids = function(node, selector) {
        return node ? Array.from(node.children).filter(function(c) { return !selector || c.matches(selector); }) : [];
    };
    window.kid = function(node, selector) { return window.kids(node, selector)[0] || null; };
    window.ge = function() { return window.fixture.editor(); };

    window.events = [];
    const recorded = ['before-delete', 'after-delete', 'before-move', 'after-move', 'before-convert', 'after-convert'];
    const record = function(e) { window.events.push(e.type.replace('grideditor:', '') + ':' + e.detail.kind); };
    window.start = function(html, settings) {
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        const grid = document.querySelector('#myGrid');
        grid.innerHTML = html;
        window.events = [];
        recorded.forEach(function(name) {
            grid.removeEventListener('grideditor:' + name, record);
            grid.addEventListener('grideditor:' + name, record);
        });
        return window.fixture.init(settings || {});
    };

    /** The tools in a block's drawer, by their first class. */
    window.toolsOf = function(block) {
        return kids(kid(block, '.ge-tools-drawer'), 'a').map(function(tool) {
            return tool.getAttribute('class').split(' ')[0];
        }).join(',');
    };
    return true;
`;

/** Two columns of loose markup, the host's own. */
var TWO_COLUMNS = '<div class="row"><div class="col-lg-6" id="left"><p>Left</p></div>' +
    '<div class="col-lg-6" id="right"><p>Right</p></div></div>';

async function wrapTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var bare = await page.eval(`
        const html = start('<h1>A</h1><p>B</p>').getHtml();
        const root = document.createElement('div');
        root.innerHTML = html;
        const area = root.querySelector('.row > .col-lg-12 > .ge-content');
        return {
            rows: root.querySelectorAll(':scope > .row').length,
            area: !!area,
            attributes: area ? Array.from(area.attributes).map(function(a) { return a.name + '=' + a.value; }).join('|') : null,
            children: area ? Array.from(area.children).map(function(n) { return n.tagName; }).join(',') : null,
        };
    `);
    t.check('a page with no grid goes into one row and column, as plain content: a content area with no type',
        bare.rows === 1 && bare.area && bare.attributes === 'class=ge-content' && bare.children === 'H1,P', bare);

    var withEditor = await page.eval(`
        start('<h1>A</h1><p>B</p>', { content_types: ['tinymce'] });
        const area = $$('#myGrid .ge-content');
        const html = ge().getHtml();
        return {
            areas: area.length,
            typed: /data-ge-content-type|ge-content-type-/.test(html),
            kind: ge() && area.length ? 'ok' : null,
        };
    `);
    t.check('with a text editor offered it is plain content all the same',
        withEditor.areas === 1 && !withEditor.typed, withEditor);

    var split = await page.eval(`
        start('<div class="row"><div class="col-12" id="outer"><p>1</p><div class="row"><div class="col-6"><div class="ge-content" data-ge-content-type="tinymce"><p>x</p></div></div></div><p>2</p></div></div>');
        return kids(document.querySelector('#outer')).filter(function(c) { return !c.matches('.ge-tools-drawer, .ge-resize-handle'); }).map(function(child) {
            if (child.matches('.ge-plain-block')) { return 'plain:' + kid(child, '.ge-content').textContent; }
            if (child.matches('.row')) { return 'row'; }
            return child.className;
        }).join(',');
    `);
    t.check('each run of loose content in a column is plain content of its own, a row between them',
        split === 'plain:1,row,plain:2', split);

    var bareText = await page.eval(`
        start('<div class="row"><div class="col-12" id="only">Hola</div></div>');
        return { areas: $$('#only .ge-content').length, text: document.querySelector('#only').textContent.indexOf('Hola') !== -1 };
    `);
    t.check('a column whose only content is a bare text node is not wrapped',
        bareText.areas === 0 && bareText.text, bareText);

    var source = await page.eval(`
        $$('#source').forEach(function(n) { n.remove(); });
        const textarea = document.createElement('textarea');
        textarea.id = 'source';
        textarea.style.display = 'none';
        textarea.value = '<p>X</p>';
        document.body.appendChild(textarea);
        start('', { source_textarea: '#source', content_types: ['tinymce'] });
        const area = $$('#myGrid > .row > .column > .ge-text-block > .ge-content');
        textarea.remove();
        return { areas: area.length, html: area[0] && area[0].innerHTML, typed: !!(area[0] && area[0].getAttribute('data-ge-content-type')) };
    `);
    t.check('source_textarea html with no grid is plain content in a row and a full width column, editor or not',
        source.areas === 1 && source.html === '<p>X</p>' && !source.typed, source);

    await page.eval(`start('<div class="row"><div class="col-6"><p>seed</p></div></div>', { content_types: ['tinymce'] }); return true;`);
    await page.click('.gm-edit-mode');
    await t.sleep(200);
    var roundTrip = await page.eval(`
        document.querySelector('.ge-html-output').value = '<div class="row"><div class="col-6"><p>L</p><div class="ge-content" data-ge-content-type="tinymce"><p>T</p></div><div class="ge-content"><p>P</p></div></div></div>';
        $$('.gm-edit-mode').forEach(function(b) { b.click(); });
        return kids(document.querySelector('#myGrid .column'), '.ge-text-block').map(function(block) {
            const area = kid(block, '.ge-content');
            return (area.getAttribute('data-ge-content-type') || 'plain') + ':' + area.textContent;
        }).join(',');
    `);
    t.check('back from the source, loose content and a content area with no type are plain, a typed one a text',
        roundTrip === 'plain:L,tinymce:T,plain:P', roundTrip);

    var auto = await page.eval(`
        start('<div class="row"><div class="col-12"><p>1</p><p>2</p></div></div>', { elements: { auto: true } });
        return { elements: $$('#myGrid .ge-element').length, plains: $$('#myGrid .ge-plain-block').length };
    `);
    t.check('with elements.auto every loose node of a column is an element, and none is plain content',
        auto.elements === 2 && auto.plains === 0, auto);

    var marked = await page.eval(`
        start('<div class="row"><div class="col-12" id="cut"><div class="ge-content"><p>1</p><blockquote data-ge-element="q">Q</blockquote><p>2</p></div></div></div>');
        return kids(document.querySelector('#cut')).filter(function(c) { return !c.matches('.ge-tools-drawer, .ge-resize-handle'); }).map(function(child) {
            if (child.matches('.ge-element')) { return 'element'; }
            const area = kid(child, '.ge-content');
            return (area.getAttribute('data-ge-content-type') || 'plain') + ':' + area.textContent;
        }).join(',');
    `);
    t.check('plain content with an element among its children is cut there, into plain content and the element',
        marked === 'plain:1,element,plain:2', marked);

    var errors = page.errors();
    t.check('the wrapping tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function drawerTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var drawer = await page.eval(`
        start(${JSON.stringify(TWO_COLUMNS)}, {
            content_types: ['tinymce'],
            plugins: window.fixture.plugins(['clipboard', 'inline-style']),
            text_tools: [{ title: 'Host tool', className: 'host-tool' }],
        });
        const block = document.querySelector('#left > .ge-plain-block');
        const handle = ge();
        return {
            tools: toolsOf(block),
            gear: $$('.ge-settings, .ge-details', block).length,
            kind: handle ? kids(block, '.ge-content').length : 0,
            createPlain: typeof handle.createPlain,
            toolbar: $$('.ge-mainControls a').filter(function(a) { return /plain/i.test(a.className + ' ' + (a.title || '')); }).length,
            columnTools: $$('#left > .ge-tools-drawer > a').filter(function(a) { return /plain/i.test(a.className); }).length,
        };
    `);
    t.check('plain content\'s drawer is move and delete, and nothing else, whatever the plugins and host tools',
        drawer.tools === 'ge-move,ge-delete-plain' && drawer.gear === 0, drawer);
    t.check('nothing in the toolbar, the drawers or the handle makes plain content',
        drawer.createPlain === 'undefined' && drawer.toolbar === 0 && drawer.columnTools === 0, drawer);

    await page.eval(`
        start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [] });
        $$('#left > .ge-plain-block > .ge-tools-drawer > .ge-delete-plain').forEach(function(tool) { tool.click(); });
        return true;
    `);
    await t.sleep(600);
    var message = await page.eval(`
        const message = $$('.ge-confirm .ge-confirm-message').map(function(n) { return n.textContent; }).join('');
        $$('.ge-confirm .ge-confirm-ok').forEach(function(b) { b.click(); });
        return message;
    `);
    await t.sleep(900);
    var asked = await page.eval(`
        return { gone: $$('#left > .ge-plain-block').length === 0, events: window.events.slice() };
    `);
    asked.message = message;
    t.check('deleting plain content asks, removes it and announces it as plain',
        asked.message === 'Delete this content?' && asked.gone &&
        asked.events.join(' ') === 'before-delete:plain after-delete:plain', asked);

    var canceled = await page.eval(`
        start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [], confirm_delete: false });
        const refuse = function(e) { e.preventDefault(); };
        document.querySelector('#myGrid').addEventListener('grideditor:before-delete', refuse);
        $$('#left > .ge-plain-block > .ge-tools-drawer > .ge-delete-plain').forEach(function(tool) { tool.click(); });
        return new Promise(function(resolve) {
            setTimeout(function() {
                document.querySelector('#myGrid').removeEventListener('grideditor:before-delete', refuse);
                resolve({ kept: $$('#left > .ge-plain-block').length === 1, events: window.events.slice() });
            }, 600);
        });
    `);
    t.check('a canceled before-delete keeps it, and there is no after-delete',
        canceled.kept && canceled.events.join(' ') === 'before-delete:plain', canceled);

    var clicked = await page.eval(`
        start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [] });
        const area = document.querySelector('#left .ge-content');
        const before = { attributes: area.outerHTML, html: ge().getHtml() };
        document.querySelector('#left .ge-content').click();
        const after = document.querySelector('#left .ge-content');
        return {
            same: after.outerHTML === document.querySelector('#left .ge-content').outerHTML && !after.getAttribute('data-ge-content-type') &&
                !after.classList.contains('ge-rte-active'),
            html: ge().getHtml() === before.html,
            events: window.events.slice(),
        };
    `);
    t.check('with no text editor offered, a click on plain content does nothing',
        clicked.same && clicked.html && clicked.events.length === 0, clicked);

    var saved = await page.eval(`
        start('<div class="row"><div class="col-12"><div class="ge-content lead" id="intro"><p>Mine</p></div></div></div>', { content_types: ['tinymce'] });
        const html = ge().getHtml();
        const root = document.createElement('div');
        root.innerHTML = html;
        const area = root.querySelector('.ge-content');
        start(html, { content_types: ['tinymce'] });
        const intro = document.querySelector('#intro');
        return {
            id: area.id,
            classes: area.className,
            marks: /data-ge-|ge-text-block|ge-tools-drawer/.test(html),
            plainAgain: intro.parentElement.matches('.ge-plain-block') && !intro.getAttribute('data-ge-content-type'),
            plainHtml: ge().getPlainHtml(),
        };
    `);
    t.check('getHtml keeps plain content\'s own id and classes and nothing of the editor\'s; it is plain again on reload',
        saved.id === 'intro' && saved.classes === 'ge-content lead' && !saved.marks && saved.plainAgain, saved);

    var published = await page.eval(`
        return start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [] }).getPlainHtml();
    `);
    t.check('getPlainHtml gives back its children, without the div around them',
        /<div class="col-lg-6" id="left"><p>Left<\/p><\/div>/.test(published), published);

    var errors = page.errors();
    t.check('the drawer tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A drag by hand, point to point: what page.drag does, from a point of our
 * choosing - the grip at the start of a drawer is a few pixels wide.
 */
async function dragFrom(page, from, to) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
    for (var step = 1; step <= 16; step++) {
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved', button: 'left', buttons: 1,
            x: from.x + (to.x - from.x) * step / 16,
            y: from.y + (to.y - from.y) * step / 16,
        });
        await new Promise(function(resolve) { setTimeout(resolve, 30); });
    }
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
    await new Promise(function(resolve) { setTimeout(resolve, 300); });
}

var POINTS = `
    const source = document.querySelector('#left > .ge-plain-block > .ge-tools-drawer');
    source.scrollIntoView({ block: 'center' });
    await new Promise(function(r) { requestAnimationFrame(function() { requestAnimationFrame(r); }); });
    const a = source.getBoundingClientRect();
    const b = document.querySelector('#right').getBoundingClientRect();
    return { from: { x: a.left + 5, y: a.top + a.height / 2 }, to: { x: b.left + b.width / 2, y: b.top + b.height * 0.9 } };
`;

async function dragTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    await page.eval(`start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [] }); document.querySelector('#left > .ge-plain-block').id = 'moving'; return true;`);
    await page.hover('#moving');
    await t.sleep(200);
    await page.drag('#moving > .ge-tools-drawer .ge-move', '#right', { yRatio: 0.9, steps: 16 });
    var moved = await page.eval(`return { inRight: $$('#right > #moving').length, events: window.events.slice() };`);
    t.check('plain content drags from one column to another, announced as plain',
        moved.inRight === 1 && moved.events.join(' ') === 'before-move:plain after-move:plain', moved);

    await page.eval(`start(${JSON.stringify(TWO_COLUMNS)}, { content_types: [], drag_handle: 'drawer' }); document.querySelector('#left > .ge-plain-block').id = 'moving'; return true;`);
    await page.hover('#moving');
    await t.sleep(200);
    var points = await page.eval(POINTS);
    await dragFrom(page, points.from, points.to);
    var byDrawer = await page.eval(`return { inRight: $$('#right > #moving').length, move: $$('#moving .ge-move').length };`);
    t.check('with drag_handle drawer it drags by its drawer, which has no move tool',
        byDrawer.inRight === 1 && byDrawer.move === 0, byDrawer);

    var errors = page.errors();
    t.check('the drag tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function orphanTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var none = await page.eval(`
        const feature = GridEditor.features.text;
        delete GridEditor.features.text;
        start('<div class="row"><div class="col-12" id="only"><div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce"><p>T</p></div></div></div>');
        const block = document.querySelector('#only > .ge-text-block');
        const area = kid(block, '.ge-content');
        area.click();
        const result = {
            tools: toolsOf(block),
            title: block.querySelector(':scope > .ge-tools-drawer > .ge-text-missing').getAttribute('title'),
            active: area.classList.contains('ge-rte-active'),
            kind: null,
            html: ge().getHtml(),
        };
        ge().destroy();
        GridEditor.features.text = feature;
        return result;
    `);
    t.check('with no text editor loaded, a text saved with a type is a block: move, why it is not editable, delete',
        none.tools === 'ge-move,ge-text-info,ge-delete-text' && /No text editor "tinymce"/.test(none.title) &&
        !none.active && /data-ge-content-type="tinymce"/.test(none.html), none);

    var ghost = await page.eval(`
        start('<div class="row"><div class="col-12" id="only"><div class="ge-content" data-ge-content-type="ghost"><p>G</p></div></div></div>', { content_types: ['tinymce'] });
        const block = document.querySelector('#only > .ge-text-block');
        kid(block, '.ge-content').click();
        return {
            tools: toolsOf(block),
            title: block.querySelector(':scope > .ge-tools-drawer > .ge-text-missing').getAttribute('title'),
            active: kid(block, '.ge-content').classList.contains('ge-rte-active'),
        };
    `);
    t.check('and so is a text of a type no plugin loaded here declares, with an editor loaded',
        ghost.tools === 'ge-move,ge-text-info,ge-delete-text' && /No text editor "ghost"/.test(ghost.title) && !ghost.active, ghost);

    var deleted = await page.eval(`
        start('<div class="row"><div class="col-12" id="only"><div class="ge-content" data-ge-content-type="ghost"><p>G</p></div></div></div>', { confirm_delete: false });
        $$('#only .ge-delete-text').forEach(function(tool) { tool.click(); });
        return new Promise(function(resolve) {
            setTimeout(function() { resolve({ gone: $$('#only .ge-content').length === 0, events: window.events.slice() }); }, 700);
        });
    `);
    t.check('its delete is announced as a text',
        deleted.gone && deleted.events.join(' ') === 'before-delete:text after-delete:text', deleted);

    var errors = page.errors();
    t.check('the orphan tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function previewTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(SETUP);

    var hidden = await page.eval(`
        const ge = start('<div class="row"><div class="col-12" id="only"><div class="ge-content d-md-none"><p>H</p></div></div></div>',
            { content_types: [], plugins: window.fixture.plugins(['inline-style']) });
        ge.changeView('md');
        const area = document.querySelector('#only .ge-content');
        return {
            faded: area.classList.contains('ge-hidden-in-view'),
            eye: $$('#only .ge-visibility-tool').length === $$('#only > .ge-tools-drawer .ge-visibility-tool').length,
            plainEye: $$('#only > .ge-plain-block .ge-visibility-tool').length,
        };
    `);
    t.check('a utility class the host wrote on plain content is previewed, though its drawer offers no tool for it',
        hidden.faded && hidden.plainEye === 0, hidden);

    var errors = page.errors();
    t.check('the preview tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'plain',
    description: 'the host\'s plain content: wrapped, moved, deleted, never made',
    run: async function(t) {
        await wrapTests(t);
        await drawerTests(t);
        await dragTests(t);
        await orphanTests(t);
        await previewTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['plain']);
}
