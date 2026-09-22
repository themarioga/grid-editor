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
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(
            '<div class="row" id="first"><div class="column col-12"><div class="ge-content"><p>First row</p></div></div></div>' +
            '<div class="row" id="second"><div class="column col-12"><div class="ge-content"><p>Second row</p></div></div></div>'
        );
        window.log = [];
        jQuery('#myGrid').off('grideditor:after-add grideditor:before-add');
        window.fixture.init(${JSON.stringify(Object.assign({ default_view: 'xs', drag_handle: 'drawer' }, settings))});
        jQuery('#myGrid').on('grideditor:after-add', function(e, payload) {
            window.log.push([payload.kind, payload.source]);
        });
    `;
}

var ROWS = `
    return jQuery('#myGrid > .row').map(function() {
        return this.id || 'new:' + jQuery(this).children('.column').length;
    }).get().join(',');
`;

async function paletteTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(canvasWith() + 'return true;');

    var ready = await page.eval(`
        return {
            draggable: jQuery('.ge-addRowGroup a').first().hasClass('ge-palette-button'),
            containerButtons: jQuery('.ge-addContainerGroup a.ge-palette-button').length,
            marked: jQuery('[data-ge-toolbar]').length,
        };
    `);
    t.check('the toolbar buttons are draggable when the palette is on',
        ready.draggable && ready.containerButtons === 4 && ready.marked === 7, ready);

    // Between the two rows: the drawer of the second one is canvas level
    await page.drag('.ge-addRowGroup a[data-ge-layout="6,6"]', '#second > .ge-tools-drawer');
    var dropped = await page.eval(`
        return { rows: (function() { ${ROWS} })(), log: window.log, buttons: jQuery('#myGrid [data-ge-toolbar]').length };
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
            nested: jQuery('#first .column > .row').length,
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
        const made = jQuery('#myGrid [data-ge-container]');
        return {
            rows: (function() { ${ROWS} })(),
            parent: made.parent().attr('class'),
            grandparentIsRow: made.closest('.row').parent().attr('id'),
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
        const made = jQuery('#myGrid [data-ge-container]');
        return {
            rows: (function() { ${ROWS} })(),
            parentIsColumn: made.parent().hasClass('column'),
            panes: made.find('.tab-pane').length,
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
        const marker = jQuery('.ge-drop-marker');
        return {
            marker: marker.length,
            markerBefore: marker.next().attr('id'),
            canvasOpen: jQuery('#myGrid').hasClass('ge-dropping'),
            helperIgnoresThePointer: getComputedStyle(jQuery('.ge-toolbar-helper')[0]).pointerEvents,
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
            markers: jQuery('.ge-drop-marker').length,
            canvasOpen: jQuery('#myGrid').hasClass('ge-dropping'),
            rows: (function() { ${ROWS} })(),
            markerInOutput: /ge-drop-marker/.test(jQuery('#myGrid').gridEditor('getHtml')),
        };
    `);
    t.check('the marker is editor furniture: gone on drop, and never in the output',
        afterDrop.markers === 0 && !afterDrop.canvasOpen &&
        afterDrop.rows === 'first,new:1,second' && !afterDrop.markerInOutput,
        afterDrop);

    await page.eval(canvasWith() + `
        jQuery('#myGrid').on('grideditor:before-add', function(e) { e.preventDefault(); });
        return true;
    `);
    await page.drag('.ge-addRowGroup a[data-ge-layout="12"]', '#second > .ge-tools-drawer');
    var afterCancel = await page.eval(`
        return {
            rows: (function() { ${ROWS} })(),
            buttons: jQuery('#myGrid [data-ge-toolbar]').length,
            markers: jQuery('.ge-drop-marker').length,
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
            draggable: jQuery('.ge-addRowGroup a.ge-palette-button').length,
            clickStillAdds: (jQuery('.ge-addRowGroup a[data-ge-layout="12"]').trigger('click'),
                jQuery('#myGrid > .row').length),
        };
    `);
    t.check('with the default drag handle the toolbar is not a palette, and still clicks',
        byDefault.draggable === 0 && byDefault.clickStillAdds === 3, byDefault);

    await page.eval(canvasWith({ drag_handle: 'tool', toolbar_drag: true }) + 'return true;');
    var forcedOn = await page.eval(`return jQuery('.ge-addRowGroup a.ge-palette-button').length;`);
    t.check('toolbar_drag true turns the palette on whatever the drag handle is',
        forcedOn === 3, forcedOn);

    await page.eval(canvasWith({ toolbar_drag: false }) + 'return true;');
    var forcedOff = await page.eval(`return jQuery('.ge-addRowGroup a.ge-palette-button').length;`);
    t.check('toolbar_drag false turns it off whatever the drag handle is',
        forcedOff === 0, forcedOff);

    var clicksToo = await page.eval(canvasWith() + `
        jQuery('.ge-addContainerGroup a[data-ge-container-type="popup"]').trigger('click');
        return {
            containers: jQuery('#myGrid [data-ge-container="popup"]').length,
            rows: (function() { ${ROWS} })(),
        };
    `);
    t.check('a palette button is still a button: clicking it adds at the end',
        clicksToo.containers === 1 && clicksToo.rows === 'first,second,new:1', clicksToo);

    var errors = page.errors();
    t.check('the toolbar tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'toolbar',
    description: 'dragging the toolbar buttons onto the canvas',
    run: async function(t) {
        await paletteTests(t);
        await markerTests(t);
        await settingTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['toolbar']);
}
