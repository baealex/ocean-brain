import type { PropsWithChildren } from 'react';

export default function Container({ children }: PropsWithChildren) {
    return (
        <main className="mx-auto max-w-[896px]">
            {children}
        </main>
    );
}
