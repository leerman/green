# Design

## Context

The repository is empty, so this is a greenfield project (see proposal.md - Why). GREEN-API allows CORS, which means the browser can call it directly and the app does not need its own backend. Key facts about the API that shape the design:

- When sending, `chatId` can be a phone number (`7999...@c.us`) or a numeric MAX ID. Incoming notifications always contain the **numeric** `senderData.chatId`. `checkAccount` returns this numeric `chatId` for a phone number.
- Receiving works through a FIFO queue: `receiveNotification` returns one notification (`{receiptId, body}`) or an empty response after `receiveTimeout` (5–60 s). Unless a notification is confirmed with `deleteNotification`, it is delivered again. The queue keeps notifications for up to 24 hours.
- The token is part of every request URL: `{apiUrl}/waInstance{id}/{method}/{token}`.

## Goals / Non-Goals

**Goals:**
- Structure the app with Feature-Sliced Design (FSD) and enforce its import rules with a linter.
- Keep message state logic (merging copies, races, automatic chat creation, filtering) in pure functions covered by unit tests without React or network.
- Run the receive loop independently of the React component lifecycle.
- Make it possible to add new message types, persistence, or a different delivery transport by changing one slice, without rewriting the rest of the app.

**Non-Goals:**
- Media and other non-text messages, delivery and read statuses, chat history (`getChatHistory`), group chats.
- Several instances open at the same time.
- An abstract transport layer, an event bus, DI. These are not needed at this size and can be extracted when a second implementation appears.
- E2E tests and deployment setup.

## Decisions

### D1. Architecture: Feature-Sliced Design

FSD layers, from top to bottom. A module may import only from layers **below** it. Slices on the same layer do not import each other. Each slice exposes a public API (`index.ts`), and imports reach into a slice only through it.

```
app        initialization, styles, session lifecycle orchestration
  |
pages      login, messenger
  |
widgets    sidebar, chat-window
  |
features   auth, logout, create-chat, send-message, receive-notifications
  |
entities   session, chat, message
  |
shared     api/green-api, config, lib, ui
```

Structure:

```
src/
+-- app/
|   +-- App.tsx                    status === "ready" ? <MessengerPage/> : <LoginPage/>
|   +-- model/session-lifecycle.ts subscribes to session -> starts/stops poller, resets chats
|   +-- styles/                    index.css, theme variables
|   +-- main.tsx
+-- pages/
|   +-- login/ui/LoginPage.tsx
|   +-- messenger/ui/MessengerPage.tsx         layout: Sidebar | ChatWindow
+-- widgets/
|   +-- sidebar/ui/Sidebar.tsx                 chat list + CreateChatForm + LogoutButton
|   |                                          + SessionWarnings + ConnectionStatus
|   +-- chat-window/ui/{ChatWindow,MessageList}.tsx
|                                              ChatHeader + MessageBubble[] + MessageInput
+-- features/
|   +-- auth/            ui/LoginForm.tsx, model/login.ts, lib/check-settings.ts
|   +-- logout/          ui/LogoutButton.tsx
|   +-- create-chat/     ui/CreateChatForm.tsx, model/create-chat.ts
|   +-- send-message/    ui/{MessageInput,RetryButton}.tsx, model/send-message.ts
|   +-- receive-notifications/
|                        model/poller.ts, lib/map-notification.ts, lib/backoff.ts,
|                        ui/ConnectionStatus.tsx
+-- entities/
|   +-- session/  model/store.ts, ui/SessionWarnings.tsx
|   +-- chat/     model/{types,events,apply-event,store}.ts, ui/{ChatListItem,ChatHeader}.tsx
|   +-- message/  model/types.ts, ui/MessageBubble.tsx, @x/chat.ts
+-- shared/
    +-- api/green-api/  client.ts, types.ts, errors.ts (ApiError)
    +-- config/env.ts   VITE_GREEN_API_URL
    +-- lib/phone/      normalize-phone.ts
    +-- ui/             Button, TextField, TextArea, Spinner
```

