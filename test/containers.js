/**
 * Browser tests for containers: tabs, accordions, popups and cards.
 *
 * Two things are under test throughout. A pane is an ordinary canvas region,
 * so rows, columns and elements have to nest inside one exactly as they do at
 * the top level. And the output is Bootstrap's markup, not the editor's: what
 * getHtml returns has to work in a page that never loads grid-editor, which
 * is why the popup tests open the exported modal with Bootstrap's own JS.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var FIXTURE = '/test/fixtures/grid.html?init=manual';

/** An empty canvas with one column, ready for containers to be put in it. */
var EMPTY_CANVAS = `
    jQuery('#myGrid').gridEditor('destroy');
    jQuery('#myGrid').html('<div class="row"><div class="column col-12"><div class="ge-content"><p>Before</p></div></div></div>');
`;

/** What the editor made of the canvas, structurally. */
var SHAPE = `
    return {
        containers: jQuery('#myGrid [data-ge-container]').map(function() {
            return jQuery(this).attr('data-ge-container');
        }).get(),
        tabs: jQuery('#myGrid .ge-tab').length,
        panes: jQuery('#myGrid .tab-pane').length,
        items: jQuery('#myGrid .accordion-item').length,
        popups: jQuery('#myGrid [data-ge-popup-id]').length,
        regions: jQuery('#myGrid [data-ge-container] .ge-content').length,
        labels: jQuery('#myGrid .ge-pane-label').map(function() { return jQuery(this).text(); }).get(),
    };
`;

