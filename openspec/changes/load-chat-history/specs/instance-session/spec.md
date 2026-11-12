# Spec Delta

## MODIFIED Requirements

### Requirement: Logout
The system SHALL provide a logout action. Logout SHALL stop receiving notifications, cancel any pending chat list or history request, and clear credentials, chats, and messages.

#### Scenario: Logout and log in to a different instance
- **WHEN** the user logs out and logs in with different credentials
- **THEN** the new session has no chats or messages from the previous one, and no requests are sent with the previous credentials

#### Scenario: Logout while chats are loading
- **WHEN** the user logs out while the chat list request is pending
- **THEN** the request is cancelled, and its response does not add chats to any later session
