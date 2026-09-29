/**
 * Browser tests for the rich text editor integrations.
 *
 * Run with `npm test`, or on its own with `node test/rte.js`. This drives the
 * example pages in a real Chrome, against the real editors loaded from their
 * CDNs, because the things that break in these integrations are things only a
 * browser does: an inline editor taking focus, and the attributes an editor
 * restores on the element it was attached to when it is removed again.
 *
 * The editors come from a CDN rather than from `test/vendor`, so the runner
 * skips this suite when there is no network.
 *
 * Tests run against the built files in `dist`, so run `npm run build` first if
 * you changed anything under `src`.
 */

var path = require('path');
var cdp = require('./cdp');

var sleep = cdp.sleep;

/**
 * Page helpers: the editor on #myGrid, a visibility test the way jQuery's
 * :visible had it, and the tinyMCE editor open on a content area, which is
 * what the plugin used to keep in jQuery data.
 */
var HELPERS = `
    window.ge = function() { return GridEditor.get('#myGrid'); };
    window.$$ = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.shown = function(node) { return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length); };
    window.editorOn = function(area) {
        return window.tinymce && area ? (tinymce.get().find(function(editor) { return editor.getElement() === area; }) || null) : null;
    };
    window.blocksOf = function(column) {
        return Array.from(column.children).filter(function(child) {
            return !child.matches('.ge-tools-drawer, .ge-resize-handle');
        });
    };
    return true;
`;

/** A page, loaded, waited on and given the helpers. */
async function openPage(t, url, waitFor, label) {
    var page = await t.page(url);
    await page.waitFor(waitFor || `window.GridEditor && GridEditor.get('#myGrid')`, { label: label || url });
    await page.eval(HELPERS);
    return page;
}

/**
 * The editor state of the first content area, as seen from the page.
 */
var CONTENT_AREA_STATE = `
    const contentArea = document.querySelector('#myGrid .ge-content');
    return {
        editorsOpen: tinymce.get().length,
        editorAttached: !!editorOn(contentArea),
        cssClass: contentArea.getAttribute('class'),
        contenteditable: contentArea.getAttribute('contenteditable'),
    };
`;

