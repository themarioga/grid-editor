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

/**
 * The page's helpers: the DOM in short, the editor, and one listener per
 * event name, so a test that listens again replaces what the one before it
 * listened with.
 */
var HELPERS = `
    window.all = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.one = function(selector, root) { return (root || document).querySelector(selector); };
    window.ge = function() { return window.fixture.editor(); };
    window.grid = function() { return document.querySelector('#myGrid'); };
    window.visible = function(node) { return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length); };
    window.text = function(nodes) { return nodes.map(function(node) { return node.textContent; }).join(''); };
    /** An attribute as a record of it: absent is undefined, as it is on the node side. */
    window.attr = function(node, name) {
        const value = node ? node.getAttribute(name) : null;
        return value === null ? undefined : value;
    };
    /** Html parsed into a detached div, to look at. */
    window.parse = function(html) {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        return holder;
    };

    window.listening = {};
    window.listen = function(names, handler) {
        names.split(' ').forEach(function(name) {
            if (window.listening[name]) { grid().removeEventListener(name, window.listening[name]); }
            window.listening[name] = function(e) { handler(e, e.detail); };
            grid().addEventListener(name, window.listening[name]);
        });
    };
    window.unlisten = function(name) {
        if (window.listening[name]) { grid().removeEventListener(name, window.listening[name]); }
        delete window.listening[name];
    };
    return true;
`;

async function start(t) {
    var page = await t.page(FIXTURE, `window.fixture`);
    await page.eval(HELPERS);
    return page;
}

/** An empty canvas with one column, ready for containers to be put in it. */
var EMPTY_CANVAS = `
    if (window.fixture.editor()) { window.fixture.editor().destroy(); }
    grid().innerHTML = '<div class="row"><div class="column col-12"><div class="ge-content"><p>Before</p></div></div></div>';
`;

/** What the editor made of the canvas, structurally. */
var SHAPE = `
    return {
        containers: all('#myGrid [data-ge-container]').map(function(node) {
            return node.getAttribute('data-ge-container');
        }),
        tabs: all('#myGrid .ge-tab').length,
        panes: all('#myGrid .tab-pane').length,
        items: all('#myGrid .accordion-item').length,
        popups: all('#myGrid [data-ge-popup-id]').length,
        regions: all('#myGrid [data-ge-container] .column').length,
        labels: all('#myGrid .ge-pane-label').map(function(label) { return label.textContent; }),
    };
`;

