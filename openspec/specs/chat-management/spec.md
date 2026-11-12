# chat-management Specification

## Purpose

Manages the list of chats with MAX recipients: creating a chat by phone number, creating chats automatically for incoming messages, and choosing the active chat.

## Requirements

### Requirement: Phone number normalization
When creating a chat, the system SHALL accept a phone number in international format, with a country code, in any common notation, and SHALL remove everything except digits. The system SHALL NOT restrict numbers by country or rewrite their prefixes. The only local check is length: 7 to 15 digits (E.164). Whether a number is supported is decided by GREEN-API.

#### Scenario: Number with formatting
- **WHEN** the user enters `+7 (999) 123-45-67`
- **THEN** the system uses the number `79991234567`

#### Scenario: Number from any country
- **WHEN** the user enters `+44 20 7946 0958`
- **THEN** the system uses the number `442079460958` and checks it with `checkAccount`

#### Scenario: Invalid length
- **WHEN** after removing non-digit characters, fewer than 7 or more than 15 digits remain
- **THEN** the system sends no requests and says the number is invalid

### Requirement: Create a chat by phone number
The system SHALL check a normalized number with `checkAccount`. It SHALL create a chat only if a MAX account exists. The chat key SHALL be the `chatId` returned by GREEN-API.

#### Scenario: Account exists
- **WHEN** `checkAccount` returns `exist: true` and a `chatId`
- **THEN** the system creates a chat with that `chatId` and phone number, adds it to the list, and opens it

#### Scenario: Account does not exist
- **WHEN** `checkAccount` returns `exist: false`
- **THEN** the system does not create a chat and says the number is not registered in MAX

#### Scenario: Number rejected by GREEN-API
- **WHEN** `checkAccount` responds with a validation error (for example, the country is not supported)
- **THEN** the system does not create a chat and says the number cannot be checked in MAX

#### Scenario: Check limit exceeded
- **WHEN** `checkAccount` responds with error 469
- **THEN** the system does not create a chat and says the MAX check limit has been reached and the user should try later

#### Scenario: Instance unavailable during check
- **WHEN** the `checkAccount` response contains `status: false`
- **THEN** the system does not create a chat and shows the reason from the response

### Requirement: No duplicate chats
The system SHALL NOT create a second chat with the same `chatId` or phone number. Before calling `checkAccount`, it SHALL look for an existing chat by phone number. A phone number of `0` from GREEN-API SHALL be treated as no phone number.

#### Scenario: Number of an existing chat
- **WHEN** the user creates a chat with a number that already has a chat in the list
- **THEN** the system opens the existing chat and does not call `checkAccount`

#### Scenario: Different number, same chatId
- **WHEN** `checkAccount` returns a `chatId` that already has a chat
- **THEN** the system opens the existing chat and does not create a new one

#### Scenario: Number of a chat loaded from the server
- **WHEN** the user creates a chat with a number that belongs to a personal chat loaded with `getChats`
- **THEN** the system opens the loaded chat and does not call `checkAccount`

#### Scenario: Chat without a phone number
- **WHEN** `getChats` returns a group or a hidden-number chat with phone number `0`
- **THEN** the chat has no phone number and is never matched by phone

### Requirement: Automatic chat creation for new messages
When a message arrives in a chat with a `chatId` that is not in the list, the system SHALL create a chat automatically, whatever the chat type, both for incoming messages and for outgoing messages the user sent from another device. Creating the chat SHALL NOT change the active chat.

#### Scenario: Message from an unknown sender
- **WHEN** a text message arrives from a `chatId` that is not in the list
- **THEN** a new chat with that message appears in the list, and the active chat does not change

#### Scenario: Title and phone of an incoming chat
- **WHEN** a chat is created for an incoming message in a personal chat
- **THEN** its title is the sender's contact name, then the sender name, then the chat name, then `chatId`, and its phone number comes from the notification when present

#### Scenario: Title of a group chat
- **WHEN** a chat is created for an incoming message in a group chat
- **THEN** its title is the chat name, or `chatId` when there is none, and it has no phone number

#### Scenario: No name in the notification
- **WHEN** the notification has no contact name, sender name, or chat name
- **THEN** the chat is titled with its `chatId`

