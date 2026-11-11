# Spec Delta

## Purpose

Lets a user sign in to the app with the credentials of their GREEN-API instance for MAX, verifies that the instance can receive and send messages, and lets the user end the session.

## ADDED Requirements

### Requirement: Login with instance credentials
The system SHALL show a login screen with `idInstance` and `apiTokenInstance` fields. Both fields are required. The GREEN-API base URL SHALL come from build configuration and SHALL NOT be entered by the user.

#### Scenario: Empty fields
- **WHEN** the user submits the form with at least one field empty
- **THEN** the system does not send any requests and points to the empty field

#### Scenario: Successful login
- **WHEN** the user enters valid credentials of an authorized instance and submits the form
- **THEN** the system shows the chat interface

### Requirement: Instance state check on login
On login, the system SHALL request the instance state. It SHALL allow login only if the instance is authorized, and SHALL distinguish wrong credentials from an unauthorized instance.

#### Scenario: Wrong credentials
- **WHEN** GREEN-API responds to the state request with an authorization error (401 or 403)
- **THEN** the system stays on the login screen and shows the message "Invalid idInstance or apiTokenInstance"

#### Scenario: Instance not authorized
- **WHEN** the instance state is anything other than `authorized`
- **THEN** the system stays on the login screen and reports that the instance is not authorized in MAX, including the state it received

#### Scenario: Network unavailable
- **WHEN** the state request fails because of a network error
- **THEN** the system stays on the login screen and reports a connection error

### Requirement: Notification settings check on login
After a successful state check, the system SHALL request the instance settings. If they prevent receiving messages over the HTTP API, the system SHALL warn the user and say which settings to change. The warning SHALL NOT block login.

#### Scenario: webhookUrl is set
- **WHEN** the instance settings have a non-empty `webhookUrl`
- **THEN** the system shows a warning that incoming messages will not arrive until `webhookUrl` is cleared

#### Scenario: Incoming notifications disabled
- **WHEN** the instance settings have `incomingWebhook` set to anything other than `yes`
- **THEN** the system shows a warning that incoming notifications must be enabled

#### Scenario: Settings are correct
- **WHEN** `webhookUrl` is empty and `incomingWebhook` is `yes`
- **THEN** the system shows no warnings

### Requirement: Session state in memory only
The system SHALL keep credentials, chats, and messages only in page memory and SHALL NOT write them to persistent browser storage.

#### Scenario: Page reload
- **WHEN** the user reloads the page after logging in
- **THEN** the system shows the login screen with no chats

### Requirement: Logout
The system SHALL provide a logout action. Logout SHALL stop receiving notifications and clear credentials, chats, and messages.

#### Scenario: Logout and log in to a different instance
- **WHEN** the user logs out and logs in with different credentials
- **THEN** the new session has no chats or messages from the previous one, and no requests are sent with the previous credentials

### Requirement: Token protection
The system SHALL NOT write `apiTokenInstance` or request URLs that contain it to the browser console. It SHALL NOT show them in error messages in the interface.

#### Scenario: API error
- **WHEN** any GREEN-API request fails
- **THEN** the message shown to the user and anything written to the console contain no token
