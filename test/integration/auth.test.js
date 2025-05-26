const request = require('supertest');
const app = require('../../server');
const User = require('../../models/userModel');
const { createTestUser } = require('../helpers');

describe('Authentication Endpoints', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'Test@123',
                confirmPassword: 'Test@123'
            };

            const res = await request(app)
                .post('/api/auth/register')
                .send(userData);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.data.user.email).toBe(userData.email);
        });

        it('should return 400 if passwords do not match', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'Test@123',
                confirmPassword: 'DifferentPassword'
            };

            const res = await request(app)
                .post('/api/auth/register')
                .send(userData);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Passwords do not match');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login an existing user', async () => {
            const user = await createTestUser();

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: user.email,
                    password: 'Test@123'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.data.user.email).toBe(user.email);
        });

        it('should return 401 for invalid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'WrongPassword'
                });

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid credentials');
        });
    });

    describe('POST /api/auth/forgot-password', () => {
        it('should send reset token email', async () => {
            const user = await createTestUser();

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: user.email });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Email sent');
        });

        it('should return 404 for non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'nonexistent@example.com' });

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('No user found with that email');
        });
    });

    describe('PUT /api/auth/reset-password/:resetToken', () => {
        it('should reset password with valid token', async () => {
            const user = await createTestUser();
            const resetToken = user.getResetPasswordToken();
            await user.save();

            const res = await request(app)
                .put(`/api/auth/reset-password/${resetToken}`)
                .send({
                    password: 'NewPassword123',
                    confirmPassword: 'NewPassword123'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
        });

        it('should return 400 for invalid token', async () => {
            const res = await request(app)
                .put('/api/auth/reset-password/invalid-token')
                .send({
                    password: 'NewPassword123',
                    confirmPassword: 'NewPassword123'
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid token');
        });
    });
}); 