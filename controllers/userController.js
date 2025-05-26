const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Book = require("../models/bookModel");
const mongoose = require("mongoose");
const Notification = require("../models/notificationModel");
const bcrypt = require("bcrypt");
const { uploadImage, deleteFile } = require("../utils/cloudinary");
const Wishlist = require("../models/wishlistModel");
const Interaction = require("../models/interactionModel");
const { validateEmail, validatePassword } = require("../utils/validators");

// Create a new user
exports.createUser = async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Get all users
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get a single user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update a user by ID
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get user's library of purchased books
exports.getLibrary = async (req, res) => {
    try {
        const userId = req.user.id;

        const orders = await Order.find({
            user: userId,
            paymentStatus: "paid",
            orderStatus: { $ne: "canceled" },
        }).populate({
            path: "items.book",
            select: "title author imageUrl isDigital isAudiobook",
        });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: "No purchased books found in your library" });
        }

        const library = orders.flatMap((order) =>
            order.items
                .filter((item) => item.book) // Ensure book exists
                .map((item) => ({
                    bookId: item.book._id,
                    title: item.book.title,
                    author: item.book.author,
                    imageUrl: item.book.imageUrl,
                    isDigital: item.book.isDigital,
                    isAudiobook: item.book.isAudiobook,
                    accessUrl:
                        item.book.isDigital || item.book.isAudiobook
                            ? `${req.protocol}://${req.get("host")}/api/order/stream/${item.book._id}`
                            : null,
                    purchasedAt: order.createdAt,
                }))
        );

        res.status(200).json({ success: true, data: library });
    } catch (error) {
        console.error("Error fetching library:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get user's notifications
exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification.find({ user: userId })
            .populate({
                path: 'order',
                select: 'orderStatus paymentStatus pricing.total createdAt'
            })
            .sort({ createdAt: -1 }) // Newest first
            .lean();
        
        // Format notifications for better readability
        const formattedNotifications = notifications.map(notification => ({
            id: notification._id,
            message: notification.message,
            status: notification.status,
            eventType: notification.eventType,
            isRead: notification.isRead,
            createdAt: notification.createdAt,
            order: notification.order ? {
                id: notification.order._id,
                status: notification.order.orderStatus,
                paymentStatus: notification.order.paymentStatus,
                total: notification.order.pricing.total,
                createdAt: notification.order.createdAt
            } : null
        }));
        
        res.status(200).json({ 
            success: true, 
            data: formattedNotifications 
        });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get current user's profile
exports.getMyProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("-password")
            .populate({
                path: 'location',
                select: 'address coordinates'
            });
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        res.status(200).json({ 
            success: true, 
            data: user 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Helper function for consistent error responses
const errorResponse = (res, status, message, error = null) => {
    return res.status(status).json({
        success: false,
        message,
        error: error?.message || null
    });
};

// Helper function for consistent success responses
const successResponse = (res, status, data, message = null) => {
    return res.status(status).json({
        success: true,
        data,
        message
    });
};

// Update current user's profile
exports.updateMyProfile = async (req, res) => {
    try {
        const { name, email, currentPassword, newPassword, location } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return errorResponse(res, 404, "User not found");
        }

        // Validate email if provided
        if (email && !validateEmail(email)) {
            return errorResponse(res, 400, "Invalid email format");
        }

        // Update basic info
        if (name) user.name = name;
        if (email) user.email = email;
        if (location) user.location = location;

        // Update password if provided
        if (currentPassword && newPassword) {
            if (!validatePassword(newPassword)) {
                return errorResponse(res, 400, "Password must be at least 8 characters long and contain at least one number and one special character");
            }

            const isMatch = await user.matchPassword(currentPassword);
            if (!isMatch) {
                return errorResponse(res, 400, "Current password is incorrect");
            }
            user.password = newPassword;
        }

        await user.save();

        return successResponse(res, 200, user, "Profile updated successfully");
    } catch (error) {
        return errorResponse(res, 400, "Profile update failed", error);
    }
};

// Update profile image
exports.updateProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, "Please upload an image");
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 404, "User not found");
        }

        // Delete old profile image if exists
        if (user.profileImageUrl) {
            const publicId = user.profileImageUrl.split('/').slice(-1)[0].split('.')[0];
            await deleteFile(publicId);
        }

        // Upload new image to Cloudinary
        const imageUrl = await uploadImage(req.file.buffer, "profile_images");

        // Update user's profile image URL
        user.profileImageUrl = imageUrl;
        await user.save();

        return successResponse(res, 200, user, "Profile image updated successfully");
    } catch (error) {
        return errorResponse(res, 400, "Profile image update failed", error);
    }
};

// Get user's order history
exports.getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate('books.book')
            .sort('-createdAt');

        res.status(200).json({ 
            success: true, 
            data: orders 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Get user's wishlist
exports.getMyWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.find({ 
            user: req.user.id,
            status: 'active'
        }).populate('book');

        res.status(200).json({ 
            success: true, 
            data: wishlist 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Get user's reading history
exports.getMyReadingHistory = async (req, res) => {
    try {
        const interactions = await Interaction.find({
            userId: req.user.id,
            type: 'view'
        })
        .populate('bookId')
        .sort('-timestamp')
        .limit(20);

        res.status(200).json({ 
            success: true, 
            data: interactions 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// Delete current user's account
exports.deleteMyAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 404, "User not found");
        }

        // Check for active orders
        const activeOrders = await Order.findOne({
            user: req.user.id,
            orderStatus: { $in: ["processing", "shipped"] }
        });

        if (activeOrders) {
            return errorResponse(res, 400, "Cannot delete account with active orders");
        }

        // Delete profile image from Cloudinary if exists
        if (user.profileImageUrl) {
            const publicId = user.profileImageUrl.split('/').slice(-1)[0].split('.')[0];
            await deleteFile(publicId);
        }

        // Delete user's data
        await Promise.all([
            Order.deleteMany({ user: req.user.id }),
            Notification.deleteMany({ user: req.user.id }),
            Wishlist.deleteMany({ user: req.user.id }),
            Interaction.deleteMany({ userId: req.user.id })
        ]);

        // Delete the user
        await User.findByIdAndDelete(req.user.id);

        // Clear the session cookie
        res.clearCookie("token");

        return successResponse(res, 200, null, "Account deleted successfully");
    } catch (error) {
        return errorResponse(res, 500, "Account deletion failed", error);
    }
};

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getLibrary,
    getUserNotifications,
    getMyProfile,
    updateMyProfile,
    updateProfileImage,
    getMyOrders,
    getMyWishlist,
    getMyReadingHistory,
    deleteMyAccount
};