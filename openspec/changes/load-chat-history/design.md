# Design

## Context

See proposal.md (Why) for the motivation and the specs for the required behavior. The current state that shapes the approach:

- All chat state is a single `ChatsState` changed only through `applyEvent(state, ChatEvent)`, a pure reducer with unit tests. Incoming messages are deduplicated by `idMessage`, and for outgoing messages the server copy wins. Bulk loads can reuse these rules.
- `app/model/session-lifecycle.ts` is the only place that connects features to the session. Entering `ready` starts the poller, and leaving it stops the poller and resets chats. The poller protects against stale writes with a generation counter (`runId`) and an `AbortController`.
- `features/receive-notifications/lib/map-notification.ts` drops any `chatId` that starts with `-` (groups) and titles a new chat from the sender before the chat name.
- `Chat` has no type or load state. `Message` has no sender.

GREEN-API for MAX facts (from the docs, confirmed on a real instance on 2026-11-14; see Real-instance findings):
- `GET getChats` returns `[{ chatId, name, type: user|group|channel|bot, phoneNumber, unreadCount, lastMessage? }]`, sorted by activity. It has an optional `count` and no pagination. `phoneNumber` is `0` for groups and hidden numbers. `lastMessage` is not in the docs and was found on a real instance (see Real-instance findings).
- `POST getChatHistory { chatId, count }` returns messages newest first: `type: incoming|outgoing`, `idMessage`, `timestamp` (seconds), `typeMessage`, `textMessage`, `extendedTextMessage.text`, `senderId`, `senderName`, `senderContactName`, `isDeleted`, and more. There is no offset or cursor.

## Goals / Non-Goals

**Goals:**
- Keep every new merge rule (chat list, history, group senders) inside `applyEvent`, covered by pure unit tests, like the existing rules.
- Give the loaders the same cancellation and stale-write protection as the poller, so logout and a fast re-login can never mix sessions.
- Keep the loaders independent of React. Components only trigger loads and render state.

**Non-Goals:**
- Caching across reloads (state stays in memory only).
- Automatic retries for `getChats`, or for `getChatHistory` errors other than HTTP 429. Those retries are user-driven, so a failing server is not hit in a loop. A 429 from `getChatHistory` is retried automatically, a bounded number of times (D4).
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
Message + sender?: { id: string; name?: string }   (incoming messages; shown only in groups)
```

- `type` for a chat created from a live notification or by phone is inferred: a `chatId` that starts with `-` is `group`, anything else is `user`. When `getChats` reports the real type, that type replaces the inferred one. On an existing chat, `chatsLoaded` changes only the type, a missing phone, and adds the `lastMessage` when it is not already in the chat (D3).
- `history` starts as `idle` for every chat, however it was created. Live messages never change it, so a chat with live messages still loads its history on first open (spec: chat-history, "Chat with live messages but no history").
- `sender` is set on any incoming message whose source carries a sender ID (history items and group notifications). The author line in `MessageBubble` is driven by `message.sender?.name` and a `showSender` prop that `MessageList` sets only for `group` chats, so personal chats never show it. `entities/message` does not need to know about chat types.

*Alternative:* a separate history store keyed by `chatId`. Rejected: the history state must reset with the chats and is read alongside the chat everywhere. Keeping it on `Chat` means `reset()` already clears it.

### D3. New chat events and their merge rules

| Event | Rule |
|---|---|
| `chatsLoaded { chats: { chatId, title, chatType, phone?, lastMessage? }[] }` | Chats not in the store are appended to `order` after the existing ones, in server order. For chats already in the store, set the type and fill a missing `phone`. `lastMessage` (already mapped, text only) is inserted by timestamp into new and existing chats when its `id` is not in the chat. Title, position, `history`, existing messages, and the active chat never change. |
| `historyRequested { chatId }` | `history` becomes `loading`. Ignored if the chat does not exist. |
| `historyLoaded { chatId, messages: Message[] }` | Insert each message whose `id` is not already in the chat, using the existing `insertByTimestamp`. Messages already present (live copies, `sending`, and `failed`) are kept as they are. `history` becomes `loaded`. The chat does not move in `order`. Ignored if the chat does not exist. |
| `historyFailed { chatId }` | `history` becomes `error`. Messages are kept. |

`incomingReceived` gains an optional `sender`, and `chatCreated` and the auto-create paths gain `chatType`. (`type` is the event discriminator, so the chat type travels as `chatType` on events.) Seeding `lastMessage` does not mark history as loaded: a chat with only its preview still loads the full history on first open, and the preview is deduplicated by `idMessage`. `insertByTimestamp` already handles an unsorted batch when applied one message at a time. The mapper also sorts the batch oldest-first so equal timestamps keep server order.

"Kept as is" when the `idMessage` is already present (rather than the server copy winning, as for `outgoingReceived`) is deliberate. A live copy is at least as fresh as history, and replacing it could undo a status or position that the existing outgoing rules set.

### D4. One feature slice for loading: `features/load-chats`

```
features/load-chats/
  lib/map-chats.ts       getChats item   -> chatsLoaded entry (title fallback, phone 0 -> none,
                         lastMessage through map-history)
  lib/map-history.ts     history item    -> Message | null   (text only, skip deleted)
  model/chat-list.ts     chatListLoader: start(api), retry(), stop(); status store
  model/history.ts       loadHistory(chatId); stopHistory()
  ui/ChatListStatus.tsx  "Loading chats..." / error + Retry (used by sidebar)
  ui/HistoryStatus.tsx   loading / error + Retry (used by chat-window)