async function creationTests(t) {
    var page = await start(t);

    var made = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const column = one('#myGrid .column');

        const tabs = ge().createContainer('tabs', { tabs: 3, labels: ['One', 'Two'], appendTo: column });
        const accordion = ge().createContainer('accordion', { items: 2, stay_open: true, appendTo: column });
        const popup = ge().createContainer('popup', { title: 'Terms', trigger_label: 'Read them', size: 'lg', appendTo: column });

        return {
            shape: (function() { ${SHAPE} })(),
            tabTargets: all('.nav-link', tabs).map(function(link) { return link.getAttribute('data-bs-target'); }),
            paneIds: all('.tab-pane', tabs).map(function(pane) { return '#' + pane.id; }),
            activeTabs: all('.nav-link.active', tabs).length,
            stayOpen: all('.accordion-collapse[data-bs-parent]', accordion).length,
            popupTitle: text(all('.modal-title', popup)),
            popupTrigger: text(all('.ge-popup-trigger', popup)),
            popupSize: attr(one('.modal-dialog', popup), 'class'),
            popupTargets: attr(one('.ge-popup-trigger', popup), 'data-ge-popup-target') === popup.getAttribute('data-ge-popup-id'),
            idsUnique: new Set(all('#myGrid [id]').map(function(node) { return node.id; })).size ===
                all('#myGrid [id]').length,
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
        listen('grideditor:before-add grideditor:after-add', function(e, payload) {
            window.log.push([e.type.replace('grideditor:', ''), payload.kind, payload.source]);
        });
        window.specific = [];
        listen('grideditor:before-add-container grideditor:after-add-container', function(e, payload) {
            window.specific.push([e.type.replace('grideditor:', ''), payload.kind]);
        });

        ['tabs', 'accordion', 'popup'].forEach(function(type) {
            all('.ge-addContainerGroup a[data-ge-container-type="' + type + '"]').forEach(function(button) { button.click(); });
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
            registered: Object.keys(GridEditor.containers).sort(),
            offered: all('.ge-addContainerGroup a').map(function(button) {
                return button.getAttribute('data-ge-container-type');
            }).sort(),
        };
    `);
    t.check('every container plugin the page loaded is offered by the toolbar',
        loaded.registered.join(',') === 'accordion,card,popup,tabs' &&
        loaded.offered.join(',') === 'accordion,card,popup,tabs',
        loaded);

    var limited = await page.eval(EMPTY_CANVAS + `
        window.fixture.init({ plugins: ['tabs'] });
        return {
            offered: all('.ge-addContainerGroup a').map(function(button) {
                return button.getAttribute('data-ge-container-type');
            }),
            madeAnyway: ge().createContainer('accordion'),
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
            offered: all('.ge-addContainerGroup a').length,
            warnings: window.warnings.filter(w => /carousel/.test(w)),
        };
    `);
    t.check('a plugin that was named but never loaded says so and changes nothing else',
        missing.offered === 1 && missing.warnings.length === 1 &&
        /not\s+loaded/.test(missing.warnings[0]),
        missing);
}

async function paneTests(t) {
    var page = await start(t);

    var added = await page.eval(EMPTY_CANVAS + `
        window.log = [];
        window.fixture.init();
        const column = one('#myGrid .column');
        const tabs = ge().createContainer('tabs', { tabs: 1, appendTo: column });
        const accordion = ge().createContainer('accordion', { items: 1, appendTo: column });

        listen('grideditor:after-add', function(e, payload) {
            window.log.push([payload.kind, payload.source, payload.container ? payload.container.getAttribute('data-ge-container') : null]);
        });

        const pane = ge().addTab(tabs, { label: 'Second', activate: true });
        const body = ge().addAccordionItem(accordion, { label: 'Second item' });
        all(':scope > .ge-tools-drawer .ge-add-pane', tabs).forEach(function(tool) { tool.click(); });

        return {
            log: window.log,
            paneIsPane: pane.classList.contains('tab-pane') && pane.classList.contains('active'),
            bodyIsBody: body.classList.contains('accordion-body'),
            tabs: all('.ge-tab', tabs).length,
            panes: all('.tab-pane', tabs).length,
            items: all('.accordion-item', accordion).length,
            activeTabs: all('.nav-link.active', tabs).length,
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
        window.fixture.init({ confirm_delete: false });
        window.deleteLog = [];
        listen('grideditor:after-delete', function(e, payload) {
            window.deleteLog.push(payload.kind);
        });

        const tabs = one('#myGrid [data-ge-container="tabs"]');
        const before = { tabs: all('.ge-tab', tabs).length, panes: all('.tab-pane', tabs).length };

        // The active tab, so the pane that is showing goes with it
        all('.ge-delete-pane', one('.ge-tab', tabs)).forEach(function(tool) { tool.click(); });
        return before;
    `);
    await cdp.sleep(700);
    var afterDelete = await page.eval(`
        const tabs = one('#myGrid [data-ge-container="tabs"]');
        return {
            tabs: all('.ge-tab', tabs).length,
            panes: all('.tab-pane', tabs).length,
            activeTabs: all('.nav-link.active', tabs).length,
            activePanes: all('.tab-pane.active', tabs).length,
            log: window.deleteLog,
        };
    `);
    t.check('deleting a tab takes its pane with it and leaves another tab active',
        afterDelete.tabs === deleted.tabs - 1 && afterDelete.panes === deleted.panes - 1 &&
        afterDelete.activeTabs === 1 && afterDelete.activePanes === 1 &&
        afterDelete.log.join(',') === 'tab',
        { before: deleted, after: afterDelete });

    var started = await page.eval(`
        const tabs = one('#myGrid [data-ge-container="tabs"]');
        const strip = all('.ge-tab', tabs);
        const label = one('.ge-pane-label', strip[strip.length - 1]);
        label.setAttribute('id', 'renaming');

        window.activeBefore = attr(one('.nav-link.active', tabs), 'data-bs-target');
        label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));

        return { editable: attr(label, 'contenteditable') };
    `);

    // A real click, because Bootstrap's toggle listens for one on the document
    await page.click('#renaming');

    var renamed = await page.eval(`
        const tabs = one('#myGrid [data-ge-container="tabs"]');
        const label = one('#renaming');
        const activeDuring = attr(one('.nav-link.active', tabs), 'data-bs-target');

        label.textContent = 'Renamed';
        label.blur();

        return {
            editable: started.editable,
            activeUnchanged: window.activeBefore === activeDuring,
            text: label.textContent,
            afterBlur: attr(label, 'contenteditable'),
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
    var page = await start(t);

    var initial = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        window.accordion = ge().createContainer('accordion', {
            items: 3,
            labels: ['One', 'Two', 'Three'],
            appendTo: one('#myGrid .column'),
        });

        window.state = function() {
            return all('.accordion-collapse', window.accordion).map(function(collapse) {
                return collapse.getAttribute('data-ge-open') + ':' + (visible(collapse) ? 'shown' : 'hidden');
            }).join(',');
        };
        window.header = function(index) {
            return one('.accordion-button', all('.ge-accordion-item', window.accordion)[index]);
        };

        return window.state();
    `);
    t.check('an accordion starts with the item the markup opened, and the others closed',
        initial === 'true:shown,false:hidden,false:hidden', initial);

    var opened = await page.eval(`
        header(1).click();
        return { state: window.state(), collapsing: all('.collapsing').length };
    `);
    t.check('clicking a header opens that item and closes the one that was open',
        opened.state === 'false:hidden,true:shown,false:hidden' && opened.collapsing === 0,
        opened);

    var closed = await page.eval(`
        header(1).click();
        return window.state();
    `);
    t.check('clicking it again closes it, leaving the accordion with nothing open',
        closed === 'false:hidden,false:hidden,false:hidden', closed);

    var stayOpen = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        window.accordion = ge().createContainer('accordion', {
            items: 3,
            stay_open: true,
            appendTo: one('#myGrid .column'),
        });

        header(1).click();
        header(2).click();

        return window.state();
    `);
    t.check('an accordion that stays open keeps the items that were already open',
        stayOpen === 'true:shown,true:shown,true:shown', stayOpen);

    var exported = await page.eval(`
        header(0).click();

        const html = ge().getHtml();
        const parsed = parse(html);

        return {
            canvas: window.state(),
            shown: all('.accordion-collapse.show', parsed).length,
            hidden: all('.accordion-collapse:not(.show)', parsed).length,
            expanded: all('.accordion-button:not(.collapsed)', parsed).length,
            bootstrapToggles: all('[data-bs-toggle="collapse"]', parsed).length,
        };
    `);
    t.check('what is open on the canvas is what the authored page opens with',
        exported.canvas === 'false:hidden,true:shown,true:shown' &&
        exported.shown === 2 && exported.hidden === 1 && exported.expanded === 2 &&
        exported.bootstrapToggles === 3,
        exported);

    var duringEditing = await page.eval(`
        return {
            suspended: all('#myGrid [data-ge-bs-toggle="collapse"]').length,
            live: all('#myGrid [data-bs-toggle="collapse"]').length,
            instances: window.bootstrap
                ? all('#myGrid .accordion-collapse').filter(function(collapse) {
                    return !!bootstrap.Collapse.getInstance(collapse);
                }).length
                : null,
        };
    `);
    t.check('Bootstrap’s own collapse is never the thing doing it',
        duringEditing.suspended === 3 && duringEditing.live === 0 && duringEditing.instances === 0,
        duringEditing);

    var errors = page.errors();
    t.check('the accordion state tests logged no errors', errors.length === 0, errors.slice(0, 5));
}

async function nestingTests(t) {
    var page = await start(t);

    var nested = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const column = one('#myGrid .column');

        const accordion = ge().createContainer('accordion', { items: 1, appendTo: column });
        const body = one('.accordion-body', accordion);
        const tabs = ge().createContainer('tabs', { tabs: 2, appendTo: body });

        const pane = one('.tab-pane', tabs);
        const row = ge().createRow([6, 6], { appendTo: pane });
        const element = ge().createElement('<span>nested element</span>', {
            type: 'nested',
            // A pane's region starts as an empty column since 6.0
            appendTo: one('.column', pane),
        });

        let depth = 0;
        for (let node = tabs.parentElement; node; node = node.parentElement) {
            if (node.matches('[data-ge-container]')) { depth++; }
        }

        return {
            depth: depth,
            rowInPane: all(':scope > .row', pane).length,
            columnsInRow: all(':scope > .column', row).length,
            columnDrawers: all(':scope > .column > .ge-tools-drawer', row).length,
            elementMarked: element.classList.contains('ge-element') && all(':scope > .ge-tools-drawer', element).length === 1,
            contentAreas: all('.ge-content', tabs).length,
        };
    `);
    t.check('a pane is an ordinary region: rows, columns and elements nest in it',
        nested.depth === 1 && nested.rowInPane === 2 && nested.columnsInRow === 2 &&
        nested.columnDrawers === 2 && nested.elementMarked,
        nested);

    var roundTrip = await page.eval(`
        const before = (function() { ${SHAPE} })();
        const html = ge().getHtml();

        ge().destroy();
        grid().innerHTML = html;
        window.fixture.init();

        return {
            before: before,
            after: (function() { ${SHAPE} })(),
            html: html,
            nestedStillNested: all('#myGrid .accordion-body [data-ge-container="tabs"]').length,
        };
    `);
    t.check('two levels of container round-trip through getHtml unchanged',
        JSON.stringify(roundTrip.before) === JSON.stringify(roundTrip.after) &&
        roundTrip.nestedStillNested === 1,
        { before: roundTrip.before, after: roundTrip.after, nested: roundTrip.nestedStillNested });

    var clean = await page.eval(`
        const html = ge().getHtml();
        return {
            drawers: /ge-tools-drawer/.test(html),
            containerClass: /class="[^"]*ge-container/.test(html),
            paneLabels: /ge-pane-label/.test(html),
            editable: /contenteditable/i.test(html),
            jqueryUi: /ui-sortable|ui-resizable|ge-drag-|ge-resize-handle/.test(html),
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
    var page = await start(t);

    await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        window.moves = [];
        const column = one('#myGrid .column');

        const tabs = ge().createContainer('tabs', { tabs: 2, labels: ['First', 'Second'], appendTo: column });
        all('.ge-tab', tabs)[0].setAttribute('id', 'tab-first');
        all('.ge-tab', tabs)[1].setAttribute('id', 'tab-second');

        listen('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.index, payload.to.index]);
        });
        return true;
    `);

    // Aimed at the top left of the target tab: with tolerance 'pointer' that
    // is unambiguously "before this one", and it is clear of the placeholder
    // the drag inserts, which is the width of the tab being dragged
    await page.drag('#tab-second > .ge-tools-drawer .ge-move', '#tab-first', { xRatio: 0.15, yRatio: 0.2 });
    var reordered = await page.eval(`
        const tabs = one('#myGrid [data-ge-container="tabs"]');
        return {
            strip: all('.ge-tab', tabs).map(function(tab) { return text(all('.ge-pane-label', tab)); }),
            panesInOrder: all('.tab-pane', tabs).map(function(pane) { return pane.id; }).join(',') ===
                all('.nav-link', tabs).map(function(link) { return link.getAttribute('data-bs-target').slice(1); }).join(','),
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
        unlisten('grideditor:after-move');
        const column = one('#myGrid .column');

        const left = ge().createContainer('accordion', { items: 2, labels: ['A1', 'A2'], appendTo: column });
        const right = ge().createContainer('accordion', { items: 1, labels: ['B1'], stay_open: true, appendTo: column });

        one('.accordion', left).setAttribute('id', 'accordion-left');
        all('.ge-accordion-item', left)[1].setAttribute('id', 'item-a2');
        one('.accordion', right).setAttribute('id', 'accordion-right');
        all('.ge-accordion-item', right)[0].setAttribute('id', 'item-b1');
        all('.accordion-collapse', left).forEach(function(collapse) { collapse.setAttribute('data-bs-parent', '#accordion-left'); });

        listen('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.container ? payload.container.getAttribute('data-ge-container') : null]);
        });
        return true;
    `);

    await page.drag('#item-a2 > .ge-tools-drawer .ge-move', '#item-b1', { yRatio: 0.15 });
    var betweenAccordions = await page.eval(`
        return {
            left: all('#accordion-left > .accordion-item').length,
            right: all('#accordion-right > .accordion-item').length,
            movedParent: attr(one('#item-a2 > .accordion-collapse'), 'data-bs-parent'),
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
        ge().destroy();
        grid().innerHTML = '<div class="row"><div class="column col-12" id="home">' +
            '<div class="ge-content" id="text"><p>A block above the container, tall enough to aim at.</p></div>' +
            '</div></div>';
        window.moves = [];
        window.fixture.init();
        const tabs = ge().createContainer('tabs', { tabs: 1, appendTo: one('#home') });
        tabs.setAttribute('id', 'movable');
        listen('grideditor:after-move', function(e, payload) {
            window.moves.push([payload.kind, payload.from.index, payload.to.index]);
        });
        return Array.from(one('#home').children).map(function(node) {
            return node.id || node.className.split(' ')[0];
        }).join(',');
    `);
    await page.drag('#movable > .ge-tools-drawer .ge-move', '#text', { yRatio: 0.2 });
    var moved = await page.eval(`
        return {
            order: Array.from(one('#home').children).map(function(node) {
                return node.id || node.className.split(' ')[0];
            }).join(','),
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
    var page = await start(t);

    var editing = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const popup = ge().createContainer('popup', { appendTo: one('#myGrid .column') });
        window.popupId = popup.getAttribute('data-ge-popup-id');

        const modal = one('.modal', popup);
        const before = {
            visible: visible(modal),
            position: getComputedStyle(modal).position,
            // Bootstrap hides an unopened modal by opacity and shifts its
            // dialog, which the editor has to undo to render it in place
            opacity: getComputedStyle(modal).opacity,
            transform: getComputedStyle(one('.modal-dialog', popup)).transform,
        };

        const toggle = function() {
            all(':scope > .ge-tools-drawer .ge-toggle-popup', popup).forEach(function(tool) { tool.click(); });
        };
        toggle();
        const collapsed = visible(modal);
        toggle();

        // A click on the trigger must not hand the modal to Bootstrap
        all('.ge-popup-trigger', popup).forEach(function(trigger) { trigger.click(); });

        return {
            before: before,
            collapsed: collapsed,
            expanded: visible(modal),
            bootstrapInstance: !!(window.bootstrap && bootstrap.Modal.getInstance(modal)),
            backdrops: all('.modal-backdrop').length,
            bodyLocked: document.body.classList.contains('modal-open'),
            triggerAttrs: attr(one('.ge-popup-trigger', popup), 'data-bs-toggle'),
            region: all('.modal-body .column', popup).length,
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
        const html = ge().getHtml();

        // The editor's own copy carries the same ids, and Bootstrap looks up
        // its target by id, so the canvas is emptied before the authored copy
        // goes into the page
        ge().destroy();
        grid().innerHTML = '';
        if (one('#authored')) { one('#authored').remove(); }
        const holder = document.createElement('div');
        holder.id = 'authored';
        holder.innerHTML = html;
        document.body.appendChild(holder);

        const modal = one('#authored .modal');
        const trigger = one('#authored .ge-popup-trigger');
        return {
            html: html,
            hiddenAtRest: !visible(modal),
            trigger: attr(trigger, 'data-bs-toggle') + ':' + attr(trigger, 'data-bs-target'),
            targetsThePopup: attr(trigger, 'data-bs-target') === '#' + window.popupId,
        };
    `);
    await page.click('#authored .ge-popup-trigger');
    await cdp.sleep(600);
    var opened = await page.eval(`
        const modal = one('#authored .modal');
        return {
            shown: modal.classList.contains('show') && visible(modal),
            backdrop: all('.modal-backdrop').length,
            instance: !!bootstrap.Modal.getInstance(modal),
        };
    `);
    t.check('the exported markup is a modal Bootstrap opens from its trigger, with no editor help',
        authored.hiddenAtRest && authored.targetsThePopup &&
        authored.trigger === 'modal:#' + (await page.eval(`return window.popupId;`)) &&
        opened.shown && opened.instance && opened.backdrop === 1,
        { authored: authored.trigger, opened: opened });

    await page.eval(`
        const instance = bootstrap.Modal.getInstance(one('#authored .modal'));
        if (instance) { instance.hide(); }
        one('#authored').remove();
        return true;
    `);
    await cdp.sleep(500);

    // A trigger the host wrote, somewhere else on the canvas
    var external = await page.eval(EMPTY_CANVAS + `
        window.orphans = [];
        listen('grideditor:popup-orphan', function(e, payload) {
            window.orphans.push([payload.missing, payload.node.textContent]);
        });
        window.fixture.init();

        const column = one('#myGrid .column');
        const popup = ge().createContainer('popup', { trigger: false, appendTo: column });
        const id = popup.getAttribute('data-ge-popup-id');

        const link = document.createElement('a');
        link.setAttribute('href', '#');
        link.setAttribute('data-ge-popup-target', id);
        link.textContent = 'Read the terms';
        one('.ge-content', column).appendChild(link);
        ge().reset();

        const html = ge().getHtml();
        const hostTrigger = one('#myGrid [data-ge-popup-target]');
        return {
            ownTrigger: all('.ge-popup-trigger', popup).length,
            marked: hostTrigger.classList.contains('ge-popup-trigger'),
            whileEditing: attr(hostTrigger, 'data-bs-toggle'),
            inOutput: /data-bs-toggle="modal"[^>]*data-bs-target="#' + '" | ''/.test(html) ||
                attr(one('[data-ge-popup-target]', parse(html)), 'data-bs-target') === '#' + id,
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
        const column = one('#myGrid .column');
        const popups = function() { return all('#myGrid [data-ge-container="popup"]'); };
        popups().forEach(function(popup) { popup.remove(); });
        const replacement = ge().createContainer('popup', { trigger: false, appendTo: column });
        ge().reset();

        const repaired = attr(one('#myGrid [data-ge-popup-target]'), 'data-ge-popup-target') ===
            replacement.getAttribute('data-ge-popup-id');
        const repairedQuietly = window.orphans.length === 0;

        // Now remove every popup: nothing to re-point to
        window.orphans = [];
        popups().forEach(function(popup) { popup.remove(); });
        ge().reset();

        const triggers = all('#myGrid [data-ge-popup-target]');
        const html = ge().getHtml();

        return {
            repaired: repaired,
            repairedQuietly: repairedQuietly,
            marked: triggers.length > 0 && triggers[0].classList.contains('ge-popup-orphan'),
            kept: triggers.length === 1 && triggers[0].textContent === 'Read the terms',
            orphans: window.orphans,
            inOutput: /ge-popup-orphan/.test(html),
            attributesWithheld: attr(one('[data-ge-popup-target]', parse(html)), 'data-bs-toggle'),
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
    var page = await start(t);

    var made = await page.eval(EMPTY_CANVAS + `
        window.fixture.init();
        const column = one('#myGrid .column');

        const card = ge().createContainer('card', { title: 'Pricing', footer: 'Per month', appendTo: column });
        const bare = ge().createContainer('card', { header: false, appendTo: column });

        return {
            shape: (function() { ${SHAPE} })(),
            header: text(all('.card-header', card)),
            footer: text(all('.card-footer', card)),
            regions: all('.card-body > .row > .column', card).length,
            drawer: all(':scope > .ge-tools-drawer > a', card).map(function(tool) {
                return tool.getAttribute('class').split(' ')[0];
            }).join(','),
            bareHeaders: all('.card-header', bare).length,
            bareFooters: all('.card-footer', bare).length,
            bareTitle: all('.card-body .column', bare).length,
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
        const buttons = function() { return all('.ge-addContainerGroup a[data-ge-container-type="card"]'); };
        buttons().forEach(function(button) { button.click(); });
        return {
            button: text(buttons()).trim(),
            cards: all('#myGrid [data-ge-container="card"]').length,
            label: text(all('#myGrid .card-header .ge-pane-label')),
        };
    `);
    t.check('the toolbar offers a card, and the button makes one',
        /Card/.test(fromToolbar.button) && fromToolbar.cards === 1 &&
        fromToolbar.label === 'Card title',
        fromToolbar);

    var exported = await page.eval(`
        all('#myGrid .card-header .ge-pane-label').forEach(function(label) { label.textContent = 'What it costs'; });
        one('#myGrid .card-body .column').insertAdjacentHTML('beforeend', '<p>Inside the card</p>');
        const html = ge().getHtml();
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
        const html = ge().getHtml();
        ge().destroy();
        grid().innerHTML = html;
        window.fixture.init();
        return {
            cards: all('#myGrid [data-ge-container="card"]').length,
            label: text(all('#myGrid .card-header .ge-pane-label')),
            regions: all('#myGrid .card-body .column').length,
            content: text(all('#myGrid .card-body')).indexOf('Inside the card') !== -1,
        };
    `);
    t.check('feeding that output back in finds the card, its title and its region',
        roundTrip.cards === 1 && roundTrip.label === 'What it costs' &&
        roundTrip.regions === 1 && roundTrip.content,
        roundTrip);

    var unloaded = await page.eval(EMPTY_CANVAS + `
        window.fixture.init({ plugins: ['tabs'] });
        one('#myGrid .ge-content').insertAdjacentHTML('afterend',
            '<div data-ge-container="card"><div class="card"><div class="card-header">Kept</div>' +
            '<div class="card-body"><p>Kept too</p></div></div></div>');
        ge().reset();
        const html = ge().getHtml();
        return {
            button: all('.ge-addContainerGroup a[data-ge-container-type="card"]').length,
            drawers: all('#myGrid [data-ge-container="card"] > .ge-tools-drawer').length,
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
