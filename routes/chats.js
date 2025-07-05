const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Match = require('../models/Match');
const { protectUser } = require('../middleware/auth');
const { validateChatMessage, validatePagination, validateObjectId } = require('../middleware/validation');

// @desc    Get chat messages for a match
// @route   GET /api/chats/:matchId
// @access  Private
router.get('/:matchId', protectUser, validateObjectId, validatePagination, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;
        const userId = req.user._id;

        // Verify match exists and user is part of it
        const match = await Match.findById(matchId);
        if (!match || !match.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        if (!match.hasUser(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this chat'
            });
        }

        // Get messages
        const messages = await Chat.find({
            matchId,
            isDeleted: false
        })
            .populate('sender', 'name photos')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Mark messages as read
        await Chat.updateMany(
            {
                matchId,
                sender: { $ne: userId },
                isRead: false,
                isDeleted: false
            },
            { isRead: true, readAt: new Date() }
        );

        // Reset unread count for this user
        match.resetUnread(userId);
        await match.save();

        res.json({
            success: true,
            data: {
                messages: messages.reverse(), // Reverse to get chronological order
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    hasMore: messages.length === parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Send a message
// @route   POST /api/chats/:matchId
// @access  Private
router.post('/:matchId', protectUser, validateObjectId, validateChatMessage, async (req, res) => {
    try {
        const { matchId } = req.params;
        const { message, messageType = 'text' } = req.body;
        const senderId = req.user._id;

        // Verify match exists and user is part of it
        const match = await Match.findById(matchId);
        if (!match || !match.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        if (!match.hasUser(senderId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to send message to this match'
            });
        }

        // Create message
        const chatMessage = await Chat.create({
            matchId,
            sender: senderId,
            message,
            messageType
        });

        // Populate sender info
        await chatMessage.populate('sender', 'name photos');

        // Increment unread count for the other user
        const otherUserId = match.getOtherUser(senderId);
        match.incrementUnread(otherUserId);
        await match.save();

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: {
                message: chatMessage
            }
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Mark messages as read
// @route   PUT /api/chats/:matchId/read
// @access  Private
router.put('/:matchId/read', protectUser, validateObjectId, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.user._id;

        // Verify match exists and user is part of it
        const match = await Match.findById(matchId);
        if (!match || !match.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        if (!match.hasUser(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this chat'
            });
        }

        // Mark all unread messages as read
        await Chat.updateMany(
            {
                matchId,
                sender: { $ne: userId },
                isRead: false,
                isDeleted: false
            },
            { isRead: true, readAt: new Date() }
        );

        // Reset unread count
        match.resetUnread(userId);
        await match.save();

        res.json({
            success: true,
            message: 'Messages marked as read'
        });
    } catch (error) {
        console.error('Mark messages as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Delete a message
// @route   DELETE /api/chats/:matchId/messages/:messageId
// @access  Private
router.delete('/:matchId/messages/:messageId', protectUser, validateObjectId, async (req, res) => {
    try {
        const { matchId, messageId } = req.params;
        const userId = req.user._id;

        // Verify match exists and user is part of it
        const match = await Match.findById(matchId);
        if (!match || !match.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        if (!match.hasUser(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this chat'
            });
        }

        // Find and verify message
        const message = await Chat.findById(messageId);
        if (!message || message.matchId.toString() !== matchId) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Only sender can delete their own message
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this message'
            });
        }

        // Soft delete the message
        await message.softDelete();

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get unread message count for all matches
// @route   GET /api/chats/unread/count
// @access  Private
router.get('/unread/count', protectUser, async (req, res) => {
    try {
        const userId = req.user._id;

        // Get all active matches for the user
        const user = await User.findById(userId).populate('matches');
        const matchIds = user.matches.map(match => match._id);

        // Get unread message counts for each match
        const unreadCounts = await Chat.aggregate([
            {
                $match: {
                    matchId: { $in: matchIds },
                    sender: { $ne: userId },
                    isRead: false,
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: '$matchId',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Convert to object for easy lookup
        const unreadMap = {};
        unreadCounts.forEach(item => {
            unreadMap[item._id.toString()] = item.count;
        });

        res.json({
            success: true,
            data: {
                unreadCounts: unreadMap,
                totalUnread: unreadCounts.reduce((sum, item) => sum + item.count, 0)
            }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router; 