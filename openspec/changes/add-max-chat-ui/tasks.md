# Tasks

## 1. Project setup and FSD skeleton

- [x] 1.1 Create a Vite project (react-ts template) in the repository root, configure strict TypeScript, and verify that `npm run dev` starts and `npm run build` succeeds
- [x] 1.2 Add dependencies `zustand`, `axios` and dev dependencies `vitest`, `steiger`, `@feature-sliced/steiger-plugin`; add the `test`, `typecheck`, and `lint:fsd` scripts; verify that each script runs
- [x] 1.3 Configure the `@/` → `src/` alias in `tsconfig` and `vite.config`, and verify that an import through `@/` builds and type-checks
- [x] 1.4 Create the FSD layers `src/{app,pages,widgets,features,entities,shared}`, move `main.tsx`/`App.tsx` into `app/`, and remove the Vite template's demo code; verify that the app builds and shows an empty `App`, and that `npm run lint:fsd` passes
- [x] 1.5 Implement `shared/config/env.ts` (typed `VITE_GREEN_API_URL` in `vite-env.d.ts`), add `.env.example` with `VITE_GREEN_API_URL=https://api.green-api.com`, and add `.env` to `.gitignore`; verify that `npm run typecheck` passes

## 2. Shared: phone, API client, UI primitives

- [x] 2.1 Implement `shared/lib/phone` (`normalizePhone`: digits only, no country binding or prefix rewriting, length 7–15, error otherwise) with its public API; verify with tests in `normalize-phone.test.ts` that cover the chat-management spec scenarios
- [x] 2.2 Describe the GREEN-API request, response, and notification types in `shared/api/green-api/types.ts` and implement `createApi` in `client.ts` on an axios instance (design D7): six methods, a separate timeout for `receiveNotification`, `null` for an empty response; verify that `npm run typecheck` passes
- [x] 2.3 Implement `ApiError` and the interceptor in `shared/api/green-api/errors.ts` (auth/limit/network/server/validation/canceled) without passing on `config.url`; verify with tests that mock the axios adapter: status mapping, and that neither the `ApiError` nor its `message` contains the token
- [x] 2.4 Implement `shared/ui` (Button, TextField, TextArea, Spinner) on CSS Modules with theme variables from `app/styles`; verify visually in `npm run dev` and with `npm run lint:fsd`

## 3. Entities: session, message, chat

- [x] 3.1 Implement `entities/message`: types `MessageContent` (union with `text`), `MessageStatus`, `Message`; `ui/MessageBubble` (in/out alignment, `HH:MM`, status icon, `switch (content.type)`, `actions` slot); public API and `@x/chat.ts`; verify with `npm run typecheck` and `npm run lint:fsd`
- [x] 3.2 Implement `entities/chat/model`: types `Chat`, `ChatsState`, events (design D3), and `applyEvent` for `chatCreated`, `chatOpened`, `messageQueued`, `messageFailed`, and `incomingReceived` (auto-creation, title fallback, `idMessage` idempotency, moving the chat to the top of `order`); verify with tests in `apply-event.test.ts`
- [x] 3.3 Implement merging of outgoing copies in `applyEvent` (`messageSent`, `outgoingReceived`, design D5): both arrival orders, repeated delivery, retry without a duplicate, ignoring an unknown chat; verify with tests for every scenario in the "No duplicate outgoing messages" requirement
- [x] 3.4 Implement `useChatsStore` (`apply`, `openChat`, `reset`) and `entities/chat/ui` (`ChatListItem`: title, latest message text, highlight; `ChatHeader`: title and number); verify with a store test (`apply` changes state, `reset` returns the initial state) and `npm run lint:fsd`
- [x] 3.5 Implement `entities/session`: `useSessionStore` with the setters from design D2 and `ui/SessionWarnings`; verify with a store test (`setReady`/`clear`) and `npm run lint:fsd`

## 4. Features

