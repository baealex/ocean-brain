import { Link } from 'react-router-dom';

import * as Icon from '~/components/icon';

import { useTheme } from '~/store/theme';

const cardClassName = 'flex items-center justify-between bg-pastel-lavender-200/20 dark:bg-zinc-800/50 p-4 rounded-[10px_3px_11px_3px/3px_8px_3px_10px] border-2 border-zinc-600 dark:border-zinc-600 font-bold hover:shadow-sketchy hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all';

const Setting = () => {
    const { theme, toggleTheme } = useTheme(state => state);

    return (
        <div className="flex flex-col gap-3">
            <button type="button" className={cardClassName} onClick={toggleTheme}>
                Theme
                <span>
                    {theme === 'dark' ? (
                        <Icon.Moon className="h-6 w-6 text-pastel-yellow-200" weight="fill" />
                    ) : (
                        <Icon.Sun className="h-6 w-6 text-pastel-orange-200" weight="fill" />
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
