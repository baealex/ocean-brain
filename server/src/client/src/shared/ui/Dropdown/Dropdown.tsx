import styles from './Dropdown.module.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind(styles);

import React from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';

interface DropdownProps {
    button: React.ReactNode;
    items: {
        name: string;
        onClick: () => void;
    }[];
}

const Dropdown = ({ button, items }: DropdownProps) => {
    return (
        <div className="relative flex">
            <Menu>
                <MenuButton>
                    {({ active }) => (
                        <div className={cx('flex', 'items-center', 'justify-center', active)}>
                            {button}
                        </div>
                    )}
                </MenuButton>
                <MenuItems className="origin-top-right absolute right-0 top-4 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-zinc-900 overflow-hidden">
                    {items.map(item => (
                        <MenuItem key={item.name}>
                            {({ focus }) => (
                                <a
                                    className={cx('block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800', { focus })}
                                    onClick={item.onClick}>
                                    {item.name}
                                </a>
                            )}
                        </MenuItem>
                    ))}
                </MenuItems>
            </Menu>
        </div>
    );
};

export default Dropdown;
