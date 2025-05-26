const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

// Generate JWT token for testing
exports.generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// Create a test user
exports.createTestUser = async (role = 'user') => {
    const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Test@123',
        role
    });
    return user;
};

// Create a test admin user
exports.createTestAdmin = async () => {
    return await this.createTestUser('admin');
};

// Mock request object
exports.mockRequest = (user = null, body = {}, params = {}, query = {}) => {
    const req = {
        body,
        params,
        query,
        user,
        file: null,
        files: null
    };
    return req;
};

// Mock response object
exports.mockResponse = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        cookie: jest.fn().mockReturnThis(),
        clearCookie: jest.fn().mockReturnThis()
    };
    return res;
};

// Mock next function
exports.mockNext = () => {
    return jest.fn();
};

// Mock Cloudinary upload
exports.mockCloudinaryUpload = () => {
    return {
        secure_url: 'https://res.cloudinary.com/test/image/upload/test.jpg',
        public_id: 'test'
    };
};

// Mock Cloudinary delete
exports.mockCloudinaryDelete = () => {
    return { result: 'ok' };
};

// Mock email service
exports.mockEmailService = () => {
    return {
        sendMail: jest.fn().mockResolvedValue({ messageId: 'test' })
    };
};

// Mock payment service
exports.mockPaymentService = () => {
    return {
        createPayment: jest.fn().mockResolvedValue({ id: 'test-payment' }),
        verifyPayment: jest.fn().mockResolvedValue({ status: 'success' })
    };
}; 