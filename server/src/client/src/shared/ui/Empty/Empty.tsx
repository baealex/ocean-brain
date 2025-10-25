import styles from './Empty.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React from 'react';

interface EmptyProps {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
}

const Empty = ({ icon, title, description }: EmptyProps) => {
    return (
        <div className={cx('Empty')}>
            {icon && (
                <div className="mb-4 text-6xl">{icon}</div>
            )}
            {title && (
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
            )}
            {description && (
                <p className="text-gray-500 max-w-[400px]">{description}</p>
            )}
        </div>
    );
};

export default Empty;
