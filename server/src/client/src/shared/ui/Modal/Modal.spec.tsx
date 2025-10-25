import { render } from '@testing-library/react';

import Modal from './Modal';

describe('<Modal />', () => {
    it('renders <Modal /> component', () => {
        const { container } = render(<Modal />);
        expect(container).toBeInTheDocument();
    });
});
