const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protectUser } = require('../middleware/auth');
const { validateProfileUpdate, validateLocation } = require('../middleware/validation');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protectUser, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('matches', 'name photos');

        res.json({
            success: true,
            data: {
                user: {
                    ...user.toObject(),
                    isPremium: user.isPremiumActive()
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protectUser, validateProfileUpdate, async (req, res) => {
    try {
        const { name, bio, interests } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (bio !== undefined) updateData.bio = bio;
        if (interests) updateData.interests = interests;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update user location
// @route   PUT /api/users/location
// @access  Private
router.put('/location', protectUser, validateLocation, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(longitude), parseFloat(latitude)]
                }
            },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Location updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Upload profile photo
// @route   POST /api/users/upload-photo
// @access  Private
router.post('/upload-photo', protectUser, async (req, res) => {
    try {
        const { photoUrl } = req.body;

        if (!photoUrl) {
            return res.status(400).json({
                success: false,
                message: 'Photo URL is required'
            });
        }

        const user = await User.findById(req.user._id);

        // Add photo to photos array
        user.photos.push(photoUrl);

        // Mark profile as completed if it has at least one photo
        if (!user.profileCompleted && user.photos.length > 0) {
            user.profileCompleted = true;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Photo uploaded successfully',
            data: {
                photos: user.photos,
                profileCompleted: user.profileCompleted
            }
        });
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Delete profile photo
// @route   DELETE /api/users/photos/:photoIndex
// @access  Private
router.delete('/photos/:photoIndex', protectUser, async (req, res) => {
    try {
        const photoIndex = parseInt(req.params.photoIndex);
        const user = await User.findById(req.user._id);

        if (photoIndex < 0 || photoIndex >= user.photos.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid photo index'
            });
        }

        // Remove photo at specified index
        user.photos.splice(photoIndex, 1);

        // Mark profile as incomplete if no photos left
        if (user.photos.length === 0) {
            user.profileCompleted = false;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Photo deleted successfully',
            data: {
                photos: user.photos,
                profileCompleted: user.profileCompleted
            }
        });
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Block user
// @route   POST /api/users/block/:userId
// @access  Private
router.post('/block/:userId', protectUser, async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        if (targetUserId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot block yourself'
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = await User.findById(req.user._id);

        // Add to blocked list
        if (!user.blocked.includes(targetUserId)) {
            user.blocked.push(targetUserId);
        }

        // Remove from likes and matches if exists
        user.likes = user.likes.filter(id => id.toString() !== targetUserId);
        user.matches = user.matches.filter(id => id.toString() !== targetUserId);

        await user.save();

        res.json({
            success: true,
            message: 'User blocked successfully'
        });
    } catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Unblock user
// @route   DELETE /api/users/block/:userId
// @access  Private
router.delete('/block/:userId', protectUser, async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const user = await User.findById(req.user._id);

        // Remove from blocked list
        user.blocked = user.blocked.filter(id => id.toString() !== targetUserId);
        await user.save();

        res.json({
            success: true,
            message: 'User unblocked successfully'
        });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Get blocked users
// @route   GET /api/users/blocked
// @access  Private
router.get('/blocked', protectUser, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('blocked', 'name photos');

        res.json({
            success: true,
            data: {
                blockedUsers: user.blocked
            }
        });
    } catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @desc    Update FCM token
// @route   PUT /api/users/fcm-token
// @access  Private
router.put('/fcm-token', protectUser, async (req, res) => {
    try {
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        await User.findByIdAndUpdate(req.user._id, { fcmToken });

        res.json({
            success: true,
            message: 'FCM token updated successfully'
        });
    } catch (error) {
        console.error('Update FCM token error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router; 