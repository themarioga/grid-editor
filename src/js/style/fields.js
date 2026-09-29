/**
 * The style plugin's inline fields: one per css property, each writing the
 * node's own style through ge.setHostStyle, never by hand, so the preview
 * of a breakpoint view neither shows in them nor eats what they write.
 *
 * A field is filled from the node by renderStyleField, again whenever the
 * plugin asks: after a write elsewhere, after the classes change. A value
 * the browser refused stays in its field, marked invalid, until it is put
 * right or emptied; nothing is written meanwhile.
 */
import * as dom from '../dom.js';
import { overriding } from './sections.js';

var renderers = new WeakMap(); // field -> what fills it from the node
var fieldCounter = 0;

function classesOf(node) {
    return (node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
}

/**
 * Write what the user typed: trimmed, with a trailing !important taken as
 * the priority. Without one, the property keeps the priority it had.
 */
function write(ge, node, property, raw) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    var important = /\s*!\s*important\s*$/i.exec(text);
    var priority;

    if (important) {
        text = text.slice(0, important.index).trim();
        priority = 'important';
    }

    return ge.setHostStyle(node, property, text, priority);
}

function mark(input, ok, ge) {
    dom.toggleClass(input, 'is-invalid', !ok);
    if (ok) {
        input.removeAttribute('title');
    } else {
        input.setAttribute('title', ge.t('style.invalid'));
    }
}

/** Put a value in an input, unless it holds something refused that is still being put right. */
function fill(input, value) {
    if (!dom.hasClass(input, 'is-invalid')) { input.value = value; }
}

function textInput(className) {
    return dom.element('input', { type: 'text', 'class': 'form-control form-control-sm ' + (className || '') });
}

/* Colors */

var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** What a color picker can show of a value: a six digit hex, or nothing. */
function pickable(value) {
    var match = HEX.exec(value.trim());
    if (!match) { return null; }

    var hex = match[1];
    if (hex.length === 3) { hex = hex.split('').map(function(c) { return c + c; }).join(''); }

    return '#' + hex.toLowerCase();
}

/** A picker and a text beside it, which takes what a picker cannot: rgba, var(), transparent. */
function colorControl(onValue) {
    var box = dom.element('div', { 'class': 'input-group input-group-sm ge-style-color' });
    var picker = box.appendChild(dom.element('input', { type: 'color', 'class': 'form-control form-control-color' }));
    var text = box.appendChild(textInput());

    picker.addEventListener('input', function() {
        dom.removeClass(text, 'is-invalid');
        text.value = picker.value;
        onValue(picker.value, text);
    });
    text.addEventListener('change', function() {
        var hex = pickable(text.value);
        if (hex) { picker.value = hex; }
        onValue(text.value, text);
    });

    return {
        element: box,
        set: function(value) {
            fill(text, value);
            var hex = pickable(value);
            if (hex) { picker.value = hex; }
        },
    };
}

/* Background images */

