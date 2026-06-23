import layoutManager from 'components/layoutManager';
import { DEFAULT_SECTIONS, HomeSectionType } from 'constants/homeSectionType';
import { getUserViewsQuery } from 'hooks/api/useUserViews';
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

const MAX_SECTIONS = 10;
const MAX_SECTIONS_TV = MAX_SECTIONS + 1; // TV layout can have an extra section to ensure a library section is always visible
const DEFERRED_HOME_SECTIONS = new Set([
    HomeSectionType.ActiveRecordings,
    HomeSectionType.LatestMedia
]);

function scheduleDeferredWork(elem, callback) {
    if (elem._deferredTimerId) {
        window.clearTimeout(elem._deferredTimerId);
    }
    elem._deferredTimerId = window.setTimeout(callback, 250);
}

const CONCURRENCY_LIMIT = 3;
const OBSERVER_ROOT_MARGIN = '400px';
const OBSERVER_TIMEOUT_MS = 30000;

function promiseAllBatched(items, fn, concurrency = CONCURRENCY_LIMIT) {
    let i = 0;
    function next() {
        const batch = items.slice(i, i + concurrency);
        i += concurrency;
        return Promise.all(batch.map(item => fn(item).catch(err => {
            console.error('Home section failed to load', err);
        }))).then(() => {
            if (i < items.length) return next();
        });
    }
    return next();
}

function observeAndResumeDeferred(elem, options) {
    const selectors = elem.querySelectorAll('.itemsContainer[data-home-deferred="true"]');

    return new Promise((resolve) => {
        if (!selectors.length) {
            resolve();
            return;
        }

        let remaining = selectors.length;
        let timedOut = false;

        const timeout = window.setTimeout(() => {
            timedOut = true;
            Array.prototype.forEach.call(selectors, section => {
                if (section.resume && !section._homeResumed) {
                    section._homeResumed = true;
                    section.resume(options).catch(err => {
                        console.error('Deferred home section timed out', err);
                    });
                }
            });
            if (elem._homeObserver) elem._homeObserver.disconnect();
            resolve();
        }, OBSERVER_TIMEOUT_MS);

        const observer = new IntersectionObserver((entries) => {
            if (timedOut) return;
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const section = entry.target;
                    if (section.resume && !section._homeResumed) {
                        section._homeResumed = true;
                        remaining--;
                        section.resume(options).catch(err => {
                            console.error('Deferred home section failed to load', err);
                        });
                    }
                    observer.unobserve(section);
                }
            }
            if (remaining <= 0) {
                observer.disconnect();
                window.clearTimeout(timeout);
                resolve();
            }
        }, { rootMargin: OBSERVER_ROOT_MARGIN });

        elem._homeObserver = observer;

        Array.prototype.forEach.call(selectors, section => {
            observer.observe(section);
        });
    });
}

export function getDefaultSection(index) {
    if (index < 0 || index >= DEFAULT_SECTIONS.length) return '';
    return DEFAULT_SECTIONS[index];
}

function getAllSectionsToShow(userSettings) {
    const sections = [];
    for (let i = 0, length = MAX_SECTIONS; i < length; i++) {
        let section = userSettings.get('homesection' + i) || getDefaultSection(i);
        if (section === 'folders') {
            section = getDefaultSection(0);
        }

        sections.push(section);
    }

    // Ensure libraries are visible in TV layout
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

    return sections;
}

export function loadSections(elem, apiClient, user, userSettings) {
    const userId = user.Id || apiClient.getCurrentUserId();
    return queryClient
        .fetchQuery(getUserViewsQuery(toApi(apiClient), { userId }))
        .then(result => result.Items || [])
        .then(function (userViews) {
            let html = '';

            if (userViews.length) {
                // TV layout can have an extra section to ensure libraries are visible
                const totalSectionCount = layoutManager.tv ? MAX_SECTIONS_TV : MAX_SECTIONS;
                for (let i = 0; i < totalSectionCount; i++) {
                    html += '<div class="verticalSection section' + i + '"></div>';
                }

                elem.innerHTML = html;
                elem.classList.add('homeSectionsContainer');

                const promises = getAllSectionsToShow(userSettings)
                    .map((section, index) => (
                        loadSection(elem, apiClient, user, userSettings, userViews, section, index)
                    ));

                return Promise.all(promises.map(promise => Promise.resolve(promise).catch(err => {
                    console.error('Home section failed to load', err);
                })))
                    // Timeout for polyfilled CustomElements (webOS 1.2)
                    .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
                    .then(() => {
                        const immediate = elem.querySelectorAll('.itemsContainer[data-home-deferred="false"]');
                        return promiseAllBatched(
                            Array.prototype.filter.call(immediate, s => s.resume),
                            s => s.resume({ refresh: true }),
                            CONCURRENCY_LIMIT
                        );
                    })
                    .then(() => observeAndResumeDeferred(elem, { refresh: true }));
            } else {
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
                    createNowLink.addEventListener('click', function () {
                        Dashboard.navigate('dashboard/libraries');
                    });
                }
            }
        });
}

