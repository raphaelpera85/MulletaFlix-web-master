import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import type { ApiClient } from 'jellyfin-apiclient';

import { getUserViewsQuery } from 'hooks/api/useUserViews';
import layoutManager from 'components/layoutManager';
import { DEFAULT_SECTIONS, HomeSectionType } from 'constants/homeSectionType';
import globalize from 'lib/globalize';
import Dashboard from 'utils/dashboard';
import { toApi } from 'utils/jellyfin-apiclient/compat';
import { queryClient } from 'utils/query/queryClient';

import { loadRecordings } from './sections/activeRecordings';
import { loadLibraryButtons } from './sections/libraryButtons';
import { loadLibraryTiles } from './sections/libraryTiles';
import { loadLiveTV } from './sections/liveTv';
import { loadNextUp } from './sections/nextUp';
import { loadRecentlyAdded } from './sections/recentlyAdded';
import { loadResume } from './sections/resume';

import 'elements/emby-button/paper-icon-button-light';
import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-scroller/emby-scroller';
import 'elements/emby-button/emby-button';

import './homesections.scss';

type HomeSectionOptions = {
    netflix?: boolean
};

type HomeSectionSetting = HomeSectionType | 'folders' | '';
type UserSettingsLike = Pick<typeof import('scripts/settings/userSettings'), 'get' | 'useEpisodeImagesInNextUpAndResume' | 'maxDaysForNextUp' | 'enableRewatchingInNextUp'>;

const MAX_SECTIONS = 10;
const MAX_SECTIONS_TV = MAX_SECTIONS + 1; // TV layout can have an extra section to ensure a library section is always visible
const INITIAL_SECTION_VIEWPORT_MARGIN = 1200;

export function getDefaultSection(index: number): HomeSectionType | '' {
    if (index < 0 || index > DEFAULT_SECTIONS.length) return '';
    return DEFAULT_SECTIONS[index];
}

function getAllSectionsToShow(
    userSettings: UserSettingsLike,
    options: HomeSectionOptions = {}
): HomeSectionType[] {
    const sections: HomeSectionType[] = [];
    for (let i = 0, length = MAX_SECTIONS; i < length; i++) {
        let section = (userSettings.get('homesection' + i) || getDefaultSection(i)) as HomeSectionSetting;
        if (section === 'folders') {
            section = getDefaultSection(0) as HomeSectionType;
        }

        sections.push(section as HomeSectionType);
    }

    if (
        layoutManager.tv
            && !sections.includes(HomeSectionType.SmallLibraryTiles)
            && !sections.includes(HomeSectionType.LibraryButtons)
    ) {
        return [
            HomeSectionType.SmallLibraryTiles,
            ...sections
        ];
    }

    if (options.netflix) {
        const preferredOrder: HomeSectionType[] = [
            HomeSectionType.Resume,
            HomeSectionType.LatestMedia,
            HomeSectionType.NextUp,
            HomeSectionType.SmallLibraryTiles,
            HomeSectionType.LibraryButtons,
            HomeSectionType.ResumeAudio,
            HomeSectionType.ResumeBook,
            HomeSectionType.LiveTv,
            HomeSectionType.ActiveRecordings
        ];

        return [
            ...preferredOrder.filter(section => sections.includes(section)),
            ...sections.filter(section => section !== HomeSectionType.None && !preferredOrder.includes(section))
        ];
    }

    return sections;
}

export function loadSections(
    elem: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    userSettings: UserSettingsLike,
    options: HomeSectionOptions = {}
): Promise<void> {
    const userId = user.Id || apiClient.getCurrentUserId();
    return queryClient
        .fetchQuery(getUserViewsQuery(toApi(apiClient), { userId }))
        .then(result => result.Items || [])
        .then((userViews: BaseItemDto[]) => {
            let html = '';

            if (userViews.length) {
                const totalSectionCount = layoutManager.tv ? MAX_SECTIONS_TV : MAX_SECTIONS;
                for (let i = 0; i < totalSectionCount; i++) {
                    html += '<div class="verticalSection section' + i + '"></div>';
                }

                elem.innerHTML = html;
                elem.classList.add('homeSectionsContainer');
                elem.classList.toggle('homeSectionsContainer-netflix', !!options.netflix);

                const promises = getAllSectionsToShow(userSettings, options)
                    .map((section, index) => loadSection(elem, apiClient, user, userSettings, userViews, section, index, options));

                return Promise.all(promises.map(promise => Promise.resolve(promise).catch(err => {
                    console.error('Home section failed to load', err);
                })))
                    .then(() => new Promise<void>(resolve => setTimeout(resolve, 0)))
                    .then(() => resumeVisibleSections(elem))
                    .then(() => undefined);
            }

            let noLibDescription;
            if (user.Policy?.IsAdministrator) {
                noLibDescription = globalize.translate('NoCreatedLibraries', '<br><a id="button-createLibrary" class="button-link">', '</a>');
            } else {
                noLibDescription = globalize.translate('AskAdminToCreateLibrary');
            }

            html += '<div class="centerMessage padded-left padded-right">';
            html += '<h2>' + globalize.translate('MessageNothingHere') + '</h2>';
            html += '<p>' + noLibDescription + '</p>';
            html += '</div>';
            elem.innerHTML = html;

            const createNowLink = elem.querySelector('#button-createLibrary');
            if (createNowLink) {
                createNowLink.addEventListener('click', () => {
                    Dashboard.navigate('dashboard/libraries');
                });
            }
        });
}

