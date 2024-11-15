import type { Controller } from '~/types';

import models from '~/models';

export const getCustomize: Controller = async (req, res) => {
    const customization = await models.customization.findUnique({ where: { id: 1 } });

    if (!customization) {
        const customization = await models.customization.create({
            data: {
                id: 1,
                color: '',
                heroBanner: ''
            }
        });
        res.status(200).json(customization);
        return;
    }

    res.status(200).json(customization);
};

export const updateCustomize: Controller = async (req, res) => {
    const { color = undefined, heroBanner = undefined } = req.body;

    const customization = await models.customization.update({
        where: { id: 1 },
        data: {
            color,
            heroBanner
        }
    });

    res.status(200).json(customization);
};
