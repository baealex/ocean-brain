import styles from './Modal.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React, { useEffect } from 'react';
import * as Icon from '~/components/icon';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
}

const Modal = ({ isOpen, onClose, children }: ModalProps) => {
    const ref = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    if (!isOpen) return null;

    return (
        <div className={cx('modal', { 'modal--open': isOpen })}>
            <div ref={ref} className={cx('modal-content')}>
                {children}
            </div>
        </div>
    );
};

Modal.Header = ({ title, onClose }: { title: string; onClose: () => void }) => {
    return (
        <div className={cx('modal-header')}>
            <span>{title}</span>
            <button className={cx('modal-close-button')} onClick={onClose}>
                <Icon.Close />
            </button>
        </div>
    );
};

Modal.Body = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={cx('modal-body')}>{children}</div>
    );
};

Modal.Footer = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className={cx('modal-footer')}>{children}</div>
    );
};

export default Modal;
