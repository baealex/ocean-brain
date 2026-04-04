import type {
    Request,
    Response,
    NextFunction
} from 'express';
import type { Controller } from '~/types/index.js';

export default function useAsync(callback: Controller) {
    return function (req: Request, res: Response, next: NextFunction) {
        void Promise.resolve()
            .then(() => callback(req, res, next))
            .catch((error: unknown) => {
                next(error);
            });
    };
}