async function tinymceTests(t) {
    var page = await openPage(t, '/example/basic.html',
        `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`, 'dependencies and grid editor');

    var booted = await page.eval(`
        return {
            jquery: typeof window.jQuery,
            tinymce: tinymce.majorVersion + '.' + tinymce.minorVersion,
            editing: document.querySelector('.ge-canvas').classList.contains('ge-editing'),
            contentAreas: $$('.ge-content').length,
        };
    `);
    t.check('the page boots with the grid editor initialized, and no jQuery',
        booted.jquery === 'undefined' && booted.editing && booted.contentAreas > 0, booted);

    // Clicking a content area starts an inline editor on that element
    await page.click('.ge-content');
    await page.waitFor(`tinymce.get().length === 1 && tinymce.get()[0].initialized`, { label: 'editor init' });

    var editing = await page.eval(`
        const contentArea = document.querySelector('.ge-content');
        const editor = tinymce.get()[0];
        return {
            editorsOpen: tinymce.get().length,
            storedInData: editorOn(contentArea) === editor,
            active: contentArea.classList.contains('active'),
            contenteditable: contentArea.getAttribute('contenteditable'),
            inline: !!editor.inline,
            attachedToContentArea: editor.getElement() === contentArea,
            focused: document.activeElement === contentArea,
            toolbar: !!document.querySelector('.tox-tinymce-inline'),
        };
    `);
    t.check('clicking a content area starts an inline editor on it',
        editing.editorsOpen === 1 && editing.storedInData && editing.active &&
        editing.contenteditable === 'true' && editing.inline && editing.attachedToContentArea,
        editing);
    t.check('the new editor takes focus and shows its inline toolbar',
        editing.focused && editing.toolbar, editing);

    // tinyMCE 7 draws the .tox-promotion box whatever promotion says, and
    // promotion: false only leaves the link out of it
    var promotion = await page.eval(`
        return {
            byDefault: document.querySelectorAll('.tox-promotion-link').length,
            menubar: !!document.querySelector('.tox-menubar'),
        };
    `);
    t.check('tinyMCE\u2019s upgrade promotion is not shown',
        promotion.byDefault === 0 && promotion.menubar, promotion);

    await page.type('HELLO_FROM_CHROME ');
    var typed = await page.eval(`return { content: tinymce.get()[0].getContent().slice(0, 120) };`);
    t.check('typing reaches the editor', typed.content.indexOf('HELLO_FROM_CHROME') !== -1, typed);

    await page.screenshot(path.join(t.screenshots, 'tinymce-editing.png'));

    // getHtml has to hand back markup with no trace of the editor in it
    var exported = await page.eval(`
        const html = ge().getHtml();
        return {
            keptTypedText: html.includes('HELLO_FROM_CHROME'),
            contenteditable: /contenteditable/i.test(html),
            dataMce: /data-mce/i.test(html),
            mceClasses: /mce-content-body|mce-edit-focus/i.test(html),
            spellcheck: /spellcheck/i.test(html),
            idAttribute: /\\sid=/i.test(html),
            toolsDrawer: /ge-tools-drawer/.test(html),
            editorsOpen: tinymce.get().length,
            contentAreaAttributes: Array.from(document.querySelector('.ge-content').attributes).map(a => a.name),
            stillEditing: document.querySelector('.ge-canvas').classList.contains('ge-editing'),
        };
    `);
    t.check('getHtml returns markup with no editor leftovers',
        exported.keptTypedText && !exported.contenteditable && !exported.dataMce &&
        !exported.mceClasses && !exported.spellcheck && !exported.idAttribute && !exported.toolsDrawer,
        exported);
    t.check('getHtml removes the live editor and leaves the grid editor editing',
        exported.editorsOpen === 0 && exported.stillEditing, exported);

    // An editor that restores its class attribute on removal used to put
    // ge-rte-active back, which made initRTE ignore every later click
    await page.click('.ge-content');
    await sleep(2500);
    var reEdited = await page.eval(CONTENT_AREA_STATE);
    t.check('a content area is still editable after getHtml',
        reEdited.editorsOpen === 1 && reEdited.editorAttached, reEdited);

    // tinymce.init is asynchronous and getHtml deinits then inits
    // synchronously, so deinit can land while an init is still in flight
    var raced = await page.eval(`
        ge().getHtml();                                        // start from no editor
        document.querySelector('#myGrid .ge-content').click(); // starts tinymce.init()
        const html = ge().getHtml();                           // deinit lands mid init
        return {
            editorsDuring: tinymce.get().length,
            htmlClean: !/contenteditable|data-mce|mce-content-body/i.test(html),
        };
    `);
    await sleep(2500);
    var settled = await page.eval(`
        return {
            editorsOpen: tinymce.get().length,
            activeEditor: !!tinymce.activeEditor,
            editorAttached: !!editorOn(document.querySelector('#myGrid .ge-content')),
            contenteditableElements: document.querySelectorAll('#myGrid [contenteditable]').length,
            inlineToolbars: document.querySelectorAll('.tox-tinymce-inline').length,
            activeContentAreas: $$('#myGrid .ge-content.active').length,
        };
    `);
    t.check('a deinit during an in-flight init strands no editor',
        settled.editorsOpen === 0 && !settled.activeEditor &&
        !settled.editorAttached && settled.contenteditableElements === 0 &&
        settled.inlineToolbars === 0 && settled.activeContentAreas === 0,
        Object.assign(raced, settled));

    await page.click('.ge-content');
    await sleep(2500);
    var afterRace = await page.eval(CONTENT_AREA_STATE);
    t.check('a content area that lost that race is editable again afterwards',
        afterRace.editorsOpen === 1 && afterRace.editorAttached,
        afterRace);

    // Callbacks from the caller's own config. The pre-6 oninit name was
    // removed in 7.0: it is not called, and saying so once is the warning
    await page.eval(`
        window.callbacks = { init_instance_callback: 0, oninit: 0, sameEditor: null };
        window.warnings = [];
        const warn = console.warn;
        console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };
        ge().destroy();
        GridEditor.create('#myGrid', {
            new_row_layouts: [[12], [6, 6]],
            content_types: ['tinymce'],
            tinymce: { config: {
                init_instance_callback: function(editor) {
                    window.callbacks.init_instance_callback++;
                    window.callbacks.sameEditor = (editor === tinymce.get()[0]);
                },
                oninit: function() { window.callbacks.oninit++; },
                menubar: false,
            } },
        });
        return 1;
    `);
    await page.click('.ge-content');
    await sleep(3000);
    var callbacks = await page.eval(`
        return Object.assign({}, window.callbacks, {
            editorsOpen: tinymce.get().length,
            menubar: !!document.querySelector('.tox-menubar'),
            warned: window.warnings.filter(function(w) { return /oninit/.test(w) && /removed in 7\.0/.test(w); }).length,
        });
    `);
    t.check('init_instance_callback fires once, with the user config applied',
        callbacks.init_instance_callback === 1 && callbacks.sameEditor === true && callbacks.menubar === false,
        callbacks);
    t.check('the pre-6 oninit, removed in 7.0, is not called, and one warning names it',
        callbacks.oninit === 0 && callbacks.warned === 1, callbacks);

    // The source code button deinits, then inits again on the way back
    await page.click('.gm-edit-mode');
    await sleep(400);
    var sourceMode = await page.eval(`
        const textarea = $$('textarea', document.querySelector('#myGrid').parentNode).filter(shown);
        return {
            editorsOpen: tinymce.get().length,
            textareaVisible: textarea.length === 1,
            textareaClean: textarea.length ? !/contenteditable|data-mce/i.test(textarea[0].value) : null,
        };
    `);
    await page.click('.gm-edit-mode');
    await sleep(400);
    await page.click('.ge-content');
    await sleep(2000);
    t.check('the source code button deinits and inits again cleanly',
        sourceMode.editorsOpen === 0 && sourceMode.textareaVisible && sourceMode.textareaClean === true,
        Object.assign(sourceMode, { editableAfterwards: (await page.eval(CONTENT_AREA_STATE)).editorAttached }));

    // A row added from the toolbar has empty columns since 6.0; the Text
    // button adds a text with the placeholder in it, which the editor clears
    // as it takes over
    var before = await page.eval(`return { contentAreas: $$('.ge-content').length };`);
    await page.click('.ge-addRowGroup a', 1);
    await sleep(400);
    var emptyRow = await page.eval(`return { contentAreas: $$('.ge-content').length };`);
    await page.click('.ge-add-text-button');
    await sleep(400);
    var added = await page.eval(`return { contentAreas: $$('.ge-content').length };`);
    await page.click('.ge-content', added.contentAreas - 1);
    await sleep(2000);
    var newArea = await page.eval(`
        const areas = $$('.ge-content');
        const contentArea = areas[areas.length - 1];
        return {
            editorAttached: !!editorOn(contentArea),
            placeholderCleared: contentArea.innerHTML.indexOf('Lorem ipsum dolores') === -1,
        };
    `);
    t.check('a new row has empty columns; a new text becomes editable and drops its placeholder',
        emptyRow.contentAreas === before.contentAreas && added.contentAreas === before.contentAreas + 1 &&
            newArea.editorAttached && newArea.placeholderCleared,
        Object.assign({ before: before.contentAreas, emptyRow: emptyRow.contentAreas, after: added.contentAreas }, newArea));

    var errors = page.errors();
    t.check('example/basic.html logged no errors', errors.length === 0, errors.slice(0, 5));

    // The other two pages wiring up tinyMCE
    for (var name of ['autosave.html', 'wrap_content.html', 'clipboard.html']) {
        var other = await openPage(t, '/example/' + name, `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`, name);

        // The autosave page starts from an empty grid, so give it a text first
        if (!await other.eval(`return $$('.ge-content').length;`)) {
            await other.click('.ge-add-text-button');
            await sleep(400);
        }

        await other.click('.ge-content');
        await sleep(2000);
        var state = await other.eval(`
            return {
                editorsOpen: tinymce.get().length,
                activeContentAreas: $$('.ge-content.active').length,
            };
        `);
        var otherErrors = other.errors();
        t.check('example/' + name + ' boots and starts an editor without errors',
            otherErrors.length === 0 && state.editorsOpen === 1 && state.activeContentAreas === 1,
            Object.assign(state, { errors: otherErrors.slice(0, 5) }));
    }

    // Every example loads its text editor as a plugin, the way 6.0 needs it,
    // rather than leaning on the main bundle's copy
    var usingCopy = [];
    for (var example of ['basic', 'autosave', 'wrap_content', 'clipboard', 'attributes', 'elements',
        'containers', 'ckeditor', 'summernote']) {
        var loaded = await openPage(t, '/example/' + example + '.html', null, example);
        var copies = await loaded.eval(`
            return Object.keys(GridEditor.texts).filter(function(type) {
                return GridEditor.texts[type].bundled &&
                    ge().settings.content_types.indexOf(type) !== -1;
            });
        `);
        if (copies.length) { usingCopy.push(example + ': ' + copies.join(',')); }
    }
    t.check('every example loads the plugin of the text editor it uses', usingCopy.length === 0, usingCopy);
}

