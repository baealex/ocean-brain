import { Outlet, createBrowserRouter } from 'react-router-dom';

import { SiteLayout } from './components/layout';

import Home from '~/pages/Home';
import Image from '~/pages/Image';
import Note from '~/pages/Note';
import TagNotes from '~/pages/TagNotes';
import Tag from '~/pages/Tag';
import ImageDetail from './pages/ImageDetail';

const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <SiteLayout>
                <Outlet />
            </SiteLayout>
        ),
        children: [
            {
                path: '/',
                element: <Home />
            },
            {
                path: '/tag',
                element: <Tag />
            },
            {
                path: '/:id',
                element: <Note />
            },
            {
                path: '/tag/:id',
                element: <TagNotes />
            },
            {
                path: '/manage-image',
                element: <Image />
            },
            {
                path: '/manage-image/:id',
                element: <ImageDetail />
            }
        ]
    }
]);

export default router;