async function creationTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var made = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();

        const tabs = ge.createContainer('tabs', { tabs: 3, labels: ['One', 'Two'], appendTo: column });
        const accordion = ge.createContainer('accordion', { items: 2, stay_open: true, appendTo: column });
        const popup = ge.createContainer('popup', { title: 'Terms', trigger_label: 'Read them', size: 'lg', appendTo: column });

        return {
            shape: (function() { ${SHAPE} })(),
            tabTargets: tabs.find('.nav-link').map(function() { return jQuery(this).attr('data-bs-target'); }).get(),
            paneIds: tabs.find('.tab-pane').map(function() { return '#' + this.id; }).get(),
            activeTabs: tabs.find('.nav-link.active').length,
            stayOpen: accordion.find('.accordion-collapse[data-bs-parent]').length,
            popupTitle: popup.find('.modal-title').text(),
            popupTrigger: popup.find('.ge-popup-trigger').text(),
            popupSize: popup.find('.modal-dialog').attr('class'),
            popupTargets: popup.find('.ge-popup-trigger').attr('data-ge-popup-target') === popup.attr('data-ge-popup-id'),
            idsUnique: new Set(jQuery('#myGrid [id]').map(function() { return this.id; }).get()).size ===
                jQuery('#myGrid [id]').length,
        };
    `);
    t.check('createContainer builds each type with its panes and its Bootstrap wiring',
        made.shape.containers.join(',') === 'tabs,accordion,popup' &&
        made.shape.tabs === 3 && made.shape.panes === 3 && made.shape.items === 2 &&
        made.shape.popups === 1 && made.activeTabs === 1 && made.idsUnique,
        made);
    t.check('a tab points at its own pane, and labels fall back to a numbered one',
        made.tabTargets.join(',') === made.paneIds.join(',') &&
        made.shape.labels.slice(0, 3).join(',') === 'One,Two,Tab 3',
        made);
    t.check('stay_open means no data-bs-parent, which is how Bootstrap is told',
        made.stayOpen === 0, made);
    t.check('a popup takes its title, its trigger label and its size',
        made.popupTitle === 'Terms' && made.popupTrigger === 'Read them' &&
        /modal-lg/.test(made.popupSize) && made.popupTargets,
        made);

    var announced = await page.eval(EMPTY_CANVAS + `
        window.log = [];
        window.fixture.init();
        jQuery('#myGrid').on('grideditor:before-add grideditor:after-add', function(e, payload) {
            window.log.push([e.type.replace('grideditor:', ''), payload.kind, payload.source]);
        });
        window.specific = [];
        jQuery('#myGrid').on('grideditor:before-add-container grideditor:after-add-container', function(e, payload) {
            window.specific.push([e.type.replace('grideditor:', ''), payload.kind]);
        });

        ['tabs', 'accordion', 'popup'].forEach(function(type) {
            jQuery('.ge-addContainerGroup a[data-ge-container-type="' + type + '"]').trigger('click');
        });

        return { log: window.log, specific: window.specific, shape: (function() { ${SHAPE} })() };
    `);
    t.check('every container type shares one pair of add events, with the kind saying which',
        JSON.stringify(announced.specific) === JSON.stringify([
            ['before-add-container', 'tabs'], ['after-add-container', 'tabs'],
            ['before-add-container', 'accordion'], ['after-add-container', 'accordion'],
            ['before-add-container', 'popup'], ['after-add-container', 'popup'],
        ]),
        announced.specific);
    t.check('the toolbar offers one button per container type, and each one announces itself',
        announced.shape.containers.join(',') === 'tabs,accordion,popup' &&
        JSON.stringify(announced.log) === JSON.stringify([
            ['before-add', 'tabs', 'tool'], ['after-add', 'tabs', 'tool'],
            ['before-add', 'accordion', 'tool'], ['after-add', 'accordion', 'tool'],
            ['before-add', 'popup', 'tool'], ['after-add', 'popup', 'tool'],
        ]),
        announced);

    var loaded = await page.eval(`
        return {
            registered: Object.keys(jQuery.fn.gridEditor.containers).sort(),
            offered: jQuery('.ge-addContainerGroup a').map(function() {
                return jQuery(this).attr('data-ge-container-type');
            }).get().sort(),
        };
    `);
    t.check('every container plugin the page loaded is offered by the toolbar',
        loaded.registered.join(',') === 'accordion,card,popup,tabs' &&
        loaded.offered.join(',') === 'accordion,card,popup,tabs',
        loaded);

    var limited = await page.eval(EMPTY_CANVAS + `
        window.fixture.init({ plugins: ['tabs'] });
        return {
            offered: jQuery('.ge-addContainerGroup a').map(function() {
                return jQuery(this).attr('data-ge-container-type');
            }).get(),
            madeAnyway: jQuery('#myGrid').gridEditor('createContainer', 'accordion'),
        };
    `);
    t.check('the plugins setting narrows that to the ones it names',
        limited.offered.join(',') === 'tabs' && limited.madeAnyway === null, limited);

    var missing = await page.eval(EMPTY_CANVAS + `
        window.warnings = [];
        const original = console.warn;
        console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); original.apply(console, arguments); };

        window.fixture.init({ plugins: ['tabs', 'carousel'] });
        console.warn = original;

        return {
            offered: jQuery('.ge-addContainerGroup a').length,
            warnings: window.warnings.filter(w => /carousel/.test(w)),
        };
    `);
    t.check('a plugin that was named but never loaded says so and changes nothing else',
        missing.offered === 1 && missing.warnings.length === 1 &&
        /not\s+loaded/.test(missing.warnings[0]),
        missing);
}

async function paneTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var added = await page.eval(EMPTY_CANVAS + `
        window.log = [];
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();
        const tabs = ge.createContainer('tabs', { tabs: 1, appendTo: column });
        const accordion = ge.createContainer('accordion', { items: 1, appendTo: column });

        jQuery('#myGrid').on('grideditor:after-add', function(e, payload) {
            window.log.push([payload.kind, payload.source, payload.container ? payload.container.attr('data-ge-container') : null]);
        });

        const pane = ge.addTab(tabs, { label: 'Second', activate: true });
        const body = ge.addAccordionItem(accordion, { label: 'Second item' });
        tabs.find('> .ge-tools-drawer .ge-add-pane').trigger('click');

        return {
            log: window.log,
            paneIsPane: pane.hasClass('tab-pane') && pane.hasClass('active'),
            bodyIsBody: body.hasClass('accordion-body'),
            tabs: tabs.find('.ge-tab').length,
            panes: tabs.find('.tab-pane').length,
            items: accordion.find('.accordion-item').length,
            activeTabs: tabs.find('.nav-link.active').length,
        };
    `);
    t.check('addTab and addAccordionItem add a pane and hand it back',
        added.paneIsPane && added.bodyIsBody && added.tabs === 3 && added.panes === 3 &&
        added.items === 2 && added.activeTabs === 1,
        added);
    t.check('a pane added by the api or by the drawer announces itself with its own kind',
        JSON.stringify(added.log) === JSON.stringify([
            ['tab', 'api', 'tabs'],
            ['accordion-item', 'api', 'accordion'],
            ['tab', 'tool', 'tabs'],
        ]),
        added.log);

    var deleted = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        window.fixture.init({ confirm_delete: false });
        window.deleteLog = [];
        jQuery('#myGrid').on('grideditor:after-delete', function(e, payload) {
            window.deleteLog.push(payload.kind);
        });

        const tabs = jQuery('#myGrid [data-ge-container="tabs"]');
        const before = { tabs: tabs.find('.ge-tab').length, panes: tabs.find('.tab-pane').length };

        // The active tab, so the pane that is showing goes with it
        tabs.find('.ge-tab').first().find('.ge-delete-pane').trigger('click');
        return before;
    `);
    await cdp.sleep(700);
    var afterDelete = await page.eval(`
        const tabs = jQuery('#myGrid [data-ge-container="tabs"]');
        return {
            tabs: tabs.find('.ge-tab').length,
            panes: tabs.find('.tab-pane').length,
            activeTabs: tabs.find('.nav-link.active').length,
            activePanes: tabs.find('.tab-pane.active').length,
            log: window.deleteLog,
        };
    `);
    t.check('deleting a tab takes its pane with it and leaves another tab active',
        afterDelete.tabs === deleted.tabs - 1 && afterDelete.panes === deleted.panes - 1 &&
        afterDelete.activeTabs === 1 && afterDelete.activePanes === 1 &&
        afterDelete.log.join(',') === 'tab',
        { before: deleted, after: afterDelete });

    var started = await page.eval(`
        const tabs = jQuery('#myGrid [data-ge-container="tabs"]');
        const label = tabs.find('.ge-tab').last().find('.ge-pane-label').attr('id', 'renaming');

        window.activeBefore = tabs.find('.nav-link.active').attr('data-bs-target');
        label.trigger('dblclick');

        return { editable: label.attr('contenteditable') };
    `);

    // A real click, because Bootstrap's toggle listens for one on the document
    await page.click('#renaming');

    var renamed = await page.eval(`
        const tabs = jQuery('#myGrid [data-ge-container="tabs"]');
        const label = jQuery('#renaming');
        const activeDuring = tabs.find('.nav-link.active').attr('data-bs-target');

        label.text('Renamed').trigger('blur');

        return {
            editable: started.editable,
            activeUnchanged: window.activeBefore === activeDuring,
            text: label.text(),
            afterBlur: label.attr('contenteditable'),
        };
    `.replace('started.editable', JSON.stringify(started.editable)));
    t.check('a tab label is renamed in place without the Bootstrap toggle firing',
        renamed.editable === 'true' && renamed.activeUnchanged && renamed.text === 'Renamed' &&
        renamed.afterBlur === undefined,
        renamed);

    var errors = page.errors();
    t.check('the pane tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Opening and closing an item while editing, which is also how the state the
 * authored page starts in is chosen.
 */
async function accordionStateTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var initial = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        window.accordion = ge.createContainer('accordion', {
            items: 3,
            labels: ['One', 'Two', 'Three'],
            appendTo: jQuery('#myGrid .column').first(),
        });

        window.state = function() {
            return window.accordion.find('.accordion-collapse').map(function() {
                return jQuery(this).attr('data-ge-open') + ':' + (jQuery(this).is(':visible') ? 'shown' : 'hidden');
            }).get().join(',');
        };

        return window.state();
    `);
    t.check('an accordion starts with the item the markup opened, and the others closed',
        initial === 'true:shown,false:hidden,false:hidden', initial);

    var opened = await page.eval(`
        window.accordion.find('.ge-accordion-item').eq(1).find('.accordion-button').trigger('click');
        return { state: window.state(), collapsing: jQuery('.collapsing').length };
    `);
    t.check('clicking a header opens that item and closes the one that was open',
        opened.state === 'false:hidden,true:shown,false:hidden' && opened.collapsing === 0,
        opened);

    var closed = await page.eval(`
        window.accordion.find('.ge-accordion-item').eq(1).find('.accordion-button').trigger('click');
        return window.state();
    `);
    t.check('clicking it again closes it, leaving the accordion with nothing open',
        closed === 'false:hidden,false:hidden,false:hidden', closed);

    var stayOpen = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        window.accordion = ge.createContainer('accordion', {
            items: 3,
            stay_open: true,
            appendTo: jQuery('#myGrid .column').first(),
        });

        window.accordion.find('.ge-accordion-item').eq(1).find('.accordion-button').trigger('click');
        window.accordion.find('.ge-accordion-item').eq(2).find('.accordion-button').trigger('click');

        return window.state();
    `);
    t.check('an accordion that stays open keeps the items that were already open',
        stayOpen === 'true:shown,true:shown,true:shown', stayOpen);

    var exported = await page.eval(`
        window.accordion.find('.ge-accordion-item').eq(0).find('.accordion-button').trigger('click');

        const html = jQuery('#myGrid').gridEditor('getHtml');
        const parsed = jQuery('<div>').html(html);

        return {
            canvas: window.state(),
            shown: parsed.find('.accordion-collapse.show').length,
            hidden: parsed.find('.accordion-collapse:not(.show)').length,
            expanded: parsed.find('.accordion-button:not(.collapsed)').length,
            bootstrapToggles: parsed.find('[data-bs-toggle="collapse"]').length,
        };
    `);
    t.check('what is open on the canvas is what the authored page opens with',
        exported.canvas === 'false:hidden,true:shown,true:shown' &&
        exported.shown === 2 && exported.hidden === 1 && exported.expanded === 2 &&
        exported.bootstrapToggles === 3,
        exported);

    var duringEditing = await page.eval(`
        return {
            suspended: jQuery('#myGrid [data-ge-bs-toggle="collapse"]').length,
            live: jQuery('#myGrid [data-bs-toggle="collapse"]').length,
            instances: window.bootstrap
                ? jQuery('#myGrid .accordion-collapse').filter(function() {
                    return !!bootstrap.Collapse.getInstance(this);
                }).length
                : null,
        };
    `);
    t.check('Bootstrap\u2019s own collapse is never the thing doing it',
        duringEditing.suspended === 3 && duringEditing.live === 0 && duringEditing.instances === 0,
        duringEditing);

    var errors = page.errors();
    t.check('the accordion state tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function nestingTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var nested = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();

        const accordion = ge.createContainer('accordion', { items: 1, appendTo: column });
        const body = accordion.find('.accordion-body').first();
        const tabs = ge.createContainer('tabs', { tabs: 2, appendTo: body });

        const pane = tabs.find('.tab-pane').first();
        const row = ge.createRow([6, 6], { appendTo: pane });
        const element = ge.createElement('<span>nested element</span>', {
            type: 'nested',
            appendTo: pane.find('.ge-content').first(),
        });

        return {
            depth: tabs.parents('[data-ge-container]').length,
            rowInPane: pane.find('> .row').length,
            columnsInRow: row.find('> .column').length,
            columnDrawers: row.find('> .column > .ge-tools-drawer').length,
            elementMarked: element.hasClass('ge-element') && element.find('> .ge-tools-drawer').length === 1,
            contentAreas: tabs.find('.ge-content').length,
        };
    `);
    t.check('a pane is an ordinary region: rows, columns and elements nest in it',
        nested.depth === 1 && nested.rowInPane === 2 && nested.columnsInRow === 2 &&
        nested.columnDrawers === 2 && nested.elementMarked,
        nested);

    var roundTrip = await page.eval(`
        const before = (function() { ${SHAPE} })();
        const html = jQuery('#myGrid').gridEditor('getHtml');

        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(html);
        window.fixture.init();

        return {
            before: before,
            after: (function() { ${SHAPE} })(),
            html: html,
            nestedStillNested: jQuery('#myGrid .accordion-body [data-ge-container="tabs"]').length,
        };
    `);
    t.check('two levels of container round-trip through getHtml unchanged',
        JSON.stringify(roundTrip.before) === JSON.stringify(roundTrip.after) &&
        roundTrip.nestedStillNested === 1,
        { before: roundTrip.before, after: roundTrip.after, nested: roundTrip.nestedStillNested });

    var clean = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            drawers: /ge-tools-drawer/.test(html),
            containerClass: /class="[^"]*ge-container/.test(html),
            paneLabels: /ge-pane-label/.test(html),
            editable: /contenteditable/i.test(html),
            jqueryUi: /ui-sortable|ui-resizable/.test(html),
            dataAttributes: (html.match(/data-ge-[a-z-]+/g) || [])
                .filter((v, i, a) => a.indexOf(v) === i).sort(),
        };
    `);
    t.check('container output carries Bootstrap\\u2019s markup and none of the editor\\u2019s',
        !clean.drawers && !clean.containerClass && !clean.paneLabels && !clean.editable &&
        !clean.jqueryUi &&
        clean.dataAttributes.every(function(name) {
            return ['data-ge-container', 'data-ge-content-type', 'data-ge-element',
                'data-ge-label', 'data-ge-open', 'data-ge-popup-id',
                'data-ge-popup-target'].indexOf(name) !== -1;
        }),
        clean);

    var errors = page.errors();
    t.check('the nesting tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function moveTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        window.moves = [];
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();

        const tabs = ge.createContainer('tabs', { tabs: 2, labels: ['First', 'Second'], appendTo: column });
        tabs.find('.ge-tab').eq(0).attr('id', 'tab-first');
        tabs.find('.ge-tab').eq(1).attr('id', 'tab-second');

        jQuery('#myGrid').on('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.index, payload.to.index]);
        });
        return true;
    `);

    // Aimed at the top left of the target tab: with tolerance 'pointer' that
    // is unambiguously "before this one", and it is clear of the placeholder
    // the drag inserts, which is the width of the tab being dragged
    await page.drag('#tab-second > .ge-tools-drawer .ge-move', '#tab-first', { xRatio: 0.15, yRatio: 0.2 });
    var reordered = await page.eval(`
        const tabs = jQuery('#myGrid [data-ge-container="tabs"]');
        return {
            strip: tabs.find('.ge-tab').map(function() { return jQuery(this).find('.ge-pane-label').text(); }).get(),
            panesInOrder: tabs.find('.tab-pane').map(function() { return this.id; }).get().join(',') ===
                tabs.find('.nav-link').map(function() { return jQuery(this).attr('data-bs-target').slice(1); }).get().join(','),
            moves: window.moves,
        };
    `);
    t.check('a tab drags to a new position and its pane follows it',
        reordered.strip.join(',') === 'Second,First' && reordered.panesInOrder &&
        reordered.moves.length === 1 && reordered.moves[0][0] === 'tab',
        reordered);

    await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        window.moves = [];
        jQuery('#myGrid').off('grideditor:after-move');
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();

        const left = ge.createContainer('accordion', { items: 2, labels: ['A1', 'A2'], appendTo: column });
        const right = ge.createContainer('accordion', { items: 1, labels: ['B1'], stay_open: true, appendTo: column });

        left.find('.accordion').attr('id', 'accordion-left');
        left.find('.ge-accordion-item').eq(1).attr('id', 'item-a2');
        right.find('.accordion').attr('id', 'accordion-right');
        right.find('.ge-accordion-item').eq(0).attr('id', 'item-b1');
        left.find('.accordion-collapse').attr('data-bs-parent', '#accordion-left');

        jQuery('#myGrid').on('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.container ? payload.container.attr('data-ge-container') : null]);
        });
        return true;
    `);

    await page.drag('#item-a2 > .ge-tools-drawer .ge-move', '#item-b1', { yRatio: 0.15 });
    var betweenAccordions = await page.eval(`
        return {
            left: jQuery('#accordion-left > .accordion-item').length,
            right: jQuery('#accordion-right > .accordion-item').length,
            movedParent: jQuery('#item-a2 > .accordion-collapse').attr('data-bs-parent'),
            moves: window.moves,
        };
    `);
    t.check('an accordion item drags into another accordion and collapses against that one',
        betweenAccordions.left === 1 && betweenAccordions.right === 2 &&
        betweenAccordions.movedParent === undefined &&
        betweenAccordions.moves.length === 1 && betweenAccordions.moves[0][0] === 'accordion-item',
        betweenAccordions);

    // A whole container is a block like a row is, and moves with the rest of
    // them. In 3.x its move tool was a handle for a list that did not accept
    // containers, so dragging one did nothing at all.
    var wholeContainer = await page.eval(`
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html('<div class="row"><div class="column col-12" id="home">' +
            '<div class="ge-content" id="text"><p>A block above the container, tall enough to aim at.</p></div>' +
            '</div></div>');
        window.moves = [];
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const tabs = ge.createContainer('tabs', { tabs: 1, appendTo: jQuery('#home') });
        tabs.attr('id', 'movable');
        jQuery('#myGrid').off('grideditor:after-move').on('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.index, payload.to.index]);
        });
        return jQuery('#home').children().map(function() {
            return this.id || this.className.split(' ')[0];
        }).get().join(',');
    `);
    await page.drag('#movable > .ge-tools-drawer .ge-move', '#text', { yRatio: 0.2 });
    var moved = await page.eval(`
        return {
            order: jQuery('#home').children().map(function() {
                return this.id || this.className.split(' ')[0];
            }).get().join(','),
            moves: window.moves,
        };
    `);
    t.check('a whole container moves like any other block, and says it moved',
        wholeContainer.indexOf('text') < wholeContainer.indexOf('movable') &&
        moved.order.indexOf('movable') < moved.order.indexOf('text') &&
        moved.moves.length === 1 && moved.moves[0][0] === 'tabs' &&
        moved.moves[0][2] === 0,
        { before: wholeContainer, after: moved });

    var errors = page.errors();
    t.check('the container move tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function popupTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var editing = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const popup = ge.createContainer('popup', { appendTo: jQuery('#myGrid .column').first() });
        window.popupId = popup.attr('data-ge-popup-id');

        const modal = popup.find('.modal');
        const before = {
            visible: modal.is(':visible'),
            position: getComputedStyle(modal[0]).position,
            // Bootstrap hides an unopened modal by opacity and shifts its
            // dialog, which the editor has to undo to render it in place
            opacity: getComputedStyle(modal[0]).opacity,
            transform: getComputedStyle(popup.find('.modal-dialog')[0]).transform,
        };

        popup.find('> .ge-tools-drawer .ge-toggle-popup').trigger('click');
        const collapsed = modal.is(':visible');
        popup.find('> .ge-tools-drawer .ge-toggle-popup').trigger('click');

        // A click on the trigger must not hand the modal to Bootstrap
        popup.find('.ge-popup-trigger').trigger('click');

        return {
            before: before,
            collapsed: collapsed,
            expanded: modal.is(':visible'),
            bootstrapInstance: !!(window.bootstrap && bootstrap.Modal.getInstance(modal[0])),
            backdrops: jQuery('.modal-backdrop').length,
            bodyLocked: jQuery('body').hasClass('modal-open'),
            triggerAttrs: popup.find('.ge-popup-trigger').attr('data-bs-toggle'),
            region: popup.find('.modal-body .ge-content').length,
        };
    `);
    t.check('a popup is edited unfolded in place, with Bootstrap never asked to open it',
        editing.before.visible && editing.before.position === 'static' &&
        editing.before.opacity === '1' && editing.before.transform === 'none' &&
        !editing.collapsed && editing.expanded && !editing.bootstrapInstance &&
        editing.backdrops === 0 && !editing.bodyLocked &&
        editing.triggerAttrs === undefined && editing.region === 1,
        editing);

    // The authored page: Bootstrap's own JS, no grid editor
    var authored = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');

        // The editor's own copy carries the same ids, and Bootstrap looks up
        // its target by id, so the canvas is emptied before the authored copy
        // goes into the page
        jQuery('#myGrid').gridEditor('destroy').empty();
        jQuery('#authored').remove();
        jQuery('<div id="authored" />').html(html).appendTo('body');

        const modal = jQuery('#authored .modal');
        return {
            html: html,
            hiddenAtRest: !modal.is(':visible'),
            trigger: jQuery('#authored .ge-popup-trigger').attr('data-bs-toggle') + ':' +
                jQuery('#authored .ge-popup-trigger').attr('data-bs-target'),
            targetsThePopup: jQuery('#authored .ge-popup-trigger').attr('data-bs-target') === '#' + window.popupId,
        };
    `);
    await page.click('#authored .ge-popup-trigger');
    await cdp.sleep(600);
    var opened = await page.eval(`
        const modal = jQuery('#authored .modal');
        return {
            shown: modal.hasClass('show') && modal.is(':visible'),
            backdrop: jQuery('.modal-backdrop').length,
            instance: !!bootstrap.Modal.getInstance(modal[0]),
        };
    `);
    t.check('the exported markup is a modal Bootstrap opens from its trigger, with no editor help',
        authored.hiddenAtRest && authored.targetsThePopup &&
        authored.trigger === 'modal:#' + (await page.eval(`return window.popupId;`)) &&
        opened.shown && opened.instance && opened.backdrop === 1,
        { authored: authored.trigger, opened: opened });

    await page.eval(`
        const instance = bootstrap.Modal.getInstance(jQuery('#authored .modal')[0]);
        if (instance) { instance.hide(); }
        jQuery('#authored').remove();
        return true;
    `);
    await cdp.sleep(500);

    // A trigger the host wrote, somewhere else on the canvas
    var external = await page.eval(EMPTY_CANVAS + `
        window.orphans = [];
        jQuery('#myGrid').on('grideditor:popup-orphan', function(e, payload) {
            window.orphans.push([payload.missing, payload.node.text()]);
        });
        window.fixture.init();

        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();
        const popup = ge.createContainer('popup', { trigger: false, appendTo: column });
        const id = popup.attr('data-ge-popup-id');

        jQuery('<a href="#" data-ge-popup-target="' + id + '">Read the terms</a>')
            .appendTo(column.find('.ge-content').first());
        ge.reset();

        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            ownTrigger: popup.find('.ge-popup-trigger').length,
            marked: jQuery('#myGrid [data-ge-popup-target]').hasClass('ge-popup-trigger'),
            whileEditing: jQuery('#myGrid [data-ge-popup-target]').attr('data-bs-toggle'),
            inOutput: /data-bs-toggle="modal"[^>]*data-bs-target="#' + '" | ''/.test(html) ||
                jQuery('<div>').html(html).find('[data-ge-popup-target]').attr('data-bs-target') === '#' + id,
            orphans: window.orphans,
        };
    `);
    t.check('a trigger the host wrote is wired up in the output and left alone while editing',
        external.ownTrigger === 0 && external.marked && external.whileEditing === undefined &&
        external.inOutput && external.orphans.length === 0,
        external);

    var orphaned = await page.eval(`
        // Delete the popup the trigger points at, with another popup left in
        // the same column: unambiguous, so it is re-pointed
        const column = jQuery('#myGrid .column').first();
        const ge = jQuery('#myGrid').data('grideditor');
        jQuery('#myGrid [data-ge-container="popup"]').remove();
        const replacement = ge.createContainer('popup', { trigger: false, appendTo: column });
        ge.reset();

        const repaired = jQuery('#myGrid [data-ge-popup-target]').attr('data-ge-popup-target') ===
            replacement.attr('data-ge-popup-id');
        const repairedQuietly = window.orphans.length === 0;

        // Now remove every popup: nothing to re-point to
        window.orphans = [];
        jQuery('#myGrid [data-ge-container="popup"]').remove();
        ge.reset();

        const trigger = jQuery('#myGrid [data-ge-popup-target]');
        const html = jQuery('#myGrid').gridEditor('getHtml');

        return {
            repaired: repaired,
            repairedQuietly: repairedQuietly,
            marked: trigger.hasClass('ge-popup-orphan'),
            kept: trigger.length === 1 && trigger.text() === 'Read the terms',
            orphans: window.orphans,
            inOutput: /ge-popup-orphan/.test(html),
            attributesWithheld: jQuery('<div>').html(html).find('[data-ge-popup-target]').attr('data-bs-toggle'),
        };
    `);
    t.check('a stale trigger is re-pointed when that is unambiguous, and marked when it is not',
        orphaned.repaired && orphaned.repairedQuietly && orphaned.marked && orphaned.kept &&
        orphaned.orphans.length >= 1 && orphaned.orphans[0][1] === 'Read the terms' &&
        !orphaned.inOutput && orphaned.attributesWithheld === undefined,
        orphaned);

    var errors = page.errors();
    t.check('the popup tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

/**
 * Cards: the plainest container there is - a header, one region, an optional
 * footer - which makes it the one that shows what a container costs at
 * minimum.
 */
async function cardTests(t) {
    var page = await t.page(FIXTURE, `window.fixture`);

    var made = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const ge = jQuery('#myGrid').data('grideditor');
        const column = jQuery('#myGrid .column').first();

        const card = ge.createContainer('card', { title: 'Pricing', footer: 'Per month', appendTo: column });
        const bare = ge.createContainer('card', { header: false, appendTo: column });

        return {
            shape: (function() { ${SHAPE} })(),
            header: card.find('.card-header').text(),
            footer: card.find('.card-footer').text(),
            regions: card.find('.card-body > .row .ge-content').length,
            drawer: card.find('> .ge-tools-drawer > a').map(function() {
                return jQuery(this).attr('class').split(' ')[0];
            }).get().join(','),
            bareHeaders: bare.find('.card-header').length,
            bareFooters: bare.find('.card-footer').length,
            bareTitle: bare.find('.card-body .ge-content').length,
        };
    `);
    t.check('a card is a header, one region and an optional footer',
        made.shape.containers.join(',') === 'card,card' && made.regions === 1 &&
        made.header === 'Pricing' && made.footer === 'Per month',
        made);
    t.check('header false leaves the title out and the region in',
        made.bareHeaders === 0 && made.bareFooters === 0 && made.bareTitle === 1, made);
    t.check('a card carries the same drawer as any other container',
        made.drawer === 'ge-move,ge-settings,ge-delete-container', made);

    var fromToolbar = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        jQuery('.ge-addContainerGroup a[data-ge-container-type="card"]').trigger('click');
        return {
            button: jQuery('.ge-addContainerGroup a[data-ge-container-type="card"]').text().trim(),
            cards: jQuery('#myGrid [data-ge-container="card"]').length,
            label: jQuery('#myGrid .card-header .ge-pane-label').text(),
        };
    `);
    t.check('the toolbar offers a card, and the button makes one',
        /Card/.test(fromToolbar.button) && fromToolbar.cards === 1 &&
        fromToolbar.label === 'Card title',
        fromToolbar);

    var exported = await page.eval(`
        jQuery('#myGrid .card-header .ge-pane-label').text('What it costs');
        jQuery('#myGrid .card-body .ge-content').first().html('<p>Inside the card</p>');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            html: html,
            furniture: /ge-tools-drawer|ge-pane-label|contenteditable/.test(html),
            marking: /data-ge-container="card"/.test(html),
            bootstrap: /class="card"/.test(html) && /class="card-header"/.test(html) &&
                /class="card-body"/.test(html),
            renamed: /What it costs/.test(html),
            content: /Inside the card/.test(html),
        };
    `);
    t.check('getHtml gives back a bootstrap card, renamed, with none of the editor on it',
        !exported.furniture && exported.marking && exported.bootstrap &&
        exported.renamed && exported.content,
        Object.assign({}, exported, { html: exported.html.slice(0, 200) }));

    var roundTrip = await page.eval(`
        const html = jQuery('#myGrid').gridEditor('getHtml');
        jQuery('#myGrid').gridEditor('destroy');
        jQuery('#myGrid').html(html);
        window.fixture.init();
        return {
            cards: jQuery('#myGrid [data-ge-container="card"]').length,
            label: jQuery('#myGrid .card-header .ge-pane-label').text(),
            regions: jQuery('#myGrid .card-body .ge-content').length,
            content: jQuery('#myGrid .card-body').text().indexOf('Inside the card') !== -1,
        };
    `);
    t.check('feeding that output back in finds the card, its title and its region',
        roundTrip.cards === 1 && roundTrip.label === 'What it costs' &&
        roundTrip.regions === 1 && roundTrip.content,
        roundTrip);

    var unloaded = await page.eval(EMPTY_CANVAS + `
        window.fixture.init({ plugins: ['tabs'] });
        const before = jQuery('#myGrid').html();
        jQuery('#myGrid .ge-content').first().after(
            '<div data-ge-container="card"><div class="card"><div class="card-header">Kept</div>' +
            '<div class="card-body"><p>Kept too</p></div></div></div>');
        jQuery('#myGrid').gridEditor('reset');
        const html = jQuery('#myGrid').gridEditor('getHtml');
        return {
            button: jQuery('.ge-addContainerGroup a[data-ge-container-type="card"]').length,
            drawers: jQuery('#myGrid [data-ge-container="card"] > .ge-tools-drawer').length,
            kept: /Kept too/.test(html) && /data-ge-container="card"/.test(html),
        };
    `);
    t.check('with the card plugin left out of plugins, its markup is left exactly alone',
        unloaded.button === 0 && unloaded.drawers === 0 && unloaded.kept, unloaded);

    var errors = page.errors();
    t.check('the card tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

module.exports = {
    name: 'containers',
    description: 'tabs, accordions, popups and cards',
    run: async function(t) {
        await creationTests(t);
        await paneTests(t);
        await accordionStateTests(t);
        await nestingTests(t);
        await moveTests(t);
        await popupTests(t);
        await cardTests(t);
    },
};

if (require.main === module) {
    require('./run').main(['containers']);
}