#### Scenario: Message sent from the phone to an unknown chat
- **WHEN** the user sends a text message from the phone to a `chatId` that is not in the list, for example to themselves in Favorites
- **THEN** a new chat titled with the chat name, or `chatId` when there is none, appears in the list with that message as outgoing, and the active chat does not change

### Requirement: Chat list
The system SHALL show the list of chats in the sidebar. The order SHALL start from the server's activity order, and a chat SHALL move to the top when a message arrives in it or is sent to it. Each item SHALL show the chat title and, when the chat has messages, the text of the latest one and when it was sent: the time (`HH:MM`) for today, or "Yesterday" or a short date for earlier days.

#### Scenario: New message moves the chat up
- **WHEN** a message arrives in or is sent to a chat that is not at the top of the list
- **THEN** that chat moves to the top of the list

#### Scenario: Date of the latest message
- **WHEN** the latest messages of four chats were sent today at 09:15, yesterday, on 12 November of the current year, and on 28 December of the previous year
- **THEN** their items show "09:15", "Yesterday", "12 Nov", and "28 Dec" followed by that year

#### Scenario: Chat without messages
- **WHEN** a chat in the list has no text messages in the app yet
- **THEN** its item shows only the title, with no preview or time

#### Scenario: Empty list
- **WHEN** there are no chats
- **THEN** the system shows an empty list and a prompt to create a chat

### Requirement: Choose the active chat
The system SHALL let the user open a chat from the list. Only the messages of the active chat SHALL be shown in the chat window.

#### Scenario: Switch chats
- **WHEN** the user selects a chat in the list
- **THEN** the chat window shows the header and messages of that chat, and the chat is highlighted in the list

### Requirement: Load the chat list at login
After a successful login, the system SHALL request the chat list once with `getChats` and add every returned chat to the sidebar, whatever its type: personal, group, channel, or bot. A chat's title SHALL be its name from GREEN-API, or its `chatId` when the name is empty. When a chat's latest message from the list is a text message, it SHALL be added to the chat.

#### Scenario: Chats on the server
- **WHEN** the user logs in and `getChats` returns chats
- **THEN** the sidebar shows those chats in the order GREEN-API returned them, each with its title

#### Scenario: Latest message as preview
- **WHEN** `getChats` returns a chat whose latest message is a text message
- **THEN** that chat's sidebar item shows the message text and time without opening the chat

#### Scenario: Latest message is not text
- **WHEN** `getChats` returns a chat whose latest message is a photo
- **THEN** that chat's sidebar item shows only the title

#### Scenario: All chat types
- **WHEN** `getChats` returns a personal chat, a group, a channel, and a bot
- **THEN** all four appear in the sidebar

#### Scenario: Loading indicator
- **WHEN** the chat list request is pending and the sidebar has no chats
- **THEN** the sidebar shows that chats are loading instead of the empty-list prompt

#### Scenario: No chats on the server
- **WHEN** `getChats` returns an empty list
- **THEN** the sidebar shows the empty list and the prompt to create a chat

### Requirement: Merge the loaded chat list with existing chats
Loading the chat list SHALL NOT remove, reorder, or retitle chats already in the sidebar, and SHALL NOT change the active chat. Loaded chats not yet in the sidebar SHALL be added below the existing ones, in server order. For a chat already in the sidebar, the system SHALL only fill in its chat type and a missing phone number, and add the latest text message from the list when that message is not already in the chat.

#### Scenario: Message arrives during the load
- **WHEN** a live message creates a chat while `getChats` is pending, and the response includes that chat
- **THEN** the chat stays at the top of the list, appears only once, keeps its messages, and does not get a second copy of a message it already has

#### Scenario: Chat created by phone during the load
- **WHEN** the user creates and opens a chat by phone number while `getChats` is pending
- **THEN** after the load, that chat stays open and appears only once

### Requirement: Chat list load error
If `getChats` fails, the system SHALL show an error in the sidebar with a retry. The error SHALL NOT end the session, stop receiving notifications, or block creating chats by phone number.

#### Scenario: Request fails
- **WHEN** `getChats` fails with a network or server error
- **THEN** the sidebar shows that chats could not be loaded and offers a retry, and live messages keep appearing

#### Scenario: Retry succeeds
- **WHEN** the user clicks retry and `getChats` succeeds
- **THEN** the error disappears and the loaded chats are merged into the sidebar
