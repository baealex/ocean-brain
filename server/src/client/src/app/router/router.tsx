import { Outlet, createBrowserRouter } from 'react-router-dom';

import SiteLayout from '@/widgets/site-layout/ui/SiteLayout';

import Home from '@/pages/home/ui/Home';
import Note from '@/pages/note/ui/Note';
import Search from '@/pages/search/ui/Search';
import TagNotes from '@/pages/tag-notes/ui/TagNotes';
import Tag from '@/pages/tag/ui/Tag';
import Calendar from '@/pages/calendar/ui/Calendar';
import Reminders from '@/pages/reminders/ui/Reminders';

import Setting from '@/pages/settings/ui/setting/index';
import ManageImage from '@/pages/settings/ui/setting/manage-image';
import ManageImageDetail from '@/pages/settings/ui/setting/manage-image-detail';
import Placeholder from '@/pages/settings/ui/setting/placeholder';

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
                path: '/calendar',
                element: <Calendar />
            },
            {
                path: '/reminders',
                element: <Reminders />
            },
            {
                path: '/search',
                element: <Search />
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
                path: '/setting',
                children: [
                    {
                        path: '',
                        element: <Setting />
                    },
                    {
                        path: 'manage-image',
                        element: <ManageImage />
                    },
                    {
                        path: 'manage-image/:id',
                        element: <ManageImageDetail />
                    },
                    {
                        path: 'placeholder',
                        element: <Placeholder />
                    }
                ]
            }
        ]
    }
]);

export default router;
