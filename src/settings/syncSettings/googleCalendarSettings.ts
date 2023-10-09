

import { PluginSettingTab, ButtonComponent, Setting } from 'obsidian'; // Assuming obsidian types based on the code context.
import { GoogleCalendarLogin } from '../../api/googleCalendarAPI/authentication';
import { ProjectModule } from '../../taskModule/project';


export function googleCalendarSyncSettings(
    containerEl: HTMLElement,
    pluginSettings: any, // Adjust with the specific type.
    writeSettings: Function,
    display: Function,
    projectModule: ProjectModule,
): void {
    const googleSettings = pluginSettings.syncSettings.googleSyncSetting;
    let loginButton: ButtonComponent;

    // Google login settings
    new Setting(containerEl)
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
                href: 'docs/google-calendar-sync-setup.md', // TODO: correct this link.
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
    .addButton(button => {
        const isLoggedIn = googleSettings.isLogin;
        
        loginButton = button
            .setButtonText(isLoggedIn ? "Logout" : "Login")
            .onClick(async () => {
                if (isLoggedIn) {
                    // Handle logout logic here if necessary.
                    googleSettings.isLogin = false;
                    writeSettings(old => old.syncSettings.googleSyncSetting.isLogin = false);
                } else {
                    const loginSuccess = await GoogleCalendarLogin();
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

    // Task sync filter settings
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
    if (doesNeedFilters) {

        // Task filter settings
        new Setting(containerEl)
        .setName("Tag Filter")
        .addText(text => {
            text
            .setPlaceholder('Tag to filter, e.g. #calendar')
            .setValue(filterTag)
            .onChange(value => {
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