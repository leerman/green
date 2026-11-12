# chat-history Specification

## Purpose

Loads a chat's earlier messages from GREEN-API when the user opens the chat, so conversations that happened before this session are visible, merged with live messages without duplicates.

## Requirements

### Requirement: Load history when a chat is first opened
The first time the user opens a chat in a session, the system SHALL request its latest 100 messages with `getChatHistory`. The system SHALL NOT request history for chats the user has not opened. A chat whose history has loaded SHALL NOT be requested again in the same session.

#### Scenario: Open a chat for the first time
- **WHEN** the user opens a chat whose history has not been loaded
- **THEN** the system requests `getChatHistory` for that chat with a count of 100 and shows a loading indicator in the chat window

#### Scenario: Open the chat again
- **WHEN** the user opens a chat whose history has already loaded and then opens it again
- **THEN** the system does not request its history again

#### Scenario: Chat not opened
- **WHEN** the chat list is loaded at login
- **THEN** the system sends no `getChatHistory` requests until the user opens a chat

#### Scenario: Chat with live messages but no history
- **WHEN** a chat received live messages in this session and the user opens it for the first time
- **THEN** the system requests its history

#### Scenario: Chat with a preview from the list
- **WHEN** a chat shows its latest message from the chat list and the user opens it for the first time
- **THEN** the system requests its history, and the latest message appears only once

### Requirement: Pace history requests
The system SHALL send at most one history request at a time, start each request at least 1.5 seconds after the previous one started, and serve them in the order the chats were opened. When GREEN-API answers with HTTP 429, the system SHALL wait and retry automatically, up to 2 retries, before treating the load as failed.

#### Scenario: Several chats opened quickly
- **WHEN** the user opens three chats within one second
- **THEN** the system requests their histories one after another, at least 1.5 seconds apart, and each chat shows a loading indicator until its turn completes

#### Scenario: Rate limit answered once
- **WHEN** `getChatHistory` answers HTTP 429 and the retry succeeds
- **THEN** the history is shown and no error appears

#### Scenario: Rate limit persists
- **WHEN** `getChatHistory` answers HTTP 429 to the first request and to both retries
- **THEN** the chat window shows the history load error with a retry button

#### Scenario: Other errors are not retried automatically
- **WHEN** `getChatHistory` fails with a network or server error other than HTTP 429
- **THEN** the system does not retry automatically and shows the error with a retry button

### Requirement: Show loaded history
The system SHALL add the text messages from the history to the chat, ordered by their timestamp, as incoming or outgoing according to the history entry. Outgoing messages from history SHALL have the status "sent". Loading history SHALL NOT move the chat in the list and SHALL NOT change the active chat.

#### Scenario: History arrives
- **WHEN** `getChatHistory` returns incoming and outgoing text messages
- **THEN** the chat shows them in chronological order, oldest first, with outgoing ones marked "sent"

#### Scenario: Empty history
- **WHEN** `getChatHistory` returns no messages
- **THEN** the chat window shows the chat with no messages and no error

#### Scenario: Position in the list
- **WHEN** history finishes loading for a chat that is not at the top of the list
- **THEN** the chat stays in its position

### Requirement: Merge history with live messages
The system SHALL identify messages by `idMessage`. A history message whose `idMessage` is already in the chat SHALL NOT be added again, and the message already in the chat SHALL be kept. Outgoing messages still being sent or not sent SHALL stay in the chat.

#### Scenario: Live message also in history
- **WHEN** a message arrived as a live notification and the same `idMessage` is in the loaded history
- **THEN** the chat contains exactly one copy of that message

#### Scenario: Live message during loading
- **WHEN** a live message arrives while the chat's history is loading
- **THEN** after the history loads, the chat contains the live message and the history, with no duplicates, in chronological order

#### Scenario: Unsent message during loading
- **WHEN** the chat contains a message with the status "sending" or "not sent" and the history loads
- **THEN** that message stays in the chat with its status

### Requirement: History load error and retry
If the history request fails, the system SHALL keep the messages already in the chat, show that the history could not be loaded, and offer a retry. Opening the chat again after a failure SHALL also retry. The error SHALL NOT end the session or stop receiving notifications.

#### Scenario: Request fails
- **WHEN** `getChatHistory` fails with a network or server error
- **THEN** the chat window shows an error with a retry button, and messages already in the chat stay visible

#### Scenario: Retry succeeds
- **WHEN** the user clicks retry and `getChatHistory` succeeds
- **THEN** the error disappears and the history is shown

### Requirement: Non-text messages in history
The system SHALL show only text messages from history, including text with a link preview. Other message types, reactions, and deleted messages SHALL be skipped.

#### Scenario: Photo in history
- **WHEN** the history contains an image message
- **THEN** that message does not appear in the chat

#### Scenario: Reaction in history
- **WHEN** the history contains a reaction to a message
- **THEN** no message is added for the reaction

#### Scenario: Deleted message in history
- **WHEN** the history contains a message marked as deleted
- **THEN** that message does not appear in the chat

### Requirement: History belongs to its session
A history response that arrives after the user has logged out SHALL NOT change any chat, including chats of a later session.

#### Scenario: Logout during loading
- **WHEN** the user logs out while a history request is pending and then logs in again
- **THEN** the response to the earlier request does not change the chats of the new session
