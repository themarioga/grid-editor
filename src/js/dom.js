/**
 * The DOM, the way grid-editor uses it.
 *
 * Small helpers over the browser's own API, for the core and the shipped
 * plugins. Not a public API: a plugin of a host's own is free to write its
 * DOM code however it likes, and this file makes no promise to it.
 *
 * Stateless on purpose. The build puts a copy of this file in each plugin's
 * classic script, so anything kept here would be kept once per copy; a
 * module that needs to remember something about a node keeps its own
 * WeakMap.
 */

/** Every element under `root` matching `selector`, as an array. */
export function all(root, selector) {
    return root ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [];
}

/** The first element under `root` matching `selector`, or null. */
export function one(root, selector) {
    return root ? root.querySelector(selector) : null;
}

/** `root` itself when it matches, then every element under it that does. */
export function selfAndAll(root, selector) {
    if (!root) { return []; }

    var found = all(root, selector);
    if (root.nodeType === 1 && root.matches(selector)) { found.unshift(root); }
    return found;
}

/** The element children of `node`, those matching `selector` if one is given. */
export function children(node, selector) {
    if (!node) { return []; }

    return Array.prototype.filter.call(node.children, function(each) {
        return !selector || each.matches(selector);
    });
}

/** The first element child matching `selector`, or null. */
export function child(node, selector) {
    return children(node, selector)[0] || null;
}

/** The nearest ancestor-or-self matching `selector` below `stopAt`, or null. */
export function closest(node, selector, stopAt) {
    var found = node && node.nodeType === 1 ? node.closest(selector) : null;

    if (found && stopAt && found !== stopAt && !stopAt.contains(found)) { return null; }
    return found;
}

/** Whether `node` is an element matching `selector`. */
export function is(node, selector) {
    return !!node && node.nodeType === 1 && node.matches(selector);
}

/** Whether `node` is in the document. */
export function attached(node) {
    return !!node && document.documentElement.contains(node);
}

/** The element siblings after `node` that match `selector`. */
export function nextAll(node, selector) {
    var found = [];

    for (var next = node.nextElementSibling; next; next = next.nextElementSibling) {
        if (!selector || next.matches(selector)) { found.push(next); }
    }
    return found;
}

/** The ancestors of `node` up to, and not including, `stop`, nearest first. */
export function parentsUntil(node, stop) {
    var found = [];

    for (var parent = node.parentElement; parent && parent !== stop; parent = parent.parentElement) {
        found.push(parent);
    }
    return found;
}

/**
 * The nodes the html parses into, detached. Parsed the way innerHTML parses,
 * so a <script> in it never runs, here or once it is in the page.
 */
export function parse(html) {
    var template = document.createElement('template');
    template.innerHTML = html;
    return Array.prototype.slice.call(template.content.childNodes);
}

/** The one element the html is, detached. */
export function create(html) {
    var nodes = parse(html.trim());

    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 1) { return nodes[i]; }
    }
    return null;
}

/** An element of `tag`, with `attributes` and `text`. */
export function element(tag, attributes, text) {
    var node = document.createElement(tag);

    Object.keys(attributes || {}).forEach(function(name) {
        var value = attributes[name];
        if (value !== null && value !== undefined && value !== false) { node.setAttribute(name, value); }
    });
    if (text !== undefined && text !== null) { node.textContent = text; }

    return node;
}

/** Replace what `node` holds with `html`. A <script> in it does not run. */
export function setHtml(node, html) {
    node.innerHTML = html === undefined || html === null ? '' : String(html);
    return node;
}

/** Add one or several space separated classes. */
export function addClass(node, names) {
    split(names).forEach(function(name) { node.classList.add(name); });
    return node;
}

export function removeClass(node, names) {
    split(names).forEach(function(name) { node.classList.remove(name); });
    return node;
}

/** Each class on, or off, or flipped when `on` is not given. */
export function toggleClass(node, names, state) {
    split(names).forEach(function(name) {
        if (state === undefined) {
            node.classList.toggle(name);
        } else {
            node.classList.toggle(name, !!state);
        }
    });
    return node;
}

export function hasClass(node, name) {
    return !!node && node.nodeType === 1 && node.classList.contains(name);
}

function split(names) {
    return String(names || '').split(/\s+/).filter(Boolean);
}

/** Take the class attribute off when there is nothing left in it. */
export function dropEmptyClass(node) {
    if (!node.getAttribute('class')) { node.removeAttribute('class'); }
    return node;
}

/** Take the style attribute off when there is nothing left in it. */
export function dropEmptyStyle(node) {
    if (!node.getAttribute('style')) { node.removeAttribute('style'); }
    return node;
}

/** Set attributes; a null or undefined value takes the attribute off. */
export function attr(node, attributes) {
    Object.keys(attributes).forEach(function(name) {
        var value = attributes[name];

        if (value === null || value === undefined) {
            node.removeAttribute(name);
        } else {
            node.setAttribute(name, value);
        }
    });
    return node;
}

/**
 * Inline styles, by css property name. A number is pixels for the properties
 * that take a length, as jQuery had it; an empty string takes one off.
 */
export function css(node, styles) {
    Object.keys(styles).forEach(function(property) {
        var value = styles[property];

        if (typeof value === 'number' && !UNITLESS[property]) { value = value + 'px'; }
        node.style.setProperty(property, value === null || value === undefined ? '' : String(value));
    });
    return node;
}

var UNITLESS = { opacity: true, 'z-index': true, 'flex-grow': true, 'flex-shrink': true, order: true };

/** What an element of this tag shows as when nothing hides it. */
var defaultDisplays = {};

