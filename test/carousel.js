/**
 * Browser tests for the carousel plugin (spec carousel): the markup it makes,
 * one slide at a time on the canvas and the drawer that moves between them,
 * adding, moving and deleting slides, the Carousel and Slide sections of the
 * settings panels, the options given to createContainer and the carousel
 * setting, the markup a host wrote, and what getHtml gives.
 *
 * Each check names the acceptance criteria it covers. addPane on the other
 * container types is test/containers.js.
 *
 * Runs against the built files in `dist`, so run `npm run build` first if you
 * changed anything under `src`.
 */

var cdp = require('./cdp');

var sleep = cdp.sleep;

var FIXTURE = '/test/fixtures/grid.html?init=manual';

var HELPERS = `
    window.warnings = [];
    const warn = console.warn;
    console.warn = function() { window.warnings.push(Array.prototype.join.call(arguments, ' ')); warn.apply(console, arguments); };

    window.all = function(selector, root) { return Array.from((root || document).querySelectorAll(selector)); };
    window.one = function(selector, root) { return (root || document).querySelector(selector); };
    window.ge = function() { return window.fixture.editor(); };
    window.grid = function() { return one('#myGrid'); };
    window.column = function() { return one('#myGrid .column'); };
    window.carousels = function() { return all('#myGrid [data-ge-container="carousel"]'); };
    window.car = function() { return carousels()[0]; };
    window.inner = function(c) { return one(':scope > .carousel > .carousel-inner', c || car()); };
    window.items = function(c) { return all(':scope > .carousel > .carousel-inner > .carousel-item', c || car()); };
    window.indicators = function(c) { return all(':scope > .carousel > .carousel-indicators > *', c || car()); };
    window.drawer = function(c) { return one(':scope > .ge-container-drawer', c || car()); };
    window.tool = function(name, c) { return one(':scope > .ge-' + name, drawer(c)); };
    window.slideTool = function(item, name) { return one(':scope > .ge-pane-drawer > .ge-' + name, item); };
    window.counter = function(c) { return tool('carousel-counter', c).textContent; };
    window.disabled = function(node) { return node.getAttribute('aria-disabled') === 'true'; };
    window.visible = function(node) { return getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0; };
    /** Which slides show, by position. */
    window.shown = function(c) {
        return items(c).map(function(item, index) { return visible(item) ? index : -1; }).filter(function(index) { return index >= 0; }).join(',');
    };
    window.next = function(c) { tool('carousel-next', c).click(); };
    window.previous = function(c) { tool('carousel-previous', c).click(); };
    window.parse = function(html) { const holder = document.createElement('div'); holder.innerHTML = html; return holder; };
    window.exported = function() { return parse(ge().getHtml()); };
    window.wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };
    window.attributes = function(node) {
        return Array.from(node.attributes).map(function(each) { return each.name + '=' + each.value; }).sort().join(' ');
    };

    window.events = [];
    ['before-add', 'after-add', 'before-add-carousel-item', 'after-add-carousel-item', 'before-add-container',
        'before-move', 'after-move', 'before-delete', 'after-delete', 'after-utility'].forEach(function(name) {
        grid().addEventListener('grideditor:' + name, function(e) {
            window.events.push({ name: name, kind: e.detail.kind, source: e.detail.source, node: e.detail.node });
        });
    });
    window.named = function() { return events.map(function(each) { return each.name; }).join(','); };

    /** A fresh editor on one column, with a carousel in it unless html says otherwise or create is false. */
    window.start = function(settings, html, create) {
        if (ge()) { window.fixture.teardown(); }
        window.warnings = [];
        grid().innerHTML = '<div class="row"><div class="column col-12">' + (html || '') + '</div></div>';
        window.fixture.init(Object.assign({
            plugins: window.fixture.plugins(['carousel', 'clipboard']),
            confirm_delete: false,
        }, settings || {}));
        if (!html && create !== false) {
            ge().createContainer('carousel', Object.assign({ appendTo: column() }, create || {}));
        }
        window.events = [];
    };

    /** A carousel's Carousel section, and a slide's Slide section, in their drawers' panels. */
    window.section = function(node) {
        return one(':scope > .ge-tools-drawer > .ge-details [data-ge-plugin="carousel"]', node || car());
    };
    window.option = function(key, node) { return one('[data-ge-carousel-option="' + key + '"] input', section(node)); };
    window.ride = function(node) { return one('select', section(node)); };
    window.interval = function(node) { return one('input[type="number"]', section(node)); };
    window.change = function(input, value) {
        if (input.type === 'checkbox') { input.checked = value; } else { input.value = value; }
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    window.theCarousel = function(c) { return one(':scope > .carousel', c || car()); };
    return true;
`;

async function start(t) {
    var page = await t.page(FIXTURE, 'window.fixture');
    await page.eval(HELPERS);
    return page;
}

