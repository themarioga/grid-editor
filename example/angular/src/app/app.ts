import { Component, signal, viewChild } from '@angular/core';
import type { GridEditorOptions } from '@themarioga/grid-editor';
import { GridEditorComponent } from './grid-editor';

/** What the page starts with: what a server would have saved from getHtml(). */
const SAVED = `
<div class="row">
  <div class="col-md-8">
    <div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">
      <h2>grid-editor in Angular</h2>
      <p>Click this text to edit it with tinyMCE. Drag the rows and columns by their
      move tool, resize a column by its edge, and add rows, tabs, accordions and cards
      from the toolbar.</p>
    </div>
  </div>
  <div class="col-md-4">
    <div class="ge-content ge-content-type-tinymce" data-ge-content-type="tinymce">
      <p>The editor is imported, with its plugins, SortableJS, Bootstrap and tinyMCE:
      there is nothing on <code>window</code> but what tinyMCE puts there itself.</p>
    </div>
  </div>
</div>`;

@Component({
  selector: 'app-root',
  imports: [GridEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly saved = signal(SAVED);
  protected readonly shown = signal(true);
  protected readonly changes = signal(0);
  protected readonly output = signal('');
  protected readonly locale = signal('en');

  protected readonly options: GridEditorOptions = {
    new_row_layouts: [[12], [6, 6], [4, 4, 4], [8, 4]],
    content_types: ['tinymce'],
    settings_panel: 'modal',
    tinymce: {
      config: {
        // tinyMCE 7 is GPL-2.0-or-later: 'gpl' accepts that licence
        license_key: 'gpl',
        // The skin is in angular.json's styles, bundled like the rest
        skin: false,
        content_css: false,
        menubar: false,
        toolbar: 'undo redo | bold italic | bullist numlist | link',
      },
    },
  };

  private readonly editor = viewChild(GridEditorComponent);

  protected onChanged(): void {
    this.changes.update((count) => count + 1);
  }

  protected save(): void {
    const editor = this.editor();
    if (!editor) { return; }

    this.saved.set(editor.getHtml());
    this.output.set(this.saved());
  }

  protected publish(): void {
    const editor = this.editor();
    if (editor) { this.output.set(editor.getPlainHtml()); }
  }

  protected switchLocale(code: string): void {
    this.locale.set(code);
    this.editor()?.setLocale(code);
  }

  /** Take the editor out of the page, and put it back with what was saved. */
  protected toggle(): void {
    if (this.shown()) { this.save(); }
    this.shown.update((shown) => !shown);
  }
}
