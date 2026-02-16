import express from 'express';
import session from 'express-session';
import { createHandler } from 'graphql-http/lib/use/express';

import logger from './modules/logger.js';
import { paths } from './paths.js';
import schema from './schema/index.js';
import router from './urls.js';

export default express()
    .use(logger)
    .use(express.static(paths.clientDist, { extensions: ['html'] }))
    .use('/assets/images/', express.static(paths.imageDir))
    .use(session({
        secret: 'my-secret',
        resave: false,
        saveUninitialized: false
    }))
    .use(express.json({ limit: '50mb' }))
    .use('/api', router)
    .use('/graphql', createHandler({ schema }))
    .get(/.*/, (req, res) => {
        res.sendFile(paths.clientIndex);
    });