async function creationTests(t, page) {
    var made = await page.eval(`
        start({ toolbar_groups: true }, '', false);
        const tabs = all('.ge-toolbar-groups [data-ge-group]');
        const inGroup = {};
        tabs.forEach(function(tab) {
            tab.click();
            inGroup[tab.getAttribute('data-ge-group')] = all('.ge-toolbar-start [data-ge-toolbar]').filter(visible).map(function(b) { return b.getAttribute('title') || b.textContent.trim(); });
        });
        return { content: inGroup.content || [] };
    `);
    t.check('AC-01 the toolbar offers a Carousel button, in the content tab with groups',
        made.content.some(function(label) { return /Carousel/.test(label); }), made);

    var created = await page.eval(`
        start({}, '', false);
        one('.ge-addContainerGroup [data-ge-container-type="carousel"]').click();
        const c = car();
        const carousel = theCarousel(c);
        const id = carousel.id;
        const html = exported();
        const out = one('.carousel', html);
        return {
            count: items().length,
            active: items().map(function(item) { return item.classList.contains('active'); }).join(','),
            indicators: indicators().length,
            controls: all(':scope > .carousel-control-prev, :scope > .carousel-control-next', carousel).length,
            order: Array.from(out.children).map(function(child) { return child.className.split(' ')[0]; }).join(','),
            classes: out.className,
            attrs: attributes(out),
            idOk: /^ge-carousel-/.test(id),
            targets: all('[data-bs-target]', out).every(function(each) { return each.getAttribute('data-bs-target') === '#' + id; }),
            slides: all('[data-bs-slide]', out).map(function(each) { return each.getAttribute('data-bs-slide'); }).join(','),
            slideTo: all('[data-bs-slide-to]', out).map(function(each) { return each.getAttribute('data-bs-slide-to') + ':' + each.getAttribute('aria-label'); }).join(','),
            hidden: all('.visually-hidden', out).map(function(each) { return each.textContent; }).join(','),
            regions: items().map(function(item) {
                const row = one(':scope > .row', item);
                return !!row && all(':scope > .column', row).length === 1 && one(':scope > .column', row).classList.contains('col-12');
            }).join(','),
        };
    `);
    t.check('AC-02 a carousel from the toolbar: 2 slides, the first active, 2 indicators and both arrows, no options written',
        created.count === 2 && created.active === 'true,false' && created.indicators === 2 && created.controls === 2 &&
        created.order === 'carousel-indicators,carousel-inner,carousel-control-prev,carousel-control-next' &&
        created.classes === 'carousel slide' && created.attrs === 'class=carousel slide id=' + created.attrs.split('id=')[1] &&
        created.idOk && created.targets && created.slides === 'prev,next' &&
        created.slideTo === '0:Slide 1,1:Slide 2' && created.hidden === 'Previous,Next', created);
    t.check('AC-03 every slide holds a row with one full width column',
        created.regions === 'true,true', created);
}

async function navigationTests(t, page) {
    var stepping = await page.eval(`
        start({}, '', { slides: 3 });
        const states = [[counter(), shown()]];
        next(); states.push([counter(), shown()]);
        next(); states.push([counter(), shown()]);
        next(); states.push([counter(), shown()]);
        previous(); states.push([counter(), shown()]);
        return { states: states.map(function(each) { return each.join('@'); }), events: named() };
    `);
    t.check('AC-04 the drawer\'s next arrow shows each slide in turn, one at a time, and wraps to the first',
        stepping.states.slice(0, 4).join(' ') === '1 / 3@0 2 / 3@1 3 / 3@2 1 / 3@0', stepping);
    t.check('AC-05 the previous arrow on the first slide shows the last',
        stepping.states[4] === '3 / 3@2', stepping);
    t.check('AC-52 navigating fires no event', stepping.events === '', stepping);

    var through = await page.eval(`
        start({}, '', { slides: 2 });
        const target = one('.column', items()[0]);
        target.id = 'under';
        const arrow = one(':scope > .carousel > .carousel-control-prev', car()).getBoundingClientRect();
        const hit = document.elementFromPoint(arrow.left + 5, arrow.top + arrow.height / 2);
        one(':scope > .carousel > .carousel-control-prev', car()).click();
        indicators()[1].click();
        await wait(700);
        return {
            hitArrow: !!hit && !!hit.closest('.carousel-control-prev'),
            hitSlide: !!hit && !!hit.closest('.carousel-item'),
            shown: shown(),
            counter: counter(),
        };
    `);
    t.check('AC-06 Bootstrap\'s arrows and indicators do not change the slide, and a click goes through them to the slide',
        !through.hitArrow && through.hitSlide && through.shown === '0' && through.counter === '1 / 2', through);

    var one_ = await page.eval(`
        start({}, '', { slides: 1 });
        const single = [counter(), disabled(tool('carousel-previous')), disabled(tool('carousel-next'))];
        slideTool(items()[0], 'delete-pane').click();
        await wait(500);
        const empty = [counter(), disabled(tool('carousel-previous')), disabled(tool('carousel-next')), indicators().length,
            !!one(':scope > .carousel > .carousel-indicators', car())];
        tool('add-pane').click();
        const again = [counter(), indicators().length, shown()];
        return { single: single.join(), empty: empty.join(), again: again.join() };
    `);
    t.check('AC-21 one slide: 1 / 1 with the arrows off; none: 0 / 0, the arrows off, the indicators empty; one added: 1 / 1',
        one_.single === '1 / 1,true,true' && one_.empty === '0 / 0,true,true,0,true' && one_.again === '1 / 1,1,0', one_);
}

