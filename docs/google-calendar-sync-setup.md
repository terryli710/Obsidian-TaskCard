

# Create a New Client of Google Calendar to Use Google Calendar Sync of Task Card Obsidian

## Step 1: Create a new project in Google Cloud Platform

- Go to [Google Cloud Platform Console](https://console.cloud.google.com/welcome/);
- Create a project:
  - Navigate to [Create Project](https://console.cloud.google.com/projectcreate);
  - Or just click on the `Create Project` button;
- Give the project a name;
- Click on the `Create` button;

## Step 2: Enable Google Calendar API

- In your new project, search for [Google Calendar API](https://console.cloud.google.com/marketplace/product/google/calendar-json.googleapis.com) and enable it.

## Step 3: Set `OAuth Consent Screen`
- Go to the [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent) tab of your project.
- **OAuth Consent Screen**:
  - Select **User Type** = `External`;
  - Click on **Create**;
  - Put in your App Information:
    - **Application Name** = `Obsidian Task Card`;
    - **User Support Email** = Your Email;
    - **Developer contact information** = Your Email;
  - Click on **Save and Continue**;
- **Scopes**:
  - Click on **Add or Remove Scopes**;
  - Choose these Scopes:
    - **Scope** = `.../auth/userinfo.email`;
    - **Scope** = `.../auth/userinfo.profile`;
    - **Scope** = `openid`;
    - **API** = `Google Calendar API` (you can search for API name in the filter);
  - Click on **Update**;
  - You should see 3 fields in **Your non-sensitive scopes**:
    - `.../auth/userinfo.email`
    - `.../auth/userinfo.profile`
    - `openid`
  - And 1 field in **Your sensitive scopes**:
    - `Google Calendar API`
  - Click on **Save and Continue**;
- Test Users:
  - Click on **ADD USERS**;
  - Input your email;
  - Click on **ADD**;
  - You should see your email showing in the **User information**;
  - Click on **Save and Continue**;
- Summary:
  - Click on **BACK TO DASHBOARD**;

## Step 4: Setup Credentials

- Go to the [Credentials](https://console.cloud.google.com/apis/credentials) tab of your project.
- Click on **CREATE CREDENTIALS**;
- Select **OAuth Client ID**;
- **Application type** = `Web Application`;
- **Name** = `Obsidian Task Card`;
- **Authorized JavaScript origins** = `http://127.0.0.1:8888`;
- **Authorized redirect URIs** = `http://127.0.0.1:8888/callback`;
- Click on **CREATE**;

## Copy and Paste Your Client ID and Secret