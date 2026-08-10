import { App, Modal, Notice, Setting } from 'obsidian';
import { Project } from '../taskModule/project';

export class CreateProjectModal extends Modal {
  result: Partial<Project> = {
        id: '',
        name: '',
        color: ''
    };
  onSubmit: (result: Partial<Project>) => boolean;

  constructor(app: App, onSubmit: (result: Partial<Project>) => boolean) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h1', { text: "Task Card: Create a Project" });

    new Setting(contentEl)
        .setName('Project Name')
        .setDesc('The name of the project. Cannot be empty.')
        .addText((text) =>
      text.onChange((value) => {
        this.result.name = value;
      })
    );

    new Setting(contentEl)
        .setName('Project Color')
        .setDesc('The color of the project. Optional. If not provided, a random color will be assigned.')
        .addColorPicker((colorPicker) =>
      colorPicker.onChange((value) => {
        this.result.color = value;
      })
    );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('Submit')
        .setCta()
        .onClick(() => {
          this.close();
        })
    );
  }

  checkValidity() {
    // check if the project name is valid (not empty)
    if (!this.result.name) {
      return false;
    } else {
      return true;
    }
  }

  onClose() {
    // Clear content first
    let { contentEl } = this;
    contentEl.empty();

    // Check validity
    if (!this.checkValidity()) {
        new Notice('[TaskCard] Project name cannot be empty.');
        return; // Exit function early if not valid
    }

    // Handle submission
    const result = this.onSubmit(this.result);
    if (result === true) {
        new Notice(`[TaskCard] Project created: ${this.result.name}`);
    } else {
        new Notice('[TaskCard] Project creation failed. Make sure the project name is unique.');
    }
}

}