async function bootstrapTests(t, page) {
    var riding = await page.eval(`
        start({}, '<div data-ge-container="carousel"><div class="carousel slide" id="riding" data-bs-ride="carousel" data-bs-interval="1000">' +
            '<div class="carousel-indicators"><button type="button" data-bs-target="#riding" data-bs-slide-to="0" class="active" aria-current="true"></button><button type="button" data-bs-target="#riding" data-bs-slide-to="1"></button></div>' +
            '<div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div><div class="carousel-item"><div class="row"><div class="column col-12"></div></div></div></div>' +
            '<button class="carousel-control-prev" type="button" data-bs-target="#riding" data-bs-slide="prev"></button><button class="carousel-control-next" type="button" data-bs-target="#riding" data-bs-slide="next"></button>' +
            '</div></div>');
        const before = shown();
        await wait(2500);
        const live = all('#myGrid [data-bs-ride], #myGrid [data-bs-slide], #myGrid [data-bs-slide-to]').length;
        const out = one('.carousel', exported());
        return {
            before: before, after: shown(), live: live,
            ride: out.getAttribute('data-bs-ride'),
            slide: all('[data-bs-slide]', out).map(function(each) { return each.getAttribute('data-bs-slide'); }).join(','),
            slideTo: all('[data-bs-slide-to]', out).map(function(each) { return each.getAttribute('data-bs-slide-to'); }).join(','),
        };
    `);
    t.check('AC-07 with autoplay in the markup, the canvas does not move and has none of Bootstrap\'s slide attributes',
        riding.before === '0' && riding.after === '0' && riding.live === 0, riding);
    t.check('AC-09 getHtml puts data-bs-ride, data-bs-slide and data-bs-slide-to back as they were',
        riding.ride === 'carousel' && riding.slide === 'prev,next' && riding.slideTo === '0,1', riding);

    var started = await page.eval(`
        if (ge()) { window.fixture.teardown(); }
        grid().innerHTML = '<div class="row"><div class="column col-12"><div data-ge-container="carousel"><div class="carousel slide" id="started" data-bs-interval="1000">' +
            '<div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div><div class="carousel-item"><div class="row"><div class="column col-12"></div></div></div></div>' +
            '</div></div></div></div>';
        const instance = bootstrap.Carousel.getOrCreateInstance(one('#started'), { interval: 1000, ride: 'carousel' });
        instance.cycle();
        window.fixture.init({ plugins: window.fixture.plugins(['carousel']) });
        const before = shown();
        await wait(2500);
        return { before: before, after: shown(), instance: !!bootstrap.Carousel.getInstance(one('#started')) };
    `);
    t.check('AC-08 a carousel Bootstrap had already started stops when the editor takes it over',
        started.before === started.after && started.instance === false, started);
}

async function htmlTests(t, page) {
    var output = await page.eval(`
        start({}, '', { slides: 3 });
        next();
        const out = exported();
        const kept = out.innerHTML;
        const snapshot = parse(ge().getHtml({ keepEditing: true }));
        return {
            active: all('.carousel-item', out).map(function(item) { return item.classList.contains('active'); }).join(','),
            indicators: all('.carousel-indicators > button', out).map(function(each) {
                return each.classList.contains('active') + ':' + each.getAttribute('aria-current');
            }).join(','),
            canvas: [counter(), shown()].join(),
            snapshotSame: snapshot.innerHTML === kept,
            snapshotCanvas: [counter(), shown(), grid().classList.contains('ge-editing')].join(),
            marks: (kept.match(/class="[^"]*\\bge-|data-ge-bs/g) || []).length,
            drawers: all('.ge-tools-drawer', out).length,
        };
    `);
    t.check('AC-10 getHtml starts at the first slide and its indicator, and the canvas stays on the one it showed',
        output.active === 'true,false,false' && output.indicators === 'true:true,false:null,false:null' && output.canvas === '2 / 3,1', output);
    t.check('AC-11 getHtml({ keepEditing: true }) gives the same, and the canvas never leaves editing',
        output.snapshotSame && output.snapshotCanvas === '2 / 3,1,true', output);
    t.check('AC-12 no editor classes, attributes, navigation or drawers in getHtml',
        output.marks === 0 && output.drawers === 0, output);

    var transitions = await page.eval(`
        start({}, '<div data-ge-container="carousel"><div class="carousel slide" id="moving"><div class="carousel-inner">' +
            '<div class="carousel-item active carousel-item-start"><div class="row"><div class="column col-12"></div></div></div>' +
            '<div class="carousel-item carousel-item-next carousel-item-start"><div class="row"><div class="column col-12"></div></div></div>' +
            '</div></div></div>');
        return { left: /carousel-item-(next|prev|start|end)/.test(ge().getHtml()) };
    `);
    t.check('AC-13 Bootstrap\'s transition classes are not in getHtml', !transitions.left, transitions);
}

