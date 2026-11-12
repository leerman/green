# Tasks

## 1. API client

- [x] 1.1 Add `getChats({ signal })` and `getChatHistory(chatId, count, { signal })` to `GreenApi` in `shared/api/green-api/client.ts`, with all-optional response types in `types.ts` (design D1); verify with client tests against a mock axios adapter: correct method, URL, and body, the signal is passed, and an error leaves no token in the `ApiError`
- [x] 1.2 On a real instance (through a temporary script or the dev console), call `getChats` without `count` and `getChatHistory` for a personal chat and a group; record in design.md Open Questions whether `getChats` returns every chat, the actual history fields for text, link-preview, reaction, and deleted messages, `senderId`/`senderName` in groups, and the group `chatId` prefix; use the result in tasks 3.1–3.2 and 4.1

## 2. Chat and message model

- [x] 2.1 Add `type` and `history` to `Chat`, `sender?` to `Message`, and set `type` (inferred from the `-` prefix) and `history: 'idle'` on every path that creates a chat in `applyEvent`; `chatCreated`, `incomingReceived`, and `outgoingReceived` accept an optional `type`/`sender` (design D2); verify existing `apply-event.test.ts` tests still pass, plus new tests for inferred types and a sender on `incomingReceived`
- [x] 2.2 Implement `chatsLoaded` in `applyEvent` (design D3): append new chats after existing ones in server order, set `type` and fill a missing `phone` on existing chats, never change title, position, messages, or the active chat; verify with tests for the "Merge the loaded chat list with existing chats" scenarios and the "Chat without a phone number" scenario
- [x] 2.3 Implement `historyRequested`, `historyLoaded`, and `historyFailed` in `applyEvent` (design D3): insert by timestamp only ids not yet present, keep live/`sending`/`failed` messages, do not move the chat, ignore unknown chats; verify with tests for every scenario in the chat-history "Show loaded history" and "Merge history with live messages" requirements
- [x] 2.4 Show the sender's name in `MessageBubble` when a `showSender` prop is set and `message.sender?.name` exists (design D2); verify with `npm run lint:fsd` and visually with a group message in `npm run dev`
- [x] 2.5 Seed `lastMessage` in `chatsLoaded` (design D3): the `LoadedChat` entry takes an optional mapped `Message`, inserted by timestamp into new and existing chats when its `id` is not present, without changing `history`, order, or the active chat; verify with tests for the "Latest message as preview" scenario, no duplicate when a live copy exists, and an existing chat that already has the message

## 3. Loading feature (`features/load-chats`)

- [x] 3.1 Implement `lib/map-chats.ts` (title fallback to `chatId`, phone `0` → none, phone normalized like `checkAccount` chats, unknown `type` → `user`, `lastMessage` through `map-history`, so a non-text one is dropped) and `lib/map-history.ts` (design D5, using the result of task 1.2); verify with unit tests: text, link preview, image, reaction, deleted, missing fields, incoming group sender, outgoing → `sent`, output sorted oldest-first
- [x] 3.2 Implement `model/chat-list.ts`: `chatListLoader.start(api)`, `retry()`, `stop()` with a `runId` guard, `AbortController`, and a status store `idle | loading | error` reset by `stop()` (design D4); verify with tests using a fake API: success dispatches `chatsLoaded`, failure sets `error`, `retry()` reloads, and a response after `stop()` or after a new `start()` does not dispatch
- [x] 3.3 Implement `model/history.ts`: `loadHistory(chatId)` (request 100, same-`api` check, dispatch `historyRequested`/`historyLoaded`/`historyFailed`), a FIFO queue with one request at a time started at least 1.5 s apart, automatic retry of HTTP 429 up to 2 times after 3 s, and `stopHistory()` clearing the queue and aborting pending requests and waits (design D4); verify with fake-timer tests: success, a non-429 failure is not retried, 429 then success, 429 three times → `historyFailed`, three quick opens are served in order and paced, a response after logout and re-login does not reach the new session, and a call for a chat already `loading` sends no second request
- [x] 3.4 Implement `ui/ChatListStatus` (loading text, error with Retry) and `ui/HistoryStatus` (loading indicator, error with Retry), and export them and the model from the slice's `index.ts`; verify with `npm run lint:fsd`

## 4. Live notifications for all chat types

- [x] 4.1 Update `mapNotification` (design D6): remove the group filter; for group `chatId`s, title new chats from `chatName ?? chatId` and attach `sender` to `incomingReceived`; personal chats unchanged; verify by updating `map-notification.test.ts`: group incoming with sender and title, group outgoing from the phone, personal chat title order unchanged
- [x] 4.2 Update the README notification section and feature list so that group chats are no longer described as ignored; verify by reading the README against the notification-receiving spec delta

## 5. Wiring and UI

- [ ] 5.1 Start `chatListLoader` next to `poller.start` and call `chatListLoader.stop()` and `stopHistory()` next to `poller.stop` in `app/model/session-lifecycle.ts`; verify by extending `session-lifecycle.test.ts`: login starts the loader, logout stops both loaders, and a second login starts a fresh load
- [ ] 5.2 In `widgets/sidebar`, render `ChatListStatus`: "Loading chats..." in place of the empty prompt while loading with no chats, and an error banner with Retry that keeps the list and create-chat form usable; verify manually in `npm run dev` with the network throttled and blocked
- [ ] 5.3 In `widgets/chat-window`: an effect keyed on `chatId` calls `loadHistory` when `history` is `idle` or `error`; render `HistoryStatus`; set `showSender` for group chats in `MessageList`; scroll to the newest message after history loads; replace `MessageInput` with a "Read-only channel" footer for channels (design D4, D7); verify manually: first open loads once, reopening a loaded chat sends no request, a blocked request shows Retry and reopening retries, a channel shows the footer, and `npm run lint:fsd` passes

## 6. Documentation and integration check

- [ ] 6.1 Update `README.md`: chats and history are loaded from GREEN-API (`getChats`, `getChatHistory`), all chat types are supported, channels are read-only, and add the limitations from proposal.md (non-text hidden and previews from the last text, no reactions/edits/deletions, latest 100 messages only, no read state or unread counts, chats whose latest message is not text show no preview until opened); verify by reading it against the proposal's limitations list
- [ ] 6.2 Run an end-to-end check on a real instance: login fills the sidebar with existing chats of every type, with previews for chats whose latest message is text → opening a personal chat shows its history → a live reply in that chat appears once → opening a group shows sender names → a live group message appears with its sender → a channel shows the read-only footer → opening three chats quickly loads all three without an error → logout during the chat list load leaves no chats in the next session; also verify that `npm test`, `npm run typecheck`, `npm run lint:fsd`, and `npm run build` pass and that the console contains no token

## Workflow follow-up

- Archive the change with `/opsx:archive` after review and the end-to-end check.
