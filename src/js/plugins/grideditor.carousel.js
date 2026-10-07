/**
 * Carousels for grid-editor.
 *
 * A container plugin: load this file after the editor and the toolbar offers
 * a carousel, a bootstrap carousel whose slides are editable regions. What it
 * can ask the editor for is the handle its factory is called with, described
 * in docs/plugins.md.
 *
 *   <script src="dist/grideditor.min.js"></script>
 *   <script src="dist/plugins/grideditor.carousel.min.js"></script>
 *
 * Only one slide shows on the canvas, as on the page. The container's drawer
 * says which, and moves to the next and the previous; Bootstrap's own arrows
 * are kept in the markup but not drawn, its indicators are drawn but do not
 * answer, and neither does its javascript:
 * the attributes it acts on are put aside while editing. A carousel's options
 * - arrows, indicators, fade, dark theme, autoplay and its interval, pause,
 * wrap, keyboard and touch - are Bootstrap's classes and attributes and
 * nothing else: they are read from the markup, chosen in the container's
 * settings panel, or given to createContainer and the carousel setting for
 * the ones made new.
 */
import { GridEditor } from '../grideditor.js';
import * as dom from '../dom.js';

Object.assign(GridEditor.locales.en, {
    'container.add_carousel': 'Carousel',
    'container.add_carousel_item': 'Add slide',
    'confirm.delete_carousel_item': 'Delete this slide and everything in it?',
    'panel.kind_carousel_item': 'Slide',
    'container.carousel_previous': 'Previous',
    'container.carousel_next': 'Next',
    'container.carousel_slide_label': 'Slide {number}',
    'container.carousel_counter': '{current} / {total}',
    'tool.carousel_show_previous': 'Previous slide',
    'tool.carousel_show_next': 'Next slide',
    'tool.carousel_move_back': 'Move back',
    'tool.carousel_move_forward': 'Move forward',
    'container.carousel_section': 'Carousel',
    'container.carousel_controls': 'Arrows',
    'container.carousel_indicators': 'Indicators',
    'container.carousel_fade': 'Fade',
    'container.carousel_dark': 'Dark theme',
    'container.carousel_ride': 'Autoplay',
    'container.carousel_ride_no': 'No',
    'container.carousel_ride_load': 'On load',
    'container.carousel_ride_interaction': 'After first interaction',
    'container.carousel_interval': 'Interval (s)',
    'container.carousel_pause': 'Pause on hover',
    'container.carousel_wrap': 'Wrap around',
    'container.carousel_keyboard': 'Keyboard',
    'container.carousel_touch': 'Touch swipe',
    'container.carousel_item_section': 'Slide',
});

/** What a carousel made new has when neither the call nor the setting says. */
var DEFAULTS = {
    controls: true,
    indicators: true,
    fade: false,
    dark: false,
    ride: false,
    interval: null,
    pause: true,
    wrap: true,
    keyboard: true,
    touch: true,
    slides: 2,
};

var CHECKBOXES = ['controls', 'indicators', 'fade', 'dark'];
var BEHAVIOURS = ['pause', 'wrap', 'keyboard', 'touch'];

/** Each option's checkbox in the panel, and its label. */
var LABELS = {
    controls: { labelKey: 'container.carousel_controls' },
    indicators: { labelKey: 'container.carousel_indicators' },
    fade: { labelKey: 'container.carousel_fade' },
    dark: { labelKey: 'container.carousel_dark' },
    pause: { labelKey: 'container.carousel_pause' },
    wrap: { labelKey: 'container.carousel_wrap' },
    keyboard: { labelKey: 'container.carousel_keyboard' },
    touch: { labelKey: 'container.carousel_touch' },
};
var RIDE_LABEL = { labelKey: 'container.carousel_ride' };
var INTERVAL_LABEL = { labelKey: 'container.carousel_interval' };
var RIDES = [false, 'carousel', 'true'];
var MIN_INTERVAL = 1000; // ms

/** What Bootstrap puts on a slide while it moves one in: never part of the page. */
var TRANSITION = 'carousel-item-next carousel-item-prev carousel-item-start carousel-item-end';

function validInterval(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= MIN_INTERVAL;
}

var CHECKS = {
    ride: function(value) { return RIDES.indexOf(value) !== -1; },
    interval: function(value) { return value === null || validInterval(value); },
    slides: function(value) { return typeof value === 'number' && Math.floor(value) === value && value >= 1; },
};

