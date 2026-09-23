Markup of grid-editor 5.x, and what 5.x published from it
=========================================================

Each `<name>.html` is a canvas as grid-editor 5.x saved it, with elements
inside the text of a content area. Each `<name>.plain.html` beside it is the
`getPlainHtml` that 5.3.1 gave for it, recorded before 6.0 took elements out
of the text: `test/conversion.js` holds 6.0 to it.

Do not regenerate the `.plain.html` files with a later version. They are the
record of what 5.x did, and the point is that 6.0 does the same.

`hosted.html` is the one case where 6.0 differs on purpose - a content area
with an id and a class of the host's keeps them on its first part only - and
`test/conversion.js` checks it against its own expectation.
