import { render, screen } from '@testing-library/react';

import Empty from './Empty';

describe('<Empty />', () => {
    it('renders title and description', () => {
        render(<Empty title="There are no items" description="Create something to populate this view." />);

        expect(screen.getByText('There are no items')).toBeInTheDocument();
        expect(screen.getByText('Create something to populate this view.')).toBeInTheDocument();
    });
});