async function slideTests(t, page) {
    var added = await page.eval(`
        start({}, '', { slides: 2 });
        tool('add-pane').click();
        return {
            count: items().length,
            shown: shown(), counter: counter(),
            region: !!one(':scope > .row > .column', items()[2]),
            indicators: indicators().map(function(each) {
                return each.getAttribute('data-ge-bs-slide-to') + ':' + each.getAttribute('aria-label');
            }).join(','),
            events: events.filter(function(each) { return /carousel-item/.test(each.name); }).map(function(each) {
                return each.name + ':' + each.kind + ':' + each.source;
            }).join(','),
        };
    `);
    t.check('AC-14 Add slide puts a slide with its region at the end and shows it, the indicators follow, and the add events fire',
        added.count === 3 && added.shown === '2' && added.counter === '3 / 3' && added.region &&
        added.indicators === '0:Slide 1,1:Slide 2,2:Slide 3' &&
        added.events === 'before-add-carousel-item:carousel-item:tool,after-add-carousel-item:carousel-item:tool', added);

    var tools = await page.eval(`
        start({ carousel_tools: [{ title: 'X', className: 'host-x' }] }, '', { slides: 3 });
        const order = Array.from(one(':scope > .ge-pane-drawer', items()[0]).children)
            .filter(function(child) { return child.tagName === 'A'; })
            .map(function(child) { return child.className.split(' ')[0]; });
        const ends = items().map(function(item) {
            return [disabled(slideTool(item, 'carousel-move-back')), disabled(slideTool(item, 'carousel-move-forward'))].join('/');
        });
        return { order: order.join(','), ends: ends.join(' ') };
    `);
    t.check('AC-15 a slide\'s drawer: back, forward, the gear, the host\'s tools and delete, with no drag handle',
        tools.order === 'ge-carousel-move-back,ge-carousel-move-forward,ge-settings,host-x,ge-delete-pane', tools);
    t.check('AC-16 back is off on the first slide, forward on the last, both on in between',
        tools.ends === 'true/false false/false false/true', tools);

    var moved = await page.eval(`
        start({}, '', { slides: 3 });
        items().forEach(function(item, index) { item.setAttribute('data-name', 'ABC'[index]); });
        slideTool(items()[0], 'carousel-move-forward').click();
        const after = {
            order: items().map(function(item) { return item.getAttribute('data-name'); }).join(''),
            shown: shown(), counter: counter(),
            indicators: indicators().map(function(each) {
                return each.getAttribute('data-ge-bs-slide-to') + (each.classList.contains('active') ? '*' : '');
            }).join(','),
            events: events.map(function(each) {
                return each.name + ':' + each.kind + ':' + each.source + ':' + (each.node.getAttribute('data-name') || '');
            }).join(','),
        };
        events.length = 0;
        grid().addEventListener('grideditor:before-move', function(e) { e.preventDefault(); }, { once: true });
        slideTool(items()[1], 'carousel-move-forward').click();
        const canceled = {
            order: items().map(function(item) { return item.getAttribute('data-name'); }).join(''),
            events: named(),
        };
        return { after: after, canceled: canceled };
    `);
    t.check('AC-17 forward moves the slide a place, it stays shown, the indicators follow, and the move events fire',
        moved.after.order === 'BAC' && moved.after.shown === '1' && moved.after.counter === '2 / 3' &&
        moved.after.indicators === '0,1*,2' &&
        moved.after.events === 'before-move:carousel-item:tool:A,after-move:carousel-item:tool:A', moved);
    t.check('AC-18 a before-move handler that cancels leaves the slides where they were, with no after-move',
        moved.canceled.order === 'BAC' && moved.canceled.events === 'before-move', moved);

    var deleted = await page.eval(`
        start({}, '', { slides: 3 });
        items().forEach(function(item, index) { item.setAttribute('data-name', 'ABC'[index]); });
        next();
        slideTool(items()[1], 'delete-pane').click();
        await wait(500);
        const middle = { names: items().map(function(item) { return item.getAttribute('data-name'); }).join(''), shown: shown(), counter: counter(), indicators: indicators().length };

        start({}, '', { slides: 3 });
        items().forEach(function(item, index) { item.setAttribute('data-name', 'ABC'[index]); });
        previous();
        slideTool(items()[2], 'delete-pane').click();
        await wait(500);
        const last = { names: items().map(function(item) { return item.getAttribute('data-name'); }).join(''), shown: shown(), counter: counter() };
        return { middle: middle, last: last };
    `);
    t.check('AC-19 deleting the slide shown shows the next one',
        deleted.middle.names === 'AC' && deleted.middle.shown === '1' && deleted.middle.counter === '2 / 2' && deleted.middle.indicators === 2, deleted);
    t.check('AC-20 deleting the last slide, shown, shows the one before it',
        deleted.last.names === 'AB' && deleted.last.shown === '1' && deleted.last.counter === '2 / 2', deleted);
}

