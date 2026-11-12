# Proposal

## Why

The app keeps everything in memory and starts every session with an empty sidebar. A reload or a new login loses all chats, and a chat opened by phone number shows nothing that was said before. GREEN-API for MAX stores the chat list (`getChats`) and recent history (`getChatHistory`), so the app can show what the user already has instead of starting from nothing.

## What Changes

- On login, the app loads the chat list with `getChats` and fills the sidebar in the server's activity order. Chats that already got live messages during the load keep their position. A failed load shows an error with a retry and does not end the session.
- History is loaded lazily: the first time a chat is opened, the app requests its last 100 messages with `getChatHistory` and merges them with the messages already in the chat by `idMessage`. Each chat has a history state (not loaded, loading, loaded, failed). A failed load shows an error with a retry in the chat window.
- All chat types from `getChats` are shown: personal chats, groups, channels, and bots. **BREAKING** (behavior): live notifications from group chats are no longer ignored.
- In group chats, incoming messages show the sender's name. A chat created from a live group message is titled with the chat name, not the sender's name.
- Channels are read-only: the message input is replaced by a "Read-only channel" footer.
- Non-text messages stay hidden, now in history as well as in live notifications.
- Logout also cancels any chat list or history load in progress, and results from an earlier session never reach the new one.
- The README documents the limitations below.

**Known limitations (documented, not addressed):**
- Non-text messages (photos, video, files, audio, stickers, polls) are not shown. A chat's preview and time come from its most recent text message, which may be older than its real latest activity. A media-heavy chat may show far fewer than 100 messages.
- Reactions, edits, and deletions are not reflected.
- Only the latest 100 messages are loaded. `getChatHistory` has no cursor, and the server keeps at most 5000 messages or 3 months.
- Read state is not synced, and unread counts are not shown. GREEN-API for MAX has no method to mark a chat as read.
- Chats that have not been opened show only their title until a message arrives or the chat is opened.

## Capabilities

### New Capabilities

- `chat-history`: loading a chat's message history from GREEN-API when the chat is first opened, the per-chat load state and retry, and merging history with live messages without duplicates.

### Modified Capabilities

- `chat-management`: the chat list is loaded from `getChats` at login and is ordered by server activity, adjusted by live messages. Chats of every type (personal, group, channel, bot) are listed and auto-created. Group chat titles come from the chat name. A phone number of `0` from GREEN-API counts as no phone, so duplicate detection by phone does not match it.
- `messaging`: messages from other devices and incoming messages are shown in chats of every type. Incoming group messages show the sender's name. Channels are read-only. The unsupported-types rule also covers history.
- `notification-receiving`: the filter no longer drops group chats.
- `instance-session`: logout also cancels chat list and history loads.

## Impact

- **Code:** `shared/api/green-api` (new `getChats` and `getChatHistory` methods and types); `entities/chat` (chat `type`, history state, new bulk events and merge rules); `entities/message` (optional sender on a message, author line in the bubble); `features/receive-notifications` (group filter removed, group titles and senders); a new feature slice that loads the chat list and history; `widgets/chat-window` (history loading and error states, read-only footer); `widgets/sidebar` (list load error); `app/model/session-lifecycle.ts` (start and cancel the chat list load).
- **External systems:** new GREEN-API calls `getChats` (once per login, plus retries) and `getChatHistory` (once per opened chat, plus retries). Both have per-second rate limits on the GREEN-API side.
- **Docs:** README feature list and a new limitations section.
- **No new dependencies.** State stays in memory only.
