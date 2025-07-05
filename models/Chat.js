const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    matchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Match',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: [true, 'Message cannot be empty'],
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'gif', 'emoji'],
        default: 'text'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
chatSchema.index({ matchId: 1, createdAt: -1 });
chatSchema.index({ sender: 1 });
chatSchema.index({ isRead: 1 });

// Pre-save middleware to update match's lastMessageAt
chatSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const Match = mongoose.model('Match');
            await Match.findByIdAndUpdate(this.matchId, {
                lastMessageAt: new Date()
            });
        } catch (error) {
            console.error('Error updating match lastMessageAt:', error);
        }
    }
    next();
});

// Method to mark message as read
chatSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Method to soft delete message
chatSchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Chat', chatSchema); 