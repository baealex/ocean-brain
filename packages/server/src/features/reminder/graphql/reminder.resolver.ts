import type { IResolvers } from '@graphql-tools/utils';
import { reminderFieldResolvers } from './reminder.field.resolver.js';
import { reminderMutationResolvers } from './reminder.mutation.resolver.js';
import { reminderQueryResolvers } from './reminder.query.resolver.js';

export const reminderResolvers: IResolvers = {
    Query: reminderQueryResolvers,
    Mutation: reminderMutationResolvers,
    Reminder: reminderFieldResolvers,
};
