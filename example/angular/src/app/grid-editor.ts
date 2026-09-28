import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { GridEditorOptions, Payload } from '@themarioga/grid-editor';
import { GridEditor } from './grid-editor.setup';

/** The events that mean the markup changed. */
const CHANGES = [
  'after-add',
  'after-delete',
  'after-move',
  'after-resize',
  'after-indent',
  'after-utility',
  'after-convert',
];

/**
 * grid-editor as an Angular component.
 *
 *   <app-grid-editor [html]="saved" [options]="options" (changed)="dirty = true" />
 *
 * The editor owns what is inside the canvas: Angular renders the element and
 * never touches its children again, so there are no bindings in there. The
 * markup goes in once, through `html`, and comes out through getHtml(),
 * called when the app saves - not on every change, since reading it takes the
 * editor out of editing for a moment and closes an open rich text editor.
 */
@Component({
  selector: 'app-grid-editor',
  template: `<div #canvas></div>`,
})
export class GridEditorComponent implements OnDestroy {
  /** The markup the canvas starts with: what getHtml() saved last time. */
  readonly html = input('');
  /** The editor's settings. Read once, when the editor is made. */
  readonly options = input<GridEditorOptions>({});
  /** Something in the markup changed, with the event's payload. */
  readonly changed = output<Payload>();

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly zone = inject(NgZone);
  private editor: GridEditor | null = null;

  constructor() {
    // In the browser only, once the element is in the page: the editor
    // measures what it edits, and there is nothing to edit on the server
    afterNextRender(() => {
      const element = this.canvas().nativeElement;
      element.innerHTML = this.html();

      // Outside Angular's zone: the editor listens for every pointer move
      // while dragging, and none of that is Angular's business
      this.zone.runOutsideAngular(() => {
        this.editor = new GridEditor(element, this.options());

        CHANGES.forEach((name) => {
          element.addEventListener('grideditor:' + name, (event) => {
            const payload = (event as CustomEvent<Payload>).detail;
            // Back in the zone, so what the app does with it is rendered
            this.zone.run(() => this.changed.emit(payload));
          });
        });
      });
    });
  }

  /** The markup to save. */
  getHtml(): string {
    return this.editor ? this.editor.getHtml() : this.html();
  }

  /** The markup to publish, with the editor's marking taken off. */
  getPlainHtml(): string {
    return this.editor ? this.editor.getPlainHtml() : this.html();
  }

  /** Switch the editor's language. */
  setLocale(code: string): void {
    this.editor?.setLocale(code);
  }

  ngOnDestroy(): void {
    // Its controls, panels and listeners go with it; the markup stays
    this.editor?.destroy();
    this.editor = null;
  }
}
