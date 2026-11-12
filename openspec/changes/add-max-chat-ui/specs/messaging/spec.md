# Spec Delta

## Purpose

Lets the user exchange text messages with a MAX recipient in the active chat: send messages, see send statuses and incoming replies, and see no duplicate copies of their own messages.

## ADDED Requirements

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
The system SHALL show outgoing text messages that the user sent to a personal chat from a phone or another client as outgoing messages in that chat, creating the chat if it is not in the list.

#### Scenario: Message from a phone
- **WHEN** a notification arrives about an outgoing text message sent from another device
- **THEN** the message appears in that chat as outgoing

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

### Requirement: Unsupported message types
In this version, the system SHALL handle only text messages. Notifications about messages of other types SHALL be ignored and SHALL NOT be shown in the chat.

#### Scenario: Image arrives
- **WHEN** an incoming message of a non-text type arrives
- **THEN** no new message appears in the chat
