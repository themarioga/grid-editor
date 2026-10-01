/**
 * Browser tests for dragging the toolbar's buttons onto the canvas.
 *
 * The toolbar is a palette in this mode: a button dropped on the canvas makes
 * its row or its container where it lands, rather than at the end. Where it
 * lands is decided from the pointer, so these tests move a real one.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** Two rows to drop between, with the palette turned on. */
function canvasWith(settings) {
    return `
        if (window.fixture.editor()) { window.fixture.editor().destroy(); }
        const grid = document.querySelector('#myGrid');
        grid.innerHTML =
            '<div class="row" id="first"><div class="column col-12"><div class="ge-content"><p>First row</p></div></div></div>' +
            '<div class="row" id="second"><div class="column col-12"><div class="ge-content"><p>Second row</p></div></div></div>';
        window.log = [];
        (window.listening || []).forEach(function(entry) { grid.removeEventListener(entry[0], entry[1]); });
        window.listening = [];
        /** Listen on the canvas until the next canvasWith. */
        window.listen = function(name, handler) {
            grid.addEventListener(name, handler);
            window.listening.push([name, handler]);
        };
        window.fixture.init(${JSON.stringify(Object.assign({ default_view: 'xs', drag_handle: 'drawer' }, settings))});
        listen('grideditor:after-add', function(e) {
            window.log.push([e.detail.kind, e.detail.source]);
        });
    `;
}

var ROWS = `
    return Array.from(document.querySelectorAll('#myGrid > .row')).map(function(row) {
        return row.id || 'new:' + row.querySelectorAll(':scope > .column').length;
    }).join(',');
`;

async function paletteTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasWith() + 'return true;');

    var ready = await page.eval(`
        return {
            draggable: document.querySelector('.ge-addRowGroup a').classList.contains('ge-palette-button'),
            containerButtons: document.querySelectorAll('.ge-addContainerGroup a.ge-palette-button').length,
            marked: document.querySelectorAll('[data-ge-toolbar]').length,
        };
    `);
    t.check('the toolbar buttons are draggable when the palette is on',
        ready.draggable && ready.containerButtons === 4 && ready.marked === 7, ready);

    // Between the two rows: the drawer of the second one is canvas level
    await page.drag('.ge-addRowGroup a[data-ge-layout="6,6"]', '#second > .ge-tools-drawer');
    var dropped = await page.eval(`
        return { rows: (function() { ${ROWS} })(), log: window.log, buttons: document.querySelectorAll('#myGrid [data-ge-toolbar]').length };
    `);
    t.check('a row button dropped between two rows makes its row there, with its layout',
        dropped.rows === 'first,new:2,second' &&
        JSON.stringify(dropped.log) === JSON.stringify([['row', 'dragdrop']]) &&
        dropped.buttons === 0,
        dropped);

    // Into a column: a nested row
    await page.eval(canvasWith() + 'return true;');
    await page.drag('.ge-addRowGroup a[data-ge-layout="12"]', '#first .ge-content', { yRatio: 0.5 });
    var nested = await page.eval(`
        return {
            rows: (function() { ${ROWS} })(),
            nested: document.querySelectorAll('#first .column > .row').length,
            log: window.log,
        };
    `);
    t.check('a row dropped inside a column is nested in it',
        nested.rows === 'first,second' && nested.nested === 1 &&
        JSON.stringify(nested.log) === JSON.stringify([['row', 'dragdrop']]),
        nested);

    // A container dropped on the canvas brings the column it needs
    await page.eval(canvasWith() + 'return true;');
    await page.drag('[data-ge-container-type="accordion"]', '#second > .ge-tools-drawer');
    var container = await page.eval(`
        const made = document.querySelector('#myGrid [data-ge-container]');
        return {
            rows: (function() { ${ROWS} })(),
            parent: made.parentElement.getAttribute('class'),
            grandparentIsRow: made.closest('.row').parentElement.getAttribute('id'),
            log: window.log,
        };
    `);
    t.check('a container dropped on the canvas arrives in a row and column of its own',
        container.rows === 'first,new:1,second' && /column/.test(container.parent) &&
        container.grandparentIsRow === 'myGrid' &&
        JSON.stringify(container.log) === JSON.stringify([['accordion', 'dragdrop']]),
        container);

    // and dropped into a column, it goes straight in
    await page.eval(canvasWith() + 'return true;');
    await page.drag('[data-ge-container-type="tabs"]', '#first .ge-content', { yRatio: 0.5 });
    var inColumn = await page.eval(`
        const made = document.querySelector('#myGrid [data-ge-container]');
        return {
            rows: (function() { ${ROWS} })(),
            parentIsColumn: made.parentElement.classList.contains('column'),
            panes: made.querySelectorAll('.tab-pane').length,
            log: window.log,
        };
    `);
    t.check('a container dropped into a column goes straight into it',
        inColumn.rows === 'first,second' && inColumn.parentIsColumn && inColumn.panes === 2 &&
        JSON.stringify(inColumn.log) === JSON.stringify([['tabs', 'dragdrop']]),
        inColumn);
}