/** The values an option takes, as the warning lists them. */
function takes(key) {
    if (key === 'ride') { return JSON.stringify(RIDES); }
    if (key === 'interval') { return 'null or an integer of ' + MIN_INTERVAL + ' or more'; }
    if (key === 'slides') { return 'an integer of 1 or more'; }

    return '[true,false]';
}

function isValid(key, value) {
    return CHECKS[key] ? CHECKS[key](value) : typeof value === 'boolean';
}

var fieldCounter = 0;

GridEditor.containers.carousel = function(ge) {

    var shown = new WeakMap(); // The slide each carousel shows, whatever its markup says
    var sections = []; // { node, element, render } for every panel section built

    function carouselOf(container) {
        return dom.child(container, '.carousel');
    }

    function innerOf(container) {
        return dom.child(carouselOf(container), '.carousel-inner');
    }

    /** A container with no carousel or no slides' holder is left as it is. */
    function usable(container) {
        return !!innerOf(container);
    }

    function itemsOf(container) {
        return dom.children(innerOf(container), '.carousel-item');
    }

    /** The carousel's id, which its arrows and indicators point at. */
    function idOf(carousel) {
        if (!carousel.getAttribute('id')) { carousel.setAttribute('id', ge.containerId('carousel')); }

        return carousel.getAttribute('id');
    }

    /** A Bootstrap attribute, whether it is where Bootstrap reads it or put aside for editing. */
    function bsAttribute(node, name) {
        var value = node.getAttribute('data-bs-' + name);

        return value === null ? node.getAttribute('data-ge-bs-' + name) : value;
    }

    function intervalOf(node) {
        var value = parseInt(node.getAttribute('data-bs-interval'), 10);

        return isFinite(value) && value > 0 ? value : null;
    }

    function writeInterval(node, value) {
        if (value === null) {
            node.removeAttribute('data-bs-interval');
        } else {
            node.setAttribute('data-bs-interval', String(value));
        }
    }

    /** What a carousel's classes and attributes say it is. */
    function read(container) {
        var carousel = carouselOf(container);
        var ride = bsAttribute(carousel, 'ride');
        var off = function(name) { return carousel.getAttribute('data-bs-' + name) !== 'false'; };

        return {
            controls: !!dom.child(carousel, '.carousel-control-prev, .carousel-control-next'),
            indicators: !!dom.child(carousel, '.carousel-indicators'),
            fade: dom.hasClass(carousel, 'carousel-fade'),
            dark: carousel.getAttribute('data-bs-theme') === 'dark',
            ride: ride === 'carousel' || ride === 'true' ? ride : false,
            interval: intervalOf(carousel),
            pause: off('pause'),
            wrap: off('wrap'),
            keyboard: off('keyboard'),
            touch: off('touch'),
        };
    }

    function controlButton(carousel, direction) {
        var button = dom.element('button', {
            'class': 'carousel-control-' + direction,
            type: 'button',
            'data-bs-target': '#' + idOf(carousel),
            'data-bs-slide': direction,
        });

        button.appendChild(dom.element('span', { 'class': 'carousel-control-' + direction + '-icon', 'aria-hidden': 'true' }));
        button.appendChild(dom.element('span', { 'class': 'visually-hidden' },
            direction === 'prev' ? ge.t('container.carousel_previous') : ge.t('container.carousel_next')));

        return button;
    }

    function setControls(container, on) {
        var carousel = carouselOf(container);

        dom.children(carousel, '.carousel-control-prev, .carousel-control-next').forEach(function(button) { button.remove(); });

        if (on) {
            carousel.appendChild(controlButton(carousel, 'prev'));
            carousel.appendChild(controlButton(carousel, 'next'));
        }
    }

    function setIndicators(container, on) {
        var carousel = carouselOf(container);
        var bar = dom.child(carousel, '.carousel-indicators');

        if (!on) {
            if (bar) { bar.remove(); }
            return;
        }

        if (!bar) {
            bar = carousel.insertBefore(dom.element('div', { 'class': 'carousel-indicators' }), carousel.firstChild);
        }

        rebuildIndicators(container);
    }

    /** One indicator a slide, in the slides' order, the shown one marked. */
    function rebuildIndicators(container, list) {
        var carousel = carouselOf(container);
        var bar = dom.child(carousel, '.carousel-indicators');
        if (!bar) { return; }

        list = list || itemsOf(container);
        var id = idOf(carousel);
        var active = 0;

        list.forEach(function(item, index) {
            if (dom.hasClass(item, 'active')) { active = index; }
        });

        bar.textContent = '';
        list.forEach(function(item, index) {
            bar.appendChild(dom.element('button', {
                type: 'button',
                'data-bs-target': '#' + id,
                'data-bs-slide-to': String(index),
                'aria-label': ge.t('container.carousel_slide_label', { number: index + 1 }),
            }));
        });

        syncIndicators(container, list.length ? active : -1);
    }

    function syncIndicators(container, index) {
        var bar = dom.child(carouselOf(container), '.carousel-indicators');

        dom.children(bar).forEach(function(indicator, position) {
            dom.toggleClass(indicator, 'active', position === index);

            if (position === index) {
                indicator.setAttribute('aria-current', 'true');
            } else {
                indicator.removeAttribute('aria-current');
            }
        });
    }

    function write(container, key, value) {
        var carousel = carouselOf(container);

        if (key === 'controls') { setControls(container, value); }
        if (key === 'indicators') { setIndicators(container, value); }
        if (key === 'fade') { dom.toggleClass(carousel, 'carousel-fade', value); }

        if (key === 'dark') {
            if (value) {
                carousel.setAttribute('data-bs-theme', 'dark');
            } else if (carousel.getAttribute('data-bs-theme') === 'dark') {
                carousel.removeAttribute('data-bs-theme');
            }
        }

        if (key === 'ride') {
            carousel.removeAttribute('data-bs-ride');
            carousel.removeAttribute('data-ge-bs-ride');
            if (value) { carousel.setAttribute('data-bs-ride', value); }
        }

        if (key === 'interval') { writeInterval(carousel, value); }

        if (BEHAVIOURS.indexOf(key) !== -1) {
            if (value) {
                carousel.removeAttribute('data-bs-' + key);
            } else {
                carousel.setAttribute('data-bs-' + key, 'false');
            }
        }

        dom.dropEmptyClass(carousel);
    }

    /**
     * A value for a new carousel: the option, or the carousel setting, or the
     * default. One the option does not take is warned about and the default used.
     */
    function chosen(options, key) {
        var setting = ge.settings.carousel || {};
        var value = options[key] !== undefined ? options[key] : setting[key];

        if (value === undefined) { return DEFAULTS[key]; }
        if (isValid(key, value)) { return value; }

        ge.warn('carousel: ' + JSON.stringify(value) + ' is not a ' + key + ', which takes ' +
            takes(key) + ': ' + JSON.stringify(DEFAULTS[key]) + ' is used');
        return DEFAULTS[key];
    }

    /** What stops Bootstrap's javascript acting on the carousel while it is edited. */
    function suspend(container) {
        var carousel = carouselOf(container);

        dom.children(carousel, '.carousel-control-prev, .carousel-control-next').forEach(ge.suspendToggles);
        dom.children(dom.child(carousel, '.carousel-indicators')).forEach(ge.suspendToggles);

        // By hand: suspendToggles(carousel) would take a tabs or an accordion
        // inside a slide off its toggles as well
        var ride = carousel.getAttribute('data-bs-ride');
        if (ride !== null) {
            carousel.setAttribute('data-ge-bs-ride', ride);
            carousel.removeAttribute('data-bs-ride');
        }
    }

    /** A carousel Bootstrap started before the editor did stops, and is forgotten. */
    function stopBootstrap(carousel) {
        var library = GridEditor.bootstrap || window.bootstrap;
        var instance = library && library.Carousel ? library.Carousel.getInstance(carousel) : null;

        if (instance) {
            instance.pause();
            instance.dispose();
        }
    }

    function buildItem(container, active, interval) {
        var item = innerOf(container).appendChild(dom.element('div', { 'class': active ? 'carousel-item active' : 'carousel-item' }));

        item.appendChild(ge.defaultRegion());
        if (interval !== null && interval !== undefined) { writeInterval(item, interval); }

        return item;
    }

    /** The slide the carousel shows: the one it was left on, or the markup's, or the first. */
    function currentOf(container) {
        var list = itemsOf(container);
        var kept = shown.get(container);

        if (kept && list.indexOf(kept) !== -1) { return kept; }

        return list.filter(function(item) { return dom.hasClass(item, 'active'); })[0] || list[0] || null;
    }

    /** Show one slide and only that one. */
    function show(container, item, list) {
        list = list || itemsOf(container);

        list.forEach(function(each) { dom.toggleClass(each, 'active', each === item); });

        if (item) {
            shown.set(container, item);
        } else {
            shown.delete(container);
        }

        syncIndicators(container, list.indexOf(item));
        refreshNavigation(container);
    }

    function step(container, offset) {
        var list = itemsOf(container);
        if (list.length < 2) { return; }

        var index = list.indexOf(currentOf(container));
        show(container, list[(index + offset + list.length) % list.length]);
    }

    function disable(tool, state) {
        if (!tool) { return; }

        dom.toggleClass(tool, 'disabled', state);

        if (state) {
            tool.setAttribute('aria-disabled', 'true');
        } else {
            tool.removeAttribute('aria-disabled');
        }
    }

    function disabled(tool) {
        return tool.getAttribute('aria-disabled') === 'true';
    }

    /** The container's counter and arrows, and every slide's move tools, as the slides stand. */
    function refreshNavigation(container) {
        var list = itemsOf(container);
        var drawer = dom.child(container, '.ge-container-drawer');
        var index = list.indexOf(currentOf(container));

        if (drawer) {
            var counter = dom.child(drawer, '.ge-carousel-counter');

            if (counter) {
                counter.textContent = ge.t('container.carousel_counter', {
                    current: list.length ? index + 1 : 0,
                    total: list.length,
                });
            }

            disable(dom.child(drawer, '.ge-carousel-previous'), list.length < 2);
            disable(dom.child(drawer, '.ge-carousel-next'), list.length < 2);
        }

        list.forEach(function(item, position) {
            var tools = dom.child(item, '.ge-pane-drawer');

            disable(dom.child(tools, '.ge-carousel-move-back'), position === 0);
            disable(dom.child(tools, '.ge-carousel-move-forward'), position === list.length - 1);
        });
    }

    function moveItem(container, item, offset) {
        var inner = innerOf(container);
        var list = itemsOf(container);
        var index = list.indexOf(item);
        var target = index + offset;

        if (target < 0 || target >= list.length) { return; }

        var from = { parent: inner, index: index };

        ge.operate(function() {
            if (!ge.emit('before-move', ge.payloadFor('carousel-item', item, {
                parent: inner,
                source: 'tool',
                from: from,
            }))) { return; }

            inner.insertBefore(item, offset < 0 ? list[target] : list[target].nextSibling);
            show(container, currentOf(container));
            rebuildIndicators(container);
            suspend(container);

            ge.emit('after-move', ge.payloadFor('carousel-item', item, {
                parent: inner,
                source: 'tool',
                from: from,
                to: { parent: inner, index: target },
                container: container,
            }));
        });
    }

    /** What the slide to show is once `item` goes: the next one, or the previous if it was the last. */
    function afterRemoving(container, item, removed) {
        dom.fadeOut(item, 200, function() {
            var list = itemsOf(container);
            var rest = list.filter(function(each) { return each !== item; });

            if (currentOf(container) === item) {
                show(container, rest[Math.min(list.indexOf(item), rest.length - 1)] || null, rest);
            }

            rebuildIndicators(container, rest);
            removed();
        });
    }

    function createItemControls(container, item) {
        var drawer = ge.createPaneControls(item, 'carousel-item', ge.settings.carousel_tools,
            ge.t('confirm.delete_carousel_item'), function(removed) {
                afterRemoving(container, item, removed);
            });

        // A slide moves a place at a time, not by dragging
        var handle = dom.child(drawer, '.ge-move');
        if (handle) { handle.remove(); }

        var back = ge.createTool(drawer, ge.t('tool.carousel_move_back'), 'ge-carousel-move-back', 'bi bi-arrow-left', function() {
            if (!disabled(this)) { moveItem(container, item, -1); }
        });
        var forward = ge.createTool(drawer, ge.t('tool.carousel_move_forward'), 'ge-carousel-move-forward', 'bi bi-arrow-right', function() {
            if (!disabled(this)) { moveItem(container, item, 1); }
        });

        drawer.insertBefore(forward, drawer.firstChild);
        drawer.insertBefore(back, forward);
    }

    function addSlideTo(container, options) {
        options = options || {};

        if (!usable(container)) {
            ge.warn('carousel: there is no .carousel-inner to add a slide to');
            return null;
        }

        var interval = null;

        if (options.interval !== undefined && options.interval !== null) {
            if (validInterval(options.interval)) {
                interval = options.interval;
            } else {
                ge.warn('carousel: ' + JSON.stringify(options.interval) + ' is not a interval, which takes ' +
                    takes('interval') + ': null is used');
            }
        }

        var item = buildItem(container, false, interval);

        show(container, item);
        rebuildIndicators(container);

        return item;
    }

    function field(labelKey, control, id) {
        var box = dom.element('div', { 'class': 'ge-carousel-option mb-2' });

        box.appendChild(dom.element('label', { 'class': 'form-label', 'for': id }, ge.t(labelKey)));
        box.appendChild(control);

        return box;
    }

    function nextId() {
        return 'ge-carousel-option-' + (++fieldCounter);
    }

    /**
     * The interval in seconds, for a node: empty takes it off, under a
     * second is refused and the field says so, and anything else is written
     * in milliseconds.
     */
    function intervalField(node, onWrite) {
        var id = nextId();
        var input = dom.element('input', {
            'class': 'form-control form-control-sm',
            id: id,
            type: 'number',
            step: '0.1',
            min: String(MIN_INTERVAL / 1000),
        });

        input.addEventListener('change', function() {
            var text = input.value.trim();
            var seconds = parseFloat(text);

            if (text === '') {
                dom.removeClass(input, 'is-invalid');
                writeInterval(node, null);
            } else if (!isFinite(seconds) || Math.round(seconds * 1000) < MIN_INTERVAL) {
                dom.addClass(input, 'is-invalid');
                return;
            } else {
                dom.removeClass(input, 'is-invalid');
                writeInterval(node, Math.round(seconds * 1000));
            }

            if (onWrite) { onWrite(); }
        });

        return {
            id: id,
            input: input,
            render: function() {
                var interval = intervalOf(node);

                dom.removeClass(input, 'is-invalid');
                input.value = interval === null ? '' : String(interval / 1000);
            },
        };
    }

    function checkbox(labelKey, onChange) {
        var id = nextId();
        var box = dom.element('div', { 'class': 'form-check' });
        var input = box.appendChild(dom.element('input', { 'class': 'form-check-input', type: 'checkbox', id: id }));

        box.appendChild(dom.element('label', { 'class': 'form-check-label', 'for': id }, ge.t(labelKey)));
        input.addEventListener('change', function() { onChange(input.checked); });

        return { box: box, input: input };
    }

    /** The Carousel section of a carousel's settings panel. */
    function createSection(container) {
        var body = dom.element('div', { 'class': 'ge-carousel-options' });
        var inputs = {};

        function change(key, value) {
            write(container, key, value);
            suspend(container);
            render();
        }

        var rideId = nextId();
        var ride = dom.element('select', { 'class': 'form-select form-select-sm', id: rideId });

        [
            { value: 'false', labelKey: 'container.carousel_ride_no' },
            { value: 'carousel', labelKey: 'container.carousel_ride_load' },
            { value: 'true', labelKey: 'container.carousel_ride_interaction' },
        ].forEach(function(choice) {
            ride.appendChild(dom.element('option', { value: choice.value }, ge.t(choice.labelKey)));
        });
        ride.addEventListener('change', function() { change('ride', ride.value === 'false' ? false : ride.value); });
        body.appendChild(field(RIDE_LABEL.labelKey, ride, rideId));

        var interval = intervalField(carouselOf(container), function() { render(); });
        body.appendChild(field(INTERVAL_LABEL.labelKey, interval.input, interval.id));

        CHECKBOXES.concat(BEHAVIOURS).forEach(function(key) {
            var each = checkbox(LABELS[key].labelKey, function(on) { change(key, on); });

            inputs[key] = each.input;
            each.box.setAttribute('data-ge-carousel-option', key);
            body.appendChild(each.box);
        });

        /** Fill the fields from the markup, and turn off what autoplay being off leaves without use. */
        function render() {
            var values = read(container);

            ride.value = String(values.ride);
            interval.render();
            Object.keys(inputs).forEach(function(key) { inputs[key].checked = values[key]; });

            interval.input.disabled = values.ride === false;
            inputs.pause.disabled = values.ride === false;
        }

        render();
        sections.push({ node: container, element: body, render: render });

        return body;
    }

    /** The Slide section of a slide's settings panel. */
    function createItemSection(item) {
        var body = dom.element('div', { 'class': 'ge-carousel-options' });
        var interval = intervalField(item);

        body.appendChild(field(INTERVAL_LABEL.labelKey, interval.input, interval.id));
        interval.render();
        sections.push({ node: item, element: body, render: interval.render });

        return body;
    }

    return {
        labelKey: 'container.add_carousel',
        addPaneKey: 'container.add_carousel_item',
        paneKind: 'carousel-item',
        paneClass: 'ge-carousel-item',
        paneLabelKey: 'panel.kind_carousel_item',

        /**
         * `slides` slides, each a region, and the options of DEFAULTS as the
         * call, the carousel setting or the defaults give them.
         */
        create: function(options) {
            options = options || {};

            var container = dom.element('div', { 'data-ge-container': 'carousel' });
            var carousel = container.appendChild(dom.element('div', { 'class': 'carousel slide', id: ge.containerId('carousel') }));
            var slides = chosen(options, 'slides');

            carousel.appendChild(dom.element('div', { 'class': 'carousel-inner' }));

            for (var i = 0; i < slides; i++) {
                buildItem(container, i === 0);
            }

            Object.keys(DEFAULTS).filter(function(key) { return key !== 'slides'; }).forEach(function(key) {
                write(container, key, chosen(options, key));
            });

            return container;
        },

        addPane: addSlideTo,

        mark: function(container) {
            var carousel = carouselOf(container);
            if (!carousel || !usable(container)) { return; }

            stopBootstrap(carousel);
            suspend(container);

            var current = currentOf(container);

            itemsOf(container).forEach(function(item) {
                dom.addClass(item, 'ge-carousel-item');
                dom.removeClass(item, TRANSITION);

                if (!dom.child(item, '.ge-tools-drawer')) { createItemControls(container, item); }
            });

            show(container, current);
        },

        unmark: function(container) {
            ge.resumeToggles(container);
            if (!usable(container)) { return; }

            // What the page ships starts at the first slide, whichever one
            // the canvas was showing
            itemsOf(container).forEach(function(item, index) {
                dom.removeClass(item, 'ge-carousel-item ' + TRANSITION);
                dom.toggleClass(item, 'active', index === 0);
                dom.dropEmptyClass(item);
            });

            syncIndicators(container, itemsOf(container).length ? 0 : -1);
        },

        // The same, on a copy of the canvas: unmark only touches markup
        cleanMarkup: function(root) {
            var definition = this;
            dom.all(root, '[data-ge-container="carousel"]').forEach(function(container) { definition.unmark(container); });
        },

        // The arrows, the counter and the arrow's other side: what moves the
        // carousel from slide to slide while it is edited
        tools: function(drawer, container) {
            if (!usable(container)) { return; }

            ge.createTool(drawer, ge.t('tool.carousel_show_previous'), 'ge-carousel-previous', 'bi bi-chevron-left', function() {
                if (!disabled(this)) { step(container, -1); }
            });

            var counter = ge.createTool(drawer, '', 'ge-carousel-counter', '', null);
            counter.textContent = '';
            counter.removeAttribute('title');

            ge.createTool(drawer, ge.t('tool.carousel_show_next'), 'ge-carousel-next', 'bi bi-chevron-right', function() {
                if (!disabled(this)) { step(container, 1); }
            });

            refreshNavigation(container);
        },

        panelSection: function(node, kind) {
            if (kind === 'carousel' && usable(node)) {
                return { labelKey: 'container.carousel_section', body: createSection(node) };
            }

            if (kind === 'carousel-item') {
                return { labelKey: 'container.carousel_item_section', body: createItemSection(node) };
            }

            return null;
        },

        // After a view change or a change of classes: the sections follow
        onRefresh: function(scope) {
            sections = sections.filter(function(entry) { return entry.element.isConnected; });
            sections.forEach(function(entry) {
                if (entry.node === scope || scope.contains(entry.node)) { entry.render(); }
            });
        },

        onDeinit: function() {
            sections = [];
        },
    };
};
