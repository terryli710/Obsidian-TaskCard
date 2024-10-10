import { Notice, Setting } from "obsidian";
import { TaskCardSettings } from "../settings";
import { logger } from "../utils/log";





export function cardDisplaySettings(
    containerEl: HTMLElement,
    pluginSettings: TaskCardSettings,
    writeSettings: Function,
    display: Function,
) {
    new Setting(containerEl)
        .setName('Default Display Mode')
        .setDesc('The default display mode when creating a new task card.')
        .addDropdown((dropdown) => {
        dropdown
            .addOptions({
                'single-line': 'Preview Mode',
                'multi-line': 'Detailed Mode'
            })
            .setValue(pluginSettings.displaySettings.defaultMode)
            .onChange(async (value: string) => {
            await writeSettings(
                (old) => (old.displaySettings.defaultMode = value)
            );
            logger.info(`Default display mode updated: ${value}`);
            new Notice(`[TaskCard] Default display mode updated: ${value}.`);
            });
        });
    
    new Setting(containerEl)
        .setName('Upcoming Minutes')
        .setDesc('The number of minutes to display as upcoming task. Default is 15 minutes.')
        .addSlider((slider) => {
        let timeoutId: NodeJS.Timeout | null = null;
        slider
            .setValue(pluginSettings.displaySettings.upcomingMinutes)
            .setLimits(0, 60, 1)
            .setDynamicTooltip()
            .onChange(async (value: number) => {
            await writeSettings(
                (old) => (old.displaySettings.upcomingMinutes = value)
            );
            logger.info(`Upcoming minutes updated: ${value}`);
            
            // Clear the existing timeout if there is one
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }

            // Set a new timeout
            timeoutId = setTimeout(() => {
                new Notice(`[TaskCard] Upcoming minutes updated: ${value}.`);
                // Reset timeoutId to null when the notice is shown
                timeoutId = null;
            }, 2000);  // 2000 milliseconds = 2 seconds delay
            });
        });

    new Setting(containerEl)
        .setName('Default Query Display Mode')
        .setDesc('The default display mode when displaying a task query.')
        .addDropdown((dropdown) => {
        dropdown
            .addOptions({
                'list': 'List Mode',
                'matrix': 'Eisenhower Matrix Mode'
            })
            .setValue(pluginSettings.displaySettings.defaultQueryDisplayMode)
            .onChange(async (value: string) => {
            await writeSettings(
                (old) => (old.displaySettings.defaultQueryDisplayMode = value)
            );
            logger.info(`Query display mode updated: ${value}`);
            new Notice(`[TaskCard] Query display mode updated: ${value}.`);
            }
            );
        }
        );
}