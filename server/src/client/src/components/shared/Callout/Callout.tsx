import * as Icon from '~/components/icon';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <div className={`bg-gray-100 dark:bg-zinc-800 p-4 rounded shadow-md ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon.Siren className="h-5 w-5" />
                    <h3 className="text-sm font-bold">{children}</h3>
                </div>
            </div>
        </div>
    );
};

export default Callout;