/**
 * An element in 5.x's markup, among the text of a content area. Since 6.0 it
 * comes out of the text as the editor starts, into the column between two
 * texts, so no text editor ever has it inside: it needs no contenteditable,
 * and nothing the editor does to its text can reach it. Checked on the
 * elements example, which is the page that loads the elements plugin.
 */
async function elementTests(t) {
    var page = await openPage(t, '/example/elements.html',
        `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`);

    await page.eval(`
        ge().destroy();
        document.querySelector('#myGrid').innerHTML = (
            '<div class="row"><div class="col-lg-12">' +
            '<div class="ge-content" data-ge-content-type="tinymce">' +
            '<p>Text before the element.</p>' +
            '<div data-ge-element="callout" data-ge-label="Callout"><p>Inside the element.</p></div>' +
            '<p>Text after the element.</p>' +
            '</div></div></div>'
        );
        GridEditor.create('#myGrid', { new_row_layouts: [[12]], content_types: ['tinymce'] });
        return true;
    `);
    await page.click('.ge-content');
    await sleep(2500);

    var beside = await page.eval(`
        const column = document.querySelector('#myGrid .column');
        const element = document.querySelector('#myGrid .ge-element');
        const editor = tinymce.get()[0];
        return {
            editorOpen: !!editor,
            order: blocksOf(column).map(function(block) {
                return block.matches('.ge-text-block') ? 'text' : block.matches('.ge-element') ? 'element' : block.className;
            }).join(','),
            inEditor: editor ? editor.getBody().querySelectorAll('[data-ge-element]').length : null,
            contenteditable: element.getAttribute('contenteditable'),
            tools: $$(':scope > .ge-tools-drawer > a', element).map(function(tool) {
                return tool.getAttribute('class').split(' ')[0];
            }).join(','),
        };
    `);
    t.check('an element in 5.x\'s markup comes out of the text, between two texts, and no editor has it',
        beside.editorOpen && beside.order === 'text,element,text' && beside.inEditor === 0 &&
        beside.contenteditable === null,
        beside);
    t.check('the element keeps its tools while the text beside it is being edited',
        beside.tools === 'ge-move,ge-element-info,ge-settings,ge-delete-element', beside);

    var undone = await page.eval(`
        const editor = tinymce.get()[0];
        editor.insertContent(' TYPED ');
        editor.undoManager.undo();
        const element = document.querySelector('#myGrid .ge-element');
        return { drawer: $$(':scope > .ge-tools-drawer', element).length, text: element.textContent.indexOf('Inside the element.') !== -1 };
    `);
    t.check('an undo in the text editor does not touch the element beside it',
        undone.drawer === 1 && undone.text, undone);

    var exportedElement = await page.eval(`
        const html = ge().getHtml();
        const root = document.createElement('div');
        root.innerHTML = html;
        const column = root.querySelector('.column');
        return {
            html: html,
            order: Array.from(column.children).map(function(child) {
                return child.matches('.ge-content') ? 'text' : child.getAttribute('data-ge-element');
            }).join(','),
            keptLabel: /data-ge-label="Callout"/.test(html),
            keptInnerText: html.indexOf('Inside the element.') !== -1,
            keptTextAround: html.indexOf('Text before the element.') !== -1 &&
                html.indexOf('Text after the element.') !== -1,
            drawer: /ge-tools-drawer|ge-text-block/.test(html),
            editable: /contenteditable/i.test(html),
            marking: /class="[^"]*ge-element/.test(html),
            mce: /data-mce|mce-content-body/i.test(html),
        };
    `);
    t.check('getHtml hands back the text, the element beside it and the text after, in the 6.0 markup',
        exportedElement.order === 'text,callout,text' && exportedElement.keptLabel &&
        exportedElement.keptInnerText && exportedElement.keptTextAround &&
        !exportedElement.drawer && !exportedElement.editable &&
        !exportedElement.marking && !exportedElement.mce,
        Object.assign({}, exportedElement, { html: exportedElement.html.slice(0, 260) }));

    var errors = page.errors();
    t.check('example/elements.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A utility on an element beside an open editor: in 5.x's markup it sat in
 * the text, and comes out of it. What is checked is that its class, its
 * preview and its field are there while the text is edited, and that getHtml
 * hands back the class and nothing of the preview.
 */
async function utilityTests(t) {
    var page = await openPage(t, '/example/elements.html',
        `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`);

    await page.eval(`
        ge().destroy();
        GridEditor.utilities.testing = function() {
            return { families: [{
                name: 'order', prefix: 'order', values: ['1', '2', '3'], appliesTo: ['element'],
                preview: function(value) { return { order: value === null ? '0' : value }; },
            }] };
        };
        document.querySelector('#myGrid').innerHTML = (
            '<div class="row"><div class="col-lg-12">' +
            '<div class="ge-content" data-ge-content-type="tinymce">' +
            '<p>Text before the element.</p>' +
            '<div data-ge-element="callout" class="order-md-2"><p>Inside the element.</p></div>' +
            '</div></div></div>'
        );
        GridEditor.create('#myGrid', { new_row_layouts: [[12]], content_types: ['tinymce'], default_view: 'md' });
        return true;
    `);
    await page.click('.ge-content');
    await sleep(2500);

    var open = await page.eval(`
        const element = document.querySelector('#myGrid .ge-element');
        const select = element.querySelector(':scope > .ge-tools-drawer .ge-utility select');
        return {
            editorOpen: tinymce.get().length === 1,
            classKept: element.classList.contains('order-md-2'),
            previewed: element.style.getPropertyValue('order') === '2' &&
                element.style.getPropertyPriority('order') === 'important',
            recorded: element.getAttribute('data-ge-preview') !== null,
            field: select ? select.value : null,
        };
    `);
    t.check('an element beside an open editor keeps its utility class, its preview and its field',
        open.editorOpen && open.classKept && open.previewed && open.recorded && open.field === '2', open);

    var exported = await page.eval(`
        const html = ge().getHtml();
        return {
            html: html,
            classKept: /class="order-md-2"/.test(html),
            preview: /data-ge-preview|important|style=/.test(html),
            previewBack: document.querySelector('#myGrid .ge-element').getAttribute('data-ge-preview') !== null,
        };
    `);
    t.check('the utility class survives the round trip through the editor, the preview does not',
        exported.classKept && !exported.preview && exported.previewBack,
        Object.assign({}, exported, { html: exported.html.slice(0, 220) }));

    await page.eval(`delete GridEditor.utilities.testing;`);

    var errors = page.errors();
    t.check('the utility round trip logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A content area inside a container is the awkward case: the pane it sits in
 * may have just appeared, and the inline toolbar is laid out against whatever
 * geometry the element has when tinyMCE draws it. Checked on the containers
 * example, which is the page that loads the container plugins.
 */
async function containerTests(t) {
    var page = await openPage(t, '/example/containers.html',
        `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`);

    await page.eval(`
        ge().destroy();
        document.querySelector('#myGrid').innerHTML = '<div class="row"><div class="col-lg-12"><div class="ge-content" data-ge-content-type="tinymce"><p>Before</p></div></div></div>';
        GridEditor.create('#myGrid', { new_row_layouts: [[12]], content_types: ['tinymce'] });
        document.querySelector('.ge-addContainerGroup a[data-ge-container-type="tabs"]').click();
        // A pane starts with an empty column since 6.0: a text in each
        const editor = ge();
        $$('#myGrid .tab-pane .column').forEach(function(column) { editor.createText({ appendTo: column }); });
        window.scrollTo(0, 0);
        return $$('#myGrid [data-ge-container="tabs"]').length;
    `);
    await page.click('#myGrid .tab-pane.active .ge-content');
    await sleep(2500);

    var inTab = await page.eval(`
        const toolbar = document.querySelector('.tox-tinymce-inline');
        const area = document.querySelector('#myGrid .tab-pane.active .ge-content');
        const box = toolbar ? toolbar.getBoundingClientRect() : null;

        return {
            editors: tinymce.get().length,
            toolbar: !!toolbar,
            // Wrapped into a narrow column, the menubar alone takes several
            // rows and the whole thing is a few hundred pixels tall
            toolbarWidth: box ? Math.round(box.width) : null,
            toolbarHeight: box ? Math.round(box.height) : null,
            areaWidth: Math.round(area.getBoundingClientRect().width),
        };
    `);
    t.check('an editor inside a tab lays its toolbar out against the pane it is in',
        inTab.editors === 1 && inTab.toolbar && inTab.toolbarHeight < 120 &&
        inTab.toolbarWidth > 400,
        inTab);

    var hiddenPane = await page.eval(`
        $$('#myGrid .tab-pane:not(.active) .ge-content').forEach(function(area) { area.click(); });
        return {
            editors: tinymce.get().length,
            activeAreas: $$('#myGrid .ge-content.active').length,
        };
    `);
    t.check('a content area in a pane nobody can see does not get an editor at all',
        hiddenPane.editors === 1 && hiddenPane.activeAreas === 1, hiddenPane);

    var errors = page.errors();
    t.check('example/containers.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * The deinit path these tests cover is shared by every integration, so check
 * the other two examples through one edit cycle as well.
 */
async function otherEditorTests(t) {
    var page = await openPage(t, '/example/ckeditor.html',
        `window.CKEDITOR && window.GridEditor && GridEditor.get('#myGrid')`, 'ckeditor page');

    // A CKEditor of the page's own, outside the grid: closing a content area
    // used to destroy every instance on the page, this one included
    await page.eval(`
        const own = document.createElement('div');
        own.id = 'host-ckeditor';
        own.setAttribute('contenteditable', 'true');
        own.innerHTML = '<p>A CKEditor of the page itself</p>';
        document.body.appendChild(own);
        CKEDITOR.inline(own);
        return true;
    `);
    await page.waitFor(`CKEDITOR.instances['host-ckeditor'] && CKEDITOR.instances['host-ckeditor'].status === 'ready'`,
        { label: 'the page\'s own CKEditor' });

    var state = `return {
        instances: Object.keys(CKEDITOR.instances).filter(function(name) { return name !== 'host-ckeditor'; }).length,
        hostKept: !!CKEDITOR.instances['host-ckeditor'],
        rteActive: document.querySelector('#myGrid .ge-content').classList.contains('ge-rte-active'),
    };`;

    await page.click('.ge-content');
    await sleep(2000);
    var ckediting = await page.eval(state);
    var html = await page.eval(`return ge().getHtml();`);
    await sleep(500);
    var afterExport = await page.eval(state);
    await page.click('.ge-content');
    await sleep(2000);
    var ckReEdited = await page.eval(state);

    // 4.22.1 is the last release under the open source licence, so its
    // "consider upgrading" notice is expected and not a test failure
    var ckErrors = page.errors([/version is not secure/]);
    t.check('ckeditor edits, exports clean html and edits again',
        ckediting.instances === 1 && afterExport.instances === 0 && !afterExport.rteActive &&
        ckReEdited.instances === 1 && !/contenteditable|cke_|ge-rte-active/.test(html) && ckErrors.length === 0,
        { editing: ckediting, afterExport: afterExport, reEdited: ckReEdited, errors: ckErrors.slice(0, 3) });
    t.check('closing a content area destroys its own CKEditor and leaves the page\'s alone',
        afterExport.hostKept && ckReEdited.hostKept, { afterExport: afterExport, reEdited: ckReEdited });

    // Summernote needs jQuery itself, so its page loads jQuery 4 and
    // summernote - and not the adapter: the editor is driven natively. And
    // summernote 0.9.1 calls $.now(), which jQuery 4 removed: the plugin gives
    // it back, so summernote opens at all
    var sn = await openPage(t, '/example/summernote.html',
        `window.jQuery && jQuery.fn.summernote && window.GridEditor && GridEditor.get('#myGrid')`, 'summernote page');

    var page6 = await sn.eval(`return { jquery: jQuery.fn.jquery, adapter: typeof jQuery.fn.gridEditor };`);
    t.check('example/summernote.html has jQuery 4 and summernote, and no jQuery adapter',
        /^4\./.test(page6.jquery) && page6.adapter === 'undefined', page6);

    var snState = `return {
        editors: $$('.note-editor').length,
        rteActive: document.querySelector('#myGrid .ge-content').classList.contains('ge-rte-active'),
    };`;
    var nowBefore = await sn.eval(`return typeof jQuery.now;`);

    await sn.click('.ge-content');
    await sleep(1500);
    var snEditing = await sn.eval(snState);
    await sn.eval(`jQuery(document.querySelector('#myGrid .ge-content')).summernote('insertText', ' SUMMERNOTE-TYPED '); return 1;`);
    var snHtml = await sn.eval(`return ge().getHtml();`);
    await sleep(300);
    var snAfterExport = await sn.eval(snState);
    await sn.click('.ge-content');
    await sleep(1500);
    var snReEdited = await sn.eval(snState);
    var nowAfter = await sn.eval(`return jQuery.now === Date.now;`);

    var snErrors = sn.errors();
    t.check('summernote edits, exports clean html and edits again',
        nowBefore === 'undefined' && nowAfter &&
        snEditing.editors === 1 && snEditing.rteActive && snAfterExport.editors === 0 && !snAfterExport.rteActive &&
        snReEdited.editors === 1 && snHtml.indexOf('SUMMERNOTE-TYPED') !== -1 &&
        !/note-editor|note-editable|ge-rte-active/.test(snHtml) && snErrors.length === 0,
        { editing: snEditing, afterExport: snAfterExport, reEdited: snReEdited, nowBefore: nowBefore,
            nowAfter: nowAfter, errors: snErrors.slice(0, 3) });
}

/**
 * example/attributes.html: a plugin of the page's own that saves a modal's
 * settings as an attribute, with a plain setAttribute(). On an element, which is a
 * block beside the texts; and on the very text tinyMCE is editing, whose
 * attributes tinyMCE puts back as it found them when it closes, and which
 * grid-editor keeps all the same. Both have to come out of getPlainHtml.
 */
async function attributePluginTests(t) {
    var page = await openPage(t, '/example/attributes.html',
        `window.tinymce && window.GridEditor && GridEditor.get('#myGrid')`);

    var tools = await page.eval(`
        const tool = function(node) { return node ? $$(':scope > .ge-tools-drawer > .my-animation-tool', node) : []; };
        const rows = $$('#myGrid > .row');
        return {
            rows: $$('#myGrid .row').every(function(row) { return tool(row).length === 1; }),
            columns: $$('#myGrid .column').every(function(column) { return tool(column).length === 1; }),
            card: tool(document.querySelector('#myGrid [data-ge-container="card"]')).length,
            element: tool(document.querySelector('#myGrid .ge-element')).length,
            texts: $$('#myGrid .ge-text-block:not(.ge-plain-block)').every(function(block) { return tool(block).length === 1; }),
            // The host's plain content - the loose markup of the first row
            // and of the card - has a drawer of move and delete, and no gear
            plains: $$('#myGrid .ge-plain-block').length > 0 &&
                $$('#myGrid .ge-plain-block').every(function(block) { return tool(block).length === 0; }),
            presetHighlighted: tool(rows[0]).some(function(t) { return t.classList.contains('my-animation-set'); }),
            othersPlain: tool(rows[1]).some(function(t) { return t.classList.contains('my-animation-set'); }),
        };
    `);
    t.check('example/attributes.html puts its tool on rows, columns, texts, containers and elements, not on plain content',
        tools.rows && tools.columns && tools.texts && tools.plains && tools.card === 1 && tools.element === 1 &&
        tools.presetHighlighted && !tools.othersPlain,
        tools);

    // The text just before the quote, with tinyMCE open on it and some typing
    await page.eval(`
        let before = document.querySelector('#myGrid .ge-element').previousElementSibling;
        while (before && !before.matches('.ge-text-block')) { before = before.previousElementSibling; }
        before.id = 'edited';
        document.querySelector('#edited > .ge-content').click();
        return 1;
    `);
    await page.waitFor(`tinymce.get().length === 1 && tinymce.get()[0].initialized`, { label: 'tinyMCE' });
    await sleep(300);
    await page.eval(`tinymce.get()[0].insertContent(' BEFORE-MODAL '); return 1;`);

    async function animate(tool, values) {
        await page.eval(`$$(${JSON.stringify(tool)}).forEach(function(node) { node.click(); }); return 1;`);
        await page.waitFor(`document.querySelector('.my-animation-modal').classList.contains('show')`, { label: 'the modal' });
        await sleep(400);
        await page.eval(`
            const form = document.querySelector('.my-animation-modal form');
            const values = ${JSON.stringify(values)};
            form.querySelector('[name=effect]').value = values.effect;
            form.querySelector('[name=duration]').value = values.duration;
            form.querySelector('[name=delay]').value = values.delay;
            form.querySelector('[name=once]').checked = values.once;
            return 1;
        `);
        await page.click('.my-animation-modal .modal-footer .btn-primary');
        // Closed, not closing: Bootstrap ignores a show while it is still
        // fading out, and the next call would wait for a modal that never came
        await page.waitFor(`!document.querySelector('.my-animation-modal').classList.contains('show') && !shown(document.querySelector('.my-animation-modal'))`,
            { label: 'the modal closed' });
    }

    await animate('#edited > .ge-tools-drawer > .my-animation-tool', { effect: 'zoom', duration: '300', delay: '0', once: true });
    await animate('#myGrid .ge-element > .ge-tools-drawer > .my-animation-tool', { effect: 'slide', duration: '500', delay: '100', once: false });

    // Keep typing, then undo that
    var undone = await page.eval(`
        const editor = tinymce.get()[0];
        editor.insertContent(' AFTER-MODAL ');
        editor.undoManager.undo();
        return {
            editorStillOpen: tinymce.get().length === 1,
            highlighted: document.querySelector('#myGrid .ge-element > .ge-tools-drawer > .my-animation-tool').classList.contains('my-animation-set') &&
                document.querySelector('#edited > .ge-tools-drawer > .my-animation-tool').classList.contains('my-animation-set'),
        };
    `);

    var exported = await page.eval(`
        const plain = ge().getPlainHtml();
        const root = document.createElement('div');
        root.innerHTML = plain;
        const quote = root.querySelector('blockquote');
        const text = Array.from(root.querySelectorAll('[data-animation]')).filter(function(node) {
            return node !== quote && !node.matches('.row') && node.textContent.indexOf('Ordinary text') !== -1;
        })[0];
        return {
            quote: quote && quote.getAttribute('data-animation'),
            text: text ? text.getAttribute('data-animation') : null,
            row: root.querySelector('.row').getAttribute('data-animation'),
            content: root.textContent,
            editorMarks: /data-ge-|ge-tools-drawer|my-animation-tool|contenteditable|mce-/.test(plain),
            modalOutside: $$('#myGrid .my-animation-modal').length === 0 && $$('body > .my-animation-modal').length === 1,
        };
    `);
    var parse = function(value) { try { return JSON.parse(value); } catch (error) { return null; } };
    var quote = parse(exported.quote);
    var text = parse(exported.text);

    t.check('the modal saves its settings on the element as data-animation',
        !!quote && quote.effect === 'slide' && quote.duration === 500 && quote.delay === 100 && quote.once === false &&
        undone.highlighted && undone.editorStillOpen,
        { undone: undone, exported: exported });
    t.check('and on the text being edited, which keeps it when tinyMCE closes, with a plain setAttribute()',
        !!text && text.effect === 'zoom' && text.duration === 300, exported);
    t.check('undoing the typing, in tinyMCE, undoes the typing and nothing else',
        !!quote && !!text && exported.content.indexOf('AFTER-MODAL') === -1 && exported.content.indexOf('BEFORE-MODAL') !== -1,
        exported);
    t.check('getPlainHtml keeps data-animation, preset and new, and nothing of the editor\'s',
        exported.row === '{"effect":"fade","duration":800,"delay":0,"once":true}' && !!quote &&
        !exported.editorMarks && exported.modalOutside,
        exported);

    var errors = page.errors();
    t.check('example/attributes.html logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * A text block's own attributes - its id and classes from the panel, a
 * utility's class, a plugin's attribute - given while its editor is open.
 * tinyMCE puts back the attributes it found when it opened, and every
 * integration took the id off when it closed, so each of these used to be
 * lost; and CKEditor left aria-readonly behind.
 */
async function textAttributeTests(t) {
    var results = {};

    for (var example of ['basic', 'ckeditor', 'summernote']) {
        var page = await openPage(t, '/example/' + example + '.html', null, example);
        await page.eval(`document.querySelector('#myGrid .ge-content').id = 'kept-id'; return true;`);
        await page.click('#kept-id');
        await sleep(1800);

        results[example] = await page.eval(`
            const open = document.querySelector('#kept-id').classList.contains('ge-rte-active');
            const html = function() {
                const root = document.createElement('div');
                root.innerHTML = ge().getHtml();
                const first = root.querySelector('.ge-content');
                return Array.from(first.attributes).map(function(a) { return a.name + '=' + a.value; }).join(' | ');
            };
            const untouched = html();

            document.querySelector('#kept-id').click();
            return new Promise(function(resolve) {
                setTimeout(function() {
                    const reopened = document.querySelector('#kept-id');
                    const field = reopened.parentNode.querySelector(':scope > .ge-tools-drawer .ge-details .ge-id');
                    field.value = 'given-id';
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    const given = document.querySelector('#given-id');
                    given.classList.add('host-class');
                    given.setAttribute('data-plugin', 'saved');
                    resolve({ open: open, reopened: given.classList.contains('ge-rte-active'), untouched: untouched, changed: html() });
                }, 1800);
            });
        `);
        results[example].errors = page.errors([/version is not secure/]);
    }

    ['basic', 'ckeditor', 'summernote'].forEach(function(name) {
        var r = results[name];
        var type = name === 'basic' ? 'tinymce' : name;
        // The example's content is the host's plain content, which the click
        // made a text: the type comes after the id the test gave it first
        t.check('example/' + name + ': the content area keeps its id through an edit, and nothing of the editor\'s',
            r.open && r.untouched === 'class=ge-content ge-content-type-' + type + ' | id=kept-id | data-ge-content-type=' + type &&
            r.errors.length === 0,
            r);
        t.check('example/' + name + ': an id, a class and an attribute given while the editor is open are kept',
            r.reopened && r.changed === 'class=ge-content ge-content-type-' + type + ' host-class | id=given-id | data-ge-content-type=' + type +
                ' | data-plugin=saved',
            r);
    });
}

module.exports = {
    name: 'rte',
    description: 'rich text editor integrations',
    requiresNetwork: true,
    run: async function(t) {
        await tinymceTests(t);
        await elementTests(t);
        await utilityTests(t);
        await containerTests(t);
        await attributePluginTests(t);
        await textAttributeTests(t);
        await otherEditorTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['rte']);
}