async function markerTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasWith() + 'return true;');

    // Mid drag: the canvas opens up and shows where the block would land
    var button = await page.eval(`
        const box = document.querySelector('.ge-addRowGroup a[data-ge-layout="12"]').getBoundingClientRect();
        const target = document.querySelector('#second > .ge-tools-drawer').getBoundingClientRect();
        return {
            from: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
            to: { x: target.left + target.width / 2, y: target.top + target.height / 2 },
        };
    `);

    await page.send('Input.dispatchMouseEvent', {
        type: 'mousePressed', x: button.from.x, y: button.from.y, button: 'left', clickCount: 1,
    });
    for (var step = 1; step <= 6; step++) {
        await page.send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: button.from.x + (button.to.x - button.from.x) * step / 6,
            y: button.from.y + (button.to.y - button.from.y) * step / 6,
            button: 'left',
            buttons: 1,
        });
        await sleep(40);
    }

    var midDrag = await page.eval(`
        const markers = document.querySelectorAll('.ge-drop-marker');
        return {
            marker: markers.length,
            markerBefore: markers[0] && markers[0].nextElementSibling ? markers[0].nextElementSibling.getAttribute('id') : undefined,
            canvasOpen: document.querySelector('#myGrid').classList.contains('ge-dropping'),
            helperIgnoresThePointer: getComputedStyle(document.querySelector('.ge-toolbar-helper')).pointerEvents,
        };
    `);
    t.check('the canvas opens up mid drag and shows a marker where the block would land',
        midDrag.marker === 1 && midDrag.markerBefore === 'second' && midDrag.canvasOpen &&
        midDrag.helperIgnoresThePointer === 'none',
        midDrag);

    await page.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased', x: button.to.x, y: button.to.y, button: 'left', clickCount: 1,
    });
    await sleep(400);

    var afterDrop = await page.eval(`
        return {
            markers: document.querySelectorAll('.ge-drop-marker').length,
            canvasOpen: document.querySelector('#myGrid').classList.contains('ge-dropping'),
            rows: (function() { ${ROWS} })(),
            markerInOutput: /ge-drop-marker/.test(window.fixture.editor().getHtml()),
        };
    `);
    t.check('the marker is editor furniture: gone on drop, and never in the output',
        afterDrop.markers === 0 && !afterDrop.canvasOpen &&
        afterDrop.rows === 'first,new:1,second' && !afterDrop.markerInOutput,
        afterDrop);

    await page.eval(canvasWith() + `
        listen('grideditor:before-add', function(e) { e.preventDefault(); });
        return true;
    `);
    await page.drag('.ge-addRowGroup a[data-ge-layout="12"]', '#second > .ge-tools-drawer');
    var afterCancel = await page.eval(`
        return {
            rows: (function() { ${ROWS} })(),
            buttons: document.querySelectorAll('#myGrid [data-ge-toolbar]').length,
            markers: document.querySelectorAll('.ge-drop-marker').length,
        };
    `);
    t.check('a canceled add leaves nothing of the drag behind',
        afterCancel.rows === 'first,second' && afterCancel.buttons === 0 && afterCancel.markers === 0,
        afterCancel);
}

