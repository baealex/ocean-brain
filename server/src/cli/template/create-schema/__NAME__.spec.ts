import request from 'supertest';

import app from '~/app';
import models from '~/models';

beforeEach(async () => {
    await models.__NAME__.create({
        data: {

        },
    });
});

afterEach(async () => {
    await models.__NAME__.deleteMany();
});

describe('__NAME__UPPER__ Schema', () => {
    const getAll__NAME__UPPER__s = async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    all__NAME__UPPER__s {
                        id
                    }
                }
            `,
        });

        return res.body.data.all__NAME__UPPER__s;
    };

    it('return __NAME__ list', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    all__NAME__UPPER__s {
                        id
                    }
                }
            `,
        });

        expect(res.body.data.all__NAME__UPPER__s).toHaveLength(1);
    });

    it('return __NAME__', async () => {
        const [{ id }] = await getAll__NAME__UPPER__s();
        const res = await request(app).post('/graphql').send({
            query: `
                query {
                    __NAME__(id: ${id}) {
                        id
                    }
                }
            `,
        });

        expect(res.body.data.__NAME__.name).toBe('Test __NAME__UPPER__ 1');
    });

    it('create __NAME__', async () => {
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    create__NAME__UPPER__() {
                        id
                    }
                }
            `,
        });

        expect(res.body.data.create__NAME__UPPER__.name).toBe('Test __NAME__UPPER__ 3');
    });

    it('delete __NAME__', async () => {
        const [{ id }] = await getAll__NAME__UPPER__s();
        const res = await request(app).post('/graphql').send({
            query: `
                mutation {
                    delete__NAME__UPPER__(id: ${id})
                }
            `,
        });

        expect(res.body.data.delete__NAME__UPPER__).toBe(true);
    });
});