Slice notes:
- **`entities/chat` and `entities/message`.** A chat contains messages, so `applyEvent` works with both. Cross-entity imports go through FSD's `@x` notation: `entities/message/@x/chat.ts` exports types and helpers only to `chat`.
- **`features/receive-notifications`** has no user action of its own, but it is the "receive messages" scenario. In FSD v2.1, `processes` is deprecated, so the logic goes here. It does not know about `auth`, because cross-imports between features are not allowed.
- **`app/model/session-lifecycle`** connects features without cross-imports. It subscribes to `entities/session`: the transition to `ready` calls `poller.start`, and the transition out of `ready` calls `poller.stop` and `chat.reset`. This is the only place that knows about several features at once.
- **`shared/lib/phone`** is not tied to the domain. It is a generic number normalization function.

Supporting tools:
- The `@/` alias points to `src/` in `tsconfig` and `vite.config`.
- **Steiger**, the official FSD linter, checks layer boundaries, public APIs, and cross-imports. It runs as `npm run lint:fsd` and is part of the verification for every task group.

Alternative: plain layers (`api/domain/store/components`). They were rejected at the user's request. FSD makes boundaries explicit and checks them with a linter, at the cost of more folders.

### D2. State: Zustand stores in entities plus a pure `applyEvent`

- `entities/session` → `useSessionStore`: `credentials`, `api` (client), `loginAt`, `status` (`idle | checking | ready`), `error`, `warnings[]`, `connection` (`online | reconnecting`). Low-level setters only: `setChecking`, `setReady({api, loginAt, warnings})`, `setError`, `setConnection`, `clear`. The entity does not know how login works; that belongs to `features/auth`.
- `entities/chat` → `useChatsStore`: `chats: Record<chatId, Chat>`, `order: chatId[]`, `activeChatId`. Actions: `apply(event)`, `openChat(id)`, `reset()`.
- All chat state transitions go through `applyEvent(state, event) => state` (`entities/chat/model/apply-event.ts`). The store calls it as `apply: ev => set(s => applyEvent(s, ev))`.
- Feature logic (`login`, `createChat`, `sendMessage`, `retry`) lives in the features' `model/` as functions that call the API from the session and `apply` on the chat store. Entities do not depend on features.

Zustand stores are module-level singletons, so state is not cleared when components unmount. Clearing is done explicitly by `session-lifecycle` (D1).

### D3. Data model

`entities/message/model/types.ts`:

```ts
type MessageContent = { type: "text"; text: string };   // discriminated union, extensible
type MessageStatus = "sending" | "sent" | "failed";

interface Message {
  id: string;              // "tmp-<uuid>" until the sendMessage response, then idMessage
  direction: "in" | "out";
  content: MessageContent;
  timestamp: number;       // ms
  status?: MessageStatus;  // outgoing only; server copies are "sent"
}
```

`entities/chat/model/types.ts`:

```ts
interface Chat {
  chatId: string;          // numeric MAX ID, used as the key
  title: string;
  phone?: string;          // normalized, digits only
  messages: Message[];     // in timestamp order
}
```

Domain events (`entities/chat/model/events.ts`):

| Event | Source | Effect |
|---|---|---|
| `chatCreated {chatId, title, phone?}` | features/create-chat | adds the chat if it does not exist |
| `chatOpened {chatId}` | UI | `activeChatId` |
| `messageQueued {chatId, tmpId, text, ts}` | features/send-message | adds `out` with status `sending` |
| `messageSent {chatId, tmpId, idMessage}` | sendMessage response | see D5 |
| `messageFailed {chatId, tmpId}` | sendMessage error | status `failed` |
| `incomingReceived {chatId, idMessage, text, ts, title, phone?}` | features/receive-notifications | auto-creates the chat; ignores a duplicate `idMessage` |
| `outgoingReceived {chatId, idMessage, text, ts}` | features/receive-notifications | see D5; ignored for an unknown chat |

Any event with a message moves its chat to the top of `order`.

### D4. Mapping notifications: `mapNotification(body, loginAt) => ChatEvent | null`

A pure function in `features/receive-notifications/lib/map-notification.ts`. It returns `null` (ignore) when any of these is true:
- `body.timestamp * 1000 < loginAt`
- `typeWebhook` is not one of `incomingMessageReceived`, `outgoingAPIMessageReceived`, or `outgoingMessageReceived`
- `messageData.typeMessage !== "textMessage"` or the text is missing
- `senderData.chatId` is missing or starts with `-` (group)

Fields: `incomingMessageReceived` → `incomingReceived` with title `senderContactName || senderName || chatName || chatId` and `phone = String(senderPhoneNumber)` when present. Both outgoing types → `outgoingReceived`. For outgoing notifications, the text field must be checked against real data (see Open Questions). The function reads it defensively from `textMessageData.textMessage` or `extendedTextMessageData.text`.

