/**
 * What the popup and the offcanvas plugins share: the host's triggers.
 *
 * A trigger is markup the host owns - a button, a link - anywhere in the
 * canvas, that points at a container by id. While editing it must not reach
 * Bootstrap, and one that points at nothing is warned about. Not a public
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
 * Gives back `onInit` and `onDeinit`, for the plugin to hand the editor as
 * its own, and `write(root)`, what onDeinit does to the canvas, for
 * cleanMarkup to do to a copy.
 */
export function triggersFor(ge, kind, idAttribute, targetAttribute, toggle) {
    var triggerClass = 'ge-' + kind + '-trigger';
    var orphanClass = 'ge-' + kind + '-orphan';
    var listening = null;

    function idOf(container) {
        return container.getAttribute(idAttribute);
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

    function write(root) {
        root = root || ge.canvas;

        dom.all(root, '[' + targetAttribute + ']').forEach(function(trigger) {
            var wanted = trigger.getAttribute(targetAttribute);

            // The warning marking is editing furniture, whether or not
            // the trigger can be wired up
            dom.removeClass(trigger, orphanClass);
            dom.dropEmptyClass(trigger);

            if (!exists(wanted, root)) { return; }

            trigger.setAttribute('data-bs-toggle', toggle);
            trigger.setAttribute('data-bs-target', '#' + wanted);
        });
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
        },

        onDeinit: function() {
            if (listening) { listening.abort(); }
            listening = null;

            write();
        },
    };
}
