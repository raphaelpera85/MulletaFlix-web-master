import { Api } from '@jellyfin/sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { useApi } from 'hooks/useApi';
import { queryClient } from 'utils/query/queryClient';

export interface UserLicenseDto {
    userId: string;
    userName: string;
    startDate: string;
    durationHours: number | null;
    expirationDate: string | null;
    isUnlimited: boolean;
    isExpired: boolean;
    timeRemaining: string;
    adminNotes: string | null;
    grantedByUserName: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface SetUserLicenseRequest {
    durationHours: number | null;
    adminNotes?: string | null;
}

export const USER_LICENSE_QUERY_KEY = 'UserLicense';

export const fetchUserLicense = async (api: Api, userId: string, options?: AxiosRequestConfig) => {
    const response = await api.axiosInstance.get<UserLicenseDto>(
        `/Users/${userId}/License`,
        options
    );
    return response.data;
};

export const useUserLicense = (userId: string) => {
    const { api } = useApi();

    return useQuery({
        queryKey: [USER_LICENSE_QUERY_KEY, userId],
        queryFn: ({ signal }) => fetchUserLicense(api!, userId, { signal }),
        enabled: !!api && !!userId,
        retry: false // Don't spam retries if the user simply has no license (404)
    });
};

export const useSetUserLicense = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: ({ userId, request }: { userId: string, request: SetUserLicenseRequest }) =>
            api!.axiosInstance.post<UserLicenseDto>(`/Users/${userId}/License`, request),
        onSuccess: (response, variables) => {
            void queryClient.setQueryData(
                [USER_LICENSE_QUERY_KEY, variables.userId],
                response.data
            );
            void queryClient.invalidateQueries({
                queryKey: [USER_LICENSE_QUERY_KEY, variables.userId]
            });
            // Also invalidate general user queries to refresh state/badges
            void queryClient.invalidateQueries({
                queryKey: ['User', variables.userId]
            });
        }
    });
};

export const useRevokeUserLicense = () => {
    const { api } = useApi();

    return useMutation({
        mutationFn: (userId: string) =>
            api!.axiosInstance.delete(`/Users/${userId}/License`),
        onSuccess: (_, userId) => {
            void queryClient.removeQueries({
                queryKey: [USER_LICENSE_QUERY_KEY, userId]
            });
            void queryClient.invalidateQueries({
                queryKey: [USER_LICENSE_QUERY_KEY, userId]
            });
            void queryClient.invalidateQueries({
                queryKey: ['User', userId]
            });
        }
    });
};