async function settingTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(canvasWith({ drag_handle: 'tool' }) + 'return true;');
    var byDefault = await page.eval(`
        return {
            draggable: document.querySelectorAll('.ge-addRowGroup a.ge-palette-button').length,
            clickStillAdds: (document.querySelector('.ge-addRowGroup a[data-ge-layout="12"]').click(),
                document.querySelectorAll('#myGrid > .row').length),
        };
    `);
    t.check('with the default drag handle the toolbar is not a palette, and still clicks',
        byDefault.draggable === 0 && byDefault.clickStillAdds === 3, byDefault);

    await page.eval(canvasWith({ drag_handle: 'tool', toolbar_drag: true }) + 'return true;');
    var forcedOn = await page.eval(`return document.querySelectorAll('.ge-addRowGroup a.ge-palette-button').length;`);
    t.check('toolbar_drag true turns the palette on whatever the drag handle is',
        forcedOn === 3, forcedOn);

    await page.eval(canvasWith({ toolbar_drag: false }) + 'return true;');
    var forcedOff = await page.eval(`return document.querySelectorAll('.ge-addRowGroup a.ge-palette-button').length;`);
    t.check('toolbar_drag false turns it off whatever the drag handle is',
        forcedOff === 0, forcedOff);

    var clicksToo = await page.eval(canvasWith() + `
        document.querySelector('.ge-addContainerGroup a[data-ge-container-type="popup"]').click();
        return {
            containers: document.querySelectorAll('#myGrid [data-ge-container="popup"]').length,
            rows: (function() { ${ROWS} })(),
        };
    `);
    t.check('a palette button is still a button: clicking it adds at the end',
        clicksToo.containers === 1 && clicksToo.rows === 'first,second,new:1', clicksToo);

    var errors = page.errors();
    t.check('the toolbar tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** A plugin's iconClass puts its icon on its toolbar button in place of its label, which becomes the title. */
async function iconTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var faces = await page.eval(`
        var card = GridEditor.containers.card;
        GridEditor.containers.card = function(ge) {
            return Object.assign(card(ge), { iconClass: 'bi bi-square' });
        };
        GridEditor.texts.simple = function() {
            return { labelKey: 'text.simple', iconClass: 'bi bi-fonts', start: function() {}, stop: function() {} };
        };
        const row = function() {
            const made = document.createElement('div');
            made.className = 'row';
            return made;
        };
        GridEditor.features.stamp = function() {
            return { toolbar: [
                { labelKey: 'stamp.add', kind: 'row', iconClass: 'bi bi-star', create: function() { return row(); } },
                { labelKey: 'stamp.plain', kind: 'row', create: function() { return row(); } },
            ] };
        };
        Object.assign(GridEditor.locales.en, { 'text.simple': 'Simple', 'stamp.add': 'Stamp', 'stamp.plain': 'Plain stamp' });

        window.fixture.init({ content_types: ['simple'], plugins: window.fixture.plugins(['stamp']) });

        function face(button) {
            const icon = button.querySelector(':scope > i');
            const span = button.querySelector(':scope > span');
            return {
                title: button.getAttribute('title'),
                icon: icon ? icon.getAttribute('class') : undefined,
                label: span ? span.textContent : '',
            };
        }
        var faces = {
            card: face(document.querySelector('.ge-addContainerGroup a[data-ge-container-type="card"]')),
            tabs: face(document.querySelector('.ge-addContainerGroup a[data-ge-container-type="tabs"]')),
            text: face(document.querySelector('.ge-addContainerGroup .ge-add-text-button')),
            stamp: face(document.querySelector('.ge-add-feature[data-ge-feature="stamp"][data-ge-item="0"]')),
            plainStamp: face(document.querySelector('.ge-add-feature[data-ge-feature="stamp"][data-ge-item="1"]')),
        };

        GridEditor.containers.card = card;
        delete GridEditor.texts.simple;
        delete GridEditor.features.stamp;
        window.fixture.init({});
        return faces;
    `);
    t.check('a container, a text and a toolbar item with an iconClass show the icon alone, their label as the title',
        faces.card.icon === 'bi bi-square' && faces.card.label === '' && faces.card.title === 'Card' &&
        faces.text.icon === 'bi bi-fonts' && faces.text.label === '' && faces.text.title === 'Text' &&
        faces.stamp.icon === 'bi bi-star' && faces.stamp.label === '' && faces.stamp.title === 'Stamp', faces);
    t.check('without one they keep the plus and their label',
        faces.tabs.icon === 'bi bi-plus' && faces.tabs.label === faces.tabs.title && faces.tabs.label !== '' &&
        faces.plainStamp.icon === 'bi bi-plus' && faces.plainStamp.label === 'Plain stamp', faces);

    var errors = page.errors();
    t.check('the toolbar icon tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/** What does not fit on the toolbar's line goes behind its more button, and comes back when there is room. */
async function overflowTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var STATE = `
        const more = document.querySelector('.ge-toolbar-more');
        const start = document.querySelector('.ge-toolbar-start');
        const wrapper = document.querySelector('.ge-wrapper');
        const tops = Array.from(wrapper.children).filter(function(node) { return node.offsetParent; })
            .map(function(node) { return node.getBoundingClientRect().top; });
        return {
            needed: more.classList.contains('ge-needed'),
            open: more.classList.contains('ge-open'),
            inMenu: Array.from(document.querySelectorAll('.ge-toolbar-overflow [data-ge-toolbar]')).map(function(b) { return b.getAttribute('title'); }),
            onLine: Array.from(start.querySelectorAll('[data-ge-toolbar]')).map(function(b) { return b.getAttribute('title'); }),
            oneLine: tops.every(function(top) { return Math.abs(top - tops[0]) < 2; }),
            fits: start.scrollWidth <= start.clientWidth,
            total: document.querySelectorAll('.ge-mainControls .ge-addRowGroup [data-ge-toolbar], .ge-mainControls .ge-addContainerGroup [data-ge-toolbar]').length,
        };
    `;
    // The resize is seen after a frame's layout, and the buttons move in the frame after that
    var frame = 'await new Promise(function(resolve) { setTimeout(resolve, 150); });';

    var wide = await page.eval(canvasWith() + frame + STATE);
    t.check('with room for every button there is no more button',
        !wide.needed && wide.inMenu.length === 0 && wide.oneLine, wide);

    var narrow = await page.eval(`document.querySelector('.container').style.width = '480px';` + frame + STATE);
    t.check('narrower, the toolbar keeps to one line and the last add buttons go behind the more button',
        narrow.needed && narrow.inMenu.length > 0 && narrow.oneLine && narrow.fits &&
        narrow.total === wide.total && narrow.onLine.concat(narrow.inMenu).join() === wide.onLine.join(), narrow);

    await page.click('.ge-toolbar-more > button');
    var opened = await page.eval(STATE + '');
    var menuShown = await page.eval(`return document.querySelector('.ge-toolbar-overflow').getBoundingClientRect().height > 0;`);
    t.check('the more button opens the menu', opened.open && menuShown, opened);
    await page.screenshot(require('path').join(t.screenshots, 'toolbar-overflow.png'));

    var added = await page.eval(`
        const before = document.querySelectorAll('#myGrid > .row').length;
        Array.from(document.querySelectorAll('.ge-toolbar-overflow [data-ge-toolbar]')).pop().click();
        return {
            added: document.querySelectorAll('#myGrid > .row').length === before + 1,
            open: document.querySelector('.ge-toolbar-more').classList.contains('ge-open'),
        };
    `);
    t.check('a button in the menu adds as it does on the line, and closes the menu',
        added.added && !added.open, added);

    await page.click('.ge-toolbar-more > button');
    var escaped = await page.eval(`
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return document.querySelector('.ge-toolbar-more').classList.contains('ge-open');
    `);
    t.check('Escape closes the menu', escaped === false);

    var back = await page.eval(`document.querySelector('.container').style.width = '';` + frame + STATE);
    t.check('with room again, every button is back on the line in its place',
        !back.needed && back.inMenu.length === 0 && back.onLine.join() === wide.onLine.join(), back);

    var relocated = await page.eval(`
        document.querySelector('.container').style.width = '480px';
        window.fixture.editor().setLocale('es');
    ` + frame + STATE);
    t.check('a toolbar rebuilt by setLocale fits again',
        relocated.needed && relocated.oneLine && relocated.fits, relocated);

    var wrapped = await page.eval(canvasWith({ toolbar_overflow: 'wrap' }) + frame + `
        return {
            more: document.querySelectorAll('.ge-toolbar-more, .ge-toolbar-start').length,
            rowsInGroup: document.querySelectorAll('.ge-wrapper > .ge-addRowGroup [data-ge-toolbar]').length,
        };
    `);
    t.check('toolbar_overflow wrap leaves the toolbar as it was, wrapping onto another line',
        wrapped.more === 0 && wrapped.rowsInGroup === 3, wrapped);

    var errors = page.errors();
    t.check('the toolbar overflow tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'toolbar',
    description: 'dragging the toolbar buttons onto the canvas, their icons, and the overflow menu',
    run: async function(t) {
        await paletteTests(t);
        await markerTests(t);
        await settingTests(t);
        await iconTests(t);
        await overflowTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['toolbar']);
}
