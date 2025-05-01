import { Router } from 'express';
import * as views from './views';
import useAsync from './modules/use-async';

export default Router()
    .post('/image', useAsync(views.uploadImage))
    .post('/image-from-src', useAsync(views.uploadImageFromSrc));