```

Both loaders live in one slice because the session lifecycle starts and stops them together, and features cannot import each other.

- **Chat list:** `session-lifecycle.ts` calls `chatListLoader.start(api)` next to `poller.start`, and `chatListLoader.stop()` next to `poller.stop`. The loader keeps a `runId` and an `AbortController` like the poller. A response is applied only if its `runId` is still current. Its status (`idle | loading | error`) lives in a small zustand store in the slice, which `stop()` resets.
- **History:** `loadHistory(chatId)` reads `api` from the session store, dispatches `historyRequested` at once (the chat shows its loading state while it waits its turn), and puts the chat in a FIFO queue. A single worker takes one chat at a time and calls `getChatHistory(chatId, 100)`, starting each request at least `HISTORY_MIN_INTERVAL_MS` (1500) after the previous one started. On an `ApiError` of kind `limit` (HTTP 429), it waits `HISTORY_RETRY_DELAY_MS` (3000) and retries, up to `HISTORY_MAX_RETRIES` (2). Any other error, or a 429 after the last retry, dispatches `historyFailed`. When a call settles, the worker applies the result only if the session store still holds the **same `api` instance** and the chat still exists. A new login always creates a new client, so this rules out cross-session writes even when the `chatId` is the same. `stopHistory()` empties the queue, aborts the request in flight and any pending wait, and bumps a generation counter so the worker exits. The lifecycle calls it on logout. The loader uses `Date.now()` and `setTimeout` directly, and its tests drive the pacing and retries with Vitest fake timers.
- *Why a queue rather than only reacting to 429:* the real instance answered 429 to a call about a second after the previous one. Opening chats in quick succession is normal browsing, so pacing avoids most 429s instead of turning each into a delay. The retries cover the rest, for example a limit shared with another client of the same instance.
- **Trigger:** `ChatWindow` runs an effect keyed on `chatId` that calls `loadHistory(chatId)` whenever the open chat changes. The loader itself skips chats whose `history` is `loading` or `loaded`, so the first open loads, reopening after a failure retries (spec: "History load error and retry"), a loaded chat is never fetched again, and a second open while loading is a no-op. Keeping the rule in the loader puts it under the loader's unit tests; the effect cannot be exercised by the render tests (D9).

*Alternative:* trigger history from `openChat` in the store. Rejected: an entity cannot call a feature, and it would hide a network call behind a state setter.

*Alternative:* load history for every chat at login (option B/C in the exploration). Rejected by the user in favor of lazy loading. See proposal.

### D5. Mapping history items

`map-history` returns `null` (skip) unless all of these hold: `typeMessage` is `textMessage` or `extendedTextMessage`, `isDeleted` is not true, a non-empty text exists (`textMessage`, then `extendedTextMessage.text`), `idMessage` is a non-empty string, and `timestamp` is a finite number. Direction comes from `type`. Outgoing messages get `status: 'sent'` whatever `statusMessage` says (delivered and read are not modeled). Incoming messages get `sender: { id: senderId, name }` when `senderId` is present, where `name` is the first **non-empty** of `senderContactName` and `senderName` (MAX sends `""` for a missing contact name), and is omitted when both are empty. Reactions use `reactionMessage` (or `extendedTextMessageData` only) and so fall out on the type check.

### D6. Group notifications

In `map-notification`:
- Remove the `chatId.startsWith('-')` filter.
- For a group `chatId`, the title of an auto-created chat is the non-empty `chatName`, or `chatId`, and `incomingReceived` carries `sender: { id: senderData.sender, name }`, with `name` the first non-empty of `senderContactName` and `senderName`. The sender's phone is not the group's, so a group chat gets no phone.
- Personal chats keep the existing title order and get no sender.

The before-login filter stays. History now covers the queue backlog, so dropping those notifications loses nothing.

### D7. Read-only channels and sidebar states

`ChatWindow` renders a "Read-only channel" footer instead of `MessageInput` when `chat.type === 'channel'`. The sidebar renders `ChatListStatus` above the list. While loading with an empty list, it replaces the empty-list prompt. On error, it shows a banner with Retry, and the list and create-chat form stay usable. `ChatListItem` already hides the preview and time when there are no messages, and shows the seeded `lastMessage` otherwise.

### D8. Auth errors during loads

A 401/403 from `getChats` or `getChatHistory` is shown as an ordinary load error. Ending the session stays the poller's job (`onAuthError`): the poller hits the same credentials within seconds and logs out, and the loaders are then stopped by the lifecycle. This keeps one owner for that decision.

### D9. Testing UI states without a DOM

The project has no DOM test environment, and adding one (jsdom, Testing Library) is a new dependency this change does not need. UI states are tested by rendering components to a string with `react-dom/server` (`MessageBubble.test.tsx`, `Sidebar.test.tsx`, `ChatWindow.test.tsx`). Server rendering reads a zustand store's *initial* state, so a test-only root `__mocks__/zustand.ts`, enabled per file with `vi.mock('zustand')`, makes stores render their current state. Effects do not run in server rendering, so behavior that would live in an effect (such as which chats load history) is kept in the loaders, where it is unit-tested.

### D10. Date separators and sidebar dates

- Two pure functions in `entities/message/lib/format.ts`, both taking `now` so tests can fix it:
  - `formatDayLabel(timestamp, now)` → "Today" / "Yesterday" / "12 November" / "28 December 2025" (message list separators).
  - `formatListTime(timestamp, now)` → "09:15" / "Yesterday" / "12 Nov" / "28 Dec 2025" (sidebar).
  Days are compared as local calendar dates, not 24-hour spans. Month names are English, like the rest of the UI, from a fixed list rather than `Intl`, so output does not depend on the runtime's locale data.
- `MessageList` walks the already-sorted messages and renders a separator whenever the local day differs from the previous message's. Separators are derived on every render and never stored, so history merges, preview seeding, and live inserts cannot produce duplicate or misplaced separators. A separator is a centered chip styled like the existing "No messages yet" pill, not sticky.
- `ChatListItem` replaces `formatTime` with `formatListTime(last.timestamp, Date.now())`.

*Alternative:* store day groups in `ChatsState`. Rejected: it duplicates what the message order already says and would need maintaining in every merge rule.

## Risks / Trade-offs

- ~~[The MAX history and chat payloads differ from the docs]~~ Resolved by task 1.2: the payloads were recorded on a real instance, and the mappers are unit-tested against those shapes. Types stay all-optional for fields not seen yet.
- ~~[`getChats` without `count` returns only part of the list]~~ Resolved by task 1.2: it returned every chat.
- [`getChats` returns `[]` with HTTP 200 on a server-side problem (documented)] → It is indistinguishable from "no chats". The empty-list prompt shows, and creating chats still works. Accepted.
- [A channel created from a live notification is inferred as `group` until `getChats` reports it, so the input is shown and a send fails] → Rare: only when the list load failed or the notification beats it. The existing "not sent" + retry flow covers it.
- [Rate limits when the user opens many chats quickly] → At most one request per chat per session, requests paced 1.5 s apart, and bounded automatic retries on 429. Opening many chats quickly makes later ones wait a few seconds, with a loading indicator.
- [The 1.5 s gap and 3 s retry delay are guesses from two probes, not documented limits] → They are constants, and a persistent 429 still ends in the normal error with Retry.
- [100 messages may contain few texts in media-heavy chats] → Documented limitation. `count` is a constant and can be raised later.
- [Day labels go stale across midnight: "Today" stays until the next render] → Any new message or chat switch re-renders. Accepted.
- [Render tests do not run effects (D9)] → Effect-driven behavior is kept thin, and the browser check in the tasks covers it.

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
