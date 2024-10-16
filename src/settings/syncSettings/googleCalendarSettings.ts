

import { ButtonComponent, Setting, Notice } from 'obsidian'; // Assuming obsidian types based on the code context.
import { ProjectModule } from '../../taskModule/project';
import { GoogleCalendarAPI } from '../../api/googleCalendarAPI/calendarAPI';
import { SettingStore, SyncSetting, TaskCardSettings } from '../../settings';
import { logger } from '../../utils/log';

export interface GoogleSyncSetting extends SyncSetting {
    clientID: string;
    clientSecret: string;
    doesNeedFilters: boolean;
    filterTag: string;
    filterProject: string;
    defaultCalendarId: string;
}

export async function googleCalendarSyncSettings(
    containerEl: HTMLElement,
    pluginSettings: TaskCardSettings,
    writeSettings: Function,
    display: Function,
    projectModule: ProjectModule,
    googleCalendarAPI: GoogleCalendarAPI,
): Promise<void> {
    const googleSettings: GoogleSyncSetting = pluginSettings.syncSettings.googleSyncSetting;
    let loginButton: ButtonComponent;

    // 1. Google login settings
    const googleLoginSettings = new Setting(containerEl)
    .setName("Login via Google")
    .addText(text => {
        text
        .setPlaceholder('Client ID')
        .setValue(googleSettings.clientID)
        .onChange(value => {
            writeSettings(old => old.syncSettings.googleSyncSetting.clientID = value);
        })
        .setDisabled(googleSettings.isLogin);
    })
    .setDesc(createFragment(frag => {
        frag.appendText('You need to create a Google Calendar API enabled client to use this feature. Refer to ');
        frag.createEl(
            'a',
            {
                text: 'the documentation',
                href: 'https://github.com/terryli710/Obsidian-TaskCard/blob/main/docs/google-calendar-sync-setup.md',
            }
        );
        frag.appendText(' for more details.');
    }))
    .addText(text => {
        text
        .setPlaceholder('Client Secret')
        .setValue(googleSettings.clientSecret)
        .onChange(value => {
            writeSettings(old => old.syncSettings.googleSyncSetting.clientSecret = value);
        })
        .setDisabled(googleSettings.isLogin);
    })

    if (googleSettings.isLogin) {
        googleLoginSettings.addButton(button => {
            button
            .setButtonText("Test Login")
            .onClick(async () => {
                if (!googleCalendarAPI) {
                    new Notice(`[TaskCard] Google Calendar API is not defined.`);
                    return;
                }
                const calendars = googleCalendarAPI.listCalendars();
                if (!calendars) {
                    new Notice(`[TaskCard] Failed to list calendars. Login status test failed.`);
                    return;
                } else {
                    new Notice(`[TaskCard] Login status test passed.`);
                }

            })
        })
    }

    googleLoginSettings.addButton(button => {
        const isLoggedIn = googleSettings.isLogin;
        
        loginButton = button
            .setButtonText(isLoggedIn ? "Logout" : "Login")
            .onClick(async () => {
                if (isLoggedIn) {
                    // Handle logout logic here if necessary.
                    googleSettings.isLogin = false;
                    writeSettings(old => old.syncSettings.googleSyncSetting.isLogin = false);
                } else {
                    const loginSuccess = await googleCalendarAPI.authenticator.login();
                    if (loginSuccess) {
                        googleSettings.isLogin = true;
                        writeSettings(old => old.syncSettings.googleSyncSetting.isLogin = true);
                    }
                }
                display();
            });
    });
    if (googleSettings.isLogin) {
        loginButton.setWarning();
    }

    let doesNeedFilters: boolean = pluginSettings.syncSettings.googleSyncSetting.doesNeedFilters;

    // Settings after login
    // logger.debug(`googleSetting.isLogin: ${googleSettings.isLogin}, googleCalendarAPI is not defined: ${!googleCalendarAPI}`);
    if (googleSettings.isLogin && googleCalendarAPI) {
        logger.info(`[TaskCard] loading settings after login`);
        // 2. Google default calendar selection
        const calendars = googleCalendarAPI.getCalendars();
        const calendarOptions: Record<string, string> = {};
        (await calendars).forEach((calendar) => {
            calendarOptions[calendar.id] = calendar.summary;
        });

        new Setting(containerEl)
        .setName("Default Calendar")
        .addDropdown(dropdown => {
            dropdown
                .addOptions(calendarOptions)
                .setValue(googleSettings.defaultCalendarId)
                .onChange(value => {
                    writeSettings(old => old.syncSettings.googleSyncSetting.defaultCalendarId = value);
                })
        })

        // 3. Task sync filter settings
        new Setting(containerEl)
        .setName("Task Sync Filter")
        .then((setting) => {
            setting.descEl.appendChild(
                createFragment((frag) => {
                    frag.appendText(
                        "Turn on this setting if you want only a subset of tasks to be synced with Google Calendar. "
                    );
                    frag.createEl('br');
                    frag.appendText("- Adding a tag/project filter means that ONLY tasks with that tag/project will be synced. ");
                    frag.createEl('br');
                    frag.appendText("- Adding BOTH filters means that tasks with both the tag and the project will be synced.");
                })
            );
        })
        .addToggle(toggle => {
            toggle
            .setValue(doesNeedFilters)
            .onChange(value => {
                doesNeedFilters = value;
                writeSettings(old => old.syncSettings.googleSyncSetting.doesNeedFilters = value);
                display();
            })
        })

        // if filter is turned on
        let filterTag: string = pluginSettings.syncSettings.googleSyncSetting.filterTag;
        let filterProject: string = pluginSettings.syncSettings.googleSyncSetting.filterProject;
        let indicatorTag: string;
        SettingStore.subscribe((settings) => {
            indicatorTag = settings.syncSettings.googleSyncSetting.filterTag;
        });
        if (doesNeedFilters) {

            // Task filter settings
            new Setting(containerEl)
            .setName("Tag Filter")
            .addText(text => {
                text
                .setPlaceholder('Tag to filter, e.g. #calendar')
                .setValue(filterTag)
                .onChange(value => {
                    if (value === indicatorTag) {
                        new Notice("Tag filter and indicator tag filter cannot be the same.");
                        logger.error("Tag filter and indicator tag filter cannot be the same.");
                        return;
                    }
                    filterTag = value;
                    writeSettings(old => old.syncSettings.googleSyncSetting.filterTag = value);
                })
            })

            // Project filter settings
            new Setting(containerEl)
            .setName("Project Filter")
            .addDropdown(dropdown => {
                const projects = projectModule.getProjectsData();
                dropdown
                .addOption('', 'No filter')
                .addOptions(projects.reduce((acc, project) => {
                    acc[project.id] = project.name;
                    return acc;
                }, {}))
                .setValue(filterProject)
                .onChange(value => {
                    filterProject = value;
                    writeSettings(old => old.syncSettings.googleSyncSetting.filterProject = value);
                })
            })
        }
    }
}