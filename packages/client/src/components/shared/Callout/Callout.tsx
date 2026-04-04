import * as Icon from '~/components/icon';
import SurfaceCard from '../SurfaceCard';

interface CalloutProps {
    children: React.ReactNode;
    className?: string;
}

const Callout = ({ children, className = '' }: CalloutProps) => {
    return (
        <SurfaceCard className={`bg-[color:color-mix(in_srgb,var(--elevated)_82%,transparent)] px-4 py-3 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Icon.Info className="h-4 w-4 text-fg-tertiary" />
                    <div className="flex-1 text-sm font-medium text-fg-secondary">
                        {children}
                    </div>
                </div>
            </div>
        </SurfaceCard>
    );
};

export default Callout;