async function panelTests(t, page) {
    var built = await page.eval(`
        start();
        const details = one(':scope > .ge-tools-drawer > .ge-details', car());
        const order = Array.from(details.children).map(function(child) { return child.getAttribute('data-ge-plugin') || child.className.split(' ')[0]; });
        const tabs = ge().createContainer('tabs', { appendTo: column() });
        const accordion = ge().createContainer('accordion', { appendTo: column() });
        return {
            order: order,
            labels: all('label', section()).map(function(label) { return label.textContent; }).join('|'),
            rides: Array.from(ride().options).map(function(each) { return each.value + ':' + each.textContent; }).join('|'),
            values: [ride().value, interval().value].concat(['controls', 'indicators', 'fade', 'dark', 'pause', 'wrap', 'keyboard', 'touch'].map(function(key) {
                return option(key).checked ? 'on' : 'off';
            })).join(','),
            disabled: [interval().disabled, option('pause').disabled].join(),
            tabs: !!section(tabs), accordion: !!section(accordion),
            row: !!one('#myGrid .row > .ge-tools-drawer [data-ge-plugin="carousel"]'),
        };
    `);
    var at = built.order.indexOf('carousel');
    t.check('AC-22 a carousel\'s gear has a Carousel section, after the general fields, with autoplay, the interval and eight checkboxes as the carousel has them',
        at > 0 && built.order.indexOf('ge-utility-section') === -1 || at < built.order.indexOf('ge-utility-section'), built);
    t.check('AC-22 its fields, labels and values',
        built.labels === 'Autoplay|Interval (s)|Arrows|Indicators|Fade|Dark theme|Pause on hover|Wrap around|Keyboard|Touch swipe' &&
        built.rides === 'false:No|carousel:On load|true:After first interaction' &&
        built.values === 'false,,on,on,off,off,on,on,on,on' && built.disabled === 'true,true', built);
    t.check('AC-23 a tabs container, an accordion and a row have no Carousel section',
        !built.tabs && !built.accordion && !built.row, built);

    var toggled = await page.eval(`
        start({}, '', { slides: 3 });
        next();
        const c = theCarousel();
        change(option('controls'), false);
        const noControls = all(':scope > .carousel-control-prev, :scope > .carousel-control-next', c).length;
        change(option('controls'), true);
        const controls = all(':scope > .carousel-control-prev, :scope > .carousel-control-next', c).map(function(button) {
            return button.getAttribute('data-bs-target') + ':' + one('.visually-hidden', button).textContent + ':' + button.getAttribute('data-ge-bs-slide');
        }).join(',');
        change(option('indicators'), false);
        const noIndicators = !one(':scope > .carousel-indicators', c);
        change(option('indicators'), true);
        const back = indicators().map(function(each) {
            return each.getAttribute('data-ge-bs-slide-to') + (each.classList.contains('active') ? '*' : '');
        }).join(',');
        const shownAfter = shown();
        change(option('fade'), true); const fade = c.classList.contains('carousel-fade');
        change(option('fade'), false); const noFade = !c.classList.contains('carousel-fade');
        change(option('dark'), true); const dark = c.getAttribute('data-bs-theme');
        change(option('dark'), false); const noDark = c.getAttribute('data-bs-theme');
        return { noControls, controls, id: '#' + c.id, noIndicators, back, shownAfter, fade, noFade, dark, noDark, slide: shown() };
    `);
    t.check('AC-24 Arrows off takes both arrows out, and on puts them back pointing at the carousel with the locale\'s texts',
        toggled.noControls === 0 && toggled.controls === toggled.id + ':Previous:prev,' + toggled.id + ':Next:next', toggled);
    t.check('AC-25 Indicators off takes them out, and on puts one a slide back, the slide shown marked, without changing it',
        toggled.noIndicators && toggled.back === '0,1*,2' && toggled.shownAfter === '1', toggled);
    t.check('AC-26 Fade on and off writes and takes carousel-fade, and the slide does not change',
        toggled.fade && toggled.noFade && toggled.slide === '1', toggled);
    t.check('AC-27 Dark theme on and off writes and takes data-bs-theme="dark"',
        toggled.dark === 'dark' && toggled.noDark === null, toggled);

    var riding = await page.eval(`
        start();
        const out = function() { return one('.carousel', exported()).getAttribute('data-bs-ride'); };
        change(interval(), '3');
        change(ride(), 'carousel'); const load = [out(), interval().disabled, option('pause').disabled].join();
        change(ride(), 'true'); const interaction = out();
        change(option('pause'), false);
        change(ride(), 'false');
        const none = [out(), interval().disabled, option('pause').disabled, theCarousel().getAttribute('data-bs-interval'), theCarousel().getAttribute('data-bs-pause')].join();
        return { load, interaction, none };
    `);
    t.check('AC-28 Autoplay writes data-bs-ride carousel, true or nothing; with No, the interval and pause turn off and stay in the markup',
        riding.load === 'carousel,false,false' && riding.interaction === 'true' && riding.none === ',true,true,3000,false', riding);

    var boundary = await page.eval(`
        start({}, '', { ride: 'carousel' });
        const c = theCarousel();
        change(interval(), '0.9'); const below = [interval().classList.contains('is-invalid'), c.getAttribute('data-bs-interval')].join();
        change(interval(), '1'); const at = [interval().classList.contains('is-invalid'), c.getAttribute('data-bs-interval')].join();
        change(interval(), '1.1'); const above = c.getAttribute('data-bs-interval');
        c.setAttribute('data-bs-interval', '3000');
        change(interval(), ''); const emptied = c.getAttribute('data-bs-interval');
        return { below, at, above, emptied };
    `);
    t.check('AC-29 an interval of 0.9 s is refused: nothing written, the field marked invalid', boundary.below === 'true,', boundary);
    t.check('AC-30 an interval of 1 s writes 1000', boundary.at === 'false,1000', boundary);
    t.check('AC-31 an interval of 1.1 s writes 1100', boundary.above === '1100', boundary);
    t.check('AC-32 an empty interval takes data-bs-interval off', boundary.emptied === null, boundary);

    var behaviours = await page.eval(`
        start();
        const c = theCarousel();
        ['pause', 'wrap', 'keyboard', 'touch'].forEach(function(key) { change(option(key), false); });
        const off = ['pause', 'wrap', 'keyboard', 'touch'].map(function(key) { return c.getAttribute('data-bs-' + key); }).join();
        ['pause', 'wrap', 'keyboard', 'touch'].forEach(function(key) { change(option(key), true); });
        const on = ['pause', 'wrap', 'keyboard', 'touch'].map(function(key) { return c.getAttribute('data-bs-' + key); }).join();
        return { off, on, events: events.filter(function(each) { return each.name !== 'after-utility'; }).length };
    `);
    t.check('AC-33 pause, wrap, keyboard and touch off write "false", and on take it away',
        behaviours.off === 'false,false,false,false' && behaviours.on === ',,,', behaviours);
    t.check('AC-52 changing the options in the panel fires no event', behaviours.events === 0, behaviours);

    var slide = await page.eval(`
        start({ settings_panel: 'offcanvas' });
        const item = items()[0];
        const fields = section(one(':scope > .ge-pane-drawer', item) ? item : item);
        const slideSection = one(':scope > .ge-pane-drawer > .ge-details [data-ge-plugin="carousel"]', item);
        const field = one('input[type="number"]', slideSection);
        const empty = field.value;
        const label = one('label', slideSection).textContent;
        const steps = [];
        ['0.9', '1', '2', ''].forEach(function(value) {
            change(field, value);
            steps.push(field.classList.contains('is-invalid') + ':' + item.getAttribute('data-bs-interval'));
        });
        slideTool(item, 'settings').click();
        await wait(600);
        const title = all('body > .ge-settings-panel .ge-settings-title').map(function(each) { return each.textContent; }).join('|');
        const heading = all('body > .ge-settings-panel .ge-section-title').map(function(each) { return each.textContent; });
        return { empty, label, steps: steps.join(','), title, heading, kind: (function() {
            let kind = null;
            grid().addEventListener('grideditor:before-delete', function(e) { kind = e.detail.kind; e.preventDefault(); }, { once: true });
            slideTool(item, 'delete-pane').click();
            return kind;
        })() };
    `);
    t.check('AC-34 a slide\'s panel is titled Slide, with a Slide section and an empty interval',
        /Slide/.test(slide.title) && slide.heading.indexOf('Slide') !== -1 && slide.label === 'Interval (s)' && slide.empty === '', slide);
    t.check('AC-35 a slide\'s interval: 0.9 refused, 1 and 2 written in ms on the slide, empty takes it off',
        slide.steps === 'true:null,false:1000,false:2000,false:null', slide);
    t.check('AC-51 a slide is a carousel-item to the events, and Slide in its panel',
        slide.kind === 'carousel-item' && /^Slide/.test(slide.title), slide);
}

