# Proposal

## Why

Users of GREEN-API need a simple web interface for exchanging text messages in MAX. They should not have to make raw API calls. The repository is empty, so this change builds the first version of the application: a minimal chat client in the style of web.max.ru that sends messages through `SendMessage` and receives them through the HTTP API (`ReceiveNotification` / `DeleteNotification`).

## What Changes

- New SPA on React + TypeScript + Vite with no backend. Requests go straight from the browser to GREEN-API, which allows CORS. `apiUrl` comes from the environment variable `VITE_GREEN_API_URL`.
- Login screen: the user enters `idInstance` and `apiTokenInstance`. The app checks the credentials and instance state (`getStateInstance`) and the notification settings (`getSettings`). Logging out clears all state.
- Creating a chat by recipient phone number: the number is normalized to digits in international format with no country restriction (length check only, E.164), checked with `checkAccount`, and the numeric MAX `chatId` becomes the chat key. Duplicate chats are not created.
- Sending text messages: the message is shown immediately, gets a "not sent" status with a retry button on error, and is validated (no empty messages, at most 4000 characters).
- Receiving messages: one `receiveNotification` → `deleteNotification` loop with retries and backoff. Every notification is removed from the queue. Notifications from before login are discarded. Group chats are ignored.
- Merging outgoing copies: the local message is replaced with the server copy by `idMessage`, including the case where the server notification arrives before the `sendMessage` response.
- A chat is created automatically when a message arrives from an unknown sender.
- Interface modeled on web.max.ru: chat sidebar, chat window with a header, message bubbles, input field, and auto-scroll.
- State is kept in memory only. Nothing is stored in `localStorage`.
- The message model is ready for new content types: `content` is a discriminated union that currently has only `text`.

## Capabilities

### New Capabilities

- `instance-session`: login with GREEN-API instance credentials, instance state and settings checks, logout with state cleanup.
- `chat-management`: creating a chat by phone number through `checkAccount`, the chat list, automatic chat creation for incoming messages, and switching the active chat.
- `messaging`: sending text messages, displaying incoming and outgoing messages, send statuses and retries, merging local and server copies.
- `notification-receiving`: the HTTP API polling loop, queue processing, notification filtering, and resilience to network errors.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- **Code:** a new Vite application in the repository root, structured with Feature-Sliced Design (`src/app`, `pages`, `widgets`, `features`, `entities`, `shared`).
- **Dependencies:** `react`, `react-dom`, `zustand`, `axios`; dev dependencies: `vite`, `typescript`, `@vitejs/plugin-react`, `vitest`, `steiger` + `@feature-sliced/steiger-plugin` (FSD linter).
- **External systems:** GREEN-API methods `getStateInstance`, `getSettings`, `checkAccount`, `sendMessage`, `receiveNotification`, `deleteNotification`. The instance must have `webhookUrl` empty and `incomingWebhook` enabled.
- **Configuration:** `.env` with `VITE_GREEN_API_URL`. The value is baked in at build time.
- **Security:** the instance token is part of request URLs and must not appear in logs or in errors shown to the user.
