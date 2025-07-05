const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        unique: true,
        sparse: true,
        match: [/^\+?[\d\s-]+$/, 'Please enter a valid phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    gender: {
        type: String,
        required: [true, 'Gender is required'],
        enum: ['male', 'female', 'non-binary', 'other']
    },
    dob: {
        type: Date,
        required: [true, 'Date of birth is required'],
        validate: {
            validator: function (v) {
                const age = Math.floor((new Date() - v) / (365.25 * 24 * 60 * 60 * 1000));
                return age >= 18;
            },
            message: 'You must be at least 18 years old'
        }
    },
    bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
    },
    interests: [{
        type: String,
        maxlength: [30, 'Interest cannot exceed 30 characters']
    }],
    photos: [{
        type: String,
        required: [true, 'At least one photo is required']
    }],
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: [true, 'Location coordinates are required']
        }
    },
    isPremium: {
        type: Boolean,
        default: false
    },
    premiumExpiresAt: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    matches: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blocked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blockedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    fcmToken: {
        type: String
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    profileCompleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

// Index for discovery queries
userSchema.index({ gender: 1, isActive: 1, isBlocked: 1 });

// Virtual for age calculation
userSchema.virtual('age').get(function () {
    return Math.floor((new Date() - this.dob) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual for distance calculation (will be populated by discovery service)
userSchema.virtual('distance').get(function () {
    return this._distance;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user is premium
userSchema.methods.isPremiumActive = function () {
    if (!this.isPremium) return false;
    if (!this.premiumExpiresAt) return true;
    return this.premiumExpiresAt > new Date();
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function () {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.email;
    delete userObject.phone;
    delete userObject.fcmToken;
    delete userObject.isBlocked;
    delete userObject.blocked;
    delete userObject.blockedBy;
    return userObject;
};

// Method to check if user can be seen by another user
userSchema.methods.canBeSeenBy = function (otherUserId) {
    return !this.blocked.includes(otherUserId) &&
        !this.blockedBy.includes(otherUserId) &&
        this.isActive &&
        !this.isBlocked;
};

module.exports = mongoose.model('User', userSchema); 