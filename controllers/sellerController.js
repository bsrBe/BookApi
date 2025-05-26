const asyncHandler = require("express-async-handler");
const Book = require("../models/bookModel");
const Order = require("../models/orderModel");
const User = require("../models/userModel");

const getSellerDashboard = asyncHandler(async (req, res) => {
  const sellerId = req.user.id;

  // Parse and validate date range
  let startDate, endDate;
  const currentDate = new Date(); // Use actual current date
  try {
    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      endDate = new Date(req.query.endDate);
      if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
        throw new Error("Invalid date range");
      }
      // Set endDate to end of day
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Fallback to last 30 days
      endDate = currentDate;
      startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - 30);
    }
  } catch (error) {
    // Log error and fallback to last 30 days
    console.error("Invalid date range:", error);
    endDate = currentDate;
    startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - 30);
  }

  // Total books count
  const availableBooks = await Book.countDocuments({ seller: sellerId });

  // Get all orders for the seller in the date range
  const orders = await Order.find({
    "items.seller": sellerId,
    orderStatus: { $ne: "canceled" },
    refundStatus: { $ne: "completed" },
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  // Calculate summary statistics
  const summary = {
    totalOrders: 0,
    paidAndDeliveredOrders: 0,
    pendingPaymentOrders: 0,
    processingOrders: 0,
    totalRevenue: 0
  };

  // Process each order to calculate summary
  orders.forEach(order => {
    // Get seller's specific earnings from sellerBreakdown
    const sellerBreakdown = order.pricing.sellerBreakdown?.find(
      (s) => s.seller.toString() === sellerId
    );

    if (order.paymentStatus === "paid") {
      summary.totalOrders++;
      // Add to revenue for all paid orders
      summary.totalRevenue += sellerBreakdown?.total || 0;
      
      if (order.orderStatus === "delivered") {
        summary.paidAndDeliveredOrders++;
      } else if (order.orderStatus === "processing") {
        summary.processingOrders++;
      }
    } else if (order.paymentStatus === "pending") {
      summary.pendingPaymentOrders++;
    }
  });

  // Get detailed orders list
  const detailedOrders = await Order.find({
    "items.seller": sellerId,
    $or: [
      { paymentStatus: "paid" },
      { paymentStatus: "pending" }
    ],
    orderStatus: { $ne: "canceled" },
    refundStatus: { $ne: "completed" },
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .select("orderStatus paymentStatus user items pricing shippingAddress createdAt")
    .populate("user", "name")
    .populate("items.book", "title")
    .sort({ createdAt: -1 }) // Sort by newest first
    .lean();

  // Format orders for response
  const formattedOrders = detailedOrders.map((order) => {
    // Get seller's specific earnings from sellerBreakdown
    const sellerBreakdown = order.pricing.sellerBreakdown?.find(
      (s) => s.seller.toString() === sellerId
    );

    return {
      _id: order._id,
      buyer: {
        _id: order.user._id,
        name: order.user.name,
      },
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      pricing: {
        subtotal: order.pricing.subtotal,
        deliveryFee: order.pricing.deliveryFee,
        total: order.pricing.total,
        sellerEarnings: sellerBreakdown?.total || 0,
      },
      shippingAddress: order.shippingAddress,
      books: order.items
        .filter((item) => item.seller.toString() === sellerId)
        .map((item) => ({
          title: item.book.title,
          quantity: item.quantity,
        })),
      createdAt: order.createdAt,
    };
  });

  res.json({
    summary: {
      ...summary,
      availableBooks,
    },
    orders: formattedOrders,
  });
});

module.exports = { getSellerDashboard };