# Set up Google Calendar sync for Task Card

> [!NOTE]
> The guided setup takes about five minutes. You create your own Google Cloud
> credentials; Task Card does not ship or share a Google client.

## Use the in-app setup guide

In Obsidian, go to **Settings → Task Card → Google Calendar sync** and click
**Open setup guide**. The wizard keeps the instructions beside you and walks
through these five steps.

## Step 1: Create a Google Cloud project

- Open the Google Cloud project creation page from the wizard.
- Give the project a recognizable name, such as `Obsidian TaskCard`.
- Create the project and make sure it remains selected in the console's top bar.

## Step 2: Enable the Google Calendar API

- Open the Google Calendar API library page from the wizard.
- Check that the project you just created is selected.
- Click **Enable**.

## Step 3: Configure the OAuth consent screen

- Choose **External** for the audience.
- Use `Obsidian TaskCard` for the app name.
- Enter your email for both required email fields, then save through the
  remaining screens.
- Add your own Google account as a test user.

> [!NOTE]
> While the app is in testing mode, Google shows an "unverified app" warning
> when you connect. Click **Continue**. Test-user refresh tokens are the normal,
> supported path for personal use.

## Step 4: Create OAuth credentials

- Create an **OAuth client ID**.
- Set **Application type** to **Desktop app**.
- Give the client a recognizable name, such as `Obsidian TaskCard`.
- Do not add authorized JavaScript origins or redirect URIs. Desktop-app clients
  allow Task Card's local `127.0.0.1` callback automatically.
- Create the client, then keep the dialog containing the client ID and client
  secret open.

> [!IMPORTANT]
> Use **Desktop app**, not **Web application**, for new credentials. Desktop-app
> clients need no origins and no redirect URIs.

## Step 5: Connect

- Copy the client ID and client secret into the wizard.
- The client ID must end with `.apps.googleusercontent.com`. The client secret
  usually starts with `GOCSPX-`.
- Click **Connect**, choose the Google account that you added as a test user,
  and complete Google's consent flow.
- After Task Card shows that it is connected, click **Done** and choose a
  default calendar in settings.

## Web application clients (legacy)

Existing Web application clients continue to work. Keep
`http://127.0.0.1:8888/callback` registered as an authorized redirect URI for
that client. You do not need to replace working credentials, but new setups
should use the simpler Desktop app client type described above.

# How the sync behaves

Sync is **desktop-only** (login needs a local helper server that mobile
Obsidian cannot run); the Google Calendar section of the settings says so on
mobile, and the rest of the plugin is unaffected there.

**Vault → Calendar (push).** Creating, editing, completing, or deleting a
scheduled `#TaskCard` task creates/updates/deletes its calendar event. A task
with a `[duration:: ...]` becomes a timed event of that length.

**Calendar → Vault (pull).** TaskCard checks Google Calendar every 5 minutes
(and on the command *Pull Google Calendar Changes Now*):

- Moving or resizing an event updates the task's `[scheduled::]` and
  `[duration::]` fields in your note.
- Deleting an event in Google Calendar **unlinks** the task — the note is left
  untouched and the task simply stops syncing.
- Event title/description edits in Google Calendar are **not** written into
  your notes.
- If both the note and the event changed since the last sync, **the note
  wins** and its state is pushed back to the calendar.
- Recurring tasks/events sync one-way only (vault → calendar).

# Feedback and problem reports

> [!NOTE]
> If you run into a problem with this tutorial, feel free to
> [contact the author](https://github.com/terryli710/Obsidian-TaskCard/discussions/new/choose)
> for help or
> [give feedback](https://github.com/terryli710/Obsidian-TaskCard/issues/new/choose).
