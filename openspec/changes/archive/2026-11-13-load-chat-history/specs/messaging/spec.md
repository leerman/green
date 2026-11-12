# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Show messages sent from other devices
The system SHALL show outgoing text messages that the user sent to any chat from a phone or another client as outgoing messages in that chat, creating the chat if it is not in the list.

#### Scenario: Message from a phone
- **WHEN** a notification arrives about an outgoing text message sent from another device
- **THEN** the message appears in that chat as outgoing

#### Scenario: Message from a phone to a group
- **WHEN** a notification arrives about an outgoing text message the user sent to a group from another device
- **THEN** the message appears in that group chat as outgoing

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