async function markupTests(t, page) {
    var hand = await page.eval(`
        start({}, '<div data-ge-container="carousel"><div class="carousel slide carousel-fade" id="hand" data-bs-theme="dark" data-bs-ride="true" data-bs-interval="3000" data-bs-pause="false">' +
            '<div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div></div></div></div>');
        return {
            values: [ride().value, interval().value].concat(['controls', 'indicators', 'fade', 'dark', 'pause', 'wrap', 'keyboard', 'touch'].map(function(key) {
                return option(key).checked ? 'on' : 'off';
            })).join(','),
        };
    `);
    t.check('AC-36 a carousel written by hand shows its options in the panel',
        hand.values === 'true,3,off,off,on,on,off,on,on,on', hand);

    var noInterval = await page.eval(`
        start({}, '<div data-ge-container="carousel"><div class="carousel slide" id="never" data-bs-interval="false">' +
            '<div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div></div></div></div>');
        return { field: interval().value, out: one('.carousel', exported()).getAttribute('data-bs-interval') };
    `);
    t.check('AC-37 data-bs-interval="false" shows an empty interval and goes out as it came',
        noInterval.field === '' && noInterval.out === 'false', noInterval);

    var noId = await page.eval(`
        start({}, '<div data-ge-container="carousel"><div class="carousel slide">' +
            '<div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div></div></div></div>');
        change(option('controls'), true);
        const c = theCarousel();
        return { id: c.id, targets: all('[data-bs-target]', c).map(function(each) { return each.getAttribute('data-bs-target'); }).join(',') };
    `);
    t.check('AC-38 a carousel with no id gets one when the arrows are written, and they point at it',
        /^ge-carousel-/.test(noId.id) && noId.targets === '#' + noId.id + ',#' + noId.id, noId);

    var starting = await page.eval(`
        const slides = function(active) {
            return [0, 1, 2].map(function(index) {
                return '<div class="carousel-item' + (index === active ? ' active' : '') + '"><div class="row"><div class="column col-12"></div></div></div>';
            }).join('');
        };
        start({}, '<div data-ge-container="carousel"><div class="carousel slide" id="third"><div class="carousel-inner">' + slides(2) + '</div></div></div>' +
            '<div data-ge-container="carousel"><div class="carousel slide" id="none"><div class="carousel-inner">' + slides(-1) + '</div></div></div>');
        return { third: [counter(carousels()[0]), shown(carousels()[0])].join(), none: [counter(carousels()[1]), shown(carousels()[1])].join() };
    `);
    t.check('AC-39 the canvas starts on the slide the markup made active, or on the first when none is',
        starting.third === '3 / 3,2' && starting.none === '1 / 3,0', starting);

    var broken = await page.eval(`
        const markup = '<div data-ge-container="carousel"><div class="something">kept</div></div>';
        start({}, markup);
        const result = {
            drawer: !!drawer(),
            navigation: !!one('.ge-carousel-counter, .ge-carousel-next', car()),
            section: !!section(),
            kept: ge().getHtml().indexOf(markup) !== -1,
        };
        tool('add-pane').click();
        result.warned = warnings.filter(function(each) { return /carousel/.test(each); }).length;
        return result;
    `);
    t.check('AC-40 a carousel container with no .carousel-inner keeps its drawer, has no navigation and no section, and goes out as it came',
        broken.drawer && !broken.navigation && !broken.section && broken.kept && broken.warned === 1, broken);
}

