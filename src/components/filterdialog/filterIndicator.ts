import './filterIndicator.scss';

interface FilterQuery {
    Filters?: string;
    IsFavorite?: boolean;
    VideoTypes?: string;
    SeriesStatus?: string;
    Is4K?: boolean;
    IsHD?: number | null;
    IsSD?: boolean;
    Is3D?: boolean;
    HasSubtitles?: boolean;
    HasTrailer?: boolean;
    HasSpecialFeature?: boolean;
    HasThemeSong?: boolean;
    HasThemeVideo?: boolean;
    IsMissing?: boolean;
    ParentIndexNumber?: number;
    Genres?: string;
    Tags?: string;
    Years?: string;
    OfficialRatings?: string;
    IsUnaired?: boolean;
    [key: string]: any;
}

export function getFilterStatus(query: FilterQuery): boolean {
    return Boolean(
        query.Filters
            || query.IsFavorite
            || query.VideoTypes
            || query.SeriesStatus
            || query.Is4K
            || (query.IsHD !== undefined && query.IsHD !== null)
            || query.IsSD
            || query.Is3D
            || query.HasSubtitles
            || query.HasTrailer
            || query.HasSpecialFeature
            || query.HasThemeSong
            || query.HasThemeVideo
            || query.IsMissing
            || query.ParentIndexNumber
            || query.Genres
            || query.Tags
            || query.Years
            || query.OfficialRatings
            || query.IsUnaired
    );
}

export function setFilterStatus(page: HTMLElement, query: FilterQuery): void {
    const hasFilters = getFilterStatus(query);

    const btnFilterWrapper = page.querySelector('.btnFilter-wrapper') as HTMLElement | null;

    if (btnFilterWrapper) {
        let indicatorElem = btnFilterWrapper.querySelector('.filterIndicator') as HTMLElement | null;

        if (!indicatorElem && hasFilters) {
            btnFilterWrapper.insertAdjacentHTML(
                'afterbegin',
                '<div class="filterIndicator">!</div>'
            );
            btnFilterWrapper.classList.add('btnFilterWithIndicator');
            indicatorElem = btnFilterWrapper.querySelector('.filterIndicator');
        }

        if (indicatorElem) {
            indicatorElem.classList.toggle('hide', !hasFilters);
        }
    }
}
