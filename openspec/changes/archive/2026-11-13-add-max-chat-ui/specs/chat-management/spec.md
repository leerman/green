# Spec Delta

## Purpose

Manages the list of chats with MAX recipients: creating a chat by phone number, creating chats automatically for incoming messages, and choosing the active chat.

## ADDED Requirements

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
The system SHALL NOT create a second chat with the same `chatId` or phone number. Before calling `checkAccount`, it SHALL look for an existing chat by phone number.

#### Scenario: Number of an existing chat
- **WHEN** the user creates a chat with a number that already has a chat in the list
- **THEN** the system opens the existing chat and does not call `checkAccount`

#### Scenario: Different number, same chatId
- **WHEN** `checkAccount` returns a `chatId` that already has a chat
- **THEN** the system opens the existing chat and does not create a new one

### Requirement: Automatic chat creation for new messages
When a message arrives in a personal chat with a `chatId` that is not in the list, the system SHALL create a chat automatically, both for incoming messages and for outgoing messages the user sent from another device. Creating the chat SHALL NOT change the active chat.

#### Scenario: Message from an unknown sender
- **WHEN** a text message arrives from a `chatId` that is not in the list
- **THEN** a new chat with that message appears in the list, and the active chat does not change

#### Scenario: Title and phone of an incoming chat
- **WHEN** a chat is created for an incoming message
- **THEN** its title is the sender's contact name, then the sender name, then the chat name, then `chatId`, and its phone number comes from the notification when present

#### Scenario: No name in the notification
- **WHEN** the notification has no contact name, sender name, or chat name
- **THEN** the chat is titled with its `chatId`

#### Scenario: Message sent from the phone to an unknown chat
- **WHEN** the user sends a text message from the phone to a `chatId` that is not in the list, for example to themselves in Favorites
- **THEN** a new chat titled with the chat name, or `chatId` when there is none, appears in the list with that message as outgoing, and the active chat does not change

### Requirement: Chat list
The system SHALL show the list of chats in the sidebar, sorted by the time of the latest message, newest first. Each item SHALL show the chat title and the text of the latest message.

#### Scenario: New message moves the chat up
- **WHEN** a message arrives in or is sent to a chat that is not at the top of the list
- **THEN** that chat moves to the top of the list

#### Scenario: Empty list
- **WHEN** there are no chats
- **THEN** the system shows an empty list and a prompt to create a chat

### Requirement: Choose the active chat
The system SHALL let the user open a chat from the list. Only the messages of the active chat SHALL be shown in the chat window.

#### Scenario: Switch chats
- **WHEN** the user selects a chat in the list
- **THEN** the chat window shows the header and messages of that chat, and the chat is highlighted in the list
