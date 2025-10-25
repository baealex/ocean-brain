import * as Icon from '~/components/icon';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div className={`bg-pastel-yellow-200 dark:bg-zinc-900 dark:bg-opacity-75 py-3 px-4 rounded-full ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Icon.Info className="h-5 w-5" />
                    <div className="text-sm font-bold flex-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Callout;
