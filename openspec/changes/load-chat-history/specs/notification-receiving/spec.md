# Spec Delta

## MODIFIED Requirements

### Requirement: Filter notifications
The system SHALL pass on to chats only notifications about incoming messages, outgoing API messages, and outgoing messages from other devices, of text type, in chats of any type, including group chats.

#### Scenario: Group chat
- **WHEN** a text message notification arrives for a chat with a group identifier (a negative number)
- **THEN** the system adds the message to that group chat, creating the chat if it is not in the list, and removes the notification from the queue

#### Scenario: Unexpected notification format
- **WHEN** a notification does not have the fields needed for processing
- **THEN** the system ignores it, removes it from the queue, and keeps polling

#### Scenario: Outgoing message from a phone to an unknown chat
- **WHEN** a notification about an outgoing message from another device arrives for a `chatId` that is not in the list
- **THEN** the system creates the chat with that message as outgoing, and the active chat does not change
