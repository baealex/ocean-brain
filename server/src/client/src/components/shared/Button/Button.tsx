import styles from './Button.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React from 'react';
import { Spinner } from '~/components/icon';

interface ButtonProps {
    variant?: 'primary' | 'secondary';
    children: React.ReactNode;
    className?: string;
    isLoading?: boolean;
    onClick?: () => void;
}

const Button = ({
    children, isLoading, onClick, variant = 'primary', className
}: ButtonProps) => {
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
                isLoading ? 'bg-zinc-950 bg-opacity-50' : variant === 'primary' ? 'bg-zinc-950' : 'bg-zinc-950 bg-opacity-50',
                'text-white',
                'font-bold',
                'rounded-full',
                className
            )}
            onClick={isLoading ? undefined : onClick}>
            {isLoading ? <Spinner className="animate-spin h-5 w-5 text-zinc-200" /> : children}
        </button>
    );
};

export default Button;
