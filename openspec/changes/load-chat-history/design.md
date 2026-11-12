# Design

## Context

See proposal.md (Why) for the motivation and the specs for the required behavior. The current state that shapes the approach:

- All chat state is a single `ChatsState` changed only through `applyEvent(state, ChatEvent)`, a pure reducer with unit tests. Incoming messages are deduplicated by `idMessage`, and for outgoing messages the server copy wins. Bulk loads can reuse these rules.
- `app/model/session-lifecycle.ts` is the only place that connects features to the session. Entering `ready` starts the poller, and leaving it stops the poller and resets chats. The poller protects against stale writes with a generation counter (`runId`) and an `AbortController`.
- `features/receive-notifications/lib/map-notification.ts` drops any `chatId` that starts with `-` (groups) and titles a new chat from the sender before the chat name.
- `Chat` has no type or load state. `Message` has no sender.

GREEN-API for MAX facts (from the docs; to be confirmed on a real instance, see tasks):
- `GET getChats` returns `[{ chatId, name, type: user|group|channel|bot, phoneNumber, unreadCount }]`, sorted by activity. It has an optional `count`, no pagination, no last message and no timestamp. `phoneNumber` is `0` for groups and hidden numbers.
- `POST getChatHistory { chatId, count }` returns messages newest first: `type: incoming|outgoing`, `idMessage`, `timestamp` (seconds), `typeMessage`, `textMessage`, `extendedTextMessage.text`, `senderId`, `senderName`, `senderContactName`, `isDeleted`, and more. There is no offset or cursor.

## Goals / Non-Goals

**Goals:**
- Keep every new merge rule (chat list, history, group senders) inside `applyEvent`, covered by pure unit tests, like the existing rules.
- Give the loaders the same cancellation and stale-write protection as the poller, so logout and a fast re-login can never mix sessions.
- Keep the loaders independent of React. Components only trigger loads and render state.

**Non-Goals:**
- Caching across reloads (state stays in memory only).
- Automatic retries with backoff for `getChats` or `getChatHistory`. Retries are user-driven, so a failing server is not hit in a loop.
- Prefetching history, or loading older messages beyond the first 100.
- Detecting channel admin rights.

## Decisions

### D1. API client: two new methods, parsed defensively

`GreenApi` gets `getChats({ signal })` and `getChatHistory(chatId, count, { signal })`. Their response types live in `shared/api/green-api/types.ts` with every field optional, like `NotificationBody`, because the MAX payloads are only partly documented. The client returns raw data. Mapping to app types happens in the feature's `lib`, where it is unit-tested. `getChats` is called without `count` (see Open Questions).

*Alternative:* mapping inside the client. Rejected: it keeps `shared` free of app concepts, the same split as `receiveNotification` and `map-notification`.

### D2. Model changes in `entities/chat` and `entities/message`

```
Chat    + type: 'user' | 'group' | 'channel' | 'bot'
        + history: 'idle' | 'loading' | 'loaded' | 'error'
Message + sender?: { id: string; name?: string }   (incoming group messages only)
```

- `type` for a chat created from a live notification or by phone is inferred: a `chatId` that starts with `-` is `group`, anything else is `user`. When `getChats` reports the real type, that type replaces the inferred one. This is the only field that `chatsLoaded` changes on an existing chat, apart from a missing phone.
- `history` starts as `idle` for every chat, however it was created. Live messages never change it, so a chat with live messages still loads its history on first open (spec: chat-history, "Chat with live messages but no history").
- The author line in `MessageBubble` is driven by `message.sender?.name` and a `showSender` prop that `MessageList` sets only for `group` chats. `entities/message` does not need to know about chat types.

*Alternative:* a separate history store keyed by `chatId`. Rejected: the history state must reset with the chats and is read alongside the chat everywhere. Keeping it on `Chat` means `reset()` already clears it.

### D3. New chat events and their merge rules

