const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const {
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
} = require("../controllers/userController");
const { profileUpload } = require("../utils/multer");

// Public routes
router.post("/", createUser);

// Protected routes
router.use(protect);

// Profile management routes
router.get("/me", getMyProfile);
router.put("/me", updateMyProfile);
router.delete("/me", deleteMyAccount);
router.put("/me/image", profileUpload.single("profileImage"), updateProfileImage);

// User activity routes
router.get("/library", getLibrary);
router.get("/notifications", getUserNotifications);
router.get("/orders", getMyOrders);
router.get("/wishlist", getMyWishlist);
router.get("/reading-history", getMyReadingHistory);

// Admin routes
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
