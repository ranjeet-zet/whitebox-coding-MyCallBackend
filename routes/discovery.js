const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Match = require('../models/Match');
const { protectUser } = require('../middleware/auth');
const { validateLikeDislike, validatePagination } = require('../middleware/validation');

// @desc    Get discovery users (nearby users to like/dislike)
// @route   GET /api/discovery
// @access  Private
router.get('/', protectUser, validatePagination, async (req, res) => {
    try {
        const { page = 1, limit = 20, maxDistance = 50 } = req.query;
        const skip = (page - 1) * limit;

        const user = await User.findById(req.user._id);

        if (!user.location) {
            return res.status(400).json({
                success: false,
                message: 'Please update your location to discover users'
            });
        }

        // Build query for discovery
        const query = {
            _id: { $ne: user._id }, // Exclude current user
            isActive: true,
            isBlocked: false,
            profileCompleted: true,
            location: {
                $near: {
                    $geometry: user.location,
                    $maxDistance: maxDistance * 1000 // Convert km to meters
                }
            }
        };

        // Exclude users that current user has already liked, disliked, or blocked
        query._id.$nin = [
            ...user.likes,
            ...user.blocked,
            ...user.blockedBy
        ];

        const users = await User.find(query)
            .select('name photos bio interests age location')
            .limit(parseInt(limit))
            .skip(skip)
            .lean();

        // Calculate distance for each user
        const usersWithDistance = users.map(userDoc => {
            const distance = calculateDistance(
                user.location.coordinates[1],
                user.location.coordinates[0],
                userDoc.location.coordinates[1],
                userDoc.location.coordinates[0]
            );

            return {
                ...userDoc,
                distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
            };
        });

        res.json({
            success: true,
            data: {
                users: usersWithDistance,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    hasMore: usersWithDistance.length === parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Discovery error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Like a user
// @route   POST /api/discovery/like
// @access  Private
router.post('/like', protectUser, validateLikeDislike, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user._id;

        if (targetUserId === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot like yourself'
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (!targetUser.isActive || targetUser.isBlocked) {
            return res.status(400).json({
                success: false,
                message: 'User is not available'
            });
        }

        const currentUser = await User.findById(currentUserId);

        // Check if already liked
        if (currentUser.likes.includes(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: 'Already liked this user'
            });
        }

        // Add to likes
        currentUser.likes.push(targetUserId);
        await currentUser.save();

        // Check if it's a mutual like (match)
        let isMatch = false;
        let match = null;

        if (targetUser.likes.includes(currentUserId)) {
            isMatch = true;

            // Create match
            match = await Match.create({
                users: [currentUserId, targetUserId]
            });

            // Add to matches for both users
            currentUser.matches.push(targetUserId);
            targetUser.matches.push(currentUserId);

            await Promise.all([currentUser.save(), targetUser.save()]);

            // TODO: Send push notification to target user about the match
        }

        res.json({
            success: true,
            message: isMatch ? 'It\'s a match!' : 'User liked successfully',
            data: {
                isMatch,
                match: isMatch ? {
                    id: match._id,
                    users: [currentUser.getPublicProfile(), targetUser.getPublicProfile()]
                } : null
            }
        });
    } catch (error) {
        console.error('Like user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Dislike a user
// @route   POST /api/discovery/dislike
// @access  Private
router.post('/dislike', protectUser, validateLikeDislike, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user._id;

        if (targetUserId === currentUserId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot dislike yourself'
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const currentUser = await User.findById(currentUserId);

        // Remove from likes if exists
        currentUser.likes = currentUser.likes.filter(id => id.toString() !== targetUserId);
        await currentUser.save();

        res.json({
            success: true,
            message: 'User disliked successfully'
        });
    } catch (error) {
        console.error('Dislike user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Super like a user (premium feature)
// @route   POST /api/discovery/super-like
// @access  Private
router.post('/super-like', protectUser, validateLikeDislike, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId);

        // Check if user is premium
        if (!currentUser.isPremiumActive()) {
            return res.status(403).json({
                success: false,
                message: 'Super like is a premium feature'
            });
        }

        // TODO: Implement super like logic
        // For now, just like the user
        return router.post('/like', protectUser, validateLikeDislike, req, res);
    } catch (error) {
        console.error('Super like error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}

module.exports = router; 