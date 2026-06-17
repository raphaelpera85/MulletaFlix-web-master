import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { describe, expect, it, vi } from 'vitest';

import { CardShape } from './shape';

const { mockGetItemImageUrlById, mockGetImageApi } = vi.hoisted(() => {
    const mockGetItemImageUrlById = vi.fn(() => 'https://example.invalid/image.jpg');
    const mockGetImageApi = vi.fn(() => ({
        getItemImageUrlById: mockGetItemImageUrlById
    }));

    return {
        mockGetItemImageUrlById,
        mockGetImageApi
    };
});

vi.mock('@jellyfin/sdk/lib/utils/api/image-api', () => ({
    getImageApi: mockGetImageApi
}));

import { getCardImageUrl } from './url';

describe('getCardImageUrl', () => {
    it('uses the fallback serverId when the resolved item does not have one', () => {
        const result = getCardImageUrl({
            api: {} as never,
            item: {
                ProgramInfo: {
                    Id: 'program-1',
                    ImageTags: {
                        Primary: 'primary-tag'
                    }
                }
            } as never,
            options: {
                serverId: 'server-1',
                width: 320
            } as never,
            shape: CardShape.Backdrop
        });

        expect(result?.imgUrl).toEqual('https://example.invalid/image.jpg');
        expect(mockGetImageApi).toHaveBeenCalledTimes(1);
        expect(mockGetItemImageUrlById).toHaveBeenCalledWith(
            'program-1',
            ImageType.Primary,
            expect.objectContaining({
                tag: 'primary-tag'
            })
        );
    });

    it('returns null when neither the item nor the options provide a serverId', () => {
        const result = getCardImageUrl({
            api: {} as never,
            item: {
                ProgramInfo: {
                    Id: 'program-2',
                    ImageTags: {
                        Primary: 'primary-tag'
                    }
                }
            } as never,
            options: {
                width: 320
            } as never,
            shape: CardShape.Backdrop
        });

        expect(result).toBeNull();
    });

    it('keeps wrapper item ids when ProgramInfo does not include one', () => {
        const result = getCardImageUrl({
            api: {} as never,
            item: {
                Id: 'wrapper-1',
                ServerId: 'server-1',
                ProgramInfo: {
                    ImageTags: {
                        Primary: 'primary-tag'
                    }
                }
            } as never,
            options: {
                width: 320
            } as never,
            shape: CardShape.Backdrop
        });

        expect(result?.imgUrl).toEqual('https://example.invalid/image.jpg');
        expect(mockGetItemImageUrlById).toHaveBeenCalledWith(
            'wrapper-1',
            ImageType.Primary,
            expect.objectContaining({
                tag: 'primary-tag'
            })
        );
    });

    it('uses the current program image when the wrapper is a TV program', () => {
        const result = getCardImageUrl({
            api: {} as never,
            item: {
                Type: 'Program',
                Id: 'program-wrapper',
                ServerId: 'server-1',
                ChannelId: 'channel-1',
                ChannelPrimaryImageTag: 'channel-tag',
                CurrentProgram: {
                    Id: 'current-program',
                    ImageTags: {
                        Primary: 'primary-tag'
                    }
                }
            } as never,
            options: {
                width: 320
            } as never,
            shape: CardShape.Backdrop
        });

        expect(result?.imgUrl).toEqual('https://example.invalid/image.jpg');
        expect(mockGetItemImageUrlById).toHaveBeenCalledWith(
            'channel-1',
            ImageType.Primary,
            expect.objectContaining({
                tag: 'channel-tag'
            })
        );
    });
});
