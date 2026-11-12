# messaging Specification

## Purpose

Lets the user exchange text messages with a MAX recipient in the active chat: send messages, see send statuses and incoming replies, and see no duplicate copies of their own messages.

## Requirements

### Requirement: Send a text message
The system SHALL send the text from the input field to the active chat through `sendMessage`, using the chat's `chatId`. Enter SHALL send the message, and Shift+Enter SHALL insert a line break.

#### Scenario: Send with Enter
- **WHEN** the user types text in the input field and presses Enter
- **THEN** the system sends the message, and the input field is cleared

#### Scenario: Line break
- **WHEN** the user presses Shift+Enter
- **THEN** a line break is inserted into the input field and nothing is sent

### Requirement: Message input validation
The system SHALL NOT send an empty message or one that contains only whitespace. It SHALL NOT allow a message longer than 4000 characters.

#### Scenario: Empty message
- **WHEN** the input field is empty or contains only whitespace
- **THEN** the send button is disabled, and Enter sends nothing

#### Scenario: Length limit
- **WHEN** the text length reaches 4000 characters
- **THEN** the system does not allow more input

### Requirement: Show a sent message immediately
The system SHALL add an outgoing message to the chat as soon as it is sent, before GREEN-API responds, with the status "sending". After a successful response, the status SHALL change to "sent".

#### Scenario: Successful send
- **WHEN** `sendMessage` returns `idMessage`
- **THEN** the message stays in the chat in its original position with the status "sent"

### Requirement: Send error and retry
If sending fails, the system SHALL mark the message "not sent" and offer to retry sending the same text.

#### Scenario: Network error while sending
- **WHEN** the `sendMessage` request fails
- **THEN** the message stays in the chat with the "not sent" label and a retry button

#### Scenario: Successful retry
- **WHEN** the user clicks retry on an unsent message and the request succeeds
- **THEN** the message gets the status "sent", and the chat does not contain a second copy

### Requirement: No duplicate outgoing messages
The system SHALL identify outgoing messages by `idMessage`. When GREEN-API reports an outgoing message that is already in the chat, the system SHALL replace the local copy with the server copy and SHALL NOT add a duplicate, whatever the order in which the `sendMessage` response and the notification arrive.

#### Scenario: Notification after the send response
- **WHEN** a notification about an outgoing API message arrives with an `idMessage` that is already in the chat
- **THEN** the chat contains exactly one copy of that message

#### Scenario: Notification before the send response
- **WHEN** a notification about an outgoing API message arrives before `sendMessage` responds, and the response then returns the same `idMessage`
- **THEN** the chat contains exactly one copy of that message

#### Scenario: Repeated delivery of the same notification
- **WHEN** a notification with an `idMessage` that is already in the chat arrives again
- **THEN** the chat does not change

### Requirement: Show messages sent from other devices
The system SHALL show outgoing text messages that the user sent to any chat from a phone or another client as outgoing messages in that chat, creating the chat if it is not in the list.

#### Scenario: Message from a phone
- **WHEN** a notification arrives about an outgoing text message sent from another device
- **THEN** the message appears in that chat as outgoing

#### Scenario: Message from a phone to a group
- **WHEN** a notification arrives about an outgoing text message the user sent to a group from another device
- **THEN** the message appears in that group chat as outgoing

### Requirement: Show incoming messages
The system SHALL add an incoming text message to the chat with the matching `chatId` and show it as an incoming bubble with the time.

#### Scenario: Recipient's reply
- **WHEN** a text message arrives from the recipient of an open chat
- **THEN** the message appears at the bottom of the chat as incoming

### Requirement: Message display
The system SHALL show outgoing messages as right-aligned bubbles and incoming messages as left-aligned bubbles, with send time in `HH:MM` format. Each outgoing message SHALL show its status. The message list SHALL scroll to the newest message when a message is added.

#### Scenario: Auto-scroll
- **WHEN** a new message is added to the active chat
- **THEN** the message list scrolls so that the new message is visible

#### Scenario: History loaded
- **WHEN** the history of the active chat finishes loading
- **THEN** the message list shows the newest message

### Requirement: Unsupported message types
In this version, the system SHALL handle only text messages. Messages of other types, from notifications or from history, SHALL be ignored and SHALL NOT be shown in the chat.

#### Scenario: Image arrives
- **WHEN** an incoming message of a non-text type arrives
- **THEN** no new message appears in the chat

#### Scenario: Image in history
- **WHEN** a chat's history contains a non-text message
- **THEN** that message does not appear in the chat

### Requirement: Sender names in group chats
In a group chat, each incoming message SHALL show its sender's name above the text: the sender's contact name, then the sender name. This SHALL apply to live messages and to history. When neither name is known, the message SHALL be shown without a name. Personal chats SHALL NOT show sender names.

#### Scenario: Live group message
- **WHEN** a text message from a group member arrives in a group chat
- **THEN** the message shows that member's name above the text

#### Scenario: Group history
- **WHEN** the history of a group chat loads with messages from several members
- **THEN** each incoming message shows the name of the member who sent it

#### Scenario: Personal chat
- **WHEN** an incoming message arrives in a personal chat
- **THEN** the message shows no sender name

### Requirement: Read-only channels
The system SHALL NOT offer message input in a chat that GREEN-API reports as a channel. The chat window SHALL show a "Read-only channel" footer in place of the input field.

#### Scenario: Open a channel
- **WHEN** the user opens a chat whose type is channel
- **THEN** the chat window shows the messages and a "Read-only channel" footer, with no input field or send button

#### Scenario: Open a personal chat, group, or bot
- **WHEN** the user opens a chat whose type is personal, group, or bot
- **THEN** the chat window shows the input field

### Requirement: Group messages by date
The message list SHALL show a date separator before the first message of each calendar day, in local time. The label SHALL be "Today", "Yesterday", the day and month (for example "12 November") for earlier dates in the current year, or the day, month, and year (for example "28 December 2025") for earlier years.

#### Scenario: Messages over several days
- **WHEN** the active chat contains messages from three different days
- **THEN** the list shows three separators, each directly before the first message of its day

#### Scenario: Today and yesterday
- **WHEN** the active chat contains messages from yesterday and today
- **THEN** their separators read "Yesterday" and "Today"

#### Scenario: Earlier dates
- **WHEN** the active chat contains a message from 12 November of the current year and one from 28 December of the previous year
- **THEN** their separators read "12 November" and "28 December" followed by that year

#### Scenario: Live message after midnight
- **WHEN** the last message in the active chat is from yesterday and a new message arrives today
- **THEN** a "Today" separator appears before the new message

#### Scenario: Older history loaded
- **WHEN** the chat shows only its latest message and its history then loads with messages from earlier days
- **THEN** each day has exactly one separator, in chronological order