| Event | Rule |
|---|---|
| `chatsLoaded { chats: { chatId, title, type, phone? }[] }` | Chats not in the store are appended to `order` after the existing ones, in server order. For chats already in the store, set `type` and fill a missing `phone`. Title, position, messages, and the active chat never change. |
| `historyRequested { chatId }` | `history` becomes `loading`. Ignored if the chat does not exist. |
| `historyLoaded { chatId, messages: Message[] }` | Insert each message whose `id` is not already in the chat, using the existing `insertByTimestamp`. Messages already present (live copies, `sending`, and `failed`) are kept as they are. `history` becomes `loaded`. The chat does not move in `order`. Ignored if the chat does not exist. |
| `historyFailed { chatId }` | `history` becomes `error`. Messages are kept. |

`incomingReceived` gains an optional `sender`, and `chatCreated` and the auto-create paths gain `type`. `insertByTimestamp` already handles an unsorted batch when applied one message at a time. The mapper also sorts the batch oldest-first so equal timestamps keep server order.

"Kept as is" when the `idMessage` is already present (rather than the server copy winning, as for `outgoingReceived`) is deliberate. A live copy is at least as fresh as history, and replacing it could undo a status or position that the existing outgoing rules set.

### D4. One feature slice for loading: `features/load-chats`

```
features/load-chats/
  lib/map-chats.ts       getChats item   -> chatsLoaded entry (title fallback, phone 0 -> none)
  lib/map-history.ts     history item    -> Message | null   (text only, skip deleted)
  model/chat-list.ts     chatListLoader: start(api), retry(), stop(); status store
  model/history.ts       loadHistory(chatId); stopHistory()
  ui/ChatListStatus.tsx  "Loading chats..." / error + Retry (used by sidebar)
  ui/HistoryStatus.tsx   loading / error + Retry (used by chat-window)
```

Both loaders live in one slice because the session lifecycle starts and stops them together, and features cannot import each other.

- **Chat list:** `session-lifecycle.ts` calls `chatListLoader.start(api)` next to `poller.start`, and `chatListLoader.stop()` next to `poller.stop`. The loader keeps a `runId` and an `AbortController` like the poller. A response is applied only if its `runId` is still current. Its status (`idle | loading | error`) lives in a small zustand store in the slice, which `stop()` resets.
- **History:** `loadHistory(chatId)` reads `api` from the session store, dispatches `historyRequested`, and calls `getChatHistory(chatId, 100)`. When the call settles, it applies the result only if the session store still holds the **same `api` instance** and the chat still exists. A new login always creates a new client, so this rules out cross-session writes even when the `chatId` is the same. Pending history controllers are kept in a set that `stopHistory()` aborts, and the lifecycle calls it on logout.
- **Trigger:** `ChatWindow` runs an effect keyed on `chatId` that calls `loadHistory` when the chat's `history` is `idle` or `error`. So the first open loads, and reopening after a failure retries (spec: "History load error and retry"), while a loaded chat is never fetched again. A second open while loading is a no-op because the state is `loading`.

*Alternative:* trigger history from `openChat` in the store. Rejected: an entity cannot call a feature, and it would hide a network call behind a state setter.

*Alternative:* load history for every chat at login (option B/C in the exploration). Rejected by the user in favor of lazy loading. See proposal.

### D5. Mapping history items

`map-history` returns `null` (skip) unless all of these hold: `typeMessage` is `textMessage` or `extendedTextMessage`, `isDeleted` is not true, a non-empty text exists (`textMessage`, then `extendedTextMessage.text`), `idMessage` is a non-empty string, and `timestamp` is a finite number. Direction comes from `type`. Outgoing messages get `status: 'sent'` whatever `statusMessage` says (delivered and read are not modeled). Incoming messages get `sender: { id: senderId, name: senderContactName ?? senderName }` when `senderId` is present. Reactions use `reactionMessage` (or `extendedTextMessageData` only) and so fall out on the type check.

### D6. Group notifications

In `map-notification`:
- Remove the `chatId.startsWith('-')` filter.
- For a group `chatId`, the title of an auto-created chat is `chatName ?? chatId`, and `incomingReceived` carries `sender: { id: senderData.sender, name: senderContactName ?? senderName }`.
- Personal chats keep the existing title order and get no sender.

