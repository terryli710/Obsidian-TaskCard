# TaskCard

**Interactive task cards for Obsidian — stored as plain markdown.**

TaskCard turns any tagged markdown task into an interactive card with priorities, due dates, projects, labels, durations, and recurrence — plus queryable task lists, an Eisenhower matrix, and two-way Google Calendar sync. Everything is saved in your notes as readable text.

![Create a task and complete it as a card](assets/Quick%20Start.gif)

## Plain text first

A TaskCard task is an ordinary markdown task with visible, human-readable fields:

```markdown
- [ ] Book flights to Tokyo #travel #TaskCard [priority:: high] [due:: 2026-07-18] [project:: Japan Trip] ^tc-b3xr9d
```

- **Readable anywhere.** GitHub, VS Code, a phone's text editor — the task makes sense without the plugin.
- **Nothing hidden in your notes.** No invisible JSON, no proprietary blobs. Uninstall TaskCard and your files are exactly what you see.
- **Built from native pieces.** Fields use Dataview's inline-field syntax, labels are real `#tags`, and each task's identity is a native block id (`^tc-…`) that you can link to and that survives moving the line around.
- **Plays well with others.** Dataview indexes every field natively, and tasks written by the [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin (emoji or dataview flavor) are recognized as-is — they keep their original dialect until you edit them through a card.

## Capture tasks fast

Write a markdown task, add the indicator tag (default `#TaskCard`), and it becomes a card in reading view:

![Adding a task](assets/Add%20A%20Task.gif)

- **Autosuggest while you type.** Typing `[` after a task offers the available fields; each field then suggests values — including natural-language dates like `tomorrow` or `next fri 2pm`, which are resolved and written as real dates.
- **Quick add.** The *Quick add task* command opens a one-line capture box that understands shorthand: `Review PR tomorrow 3pm for 1h !high #code @Work every week`.
- **Live Preview stays tidy.** In editing mode, field syntax is styled into compact chips instead of raw brackets, so metadata doesn't drown the task text.

## Edit everything in place

Cards have two display modes: a one-line preview that sits at normal task height, and a detailed mode for working with all attributes. Click a preview card to expand it, then click any attribute to edit it in place — content, description, due, scheduled time, duration, recurrence, labels, project, priority:

![Editing a task card](assets/Modify%20A%20Task.gif)

- Indented lines under a task become its **description**; child checkboxes become **subtasks**, and the card tracks their progress.
- Edits patch only the task's own lines in the file — TaskCard never rewrites your whole note.
- Completing a **recurring task** (`[repeat:: every week]`, using Tasks' recurrence grammar) completes it in place and inserts the next occurrence on the line below.

## Query your tasks anywhere

Drop a `taskcard` code block into any note to get a live task list. A visual editor lets you filter by project, label, priority, completion, schedule window, or file path — no query language to learn:

![Building a query](assets/Add%20A%20Query.gif)

````markdown
```taskcard
project: ["Japan Trip"]
completed: [false]
editMode: false
```
````

Tasks can be completed right from the results, and clicking a result jumps to its source line. Queries need the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin enabled — it powers the task index.

## Plan your week with the matrix

Add `display: "matrix"` to a query block to lay the results out as an Eisenhower matrix — importance from priority, urgency from due dates:

![Weekly review with the Eisenhower matrix](assets/Plan%20Your%20Week.gif)

## Two-way Google Calendar sync

Link tasks to Google Calendar and they stay in sync in both directions (desktop only):

- Scheduled tasks are pushed as events, durations included.
- Reschedules and resizes made in Google Calendar flow back into the task's `[scheduled::]` and `[duration::]` fields.
- Conflicts resolve in favor of your notes; events deleted remotely are unlinked cleanly.
- A guided in-app wizard walks through the one-time OAuth setup with your own credentials.

Setup and behavior details: [Google Calendar sync guide](docs/google-calendar-sync-setup.md).

## Installation

TaskCard is not yet in the community plugin market.

**With [BRAT](https://tfthacker.com/BRAT)** (recommended): add `terryli710/Obsidian-TaskCard` as a beta plugin.

**Manual:** download `plugin-release.zip` from the [latest release](https://github.com/terryli710/Obsidian-TaskCard/releases), unzip it, and place the folder in your vault's `.obsidian/plugins/` directory.

## FAQ

**Do I need Dataview?**
Only for query blocks and the matrix — the task index is built on it. Cards themselves render without it.

**Does it work on mobile?**
Cards and queries work on mobile; Google Calendar sync is desktop-only (it needs a local OAuth callback server).

**What about my existing tasks?**
Tasks in the Tasks plugin's emoji or dataview format just need the indicator tag to render as cards. Tasks from TaskCard versions before the plain-text format can be converted vault-wide with the *Migrate Legacy Tasks to the New Format* command.

**A card looks wrong in my theme.**
Card styling aims to follow your theme's variables, but not every theme has been tested. Please [open an issue](https://github.com/terryli710/Obsidian-TaskCard/issues) with the theme name.

## License

[Apache 2.0](LICENSE)
