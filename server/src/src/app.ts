import express from 'express';
import session from 'express-session';
import { createHandler } from 'graphql-http/lib/use/express';
import path from 'path';

import logger from './modules/logger';
import schema from './schema';
import { uploadImage, uploadImageFromSrc } from './views/image';
import useAsync from './modules/use-async';

export default express()
    .use(logger)
    .use(express.static(path.resolve('client/dist'), { extensions: ['html'] }))
    .use('/assets/images/', express.static(path.resolve('public/assets/images/')))
    .use(session({
        secret: 'my-secret',
        resave: false,
        saveUninitialized: false
    }))
    .use(express.json({ limit: '50mb' }))
    .post('/image', useAsync(uploadImage))
    .post('/image-from-src', useAsync(uploadImageFromSrc))
    .use('/graphql', createHandler({ schema }))
    .get('*', (req, res) => {
        res.sendFile(path.resolve('client/dist/index.html'));
    });
