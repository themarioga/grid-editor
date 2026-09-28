/**
 * Browser tests for html the editor writes into the page: a <script> in it
 * is markup, kept in what getHtml gives, and never run in the editor.
 *
 * 6.x wrote through jQuery's .html() and .append(), which run inline scripts.
 * 7.0 writes as innerHTML does, and so a script pasted into the source view
 * runs on the page it is published on, not in the editor while it is being
 * edited.
 *
 * Spec remove-jquery: AC-16, AC-17 and AC-36, invariant I-8.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var SCRIPT = '<script>window.ran = (window.ran || 0) + 1;<\\/script>';

var HELPERS = `
    window.fresh = function(settings, html) {
        const running = GridEditor.get('#myGrid');
        if (running) { running.destroy(); }
        document.querySelector('#myGrid').innerHTML = html || '<div class="row"><div class="col-12" id="col"><p>Text</p></div></div>';
        window.ran = undefined;
        return GridEditor.create('#myGrid', Object.assign({ confirm_delete: false }, settings || {}));
    };
    window.settle = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms || 50); }); };
    window.scripts = function() { return document.querySelectorAll('#myGrid script').length; };
    return true;
`;

async function run(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);

    var source = await page.eval(`
        fresh();
        document.querySelector('.gm-edit-mode').click();
        const textarea = document.querySelector('textarea.ge-html-output');
        textarea.value = '<div class="row"><div class="col-12"><p>Edited</p>${SCRIPT}</div></div>';
        document.querySelector('.gm-edit-mode').click();
        await settle();
        return { ran: window.ran, scripts: scripts(), kept: /window\\.ran/.test(GridEditor.get('#myGrid').getHtml()) };
    `);
    t.check('a script written in the source view is in the canvas, and in getHtml, but did not run',
        source.ran === undefined && source.scripts === 1 && source.kept, source);

    var textarea = await page.eval(`
        const running = GridEditor.get('#myGrid');
        if (running) { running.destroy(); }
        window.ran = undefined;
        const area = document.createElement('textarea');
        area.id = 'source';
        area.value = '<div class="row"><div class="col-12"><p>From the textarea</p>${SCRIPT}</div></div>';
        document.body.appendChild(area);
        GridEditor.create('#myGrid', { source_textarea: '#source' });
        await settle();
        const result = { ran: window.ran, scripts: scripts(), text: /From the textarea/.test(document.querySelector('#myGrid').textContent) };
        area.remove();
        return result;
    `);
    t.check("a script in the source_textarea's html is put in the canvas and not run",
        textarea.ran === undefined && textarea.scripts === 1 && textarea.text, textarea);

    var created = await page.eval(`
        const ge = fresh({ elements: { enabled: true } });
        ge.createElement('<div class="widget"><p>Widget</p>${SCRIPT}</div>', { appendTo: '#col' });
        ge.createColumn(6, { appendTo: '#myGrid .row', content: '<p>Column</p>${SCRIPT}' });
        await settle();
        return { ran: window.ran, scripts: scripts() };
    `);
    t.check("neither does one in createElement's content or createColumn's",
        created.ran === undefined && created.scripts === 2, created);

    var pasted = await page.eval(`
        window.localStorage.setItem('grideditor.clipboard', JSON.stringify({
            version: 1,
            category: 'row',
            kind: 'row',
            html: '<div class="row"><div class="column col-12"><div class="ge-content"><p>Copied</p>${SCRIPT}</div></div></div>',
        }));
        fresh({ plugins: window.fixture.plugins(['clipboard']) });
        const button = document.querySelector('.ge-add-feature[data-ge-feature="clipboard"][data-ge-item="0"]');
        button.click();
        await settle();
        window.localStorage.removeItem('grideditor.clipboard');
        return {
            button: !!button,
            ran: window.ran,
            scripts: scripts(),
            pasted: /Copied/.test(document.querySelector('#myGrid').textContent),
        };
    `);
    t.check('nor one in what the clipboard pastes',
        pasted.button && pasted.pasted && pasted.ran === undefined && pasted.scripts === 1, pasted);

    var errors = page.errors();
    t.check('the script tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'scripts',
    description: 'a <script> in html the editor writes is markup, and does not run in the editor',
    run: run,
};

if (require.main === module) {
    require('./run').main(['scripts']);
}