async function optionTests(t, page) {
    var api = await page.eval(`
        start({}, '', { slides: 3, controls: false, indicators: true, fade: true, dark: true, ride: 'carousel', interval: 3000,
            pause: false, wrap: false, keyboard: false, touch: false });
        const out = one('.carousel', exported());
        return {
            count: all('.carousel-item', out).length,
            controls: all('.carousel-control-prev, .carousel-control-next', out).length,
            indicators: all('.carousel-indicators > button', out).length,
            attrs: attributes(out).replace(/ id=\\S+/, ''),
            warnings: warnings.length,
        };
    `);
    t.check('AC-41 createContainer writes every option it is given',
        api.count === 3 && api.controls === 0 && api.indicators === 3 && api.warnings === 0 &&
        api.attrs === 'class=carousel slide carousel-fade data-bs-interval=3000 data-bs-keyboard=false data-bs-pause=false data-bs-ride=carousel data-bs-theme=dark data-bs-touch=false data-bs-wrap=false', api);

    var setting = await page.eval(`
        start({ carousel: { fade: true, ride: 'carousel' } }, '', false);
        one('.ge-addContainerGroup [data-ge-container-type="carousel"]').click();
        const fromToolbar = car();
        const fromApi = ge().createContainer('carousel', { fade: false, appendTo: column() });
        const describe = function(c) {
            const out = theCarousel(c);
            return out.classList.contains('carousel-fade') + ':' + out.getAttribute('data-ge-bs-ride');
        };
        return { toolbar: describe(fromToolbar), api: describe(fromApi) };
    `);
    t.check('AC-42 the carousel setting is the default for new ones, and an option given wins',
        setting.toolbar === 'true:carousel' && setting.api === 'false:carousel', setting);

    var existing = await page.eval(`
        start({ carousel: { fade: true } }, '<div data-ge-container="carousel"><div class="carousel slide" id="plain"><div class="carousel-inner"><div class="carousel-item active"><div class="row"><div class="column col-12"></div></div></div></div></div></div>');
        return { fade: theCarousel().classList.contains('carousel-fade') };
    `);
    t.check('AC-43 the setting does not change the carousels already there', !existing.fade, existing);

    var intervals = await page.eval(`
        const make = function(value) {
            start({}, '', { interval: value });
            return [theCarousel().getAttribute('data-bs-interval'), warnings.filter(function(each) { return /interval/.test(each); }).length].join(':');
        };
        return { below: make(999), at: make(1000), above: make(1001) };
    `);
    t.check('AC-44 interval 999 warns and writes nothing; 1000 and 1001 are written without a warning',
        intervals.below === ':1' && intervals.at === '1000:0' && intervals.above === '1001:0', intervals);

    var slides = await page.eval(`
        const make = function(value) {
            start({}, '', { slides: value });
            return [items().length, warnings.filter(function(each) { return /slides/.test(each); }).length].join(':');
        };
        return { zero: make(0), one: make(1), half: make(2.5) };
    `);
    t.check('AC-45 slides 0 and 2.5 warn and make 2; 1 makes 1 without a warning',
        slides.zero === '2:1' && slides.one === '1:0' && slides.half === '2:1', slides);

    var invalid = await page.eval(`
        start({}, '', { ride: 'always' });
        const ride = { warnings: warnings.slice(), attr: theCarousel().getAttribute('data-ge-bs-ride') };
        start({ carousel: { dark: 'yes' } });
        const dark = { warnings: warnings.slice(), attr: theCarousel().getAttribute('data-bs-theme') };
        return { ride, dark };
    `);
    t.check('AC-46 a value an option does not take warns, naming the option and what it takes, and its default is used',
        invalid.ride.warnings.length === 1 && /"always" is not a ride, which takes \[false,"carousel","true"\]/.test(invalid.ride.warnings[0]) && invalid.ride.attr === null &&
        invalid.dark.warnings.length === 1 && /"yes" is not a dark, which takes \[true,false\]/.test(invalid.dark.warnings[0]) && invalid.dark.attr === null, invalid);

    var added = await page.eval(`
        start({}, '', { slides: 2 });
        const slide = ge().addPane(car(), { interval: 6000 });
        return {
            returned: slide === items()[2], interval: slide.getAttribute('data-bs-interval'),
            indicators: indicators().length,
            events: events.filter(function(each) { return /carousel-item/.test(each.name); }).map(function(each) { return each.name + ':' + each.source; }).join(','),
        };
    `);
    t.check('AC-47 addPane on a carousel adds a slide with its interval at the end, and returns it',
        added.returned && added.interval === '6000' && added.indicators === 3 &&
        added.events === 'before-add-carousel-item:api,after-add-carousel-item:api', added);
}

