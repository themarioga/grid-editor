## Auto save and layout import/export

The `example/autosave.html` demo shows how to add **auto save** and
**import/export** on top of Grid Editor, using only the plugin's existing
public API (`gridEditor('getHtml')` and `gridEditor('remove')`).

### Features

- **Auto save**
  Saves the layout to `localStorage` every 5 seconds, so work is not lost on
  an accidental refresh. The saved draft is restored on page load.

- **Import a saved layout**
  Load a previously exported `.html` file back into the editor.

- **Export HTML**
  Download the edited layout as an HTML file for saving or sharing.

- **Clear draft**
  Remove the stored layout from `localStorage` and start over.

### Demo

Build the `dist/` files first, then open the example:

```bash
npm install
npm run build
open example/autosave.html
```
