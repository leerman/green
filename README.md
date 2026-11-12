# MAX Chat

A minimal web chat for [MAX](https://max.ru) on top of [GREEN-API](https://green-api.com), styled after web.max.ru.

Log in with your GREEN-API instance credentials. The sidebar fills with your existing MAX chats, and opening a chat loads its recent history. You can start new chats by phone number and exchange text messages. Replies, and messages sent from your phone, show up in the same chats. The app is a single-page React app with no backend: the browser calls GREEN-API directly.

- Loads the chat list with `getChats` at login, in MAX's activity order. Each chat's latest message, when it is text, becomes its preview in the sidebar.
- Loads a chat's last 100 messages with `getChatHistory` the first time you open it. History requests run one at a time, at least 1.5 s apart, and an HTTP 429 is retried automatically up to 2 times.
- Sends messages with `sendMessage`. Channels are read-only: they show a "Read-only channel" footer instead of the input.
- Receives messages over the HTTP API (`receiveNotification` / `deleteNotification`) with a single long-polling loop, in personal chats, groups, channels, and bots. In groups, each incoming message shows its sender's name.
- Creates chats by phone number with `checkAccount`. A chat is also created automatically when a message arrives from an unknown sender.
- Keeps everything in memory only. Reloading the page or logging out clears all state; the next login loads chats and history from GREEN-API again.

## Instance requirements

You need a GREEN-API instance for MAX that is **authorized** (state `authorized`). In the instance settings:

| Setting                     | Value | Why                                                                             |
| --------------------------- | ----- | ------------------------------------------------------------------------------- |
| `webhookUrl`                | empty | When a webhook URL is set, notifications go there instead of the HTTP API queue |
| `incomingWebhook`           | `yes` | Otherwise incoming messages are not reported                                    |
| `outgoingMessageWebhook`    | `yes` | Shows messages you send from your phone                                         |
| `outgoingAPIMessageWebhook` | `yes` | Delivers the server copy of messages sent from this app                         |

The app checks all four settings on login and shows a warning for any that are wrong. The warning does not block login.

## Getting started

Requirements: Node.js 22.18+ and npm.

```bash
npm install
cp .env.example .env    # edit if you use a different GREEN-API host
npm run dev             # http://localhost:5173
```

### Configuration

| Variable             | Example                     | Description                   |
| -------------------- | --------------------------- | ----------------------------- |
| `VITE_GREEN_API_URL` | `https://api.green-api.com` | GREEN-API base URL (`apiUrl`) |

The value is baked in at build time. Changing it requires a rebuild. If it is not set, `https://api.green-api.com` is used.

## Commands

| Command             | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Start the dev server                                           |
| `npm run build`     | Type-check and build a static bundle into `dist/`              |
| `npm run preview`   | Serve the built bundle locally                                 |
| `npm test`          | Run unit tests (Vitest)                                        |
| `npm run typecheck` | Type-check the project                                         |
| `npm run lint:fsd`  | Check the Feature-Sliced Design structure (Steiger)            |

## Project structure

The code follows [Feature-Sliced Design](https://fsd.how). A module may import only from layers below it. Slices on the same layer do not import each other. Each slice is reached only through its `index.ts`. `npm run lint:fsd` enforces these rules.

```
src/
  app/        entry point, styles, session lifecycle (starts/stops polling and loading, clears chats)
  pages/      login, messenger
  widgets/    sidebar (chat list, new chat, warnings), chat-window (header, messages, input)
  features/   auth, logout, create-chat, send-message, receive-notifications, load-chats
  entities/   session, chat (state + applyEvent), message (types + bubble)
  shared/     api/green-api (axios client, ApiError), config, lib/phone, ui
```

Key parts:

- `entities/chat/model/apply-event.ts`: every chat state change is a pure `applyEvent(state, event)`. This covers merging the local and server copies of outgoing messages, which works whichever of the two arrives first.
- `features/receive-notifications`: `mapNotification` filters and maps notifications. The poller runs outside React, with backoff (1, 2, 5, 10 s) and a generation guard.
- `features/load-chats`: maps `getChats` and `getChatHistory` responses, loads the chat list once per session, and loads history through a paced queue. Both loaders are cancelled on logout, and a late response never reaches a later session.
- `shared/api/green-api`: every request error becomes an `ApiError` without the request URL, so the token never reaches the UI or the console.

## Limitations

- **Text messages only.** Photos, video, files, audio, stickers, and polls are not shown, live or in history. A chat's preview and time come from its most recent text message, which may be older than its real latest activity. A chat whose latest message is not text shows no preview until a text message arrives or you open it.
- **No reactions, edits, or deletions.** Reactions are not shown, edited messages keep the text they were loaded with, and deleted messages are not removed from an open chat.
- **Only the latest 100 messages.** `getChatHistory` has no paging, and the server keeps at most 5000 messages or 3 months. Because non-text messages are skipped, a media-heavy chat may show far fewer than 100.
- **No read state.** Opening a chat here does not mark it as read in MAX, and unread counts are not shown.
- **One tab per instance.** The notification queue is shared. With several tabs or apps reading the same instance, each notification goes to only one of them.
- **Notifications from before login are dropped from the queue.** Those messages appear through the chat history when you open the chat.
- **The token is visible in the browser's Network tab.** GREEN-API puts the token in the request URL, and without a backend this cannot be hidden. The app does not log or store the token, and it is gone after a reload.
