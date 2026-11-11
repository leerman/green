# MAX Chat

A minimal web chat for [MAX](https://max.ru) on top of [GREEN-API](https://green-api.com), styled after web.max.ru.

Log in with your GREEN-API instance credentials. You can then start chats by phone number and exchange text messages. Replies, and messages sent from your phone, show up in the same chats. The app is a single-page React app with no backend: the browser calls GREEN-API directly.

- Sends messages with `sendMessage`.
- Receives messages over the HTTP API (`receiveNotification` / `deleteNotification`) with a single long-polling loop.
- Creates chats by phone number with `checkAccount`. A chat is also created automatically when a message arrives from an unknown sender.
- Keeps everything in memory only. Reloading the page or logging out clears all state.

## Instance requirements

You need a GREEN-API instance for MAX that is **authorized** (state `authorized`). In the instance settings:

| Setting           | Value   | Why                                                                      |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `webhookUrl`      | empty   | When a webhook URL is set, notifications go there instead of the HTTP API queue |
| `incomingWebhook` | `yes`   | Otherwise incoming messages are not reported                             |

To see messages you send from your phone, also enable `outgoingWebhook` / `outgoingMessageWebhook`. Enable `outgoingAPIMessageWebhook` as well, so the server copies of messages sent from this app are received.

The app checks `webhookUrl` and `incomingWebhook` on login and shows a warning if they are wrong. The warning does not block login.

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
  app/        entry point, styles, session lifecycle (starts/stops polling, clears chats)
  pages/      login, messenger
  widgets/    sidebar (chat list, new chat, warnings), chat-window (header, messages, input)
  features/   auth, logout, create-chat, send-message, receive-notifications
  entities/   session, chat (state + applyEvent), message (types + bubble)
  shared/     api/green-api (axios client, ApiError), config, lib/phone, ui
```

Key parts:

- `entities/chat/model/apply-event.ts`: every chat state change is a pure `applyEvent(state, event)`. This covers merging the local and server copies of outgoing messages, which works whichever of the two arrives first.
- `features/receive-notifications`: `mapNotification` filters and maps notifications. The poller runs outside React, with backoff (1, 2, 5, 10 s) and a generation guard.
- `shared/api/green-api`: every request error becomes an `ApiError` without the request URL, so the token never reaches the UI or the console.

## Limitations

- **Text messages only.** Images, files and other message types are ignored. Group chats are ignored.
- **One tab per instance.** The notification queue is shared. With several tabs or apps reading the same instance, each notification goes to only one of them.
- **No history.** Only messages that arrive after login are shown. Notifications from before login are dropped from the queue.
- **The token is visible in the browser's Network tab.** GREEN-API puts the token in the request URL, and without a backend this cannot be hidden. The app does not log or store the token, and it is gone after a reload.
