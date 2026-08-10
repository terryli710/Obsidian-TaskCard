import { Setting } from 'obsidian';
import type { App } from 'obsidian';
import type { TaskCardSettings } from '../settings';

export function cardDisplaySettings(
  containerEl: HTMLElement,
  pluginSettings: TaskCardSettings,
  writeSettings: (
    change: (settings: TaskCardSettings) => void
  ) => Promise<void> | void,
  _display: () => void,
  app: App
): void {
  new Setting(containerEl)
    .setName('Default display mode')
    .setDesc('How a task card opens: compact single line or full details.')
    .addDropdown((dropdown) => {
      dropdown
        .addOptions({
          'single-line': 'Preview mode',
          'multi-line': 'Detailed mode'
        })
        .setValue(pluginSettings.displaySettings.defaultMode)
        .onChange(async (value: string) => {
          await writeSettings(
            (old) => (old.displaySettings.defaultMode = value)
          );
        });
    });

  const upcomingSetting = new Setting(containerEl).setName('Upcoming window');
  const updateUpcomingDescription = (value: number): void => {
    upcomingSetting.setDesc(
      'Tasks scheduled to start within this many minutes are highlighted as ' +
        `upcoming. Current: ${value} minutes.`
    );
  };
  updateUpcomingDescription(pluginSettings.displaySettings.upcomingMinutes);
  upcomingSetting.addSlider((slider) => {
    slider
      .setValue(pluginSettings.displaySettings.upcomingMinutes)
      .setLimits(0, 60, 1)
      .setDynamicTooltip()
      .onChange(async (value: number) => {
        await writeSettings(
          (old) => (old.displaySettings.upcomingMinutes = value)
        );
        updateUpcomingDescription(value);
      });
  });

  new Setting(containerEl)
    .setName('Query display mode')
    .setDesc(
      "Default layout for taskcard query blocks that don't set their own display mode."
    )
    .addDropdown((dropdown) => {
      dropdown
        .addOptions({
          list: 'List',
          matrix: 'Eisenhower matrix'
        })
        .setValue(pluginSettings.displaySettings.queryDisplayMode)
        .onChange(async (value: string) => {
          await writeSettings(
            (old) => (old.displaySettings.queryDisplayMode = value)
          );
        });
    });

  new Setting(containerEl)
    .setName('Style task metadata in Live Preview')
    .setDesc(
      'Render TaskCard v2 inline fields as quiet metadata in Live Preview while keeping raw source available on cursor/selection.'
    )
    .addToggle((toggle) => {
      toggle
        .setValue(pluginSettings.displaySettings.styleMetadataInLivePreview)
        .onChange(async (value: boolean) => {
          await writeSettings(
            (old) => (old.displaySettings.styleMetadataInLivePreview = value)
          );
          // Rebuild open editor extensions so the change is visible immediately.
          app.workspace.updateOptions();
        });
    });
}