var URL_VALUE = /^url\(\s*(["']?)(.*)\1\s*\)$/i;

/** What the field shows of a background-image: the url itself, or the value as it is. */
function shownUrl(value) {
    var match = URL_VALUE.exec(value.trim());
    if (!match) { return value; }

    return match[1] ? match[2].replace(/\\(["\\])/g, '$1') : match[2];
}

/** A url becomes url("…"); a gradient, none or any other css function goes as it is. */
function urlValue(text) {
    text = text.trim();
    if (text === '' || /^(?:none|inherit|initial|unset|revert)$/i.test(text) || /^[a-z-]+\(/i.test(text)) { return text; }

    return 'url("' + text.replace(/(["\\])/g, '\\$1') + '")';
}

/* Shadows */

/** Split at spaces and commas outside parentheses. */
function tokens(value) {
    var list = [];
    var depth = 0;
    var current = '';

    for (var i = 0; i < value.length; i++) {
        var c = value.charAt(i);

        if (c === '(') { depth++; }
        if (c === ')') { depth--; }

        if (depth === 0 && (c === ' ' || c === ',')) {
            if (current) { list.push(current); }
            if (c === ',') { list.push(','); }
            current = '';
        } else {
            current += c;
        }
    }
    if (current) { list.push(current); }

    return list;
}

var LENGTH = /^-?(?:\d*\.)?\d+(?:[a-z%]+)?$/i;

/** The lengths of a shadow, in the order css writes them; a text shadow has no spread. */
var SHADOW_PARTS = [
    { name: 'x', labelKey: 'style.shadow_x' },
    { name: 'y', labelKey: 'style.shadow_y' },
    { name: 'blur', labelKey: 'style.shadow_blur' },
    { name: 'spread', labelKey: 'style.shadow_spread' },
];

/**
 * One shadow as the builder's parts, or null when the value is something
 * the builder cannot hold: several shadows, var(), a keyword.
 */
function parseShadow(value, box) {
    value = value.trim();
    if (value === '') { return { inset: false, lengths: [], color: '' }; }
    if (/var\(/i.test(value)) { return null; }

    var list = tokens(value);
    if (list.indexOf(',') !== -1) { return null; }

    var inset = false;
    var lengths = [];
    var colors = [];

    list.forEach(function(token) {
        if (box && token.toLowerCase() === 'inset') {
            inset = true;
        } else if (LENGTH.test(token)) {
            lengths.push(token);
        } else {
            colors.push(token);
        }
    });

    if (colors.length > 1 || lengths.length < 2 || lengths.length > (box ? 4 : 3)) { return null; }
    if (colors.length && /^(?:none|inherit|initial|unset|revert)$/i.test(colors[0])) { return null; }

    return { inset: inset, lengths: lengths, color: colors[0] || '' };
}

function composeShadow(parts, box) {
    var lengths = parts.lengths.slice();

    // A later length needs the earlier ones: a spread needs a blur
    for (var i = lengths.length - 1; i >= 0; i--) {
        if (lengths[i] === '' && lengths.slice(i + 1).some(Boolean)) { lengths[i] = '0'; }
    }
    lengths = lengths.filter(Boolean);

    if (!lengths.length && !parts.color && !parts.inset) { return ''; }
    while (lengths.length < 2) { lengths.push('0'); }

    return (box && parts.inset ? 'inset ' : '') + lengths.join(' ') + (parts.color ? ' ' + parts.color : '');
}

/**
 * The shadow field: a builder for one shadow - x, y, blur, the spread and
 * inset for a box - and the value as text when it is more than the
 * builder holds, or when the user asks for the text.
 */
function shadowControl(ge, node, property, changed) {
    var box = property === 'box-shadow';
    var holder = dom.element('div', { 'class': 'ge-style-shadow' });
    var textMode = false;

    function writeValue(value, input) {
        var ok = write(ge, node, property, value);
        mark(input, ok, ge);
        if (ok) { changed(); }
        return ok;
    }

    function builder(parts) {
        holder.innerHTML = '';
        var grid = holder.appendChild(dom.element('div', { 'class': 'ge-style-shadow-builder' }));
        var names = box ? SHADOW_PARTS : SHADOW_PARTS.slice(0, 3);
        var inputs = names.map(function(part, i) {
            var cell = grid.appendChild(dom.element('label', { 'class': 'ge-style-shadow-part' }));
            cell.appendChild(dom.element('span', { 'class': 'ge-style-shadow-label' }, ge.t(part.labelKey)));
            var input = cell.appendChild(textInput('ge-style-shadow-' + part.name));
            input.value = parts.lengths[i] || '';
            return input;
        });

        var colorCell = grid.appendChild(dom.element('label', { 'class': 'ge-style-shadow-part ge-style-shadow-color' }));
        colorCell.appendChild(dom.element('span', { 'class': 'ge-style-shadow-label' }, ge.t('style.shadow_color')));
        var color = colorControl(function() { update(); });
        colorCell.appendChild(color.element);
        color.set(parts.color);

        var inset = null;
        if (box) {
            var insetCell = grid.appendChild(dom.element('label', { 'class': 'form-check ge-style-shadow-inset' }));
            inset = insetCell.appendChild(dom.element('input', { type: 'checkbox', 'class': 'form-check-input' }));
            insetCell.appendChild(dom.element('span', { 'class': 'form-check-label' }, ge.t('style.shadow_inset')));
            inset.checked = parts.inset;
            inset.addEventListener('change', function() { update(); });
        }

        inputs.forEach(function(input) { input.addEventListener('change', function() { update(); }); });

        var toText = holder.appendChild(dom.element('a', { href: '#', 'class': 'ge-style-shadow-mode' }, ge.t('style.shadow_text_mode')));
        toText.addEventListener('click', function(e) {
            e.preventDefault();
            textMode = true;
            render();
        });

        function update() {
            var value = composeShadow({
                inset: inset ? inset.checked : false,
                lengths: inputs.map(function(input) { return input.value.trim(); }),
                color: dom.one(color.element, 'input[type="text"]').value.trim(),
            }, box);
            writeValue(value, inputs[0]);
        }
    }

    function text(value) {
        holder.innerHTML = '';
        var input = holder.appendChild(textInput('ge-style-shadow-text'));
        input.value = value;
        input.addEventListener('change', function() {
            if (input.value.trim() === '') {
                if (writeValue('', input)) {
                    textMode = false;
                    render();
                }
                return;
            }
            writeValue(input.value, input);
        });
    }

    var shown = null; // The value the builder or the text was last built for

    function render() {
        if (holder.querySelector('.is-invalid')) { return; }

        var value = ge.hostStyle(node, property).value;
        var parts = parseShadow(value, box);

        // Built again only when the value changed under it: building takes
        // the focus from whichever of its inputs the user moved on to
        if (value === shown && holder.firstChild && textMode === !!holder.querySelector('.ge-style-shadow-text')) { return; }
        shown = value;

        if (textMode || !parts) {
            textMode = !!value || textMode;
            text(value);
        } else {
            builder(parts);
        }
    }

    return { element: holder, render: render, value: function() { return ge.hostStyle(node, property).value; } };
}

/**
 * The field for one property of a node. `changed` is called after every
 * write that went through, so the plugin can bring the rest of its
 * sections up to date.
 */
export function createStyleField(ge, node, property, changed) {
    var field = dom.element('div', { 'class': 'ge-style-field', 'data-ge-style-property': property.name });
    var label = field.appendChild(dom.element('label', { 'class': 'ge-style-label' }, ge.t(property.labelKey)));
    var render;

    function current() {
        return ge.hostStyle(node, property.name).value;
    }

    function commit(value, input) {
        var ok = write(ge, node, property.name, value);
        mark(input, ok, ge);
        if (ok) { changed(); }
    }

    if (property.type === 'select') {
        var select = field.appendChild(dom.element('select', { 'class': 'form-select form-select-sm' }));
        select.addEventListener('change', function() { commit(select.value, select); });
        render = function() {
            var value = current();
            var values = property.values.slice();
            if (value && values.indexOf(value) === -1) { values.push(value); }

            select.innerHTML = '';
            select.appendChild(dom.element('option', { value: '' }, ''));
            values.forEach(function(each) { select.appendChild(dom.element('option', { value: each }, each)); });
            select.value = value;
        };
    } else if (property.type === 'color') {
        var color = colorControl(function(value, input) { commit(value, input); });
        field.appendChild(color.element);
        render = function() { color.set(current()); };
    } else if (property.type === 'url') {
        var url = field.appendChild(textInput());
        url.addEventListener('change', function() { commit(urlValue(url.value), url); });
        render = function() { fill(url, shownUrl(current())); };
    } else if (property.type === 'shadow') {
        var shadow = shadowControl(ge, node, property.name, changed);
        field.appendChild(shadow.element);
        render = shadow.render;
    } else {
        var input = field.appendChild(textInput());
        input.addEventListener('change', function() { commit(input.value, input); });
        render = function() { fill(input, current()); };
    }

    var control = field.querySelector('input, select');
    if (control) {
        control.id = 'ge-style-field-' + (++fieldCounter);
        label.setAttribute('for', control.id);
    }

    field.appendChild(dom.element('small', { 'class': 'ge-style-note ge-style-overridden' }));

    renderers.set(field, function() {
        render();

        // A Bootstrap utility on the node wins over the value: every one is !important
        var winner = current() ? overriding(property.name, classesOf(node)) : null;
        var note = dom.child(field, '.ge-style-overridden');
        note.textContent = winner ? ge.t('style.overridden', { 'class': winner }) : '';
        dom.toggle(note, !!winner);
    });
    renderStyleField(field);

    return field;
}

/** Fill a field from its node again. */
export function renderStyleField(field) {
    var render = renderers.get(field);
    if (render) { render(); }
}
