import * as Icon from '~/components/icon';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div className={`bg-pastel-yellow-200 dark:bg-zinc-800 py-3 px-4 rounded-[12px_4px_13px_3px/4px_10px_4px_12px] border-2 border-zinc-700 shadow-sketchy ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Icon.Info className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                    <div className="text-sm font-bold flex-1 text-zinc-800 dark:text-zinc-200">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Callout;
