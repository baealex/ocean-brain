import { GraphQLError } from 'graphql';

export const NOTE_UPDATE_CONFLICT_CODE = 'NOTE_UPDATE_CONFLICT';

export const parseNoteVersion = (value?: string | null) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const timestamp = /^\d+$/.test(value) ? Number(value) : Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        throw new GraphQLError('Invalid note version.', {
            extensions: {
                code: 'BAD_USER_INPUT',
            },
        });
    }

    return timestamp;
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
        throw new GraphQLError('This note changed elsewhere. Reload the latest version before saving.', {
            extensions: {
                code: NOTE_UPDATE_CONFLICT_CODE,
                currentUpdatedAt: String(currentTimestamp),
                expectedUpdatedAt: String(expectedTimestamp),
            },
        });
    }
};