### D5. Merging outgoing copies

The key is `idMessage`. `applyEvent` handles two orders:

```
messageSent {tmpId, idMessage}:
  if chat contains a message with id == idMessage  -> remove tmpId (the echo already arrived)
  else                                              -> tmp.id = idMessage, status = "sent"

outgoingReceived {idMessage, ...}:
  if chat unknown                                   -> ignore
  if chat contains id == idMessage                  -> replace with the server copy (status "sent")
  else                                              -> append as a new outgoing message
```

A retry (`features/send-message`, `retry`) reuses the existing message: status `sending` → the same `messageSent`/`messageFailed` path with the same `tmpId`. No new copy is created.

Repeated delivery of a notification (when `deleteNotification` failed) is safe: both `incomingReceived` and `outgoingReceived` are idempotent by `idMessage`.

### D6. The poller lives outside React

`features/receive-notifications/model/poller.ts` exports `start(api, loginAt)` and `stop()`. They are called from `app/model/session-lifecycle.ts` (D1), not from components and not from `features/auth`. Running outside React avoids double effects in StrictMode and keeps the loop out of component lifecycles.

```
loop until aborted:
  try:
    n = await api.receiveNotification({ receiveTimeout: 20, signal })
    if n: 
      ev = mapNotification(n.body, loginAt)
      if ev: useChatsStore.getState().apply(ev)
      await deleteWithRetry(n.receiptId)        // up to 3 attempts at 1 s, then keep going
    backoff.reset(); session.setConnection("online")
  catch (e):
    if aborted: break
    if backoff.attempts >= 3: session.setConnection("reconnecting")
    await sleep(backoff.next(), signal)         // 1, 2, 5, 10, 10, ... s
```

The order is dispatch, then delete. If removal fails, the notification arrives again and is dropped by idempotency. If removal still fails after all attempts, the loop moves on. The next `receiveNotification` returns the same notification, and the attempt repeats naturally.

A generation guard (`runId`) stops a loop from a previous session from writing to the store, even if `stop()` races with an in-flight response.

### D7. API client on axios

`shared/api/green-api/client.ts`: `createApi({ idInstance, apiTokenInstance })` creates an `axios.create({ baseURL: env.greenApiUrl, timeout: 15000 })` instance and the methods:
`getStateInstance`, `getSettings`, `checkAccount(phone:number)`, `sendMessage(chatId, text)`, `receiveNotification({receiveTimeout, signal})`, `deleteNotification(receiptId)`.

- Each URL is built as `/waInstance${id}/${method}/${token}`. The token exists only inside the client closure.
- `receiveNotification` uses its own `timeout = (receiveTimeout + 10) * 1000`. Otherwise axios would abort normal long polling.
- An empty response (`null` or `""`) becomes `null`.
- A response interceptor converts any `AxiosError` into `ApiError { kind, status?, message }` (`errors.ts`) with `kind: "auth" | "limit" | "network" | "server" | "validation" | "canceled"`. The original error, which contains `config.url` with the token, is not passed on. Mapping: 401/403 → auth, 469 → limit, 4xx → validation, 5xx → server, no response → network, `CanceledError` → canceled.
- The app has no `console.*` with request data.
- `shared/api` knows nothing about entities. It returns GREEN-API types (`types.ts`).

Alternative: `fetch`. axios was chosen at the user's request. Its advantages are interceptors and per-request timeouts.

### D8. Login flow (`features/auth/model/login.ts`)

```
login(id, token):
  session.setChecking()
  api = createApi(...)
  state = await api.getStateInstance()        // ApiError auth -> "Invalid credentials"
  if state !== "authorized" -> session.setError(state)
  settings = await api.getSettings()          // on error: a warning, not a block
  warnings = checkSettings(settings)          // lib: webhookUrl != "", incomingWebhook != "yes"
  session.setReady({ api, loginAt: Date.now(), warnings })
  // the poller is started by app/session-lifecycle in reaction to status === "ready"
```

`loginAt` is recorded after the checks, right before the poller starts, so messages that arrive during login are not lost unnecessarily.

Logout (`features/logout`) calls only `session.clear()`. Stopping the poller and resetting chats is done by `session-lifecycle`.

### D9. Creating a chat (`features/create-chat/model/create-chat.ts`)

