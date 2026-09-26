import type { ColorControl, PanelControl, PanelModel } from './model';
import type { TweakpaneContainer, TweakpaneModule } from './tweakpane';

const EXPORT_FILE_NAME = 'magic-cursor-wand.json';

/** The actions of the panel buttons that are not part of the model. */
export interface PaneActions {
  readonly close?: () => void;
  readonly importFile: () => void;
  readonly exportFile: () => void;
}

/** A rendered Tweakpane pane that follows the model. */
export interface RenderedPane {
  readonly element: HTMLElement;
  sync(): void;
  dispose(): void;
}

type Sync = (control: PanelControl) => void;

interface Binder {
  readonly guard: { syncing: boolean };
  readonly model: PanelModel;
}

function write(binder: Binder, path: string, value: unknown): void {
  if (binder.guard.syncing) return;
  binder.model.set(path, value);
}

function bindColor(binder: Binder, folder: TweakpaneContainer, control: ColorControl): Sync {
  const color = { value: control.value ?? control.inherited };
  if (!control.nullable) {
    folder
      .addBinding(color, 'value', { label: control.label, view: 'color' })
      .on('change', (event) => write(binder, control.path, event.value));
    return (next) => {
      if (next.kind === 'color') color.value = next.value ?? next.inherited;
    };
  }
  const inherit = { value: control.value === null };
  const inheritBinding = folder.addBinding(inherit, 'value', { label: `${control.label} inherit` });
  const colorBinding = folder.addBinding(color, 'value', { label: control.label, view: 'color' });
  colorBinding.disabled = inherit.value;
  inheritBinding.on('change', (event) => {
    colorBinding.disabled = event.value === true;
    write(binder, control.path, event.value === true ? null : color.value);
  });
  colorBinding.on('change', (event) => write(binder, control.path, event.value));
  return (next) => {
    if (next.kind !== 'color') return;
    inherit.value = next.value === null;
    color.value = next.value ?? next.inherited;
    colorBinding.disabled = inherit.value;
  };
}

function bindControl(binder: Binder, folder: TweakpaneContainer, control: PanelControl): Sync {
  if (control.kind === 'color') return bindColor(binder, folder, control);
  const state: Record<string, unknown> = { value: control.value };
  const params: Record<string, unknown> = { label: control.label };
  if (control.kind === 'number') {
    params.min = control.min;
    params.max = control.max;
    params.step = control.step;
  }
  if (control.kind === 'enum') {
    params.options = control.options.map((option) => ({ text: option, value: option }));
  }
  folder
    .addBinding(state, 'value', params)
    .on('change', (event) => write(binder, control.path, event.value));
  return (next) => {
    state.value = next.value;
  };
}

/**
 * Render the model in a Tweakpane pane: one folder for each group, then the buttons.
 *
 * @param tweakpane - The Tweakpane module.
 * @param container - The element that contains the pane.
 * @param model - The panel model.
 * @param title - The title of the pane.
 * @param expanded - The names of the sections that show their controls at start.
 * @param actions - The actions of the Close, Import and Export buttons.
 * @returns The rendered pane.
 */
export function renderPane(
  tweakpane: TweakpaneModule,
  container: HTMLElement,
  model: PanelModel,
  title: string,
  expanded: ReadonlySet<string>,
  actions: PaneActions,
): RenderedPane {
  const pane = new tweakpane.Pane({
    container,
    document: container.ownerDocument,
    title,
    expanded: true,
  });
  const binder: Binder = { guard: { syncing: false }, model };
  const syncs = new Map<string, Sync>();

  for (const group of model.groups) {
    const folder = pane.addFolder({ title: group.title, expanded: expanded.has(group.name) });
    for (const control of group.controls) {
      syncs.set(control.path, bindControl(binder, folder, control));
    }
  }
  pane.addButton({ title: 'Reset' }).on('click', () => model.reset());
  pane.addButton({ title: 'Import' }).on('click', actions.importFile);
  pane.addButton({ title: 'Export' }).on('click', actions.exportFile);
  if (actions.close) pane.addButton({ title: 'Close' }).on('click', actions.close);

  return {
    element: pane.element,
    sync() {
      binder.guard.syncing = true;
      try {
        for (const group of model.groups) {
          for (const control of group.controls) syncs.get(control.path)?.(control);
        }
        pane.refresh();
      } finally {
        binder.guard.syncing = false;
      }
    },
    dispose() {
      pane.dispose();
    },
  };
}

/**
 * Download the configuration of the model as a JSON file.
 *
 * @param doc - The document that starts the download.
 * @param model - The panel model.
 */
export function downloadJson(doc: Document, model: PanelModel): void {
  const url = URL.createObjectURL(new Blob([model.exportJson()], { type: 'application/json' }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = EXPORT_FILE_NAME;
  link.style.display = 'none';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
