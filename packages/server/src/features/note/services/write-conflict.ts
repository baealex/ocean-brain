export const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';
export const INVALID_NOTE_VERSION_CODE = 'INVALID_NOTE_VERSION';
export const MISSING_NOTE_VERSION_CODE = 'MISSING_NOTE_VERSION';

export class InvalidNoteVersionError extends Error {
    code = INVALID_NOTE_VERSION_CODE;

    constructor() {
        super('Invalid note version.');
        this.name = 'InvalidNoteVersionError';
    }
}

export class MissingNoteVersionError extends Error {
    code = MISSING_NOTE_VERSION_CODE;

    constructor() {
        super('Expected note update time is required for this write.');
        this.name = 'MissingNoteVersionError';
    }
}

export class NoteVersionConflictError extends Error {
    code = NOTE_UPDATE_CONFLICT_CODE;
    currentUpdatedAt: string;
    expectedUpdatedAt: string;

    constructor(input: { currentUpdatedAt: string | number; expectedUpdatedAt: string | number }) {
        super('This note changed elsewhere. Reload the latest version before saving.');
        this.name = 'NoteVersionConflictError';
        this.currentUpdatedAt = String(input.currentUpdatedAt);
        this.expectedUpdatedAt = String(input.expectedUpdatedAt);
    }
}

export const parseNoteVersion = (value?: string | null) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const timestamp = /^\d+$/.test(value) ? Number(value) : Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        throw new InvalidNoteVersionError();
    }

    return timestamp;
};

export const createNoteVersionConflictError = ({
    expectedUpdatedAt,
    currentUpdatedAt,
}: {
    expectedUpdatedAt: string | number;
    currentUpdatedAt: string | number;
}) => {
    return new NoteVersionConflictError({
        expectedUpdatedAt,
        currentUpdatedAt,
    });
};

export const assertExpectedNoteVersion = ({
    expectedUpdatedAt,
    currentUpdatedAt,
}: {
    expectedUpdatedAt?: string | null;
    currentUpdatedAt: Date;
}) => {
    const expectedTimestamp = parseNoteVersion(expectedUpdatedAt);

    if (expectedTimestamp === null) {
        return;
    }

    const currentTimestamp = currentUpdatedAt.getTime();

    if (expectedTimestamp !== currentTimestamp) {
        throw createNoteVersionConflictError({
            expectedUpdatedAt: expectedTimestamp,
            currentUpdatedAt: currentTimestamp,
        });
    }
};

export const isNoteVersionConflictError = (error: unknown): error is NoteVersionConflictError => {
    return error instanceof NoteVersionConflictError;
};

export const isInvalidNoteVersionError = (error: unknown): error is InvalidNoteVersionError => {
    return error instanceof InvalidNoteVersionError;
};

export const isMissingNoteVersionError = (error: unknown): error is MissingNoteVersionError => {
    return error instanceof MissingNoteVersionError;
};