- [x] 4.1 Implement `features/auth`: `lib/check-settings.ts`, `model/login.ts` (design D8), and `ui/LoginForm` (required fields, loading state, errors by `ApiError.kind`); verify with tests of `login` against a mock API (wrong credentials, unauthorized instance, settings warnings, `setReady` on success) and of `checkSettings`
- [x] 4.2 Implement `features/logout` (`LogoutButton` → `session.clear()`); verify with `npm run lint:fsd` and a manual click in `npm run dev`
- [x] 4.3 Implement `features/create-chat`: `model/create-chat.ts` (design D9) and `ui/CreateChatForm` (inline form, errors); verify with tests against a mock API: invalid number without a request, existing chat without `checkAccount`, `exist:false`, API validation error, 469, `status:false`, existing `chatId`, success
- [x] 4.4 Implement `features/send-message`: `model/send-message.ts` (`sendMessage`, `retry`), `ui/MessageInput` (auto-growing textarea, Enter/Shift+Enter, block empty input, 4000-character limit, clear after sending), and `ui/RetryButton`; verify with tests against a mock API (success, error → `failed`, retry → one copy) and manually against the "Message input validation" scenarios
- [x] 4.5 Check on a real instance (manually, through a temporary script or the dev console) that `idMessage` from `sendMessage` matches `idMessage` in `outgoingAPIMessageReceived`, and record which text field outgoing notifications use; record the result in design.md Open Questions and use it in task 4.6
- [x] 4.6 Implement `features/receive-notifications/lib`: `mapNotification` (design D4, accounting for the result of task 4.5) and `backoff`; verify with tests for every webhook type, groups, old timestamps, broken format, and the backoff sequence/reset
- [x] 4.7 Implement `features/receive-notifications/model/poller.ts` (design D6): one loop, `AbortController`, dispatch then `deleteWithRetry`, `runId` guard, `session.setConnection`; and `ui/ConnectionStatus`; verify with Vitest using fake timers and a fake API: every notification is removed, `stop()` stops requests, the delay grows and resets, and a stale loop does not dispatch

## 5. App, widgets, pages

- [x] 5.1 Implement `app/model/session-lifecycle.ts`: subscribe to `useSessionStore`, `ready` → `poller.start(api, loginAt)`, leaving `ready` → `poller.stop()` + `useChatsStore.reset()`; verify with a test: login starts the poller, logout stops it and clears chats, and a second login starts a new loop
- [x] 5.2 Implement `widgets/sidebar` (chat list sorted by `order`, empty state with a prompt, `CreateChatForm`, `LogoutButton`, `SessionWarnings`, `ConnectionStatus`); verify visually and with `npm run lint:fsd`
- [x] 5.3 Implement `widgets/chat-window` (`ChatHeader`, `MessageList` with `MessageBubble` and `RetryButton` in the slot, auto-scroll to the newest message, `MessageInput`, placeholder when no chat is selected); verify visually and with `npm run lint:fsd`
- [x] 5.4 Implement `pages/login` and `pages/messenger` (layout in the style of web.max.ru), plus the page switch and lifecycle connection in `app/App.tsx`; verify manually: invalid and valid login, logout returns to the login screen with no chats

## 6. Documentation and integration check

- [x] 6.1 Write `README.md`: what the app does, instance requirements (empty `webhookUrl`, `incomingWebhook` enabled), `.env` setup, `npm` commands, an FSD structure overview, limitations (text only, one tab per instance, the token is visible in Network); verify that following the README you can start the project from scratch
- [ ] 6.2 Run an end-to-end check on a real instance: log in → create a chat by number → send a message → receive the recipient's reply in the same chat → reply from an unknown number creates a chat → message from the phone appears as outgoing → logout clears state; also verify that `npm test`, `npm run typecheck`, `npm run lint:fsd`, and `npm run build` pass and that the console contains no token

## Workflow follow-up

- Archive the change with `/opsx:archive` after review and the end-to-end check.
