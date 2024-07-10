import styles from './Button.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React from 'react';
import { Spinner } from '~/components/icon';

interface ButtonProps {
    children: React.ReactNode;
    isLoading?: boolean;
    onClick?: () => void;
}

const Button = ({ children, isLoading, onClick }: ButtonProps) => {
    return (
        <button
            className={cx(
                'h-10',
                'min-w-20',
                'px-4',
                'flex',
                'items-center',
                'justify-center',
                'gap-1',
                isLoading ? 'cursor-not-allowed' : 'cursor-pointer',
                isLoading ? 'bg-zinc-600' : 'bg-zinc-800',
                isLoading ? 'dark:bg-zinc-800' : 'dark:bg-zinc-700',
                'text-white',
                'font-bold',
                'rounded-full'
            )}
            onClick={isLoading ? undefined : onClick}>
            {isLoading ? <Spinner className="animate-spin h-5 w-5 text-zinc-200" /> : children}
        </button>
    );
};

export default Button;
