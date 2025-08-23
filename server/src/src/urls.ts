import { Router } from 'express';
import * as views from './views/index.js';
import useAsync from './modules/use-async.js';

export default Router()
    .post('/image', useAsync(views.uploadImage))
    .post('/image-from-src', useAsync(views.uploadImageFromSrc));