```
createChat(input):
  phone = normalizePhone(input)               // shared/lib: digits only, 7-15; error -> message, no requests
                                              // country is not checked: the API decides support
  existing = chat with phone == phone -> openChat, return
  r = await api.checkAccount(Number(phone))
  ApiError validation -> "Number cannot be checked in MAX"
  r.status === false -> error r.reason
  !r.exist -> "Number is not registered in MAX"
  chat with r.chatId exists -> fill in phone, openChat, return
  apply(chatCreated); apply(chatOpened)
```

### D10. UI and styles

Layout like web.max.ru (`pages/messenger`): a left sidebar about 320 px wide (`widgets/sidebar`: header with "New chat" and "Log out" buttons, settings warnings, connection indicator, chat list), and a chat window on the right (`widgets/chat-window`: header with title and number, message list, input field).

- Styles use CSS Modules with CSS variables for the palette (`app/styles`). No UI library is used. Basic controls live in `shared/ui`.
- Bubbles (`entities/message/ui/MessageBubble`): outgoing messages are right-aligned with the accent color, incoming messages are left-aligned and neutral, with time and a status icon (clock / check / red "!"). The bubble renders content with `switch (content.type)`. The retry button is not part of the entity: the widget passes it in through a slot (`actions` prop) from `features/send-message`, because an entity must not import a feature.
- New chat creation uses an inline form in the sidebar instead of a modal.
- Auto-scroll (`widgets/chat-window/MessageList`) uses a `ref` on the end of the list and `scrollIntoView` when the active chat's message count changes.

### D11. Tests

Vitest. Tests sit next to the code inside each slice (`*.test.ts`). The domain needs no jsdom:
- `shared/lib/phone`: formatting (`+`, spaces, brackets, hyphens), numbers from different countries, 7/15-digit boundaries, invalid input.
- `shared/api/green-api`: `ApiError` mapping, no token in errors.
- `entities/chat`: both orders of `messageSent`/`outgoingReceived`, repeated delivery, retry, auto-creation, ignoring an unknown chat for outgoing messages, sorting, `reset`.
- `features/receive-notifications`: `mapNotification` (every webhook type, groups, old timestamps, broken format); poller with fake timers.
- `features/auth`, `features/create-chat`, `features/send-message`: model functions against a mock API.
- `app/model/session-lifecycle`: `ready` → start, `clear` → stop + reset.

UI tests are optional and not required in this change.

## Risks / Trade-offs

- [FSD adds many folders for a small app] → This is accepted for a clear structure and room to grow. Steiger keeps the boundaries from eroding.
- [The pull to cross-import features (for example, auth → receive-notifications)] → Features are coordinated only through `app/model/session-lifecycle` and the session entity's state. Steiger catches violations.
- [The `idMessage` in the `sendMessage` response may not match the `idMessage` in `outgoingAPIMessageReceived`] → Check this on a real instance at the start of implementation (task 3.3). If they do not match, the user sees a duplicate. The fallback is to ignore `outgoingAPIMessageReceived` and keep only local copies.
- [The text field in outgoing notifications may differ from that in incoming ones] → `mapNotification` reads both known fields. Check this on real data.
- [The token is visible in the browser's Network tab] → This is unavoidable without a backend. The token is not logged or stored, and it disappears when the page is reloaded.
- [`VITE_GREEN_API_URL` is baked in at build time] → A different host requires a rebuild. This is acceptable for the task.
- [The browser can throttle timers in background tabs] → Long polling does not depend on timers. Only backoff can slow down, which is acceptable.
- [GREEN-API documentation says `checkAccount` supports only codes 7 and 375] → The client deliberately has no region restriction, so it will not need changes if the API expands support. Rejecting an unsupported number is the API's job, and the client shows a clear message.
- [`checkAccount` limits in MAX (469)] → Repeated checks of a known number are prevented by the duplicate check, and the error is shown to the user.
- [Several open tabs with the same instance will compete for the queue] → Not supported. Each notification goes to only one tab. This is documented in the README.

## Migration Plan

Not applicable. This is the first version of the app. Deployment is a static build (`vite build`) with `VITE_GREEN_API_URL` set.

## Open Questions

- The exact text field and `idMessage` format in `outgoingAPIMessageReceived` / `outgoingMessageReceived` for MAX. This is checked on a real instance and affects only the `mapNotification` implementation, not the specs or architecture.
