import { Api } from '@jellyfin/sdk';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { addSection, isLivetv } from '../utils/search';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { LIVETV_CARD_OPTIONS } from '../constants/liveTvCardOptions';
import { CardShape } from 'components/cardbuilder/utils/shape';
import { Section } from '../types';
import { fetchItemsByType } from './fetchItemsByType';

const fetchLiveTv = async (api: Api, userId: string | undefined, searchTerm: string | undefined, signal: AbortSignal) => {
    const sections: Section[] = [];

    const [programsResult, channelsResult, moviesResult] = await Promise.all([
        fetchItemsByType(
            api, userId,
            { includeItemTypes: [BaseItemKind.LiveTvProgram], searchTerm, limit: 200 },
            { signal }
        ),
        fetchItemsByType(
            api, userId,
            { includeItemTypes: [BaseItemKind.TvChannel], searchTerm, limit: 50 },
            { signal }
        ),
        fetchItemsByType(
            api, userId,
            { includeItemTypes: [BaseItemKind.LiveTvProgram], isMovie: true, searchTerm, limit: 50 },
            { signal }
        )
    ]);

    addSection(sections, 'Movies', moviesResult.Items, {
        ...LIVETV_CARD_OPTIONS,
        shape: CardShape.PortraitOverflow
    });

    if (programsResult.Items) {
        const categorized = { episodes: [] as BaseItemDto[], sports: [] as BaseItemDto[], kids: [] as BaseItemDto[], news: [] as BaseItemDto[], programs: [] as BaseItemDto[] };
        for (const item of programsResult.Items) {
            if (item.IsSeries) {
                if (item.IsSports) categorized.sports.push(item);
                else if (item.IsKids) categorized.kids.push(item);
                else if (item.IsNews) categorized.news.push(item);
                else categorized.episodes.push(item);
            } else if (!item.IsMovie) {
                categorized.programs.push(item);
            }
        }
        addSection(sections, 'Episodes', categorized.episodes, { ...LIVETV_CARD_OPTIONS });
        addSection(sections, 'Sports', categorized.sports, { ...LIVETV_CARD_OPTIONS });
        addSection(sections, 'Kids', categorized.kids, { ...LIVETV_CARD_OPTIONS });
        addSection(sections, 'News', categorized.news, { ...LIVETV_CARD_OPTIONS });
        addSection(sections, 'Programs', categorized.programs, { ...LIVETV_CARD_OPTIONS });
    }

    addSection(sections, 'Channels', channelsResult.Items);

    return sections;
};

export const useLiveTvSearch = (
    parentId?: string,
    collectionType?: CollectionType,
    searchTerm?: string
) => {
    const { api, user } = useApi();
    const userId = user?.Id;

    return useQuery({
        queryKey: ['Search', 'LiveTv', collectionType, parentId, searchTerm],
        queryFn: ({ signal }) =>
            fetchLiveTv(api!, userId!, searchTerm, signal),
        enabled: !!api && !!userId && !!collectionType && !!isLivetv(collectionType)
    });
};