export function destroySections(elem: HTMLElement): void {
    const elems = elem.querySelectorAll('.itemsContainer');
    for (const e of elems) {
        (e as any).fetchData = null;
        (e as any).parentContainer = null;
        (e as any).getItemsHtml = null;
    }

    elem.innerHTML = '';
}

export function pause(elem: HTMLElement): void {
    const elems = elem.querySelectorAll('.itemsContainer');
    for (const e of elems) {
        (e as any).pause();
    }
}

export function resume(elem: HTMLElement, options: unknown): Promise<unknown[]> {
    const elems = elem.querySelectorAll('.itemsContainer');
    const promises: Promise<unknown>[] = [];

    Array.prototype.forEach.call(elems, (section: any) => {
        if (section.resume) {
            promises.push(section.resume(options));
        }
    });

    return Promise.all(promises);
}

function resumeVisibleSections(elem: HTMLElement): Promise<unknown[]> {
    const itemsContainers = Array.from(elem.querySelectorAll('.itemsContainer')) as any[];
    if (!itemsContainers.length) {
        return Promise.resolve([]);
    }

    const promises: Promise<unknown>[] = [];
    const observer = typeof window.IntersectionObserver === 'function'
        ? new IntersectionObserver((entries, intersectionObserver) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return;
                }

                intersectionObserver.unobserve(entry.target);
                promises.push(Promise.resolve((entry.target as any).resume({ refresh: true })).catch(err => {
                    console.error('Home section failed to refresh', err);
                }));
            });
        }, {
            rootMargin: INITIAL_SECTION_VIEWPORT_MARGIN + 'px 0px',
            threshold: 0
        })
        : null;

    for (const section of itemsContainers) {
        const rect = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        if (rect.bottom >= -INITIAL_SECTION_VIEWPORT_MARGIN && rect.top <= viewportHeight + INITIAL_SECTION_VIEWPORT_MARGIN) {
            promises.push(Promise.resolve(section.resume({ refresh: true })).catch(err => {
                console.error('Home section failed to refresh', err);
            }));
            continue;
        }

        if (observer) {
            observer.observe(section);
            continue;
        }

        promises.push(Promise.resolve(section.resume({ refresh: true })).catch(err => {
            console.error('Home section failed to refresh', err);
        }));
    }

    if (observer) {
        window.setTimeout(() => observer.disconnect(), 60000);
    }

    return Promise.all(promises);
}

function loadSection(
    page: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    userSettings: UserSettingsLike,
    userViews: BaseItemDto[],
    section: HomeSectionType | '',
    index: number,
    options: HomeSectionOptions
): Promise<void> {
    const elem = page.querySelector('.section' + index) as HTMLElement | null;
    if (!elem) {
        return Promise.resolve();
    }

    const sectionOptions = {
        enableOverflow: enableScrollX(),
        netflix: !!options.netflix,
        featured: !!options.netflix && index === 0
    };

    switch (section) {
        case HomeSectionType.ActiveRecordings:
            loadRecordings(elem, true, apiClient, sectionOptions);
            break;
        case HomeSectionType.LatestMedia:
            loadRecentlyAdded(elem, apiClient, user, userViews, sectionOptions);
            break;
        case HomeSectionType.LibraryButtons:
            loadLibraryButtons(elem, userViews);
            break;
        case HomeSectionType.LiveTv:
            return loadLiveTV(elem, apiClient, user, sectionOptions);
        case HomeSectionType.NextUp:
            loadNextUp(elem, apiClient, userSettings, sectionOptions);
            break;
        case HomeSectionType.Resume:
            loadResume(elem, apiClient, 'HeaderContinueWatching', 'Video', userSettings, sectionOptions);
            break;
        case HomeSectionType.ResumeAudio:
            loadResume(elem, apiClient, 'HeaderContinueListening', 'Audio', userSettings, sectionOptions);
            break;
        case HomeSectionType.ResumeBook:
            loadResume(elem, apiClient, 'HeaderContinueReading', 'Book', userSettings, sectionOptions);
            break;
        case HomeSectionType.SmallLibraryTiles:
            loadLibraryTiles(elem, userViews, sectionOptions);
            break;
        default:
            elem.innerHTML = '';
    }

    return Promise.resolve();
}

function enableScrollX(): boolean {
    return true;
}

export default {
    getDefaultSection,
    loadSections,
    destroySections,
    pause,
    resume
};
