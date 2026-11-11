# Spec Delta

## Purpose

Delivers GREEN-API notifications to the app over the HTTP API: it reads the instance notification queue, passes the relevant events on to chats, and keeps the queue moving after network failures.

## ADDED Requirements

### Requirement: Continuous queue polling during a session
While the user is logged in, the system SHALL keep exactly one active notification-reading loop. Each step SHALL request one notification with `receiveNotification` using long polling. The loop SHALL start after login and stop on logout.

#### Scenario: Start after login
- **WHEN** the user logs in successfully
- **THEN** the system starts reading notifications, and there is no more than one pending `receiveNotification` request at any time

#### Scenario: Stop on logout
- **WHEN** the user logs out
- **THEN** the pending request is cancelled, and no new requests are sent

#### Scenario: Empty queue
- **WHEN** `receiveNotification` returns an empty response because the timeout expired
- **THEN** the system immediately requests the next notification and does not report an error

### Requirement: Confirm every notification
After processing each notification it receives, the system SHALL remove it from the queue with `deleteNotification`, using its `receiptId`. This SHALL apply whatever the notification type and whether it was shown in the interface.

#### Scenario: Service notification
- **WHEN** a notification arrives that is not related to messages (for example, a change in instance state)
- **THEN** the system does not change the chats and removes the notification from the queue

#### Scenario: Removal fails
- **WHEN** the `deleteNotification` request fails
- **THEN** the system retries the removal before requesting the next notification

### Requirement: Discard notifications from before login
The system SHALL NOT show messages from notifications with a time earlier than the session's login time. Those notifications SHALL still be removed from the queue.

#### Scenario: Old message in the queue
- **WHEN** after login, the queue contains a notification about a message received before login
- **THEN** the message does not appear in any chat, no chat is created, and the notification is removed from the queue

### Requirement: Filter notifications
The system SHALL pass on to chats only notifications about incoming messages, outgoing API messages, and outgoing messages from other devices, of text type, in personal chats. Notifications from group chats SHALL be ignored.

#### Scenario: Group chat
- **WHEN** a message notification arrives for a chat with a group identifier (a negative number)
- **THEN** the system does not change the chats and removes the notification from the queue

#### Scenario: Unexpected notification format
- **WHEN** a notification does not have the fields needed for processing
- **THEN** the system ignores it, removes it from the queue, and keeps polling

#### Scenario: Outgoing message from a phone to an unknown chat
- **WHEN** a notification about an outgoing message from another device arrives for a `chatId` that is not in the list
- **THEN** the system does not create a chat

### Requirement: Resilience to network errors
If a request to the queue fails, the system SHALL keep polling with an increasing delay between attempts and SHALL reset the delay after the first successful request. A network error SHALL NOT end the session.

#### Scenario: Temporary network loss
- **WHEN** several `receiveNotification` requests in a row fail with a network error and the network then comes back
- **THEN** the delays between attempts grow up to a limit, and after the first successful request polling continues without a delay

#### Scenario: Connection state indicator
- **WHEN** the queue cannot be reached after repeated attempts
- **THEN** the interface shows that the connection has been lost, and the indicator disappears after a successful request

### Requirement: Order of processing
The system SHALL process notifications in the order the queue returns them. It SHALL request the next notification only after it has finished processing and removing the current one.

#### Scenario: Several messages in a row
- **WHEN** the recipient sends several messages in a row
- **THEN** they appear in the chat in the order they were sent