function defaultDisplay(node) {
    var tag = node.nodeName;

    if (!defaultDisplays[tag]) {
        var probe = document.body.appendChild(document.createElement(tag));
        defaultDisplays[tag] = getComputedStyle(probe).display;
        probe.remove();
        if (defaultDisplays[tag] === 'none') { defaultDisplays[tag] = 'block'; }
    }
    return defaultDisplays[tag];
}

/** Show a node: its inline display:none off, and a display of its own if a stylesheet hides it. */
export function show(node) {
    node.style.removeProperty('display');
    if (getComputedStyle(node).display === 'none') { node.style.display = defaultDisplay(node); }
    return node;
}

export function hide(node) {
    node.style.display = 'none';
    return node;
}

/** Show or hide; flip when `on` is not given. */
export function toggle(node, state) {
    if (state === undefined) { state = !visible(node); }
    return state ? show(node) : hide(node);
}

/** Whether a node takes up room: what jQuery's :visible meant. */
export function visible(node) {
    return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
}

/** The border box's width, fractions included. */
export function outerWidth(node) {
    return node.getBoundingClientRect().width;
}

export function outerHeight(node) {
    return node.getBoundingClientRect().height;
}

/** The content box's height, which is what jQuery's height() gave. */
export function contentHeight(node) {
    var style = getComputedStyle(node);
    return node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
}

/** Where a node is on the page, not in the window. */
export function offset(node) {
    var box = node.getBoundingClientRect();
    return { top: box.top + window.pageYOffset, left: box.left + window.pageXOffset };
}

/** Its index among its parent's element children, those matching `selector` if given. */
export function indexIn(node, selector) {
    return children(node.parentElement, selector).indexOf(node);
}

/** Put `node` right after `reference`. */
export function insertAfter(node, reference) {
    reference.parentNode.insertBefore(node, reference.nextSibling);
    return node;
}

/** Replace `node` with what it holds. */
export function unwrap(node) {
    var parent = node.parentNode;

    while (node.firstChild) { parent.insertBefore(node.firstChild, node); }
    node.remove();
}

/** Put `node` inside `wrapper`, where `node` was. */
export function wrap(node, wrapper) {
    node.parentNode.insertBefore(wrapper, node);
    wrapper.appendChild(node);
    return wrapper;
}

/**
 * Listen on `root` for `types` (space separated) on descendants that match
 * `selector`, with `this` the matched element, as jQuery's delegated
 * handlers had it. Hands back the listener, for removeEventListener; a
 * signal in `options` removes it too.
 */
export function delegate(root, types, selector, handler, options) {
    var listener = function(event) {
        var match = closest(event.target, selector, root);
        if (match && root.contains(match)) { return handler.call(match, event); }
        return undefined;
    };

    split(types).forEach(function(type) { root.addEventListener(type, listener, options); });
    return listener;
}

/** Listen for several space separated event types with one handler. */
export function on(target, types, handler, options) {
    split(types).forEach(function(type) { target.addEventListener(type, handler, options); });
    return handler;
}

export function off(target, types, handler, options) {
    split(types).forEach(function(type) { target.removeEventListener(type, handler, options); });
}

/** A mouse event of `type` sent to `node`, the way a pointer would. */
export function fire(node, type) {
    node.dispatchEvent(new MouseEvent(type, { bubbles: type !== 'mouseenter' && type !== 'mouseleave' }));
}

/* ------------------------------------------------------------------
 * Taking a node away, visibly.
 *
 * The durations are jQuery's: 400 ms unless the caller says otherwise. `done` runs once the node is out of sight, which is
 * when the caller removes it; a node that is already out of sight is done at
 * once, on the next task, as jQuery had it.
 * ------------------------------------------------------------------ */

var DEFAULT_DURATION = 400;

function animateAway(node, frames, duration, done) {
    duration = duration === undefined ? DEFAULT_DURATION : duration;

    var finish = function() {
        hide(node);
        if (done) { done(); }
    };

    if (!visible(node) || !node.animate || duration <= 0) {
        window.setTimeout(finish, 0);
        return;
    }

    var animation = node.animate(frames(getComputedStyle(node)), {
        duration: duration,
        easing: 'ease-in-out',
    });
    var called = false;
    var once = function() {
        if (called) { return; }
        called = true;
        finish();
    };

    animation.onfinish = once;
    animation.oncancel = once;
}

/** Fold a node up to nothing, then hide it. */
export function slideUp(node, duration, done) {
    if (typeof duration === 'function') {
        done = duration;
        duration = undefined;
    }

    node.style.overflow = 'hidden';
    animateAway(node, function(style) {
        return [
            {
                height: style.height,
                paddingTop: style.paddingTop,
                paddingBottom: style.paddingBottom,
                marginTop: style.marginTop,
                marginBottom: style.marginBottom,
            },
            { height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' },
        ];
    }, duration, function() {
        node.style.removeProperty('overflow');
        if (done) { done(); }
    });
}

/** Fade a node out, then hide it. */
export function fadeOut(node, duration, done) {
    animateAway(node, function(style) {
        return [{ opacity: style.opacity }, { opacity: 0 }];
    }, duration, done);
}

/** Fade and fold a node, in height and, with `width`, sideways too, then hide it. */
export function shrinkAway(node, duration, done, width) {
    node.style.overflow = 'hidden';
    animateAway(node, function(style) {
        var from = { opacity: style.opacity, height: style.height };
        var to = { opacity: 0, height: '0px' };

        if (width) {
            from.width = style.width;
            to.width = '0px';
        }
        return [from, to];
    }, duration, function() {
        node.style.removeProperty('overflow');
        if (done) { done(); }
    });
}