export function destroySections(elem) {
    if (elem._deferredTimerId) {
        window.clearTimeout(elem._deferredTimerId);
        elem._deferredTimerId = null;
    }

    if (elem._homeObserver) {
        elem._homeObserver.disconnect();
        elem._homeObserver = null;
    }

    const elems = elem.querySelectorAll('.itemsContainer');
    for (const e of elems) {
        e.fetchData = null;
        e.parentContainer = null;
        e.getItemsHtml = null;
    }

    elem.innerHTML = '';
}

export function pause(elem) {
    const elems = elem.querySelectorAll('.itemsContainer');
    for (const e of elems) {
        e.pause();
    }
}

export function resume(elem, options, sectionFilter) {
    const elems = elem.querySelectorAll('.itemsContainer');
    const promises = [];

    Array.prototype.forEach.call(elems, section => {
        if (sectionFilter && !sectionFilter(section)) {
            return;
        }

        if (section.resume) {
            promises.push(section.resume(options));
        }
    });

    return Promise.all(promises);
}

function loadSection(page, apiClient, user, userSettings, userViews, section, index) {
    const elem = page.querySelector('.section' + index);
    const options = { enableOverflow: enableScrollX() };
    const isDeferred = DEFERRED_HOME_SECTIONS.has(section);

    switch (section) {
        case HomeSectionType.ActiveRecordings:
            loadRecordings(elem, true, apiClient, options);
            break;
        case HomeSectionType.LatestMedia:
            loadRecentlyAdded(elem, apiClient, user, userViews, options);
            break;
        case HomeSectionType.LibraryButtons:
            loadLibraryButtons(elem, userViews);
            break;
        case HomeSectionType.LiveTv:
            return new Promise((resolve) => {
                scheduleDeferredWork(elem, () => {
                    void loadLiveTV(elem, apiClient, user, options)
                        .then(() => {
                            const itemsContainers = elem.querySelectorAll('.itemsContainer');
                            for (const itemsContainer of itemsContainers) {
                                    itemsContainer.setAttribute('data-home-deferred', isDeferred ? 'true' : 'false');
                            }
                        })
                        .catch(err => {
                            console.error('Deferred Live TV section failed to load', err);
                        })
                        .then(resolve);
                });
            });
        case HomeSectionType.NextUp:
            loadNextUp(elem, apiClient, userSettings, options);
            break;
        case HomeSectionType.Resume:
            loadResume(elem, apiClient, 'HeaderContinueWatching', 'Video', userSettings, options);
            break;
        case HomeSectionType.ResumeAudio:
            loadResume(elem, apiClient, 'HeaderContinueListening', 'Audio', userSettings, options);
            break;
        case HomeSectionType.ResumeBook:
            loadResume(elem, apiClient, 'HeaderContinueReading', 'Book', userSettings, options);
            break;
        case HomeSectionType.SmallLibraryTiles:
            loadLibraryTiles(elem, userViews, options);
            break;
        default:
            elem.innerHTML = '';
    }

    const itemsContainers = elem.querySelectorAll('.itemsContainer');
    for (const itemsContainer of itemsContainers) {
        itemsContainer.setAttribute('data-home-deferred', isDeferred ? 'true' : 'false');
    }

    return Promise.resolve();
}

function enableScrollX() {
    return true;
}

export default {
    getDefaultSection,
    loadSections,
    destroySections,
    pause,
    resume
};

