const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');
const { protectUser } = require('../middleware/auth');
const { validatePagination, validateObjectId } = require('../middleware/validation');

// @desc    Get user matches
// @route   GET /api/matches
// @access  Private
router.get('/', protectUser, validatePagination, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id)
            .populate({
                path: 'matches',
                select: 'name photos bio interests age lastActive',
                match: { isActive: true, isBlocked: false }
            });

        const matches = user.matches.slice(skip, skip + parseInt(limit));

        res.json({
            success: true,
            data: {
                matches,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: user.matches.length,
                    hasMore: skip + matches.length < user.matches.length
                }
            }
        });
    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get specific match details
// @route   GET /api/matches/:matchId
// @access  Private
router.get('/:matchId', protectUser, validateObjectId, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.user._id;

        const match = await Match.findById(matchId)
            .populate('users', 'name photos bio interests age');

        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        // Check if user is part of this match
        if (!match.hasUser(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this match'
            });
        }

        // Get the other user in the match
        const otherUser = match.getOtherUser(userId);
        const otherUserData = await User.findById(otherUser).select('name photos bio interests age lastActive');

        res.json({
            success: true,
            data: {
                match: {
                    id: match._id,
                    createdAt: match.createdAt,
                    lastMessageAt: match.lastMessageAt,
                    otherUser: otherUserData
                }
            }
        });
    } catch (error) {
        console.error('Get match error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Unmatch a user
// @route   DELETE /api/matches/:matchId
// @access  Private
router.delete('/:matchId', protectUser, validateObjectId, async (req, res) => {
    try {
        const { matchId } = req.params;
        const userId = req.user._id;

        const match = await Match.findById(matchId);
        if (!match) {
            return res.status(404).json({
                success: false,
                message: 'Match not found'
            });
        }

        // Check if user is part of this match
        if (!match.hasUser(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to unmatch this user'
            });
        }

        const otherUserId = match.getOtherUser(userId);

        // Remove match from both users
        await User.findByIdAndUpdate(userId, {
            $pull: { matches: otherUserId }
        });

        await User.findByIdAndUpdate(otherUserId, {
            $pull: { matches: userId }
        });

        // Deactivate the match
        match.isActive = false;
        await match.save();

        res.json({
            success: true,
            message: 'Match removed successfully'
        });
    } catch (error) {
        console.error('Unmatch error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get match statistics
// @route   GET /api/matches/stats/overview
// @access  Private
router.get('/stats/overview', protectUser, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        const totalMatches = user.matches.length;
        const totalLikes = user.likes.length;
        const totalLikedBy = user.likedBy.length;

        res.json({
            success: true,
            data: {
                stats: {
                    totalMatches,
                    totalLikes,
                    totalLikedBy,
                    matchRate: totalLikedBy > 0 ? Math.round((totalMatches / totalLikedBy) * 100) : 0
                }
            }
        });
    } catch (error) {
        console.error('Get match stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router; 