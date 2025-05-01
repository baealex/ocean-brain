import { Link } from 'react-router-dom';

import * as Icon from '~/components/icon';

import { useTheme } from '~/store/theme';

const cardClassName = 'flex items-center justify-between bg-gray-100 dark:bg-zinc-900 p-4 rounded';

const Setting = () => {
    const { theme, toggleTheme } = useTheme(state => state);

    return (
        <div className="flex flex-col gap-3">
            <button type="button" className={cardClassName} onClick={toggleTheme}>
                Theme
                <span>
                    {theme === 'dark' ? (
                        <Icon.Moon className="h-6 w-6 text-yellow-500" />
                    ) : (
                        <Icon.Sun className="h-6 w-6 text-black" />
                    )}
                </span>
            </button>
            <Link to="manage-image" className={cardClassName}>
                <span>Manage Image</span>
                <Icon.ChevronRight className="size-4" />
            </Link>
            <Link to="placeholder" className={cardClassName}>
                <span>Placeholder</span>
                <Icon.ChevronRight className="size-4" />
            </Link>
        </div>
    );
};

export default Setting;
