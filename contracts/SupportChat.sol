// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title SupportChat
 * @notice Ownerless on-chain support chat for GoodDAPP.
 *
 * Design notes (deliberate, see docs/SUPPORT_CHAT_PROPOSAL.md):
 * - Messages live ONLY in the `MessagePosted` event. There is no storage
 *   array, so posting costs a single log write instead of a slot per message.
 * - There is no owner, no pause, no delete and no upgrade path. Nothing can
 *   rewrite or remove a message after it is mined, which is what makes the
 *   contract honest: the widget promises "permanent and public".
 * - Two cheap guards replace moderation: a per-wallet cooldown and a byte
 *   length cap. Both are constants, so nobody can change them later.
 * - Anything private (wallet addresses, order details) belongs in the
 *   Telegram support group, not here. The widget says so before the first post.
 */
contract SupportChat {
    /// @notice Maximum message size in UTF-8 bytes (not characters).
    uint256 public constant MAX_MESSAGE_BYTES = 1000;

    /// @notice Minimum time between two messages from the same wallet.
    uint256 public constant POST_COOLDOWN_SECONDS = 15;

    /// @notice Last time a wallet posted, 0 means never.
    mapping(address => uint256) public lastPostAt;

    /// @notice Id of the next message, so clients can order and de-duplicate.
    uint256 public nextId = 1;

    /// @notice Emitted once per accepted message.
    event MessagePosted(uint256 indexed id, address indexed author, string message, uint256 timestamp);

    error EmptyMessage();
    error MessageTooLong(uint256 length, uint256 maxLength);
    error PostingTooSoon(uint256 retryAfterSeconds);

    /**
     * @notice Publish a support message.
     * @param message UTF-8 text, 1..MAX_MESSAGE_BYTES bytes.
     * @return id The id assigned to the message.
     */
    function post(string calldata message) external returns (uint256 id) {
        uint256 length = bytes(message).length;
        if (length == 0) revert EmptyMessage();
        if (length > MAX_MESSAGE_BYTES) revert MessageTooLong(length, MAX_MESSAGE_BYTES);

        uint256 last = lastPostAt[msg.sender];
        if (last != 0 && block.timestamp < last + POST_COOLDOWN_SECONDS) {
            revert PostingTooSoon(last + POST_COOLDOWN_SECONDS - block.timestamp);
        }

        lastPostAt[msg.sender] = block.timestamp;
        id = nextId++;
        emit MessagePosted(id, msg.sender, message, block.timestamp);
    }
}
