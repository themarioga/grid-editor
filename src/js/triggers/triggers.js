/**
 * What the popup and the offcanvas plugins share: the host's triggers.
 *
 * A trigger is markup the host owns - a button, a link - anywhere in the
 * canvas, that points at a container by id. While editing it must not reach
 * Bootstrap, and one that points at nothing is warned about. With the
 * preview button pressed it does reach it, and opens the container as the
 * page will, until the button is let go. Not a public
 * API: the build puts a copy of this file in each plugin that imports it,
 * so it keeps nothing of its own between plugins.
 */
import * as dom from '../dom.js';

/**
 * The trigger handling of one kind of container.
 *
 * `kind` names the container (`popup`), its classes (`ge-popup-trigger`,
 * `ge-popup-orphan`) and the event for a trigger left pointing at nothing
 * (`popup-orphan`). `idAttribute` is the attribute a container has its id in,
 * `targetAttribute` the one a trigger names it with, and `toggle` is
 * Bootstrap's `data-bs-toggle` for it, written on the way out.
 *
 * Gives back `onInit`, `onDeinit` and `onPreviewChange`, for the plugin to
 * hand the editor as its own, and `write(root)`, what onDeinit does to the
 * canvas, for cleanMarkup to do to a copy.
 */
export function triggersFor(ge, kind, idAttribute, targetAttribute, toggle) {
    var triggerClass = 'ge-' + kind + '-trigger';
    var orphanClass = 'ge-' + kind + '-orphan';
    var listening = null;

    // What Bootstrap changes on a container as it opens and closes it
    var STATE_ATTRIBUTES = ['style', 'aria-hidden', 'aria-modal', 'role'];
    var STATE_CLASSES = ['show', 'showing', 'hiding'];
    // Each container's element as the preview found it: what it goes back to
    var before = new Map();
    // The dismisses the preview gave back to Bootstrap, to take away again
    var dismisses = [];
    // What a getHtml in the middle of a preview took off, for onInit to put back
    var saved = new Map();
    // Where Bootstrap is with each container it has been asked to open:
    // opening, open or closing, as its events tell. Not there once closed
    var phases = new Map();
    var watching = null;
    // Let go of while Bootstrap was still closing them: what they go back to once it is done
    var pending = new Map();
    var PHASES = { show: 'opening', shown: 'open', hide: 'closing' };

    function idOf(container) {
        return container.getAttribute(idAttribute);
    }

    /** The modal, the panel: the element in a container with the container's id. */
    function targetOf(container) {
        var id = idOf(container);

        return dom.all(container, '[id]').filter(function(node) { return node.id === id; })[0] || null;
    }

    function targets() {
        return dom.all(ge.canvas, '[' + idAttribute + ']').map(targetOf).filter(Boolean);
    }

    /** Whether a container with this id is on the canvas. */
    function exists(id, root) {
        return dom.all(root || ge.canvas, '[' + idAttribute + ']').some(function(container) {
            return idOf(container) === id;
        });
    }

    function wire() {
        dom.all(ge.canvas, '[' + targetAttribute + ']').forEach(function(trigger) {
            dom.addClass(trigger, triggerClass);
            var wanted = trigger.getAttribute(targetAttribute);

            // Bootstrap's own attributes are written at getHtml time, not
            // while editing, so a click here cannot open a real container
            trigger.removeAttribute('data-bs-toggle');
            trigger.removeAttribute('data-bs-target');

            if (exists(wanted)) {
                dom.removeClass(trigger, orphanClass);
                return;
            }

            var column = trigger.closest('.column');
            var nearby = column ? dom.all(column, '[' + idAttribute + ']') : [];

            if (nearby.length === 1) {
                trigger.setAttribute(targetAttribute, idOf(nearby[0]));
                dom.removeClass(trigger, orphanClass);
                return;
            }

            dom.addClass(trigger, orphanClass);

            ge.operate(function() {
                ge.emit(kind + '-orphan', ge.payloadFor(kind, trigger, {
                    parent: trigger.parentElement,
                    source: 'api',
                    missing: wanted,
                }));
            });
        });
    }

    /** Bootstrap's own attributes on the triggers that point at something. */
    function arm(root) {
        dom.all(root, '[' + targetAttribute + ']').forEach(function(trigger) {
            var wanted = trigger.getAttribute(targetAttribute);
            if (!exists(wanted, root)) { return; }

            trigger.setAttribute('data-bs-toggle', toggle);
            trigger.setAttribute('data-bs-target', '#' + wanted);
        });
    }

    function disarm() {
        dom.all(ge.canvas, '[' + targetAttribute + ']').forEach(function(trigger) {
            trigger.removeAttribute('data-bs-toggle');
            trigger.removeAttribute('data-bs-target');
        });
    }

    function write(root) {
        root = root || ge.canvas;

        // The warning marking is editing furniture, whether or not
        // the trigger can be wired up
        dom.all(root, '[' + targetAttribute + ']').forEach(function(trigger) {
            dom.removeClass(trigger, orphanClass);
            dom.dropEmptyClass(trigger);
        });

        arm(root);

        // A container the preview opened is read as the preview found it,
        // whether the preview goes on or Bootstrap is still closing it
        var quiet = new Map();
        before.forEach(function(state, target) { quiet.set(target.id, state); });
        pending.forEach(function(state, target) { quiet.set(target.id, state); });
        if (!quiet.size) { return; }

        dom.all(root, '[id]').forEach(function(node) {
            if (quiet.has(node.id)) { putState(node, quiet.get(node.id)); }
        });
    }

    /** What Bootstrap may change on a container, as it is now. */
    function stateOf(target) {
        var state = { classes: STATE_CLASSES.filter(function(name) { return dom.hasClass(target, name); }) };
        STATE_ATTRIBUTES.forEach(function(name) { state[name] = target.getAttribute(name); });
        return state;
    }

    function putState(target, state) {
        STATE_CLASSES.forEach(function(name) { dom.toggleClass(target, name, state.classes.indexOf(name) !== -1); });
        STATE_ATTRIBUTES.forEach(function(name) {
            // Read first: a style Bootstrap last wrote through the element's
            // style object is only written to the attribute when it is read,
            // and would otherwise come back, empty, after it is taken off
            target.getAttribute(name);

            if (state[name] === null) {
                target.removeAttribute(name);
            } else {
                target.setAttribute(name, state[name]);
            }
        });
    }

    /**
     * The preview pressed: the triggers reach Bootstrap, and so do the
     * container's own close buttons, which editing keeps from it.
     */
    function startPreview() {
        // Again after a getHtml, whose init took them away once more
        dismisses = [];
        targets().forEach(function(target) {
            if (!before.has(target)) { before.set(target, stateOf(target)); }

            dom.all(target, '[data-ge-bs-dismiss="' + toggle + '"]').forEach(function(dismiss) {
                ge.resumeToggles(dismiss);
                dismisses.push(dismiss);
            });
        });
        arm(ge.canvas);

        if (watching) { watching.abort(); }
        watching = new AbortController();
        ['show', 'shown', 'hide', 'hidden'].forEach(function(name) {
            ge.canvas.addEventListener(name + '.bs.' + toggle, function(e) {
                if (!before.has(e.target)) { return; }

                if (name === 'hidden') {
                    phases.delete(e.target);
                } else {
                    phases.set(e.target, PHASES[name]);
                }
            }, { signal: watching.signal });
        });
    }

    /** Bootstrap's component for this kind, when the page has it on window. */
    function component() {
        var bootstrap = window.bootstrap;
        var name = toggle.charAt(0).toUpperCase() + toggle.slice(1);

        return bootstrap && bootstrap[name] && bootstrap[name].getInstance ? bootstrap[name] : null;
    }

    /**
     * Ask Bootstrap to close a container: through its instance, or, for a
     * page with no window.bootstrap - an app that imports it - through its
     * own close button, which its data api still listens for.
     */
    function closer(target) {
        var Component = component();
        var instance = Component ? Component.getInstance(target) : null;
        if (instance) { return function() { instance.hide(); }; }

        var dismiss = dom.one(target, '[data-bs-dismiss="' + toggle + '"], [data-ge-bs-dismiss="' + toggle + '"]');
        if (!dismiss) { return null; }

        return function() {
            ge.resumeToggles(dismiss);
            dismiss.click();
            ge.suspendToggles(dismiss);
        };
    }

    /**
     * The preview let go: an open container is closed, by Bootstrap so its
     * backdrop and the page's scroll go back too, and each is left as the
     * preview found it once Bootstrap is done with it. One still opening is
     * closed when it has opened, as Bootstrap will not close it before.
     */
    function endPreview() {
        if (watching) { watching.abort(); }
        watching = null;

        before.forEach(function(state, target) {
            var phase = phases.get(target);
            var close = phase && phase !== 'closing' ? closer(target) : null;
            var restore = function() {
                pending.delete(target);
                putState(target, state);
            };

            if (!phase || (phase !== 'closing' && !close)) {
                restore();
                return;
            }

            pending.set(target, state);
            target.addEventListener('hidden.bs.' + toggle, restore, { once: true });
            if (phase === 'opening') {
                target.addEventListener('shown.bs.' + toggle, close, { once: true });
            } else if (phase === 'open') {
                close();
            }
        });
        before = new Map();
        phases = new Map();

        dismisses.forEach(function(dismiss) { ge.suspendToggles(dismiss); });
        dismisses = [];
        disarm();
    }

    return {
        write: write,

        // Triggers are markup the host owns, anywhere in the canvas, so they
        // are looked at whenever the canvas is initialized rather than only
        // when a container is touched
        onInit: function() {
            wire();

            if (listening) { listening.abort(); }
            listening = new AbortController();

            // A trigger is often a link, and a link still navigates even
            // with its Bootstrap attributes suspended
            dom.delegate(ge.canvas, 'click', '.' + triggerClass + ', [' + targetAttribute + ']', function(e) {
                if (dom.hasClass(ge.canvas, 'ge-editing')) { e.preventDefault(); }
            }, { signal: listening.signal });

            // A getHtml in the middle of a preview: back to what it was
            if (ge.previewing()) {
                var live = new Map(saved);
                saved = new Map();
                startPreview();
                live.forEach(function(state, target) {
                    if (ge.canvas.contains(target)) { putState(target, state); }
                });
            }
        },

        onDeinit: function() {
            if (listening) { listening.abort(); }
            listening = null;

            // In the middle of a preview, write reads the markup as the
            // preview found it, not with a container open: onInit puts it back
            if (ge.previewing()) {
                before.forEach(function(state, target) { saved.set(target, stateOf(target)); });
            }

            write();
        },

        onPreviewChange: function(previewing) {
            if (previewing) {
                startPreview();
            } else {
                endPreview();
            }
        },
    };
}
