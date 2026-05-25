import {
    clearLocalNoteDraft,
    getDraftStorageKey,
    type NoteSaveDraft,
    readLocalNoteDraft,
    writeLocalNoteDraft,
} from './note-draft-storage';

describe('note draft storage', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('reads and clears a saved note draft', () => {
        const draft: NoteSaveDraft = {
            title: 'Draft title',
            content: 'Draft content',
            createdAt: 1770000000000,
            baseUpdatedAt: '1769999999999',
        };

        writeLocalNoteDraft('7', draft);

        expect(readLocalNoteDraft('7')).toEqual(draft);

        clearLocalNoteDraft('7');

        expect(readLocalNoteDraft('7')).toBeNull();
    });

    it('ignores legacy drafts without a server version', () => {
        window.localStorage.setItem(
            getDraftStorageKey('7'),
            JSON.stringify({
                title: 'Legacy draft',
                content: 'Unsafe content',
                createdAt: 1770000000000,
            }),
        );

        expect(readLocalNoteDraft('7')).toBeNull();
    });

    it('ignores malformed drafts', () => {
        window.localStorage.setItem(getDraftStorageKey('7'), '{');

        expect(readLocalNoteDraft('7')).toBeNull();
    });
});
