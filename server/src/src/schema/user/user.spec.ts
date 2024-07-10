import request from 'supertest';

import app from '~/app';
import models from '~/models';

beforeEach(async () => {
    await models.user.create({
        data: {
            name: 'Test User 1',
            email: 'test1@test.test',
            password: '0000'
        }
    });
    await models.user.create({
        data: {
            name: 'Test User 2',
            email: 'test2@test.test',
            password: '0000'
        }
    });
});

afterEach(async () => {
    await models.user.deleteMany();
});

describe('User Schema', () => {
    const getAllUsers = async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    allUsers {
                        id
                    }
                }
            `
        });

        return res.body.data.allUsers;
    };

    it('return user list', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    allUsers {
                        id
                        name
                        email
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.body.data.allUsers).toHaveLength(2);
    });

    it('can not return password', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    allUsers {
                        id
                        name
                        email
                        password
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toContain('Cannot query field "password"');
    });

    it('return user', async () => {
        const [{ id }] = await getAllUsers();
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    user(id: ${id}) {
                        id
                        name
                        email
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.body.data.user.name).toBe('Test User 1');
    });

    it('create user', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    createUser(
                        name: "Test User 3"
                        email: "test3@test.test"
                        password: "0000"
                    ) {
                        id
                        name
                        email
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.body.data.createUser.name).toBe('Test User 3');
    });

    it('if email is duplicated, return error', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    createUser(
                        name: "Test User X"
                        email: "test2@test.test"
                        password: "0000"
                    ) {
                        id
                        name
                        email
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.status).toBe(200);
        expect(res.body.errors[0].message).toContain('Email already exists');
    });

    it('update user', async () => {
        const [{ id }] = await getAllUsers();
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    updateUser(
                        id: ${id}
                        name: "Test User 1 Updated"
                    ) {
                        id
                        name
                        email
                        createdAt
                        updatedAt
                    }
                }
            `
        });

        expect(res.body.data.updateUser.name).toBe('Test User 1 Updated');
    });

    it('delete user', async () => {
        const [{ id }] = await getAllUsers();
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    deleteUser(id: ${id})
                }
            `
        });

        expect(res.body.data.deleteUser).toBe(true);
    });
});
