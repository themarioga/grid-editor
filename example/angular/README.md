grid-editor in Angular
======================

grid-editor 7 in an Angular 21 app, from the npm package: the editor, its
plugins, SortableJS, Bootstrap and tinyMCE are all imported, with no script
tags and no jQuery.

```
npm install
npm start          # ng serve, on http://localhost:4200
npm run build      # into dist/angular
npm run check      # the build, driven in Chrome (needs a checkout of grid-editor)
```

Unlike the other pages in `example/`, this one has a build step: it is an
Angular CLI project. It is not part of the npm package.

What there is to read
---------------------

- **`src/app/grid-editor.setup.ts`** - everything imported, once. The plugins
  and the locale register as they are imported. A module app has no
  `window.Sortable` or `window.bootstrap`, so it hands SortableJS and
  Bootstrap over as `GridEditor.Sortable` and `GridEditor.bootstrap`.
  tinyMCE is imported with its theme, model and icons; the grid-editor
  tinyMCE plugin finds it as `window.tinymce`, where tinyMCE puts itself.
- **`src/app/grid-editor.ts`** - the editor as a component,
  `<app-grid-editor [html] [options] (changed)>`:
  - the editor is made in `afterNextRender`, so only in the browser, once the
    element is in the page, and outside Angular's zone, so a drag does not run
    change detection on every pointer move;
  - its `after-*` events come back into the zone as the `changed` output;
  - `ngOnDestroy` destroys it: its controls, panels, listeners and open
    tinyMCE editors go, and the markup stays;
  - the markup comes out through `getHtml()`, called when the app saves, not
    on every change: reading it takes the editor out of editing for a moment,
    and closes an open tinyMCE.
- **`src/app/app.ts`**, **`app.html`** - a page using it: save, publish,
  switch language, and take the component away and bring it back.
- **`angular.json`** - the stylesheets (Bootstrap, Bootstrap Icons,
  grid-editor, tinyMCE's skin) in `styles`, tinyMCE allowed as a CommonJS
  dependency, and a budget raised for it: tinyMCE is most of the 1.4 MB
  bundle. Without tinyMCE the app is well under Angular's default budget.

The editor owns what is inside its canvas. Angular renders the element and
never touches its children again, so there are no bindings in there: the
markup goes in once, through `html`, and comes out through `getHtml()`.