async function integrationTests(t, page) {
    var pasted = await page.eval(`
        start({}, '', { slides: 2 });
        tool('copy').click();
        one('#myGrid .column > .ge-tools-drawer > .ge-paste').click();
        const ids = carousels().map(function(c) { return theCarousel(c).id; });
        const pointsHome = carousels().map(function(c) {
            const id = theCarousel(c).id;
            return all('[data-bs-target]', c).every(function(each) { return each.getAttribute('data-bs-target') === '#' + id; });
        });
        return { count: carousels().length, ids: ids, pointsHome: pointsHome };
    `);
    t.check('AC-53 a carousel pasted has an id of its own, and its arrows and indicators point at it',
        pasted.count === 2 && pasted.ids[0] !== pasted.ids[1] && pasted.pointsHome.every(Boolean), pasted);

    var nested = await page.eval(`
        start({}, '', false);
        const tabs = ge().createContainer('tabs', { tabs: 2, appendTo: column() });
        const outer = ge().createContainer('carousel', { slides: 2, appendTo: one('.tab-pane.active > .row > .column', tabs) });
        const inner = ge().createContainer('tabs', { tabs: 2, appendTo: one('.column', items(outer)[0]) });
        next(outer);
        const tabsShown = all(':scope > .tab-content > .tab-pane', tabs).map(function(pane) { return pane.classList.contains('active'); }).join();
        previous(outer);
        all('.nav-link', inner)[1].click();
        await wait(400);
        const innerShown = all(':scope > .tab-content > .tab-pane', inner).map(function(pane) { return pane.classList.contains('active'); }).join();
        const html = ge().getHtml();
        return { outer: counter(outer), tabsShown, innerShown, clean: !/class="[^"]*\\bge-|data-ge-bs/.test(html) };
    `);
    t.check('AC-54 a carousel inside a tab moves without changing the tab, the tabs in its slide still switch, and the markup is clean',
        nested.tabsShown === 'true,false' && nested.innerShown === 'false,true' && nested.clean, nested);

    var twice = await page.eval(`
        start({}, '', { slides: 2 });
        const inner = ge().createContainer('carousel', { slides: 2, appendTo: one('.column', items()[0]) });
        next(inner);
        return { outer: counter(car()), inner: counter(inner) };
    `);
    t.check('AC-55 in a carousel inside another, the inner one\'s arrows move only the inner one',
        twice.outer === '1 / 2' && twice.inner === '2 / 2', twice);

    var styled = await page.eval(`
        start({ plugins: window.fixture.plugins(['carousel', 'inline-style']), settings_panel: 'offcanvas' });
        return { style: !!one(':scope > .ge-pane-drawer > .ge-details [data-ge-plugin="inline-style"]', items()[0]) };
    `);
    t.check('AC-56 with the inline-style plugin, a slide\'s gear has the Style section', styled.style, styled);

    var spanish = await page.eval(`
        await new Promise(function(resolve) {
            const script = document.createElement('script');
            script.src = '/dist/locales/grideditor.es.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
        start({ locale: 'es' });
        const out = exported();
        return {
            button: one('.ge-addContainerGroup [data-ge-container-type="carousel"]').textContent.trim(),
            add: tool('add-pane').getAttribute('title'),
            heading: section().closest('.ge-panel-section') ? all('label', section()).map(function(each) { return each.textContent; }).slice(0, 3).join('|') : '',
            hidden: all('.visually-hidden', out).map(function(each) { return each.textContent; }).join(','),
            label: one('.carousel-indicators > button', out).getAttribute('aria-label'),
            slide: one(':scope > .ge-pane-drawer > .ge-details [data-ge-plugin="carousel"] label', items()[0]).textContent,
        };
    `);
    t.check('AC-57 in Spanish: the toolbar, the drawer, the sections and the arrows\' and indicators\' texts in the page',
        /Carrusel/.test(spanish.button) && spanish.add === 'Añadir diapositiva' &&
        spanish.heading === 'Autoplay|Intervalo (s)|Flechas' && spanish.hidden === 'Anterior,Siguiente' &&
        spanish.label === 'Diapositiva 1' && spanish.slide === 'Intervalo (s)', spanish);
}

module.exports = {
    name: 'carousel',
    description: 'the carousel plugin: slides, navigation, options and markup',
    run: async function(t) {
        var page = await start(t);

        await creationTests(t, page);
        await navigationTests(t, page);
        await bootstrapTests(t, page);
        await htmlTests(t, page);
        await slideTests(t, page);
        await panelTests(t, page);
        await markupTests(t, page);
        await optionTests(t, page);
        await integrationTests(t, page);
        await sleep(0);

        var errors = page.errors();
        t.check('the carousel tests logged no errors', errors.length === 0, errors.slice(0, 5));
    },
};

if (require.main === module) {
    require('./run').main(['carousel']);
}