The before-login filter stays. History now covers the queue backlog, so dropping those notifications loses nothing.

### D7. Read-only channels and sidebar states

`ChatWindow` renders a "Read-only channel" footer instead of `MessageInput` when `chat.type === 'channel'`. The sidebar renders `ChatListStatus` above the list. While loading with an empty list, it replaces the empty-list prompt. On error, it shows a banner with Retry, and the list and create-chat form stay usable. `ChatListItem` already hides the preview and time when there are no messages.

### D8. Auth errors during loads

A 401/403 from `getChats` or `getChatHistory` is shown as an ordinary load error. Ending the session stays the poller's job (`onAuthError`): the poller hits the same credentials within seconds and logs out, and the loaders are then stopped by the lifecycle. This keeps one owner for that decision.

## Risks / Trade-offs

- [The MAX history and chat payloads differ from the docs (field names, `textMessage` vs. `extendedTextMessage`, `senderId`)] → Defensive optional types, mappers unit-tested against the documented shape, and a real-instance check task that records the actual payloads, as was done for `idMessage` in the previous change.
- [`getChats` without `count` returns only part of the list] → Real-instance check. If it is truncated, pass a large `count`. That is a one-line change and does not affect the specs.
- [`getChats` returns `[]` with HTTP 200 on a server-side problem (documented)] → It is indistinguishable from "no chats". The empty-list prompt shows, and creating chats still works. Accepted.
- [A channel created from a live notification is inferred as `group` until `getChats` reports it, so the input is shown and a send fails] → Rare: only when the list load failed or the notification beats it. The existing "not sent" + retry flow covers it.
- [Rate limits when the user opens many chats quickly] → At most one request per chat per session, and there are no automatic retries. Acceptable for manual browsing.
- [100 messages may contain few texts in media-heavy chats] → Documented limitation. `count` is a constant and can be raised later.

## Migration Plan

No data migration: state is in memory only. Deploying replaces the static bundle, and rollback is the previous bundle. The README gains the limitations from the proposal.

## Open Questions

- ~~Does `getChats` without `count` return every chat?~~ Checked on a real instance on 2026-11-14 (task 1.2): it returned 28 chats (18 user, 4 group, 2 channel, 4 bot), sorted by latest activity. `getChats` is called without `count`.
- ~~Do MAX group `chatId`s always start with `-`?~~ Yes, and so do channel `chatId`s. User and bot `chatId`s are positive. A channel created from a live notification is therefore inferred as `group` until `getChats` reports it (see Risks).

### Real-instance findings (task 1.2, 2026-11-14)

- **`getChats` items also carry `lastMessage`** (not in the docs): a full history item (same shape as `getChatHistory`) or absent (seen on a bot with no messages). Item keys: `chatId`, `name`, `type`, `phoneNumber`, `unreadCount`, `lastMessage`.
- `phoneNumber` is `0` for groups, channels, bots, **and** personal chats with a hidden number. It is a number when set.
- History items carry `chatType` (`user` / `group` / `channel`) and, for incoming messages, `senderId`, `senderName`, `senderType`, and `senderContactName`. **`senderContactName` is often `""`**, so name fallbacks must skip empty strings, not just `undefined`.
- `extendedTextMessage` items have **both** `textMessage` and `extendedTextMessage.text` (same value). Reading `textMessage` first, then `extendedTextMessage.text`, covers both types.
- Edits appear as a separate item with `typeMessage: 'editedMessage'` and `editedMessageData: { stanzaId, textMessage }`. The original item has `isEdited: true`. The type filter skips the `editedMessage` items. Whether the original text item shows the edited text was not observed (only an edited image caption was seen).
- No `reactionMessage` or deleted item was present in the sampled chats. The mapper handles them as documented (type filter, `isDeleted`).
- In channels, incoming messages have `senderId` equal to the channel `chatId` and `senderType: 'channel'`. The sampled channel contained only images.
- **`getChatHistory` is rate limited tightly:** a second call about a second after the first returned **HTTP 429**. Calls 5 s apart succeeded. The client maps 429 to `ApiError` kind `limit`.
