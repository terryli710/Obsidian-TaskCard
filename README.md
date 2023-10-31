# Obsidian-TaskCard



## Table of Contents
- [Obsidian-TaskCard](#obsidian-taskcard)
  - [Table of Contents](#table-of-contents)
  - [Highlights](#highlights)
  - [Features](#features)
  - [Examples](#examples)
    - [Usage Preview](#usage-preview)
    - [Add a task](#add-a-task)
    - [Edit a task](#edit-a-task)
    - [Query](#query)
  - [Usage](#usage)
    - [Task Creation](#task-creation)
      - [Create a task](#create-a-task)
      - [Add normal attributes to a task](#add-normal-attributes-to-a-task)
      - [Add special attributes to a task](#add-special-attributes-to-a-task)
    - [Task Modification](#task-modification)
    - [Create a query](#create-a-query)
  - [Installation](#installation)
    - [Obsidian Plugins](#obsidian-plugins)
    - [Manual](#manual)
    - [Beta Testing](#beta-testing)
  - [License](#license)
  - [Frequently Asked Questions](#frequently-asked-questions)
    - [1. Why do some user interface elements appear incorrect? What steps can be taken to resolve this?](#1-why-do-some-user-interface-elements-appear-incorrect-what-steps-can-be-taken-to-resolve-this)

## Highlights

Obsidian-TaskCard is an Obsidian plugin designed to revolutionize your task management experience within Obsidian. It offers a visually appealing and efficient way to organize and manage your tasks. With two distinct display modes and a plethora of features like tags, projects, and descriptions, Obsidian-TaskCard turns your Obsidian vault into a powerful task management tool.

## Features

- **Intuitive and easy-to-use**: the plugin doesn't deviate you from <u>*normal markdown task workflow*</u>. You can create, modify, delete your tasks very similarly when you are using pure markdown in Obsidian. Just by adding a tag (indicator tag in the settings) you can turn your tasks into a task card, which supports two display modes and that allows you to see and edit all attributes of a task, such as the project, schedule date, and description.

- **Two Display Modes**: Choose between two display modes for your tasks.
    - **Preview Mode**: Designed for quick browsing, this mode displays tasks at the same height as a normal markdown task, showing only the most essential information.
    - **Detailed Mode**: This mode provides a comprehensive task card that allows you to see and edit all attributes of a task, such as the project, schedule date, and description.

- **Schedule Date**: Add a schedule date to your tasks to indicate when the task is schedule.

- **Tags and Projects**: Easily categorize your tasks with tags and associate them with specific projects.
  
- **Task Descriptions**: Add detailed descriptions to your tasks to capture additional information and context. You can also use the description to create sub tasks, the same way you do in normal markdown. The task card will track the progress of the sub tasks.


## Examples

### Usage Preview



![quick-start](assets/Quick%20Start.gif)

### Add a task

![add-a-task](assets/Add%20A%20Task.gif)

### Edit a task

![edit-a-task](assets/Modify%20A%20Task.gif)

### Query

![query](assets/Add%20A%20Query.gif)


## Usage

### Task Creation

Attributes | Addition | Example |
--- | --- | ---
Content | Task in markdown | `- [ ] some content` |
Tag | Tag in markdown | `- [ ] some content #tag` |
Description | Description in markdown (change line + indent) | `- [ ] some content \n    - some description` |
Schedule Date | Special attribute: `schedule` | `%%* schedule: 2021-01-01 *%%` |
Project | Special attribute: `project` | `%%* project: project name *%%` |

#### Create a task 
- Create a task in the normal way by typing `- [ ] some content`;
- To make it recognizable as a task card, add a tag (indicator tag in the settings, default to "`#TaskCard`") to the task.

#### Add normal attributes to a task
Some attributes are native for a markdown task, we can add them to the task in the same way as normal markdown.
- Tags: add tags in the content. e.g. `- [ ] some content #tag`;
- Description: Add description to the task in the same way as normal markdown. e.g.
```markdown
- [ ] some content
  - some description
  - [ ] sub task
```

#### Add special attributes to a task
Some added ingredients for a task card, we can add them in a special way: `%%* key: value *%%`. this is will show nicely in the editing mode of obsidian, while invisible in the preview mode.
- Schedule Date: Add a schedule date to the task. e.g. `%%* schedule: 2021-01-01 *%%`
- Project: Add a project to the task. e.g. `%%* project: project name *%%`

### Task Modification
- Tasks are shown in two view: preview and detailed views. Most attributes are editable in the detailed view.
- Add `description`, `schedule`, and `project`: click the ⋮ button in the bottom right corner.
- Add `tags`: click the + button.
- Add `priority`: right click the checkbox.
- Modify `description`, `schedule`: click on them.
- Modify `tags`: right click on the tag and select `edit`.
- Modify `project`: click on the project color dot.
- Modify `priority`: right click on the checkbox.

### Create a query
- Create a query by inserting a code block of `taskcard`.
    ```markdown
    >>> ```taskcard
    >>> 
    >>> ```
    ```
    - You don't have to create anything, the plugin will parse it and display the query for you.
- Use command (⌘ + p) - "Task Card: Add Query". It will automatically add the query code block at your cursor position.


## Installation

### Obsidian Plugins

The plugin will be available on Obsidian's plugin market when it reaches version 1.0.0.

### Manual

1. Go to the [releases page](https://github.com/terryli710/Obsidian-TaskCard/releases).
2. Select the latest stable release.
3. Download the `plugin-release.zip` file.
4. Unzip the downloaded file.
5. Place the unzipped folder under your Obsidian plugins folder.

### Beta Testing

To test some of the features in the pre-release versions, you can use [this plugin](https://tfthacker.com/BRAT). After installation, follow these steps:

1. In the plugin setting, click on `Add Beta plugin with frozen version`.
2. In the popup modal, input the following:

```
url: https://github.com/terryli710/Obsidian-TaskCard
version: x.x.x
```

<!-- ## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) to get started. -->

## License

This project is licensed under the Apache License - see the [LICENSE.md](LICENSE.md) file for details.


## Frequently Asked Questions

### 1. Why do some user interface elements appear incorrect? What steps can be taken to resolve this?
- **Theme Compatibility**: Our plugin has not been exhaustively tested across all available themes. Therefore, compatibility issues related to the active theme could lead to the user interface not displaying as intended. To address this:
  - Ensure your theme is up-to-date;
  - Use the plugin settings to switch to a different theme for troubleshooting purposes.

Should the issue persist, we welcome you to report it by opening an [issue](https://github.com/terryli710/Obsidian-TaskCard/issues) on our GitHub repository.
