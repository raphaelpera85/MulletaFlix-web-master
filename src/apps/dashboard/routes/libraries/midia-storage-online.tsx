import type { AxiosRequestConfig } from 'axios';
import type { Api } from '@jellyfin/sdk';
import { getConfigurationApi } from '@jellyfin/sdk/lib/utils/api/configuration-api';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FolderOpen from '@mui/icons-material/FolderOpen';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { TaskState } from '@jellyfin/sdk/lib/generated-client/models/task-state';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { type ActionFunctionArgs, Form, useActionData, useNavigation } from 'react-router-dom';

import Page from 'components/Page';
import DirectoryBrowser from 'components/directorybrowser/directorybrowser';
import Loading from 'components/loading/LoadingComponent';
import { useNamedConfiguration } from 'hooks/useNamedConfiguration';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import useLiveTasks from 'apps/dashboard/features/tasks/hooks/useLiveTasks';
import { useStartTask } from 'apps/dashboard/features/tasks/api/useStartTask';
import TaskProgress from 'apps/dashboard/features/tasks/components/TaskProgress';
import { queryClient } from 'utils/query/queryClient';
import { QUERY_KEY as NAMED_CONFIG_QUERY_KEY } from 'hooks/useNamedConfiguration';
import { useQuery } from '@tanstack/react-query';

const CONFIG_KEY = 'midiastorageonline';
const STATUS_QUERY_KEY = [ 'MidiaStorageOnlineStatus' ];
const TASK_KEY = 'MidiaStorageOnlineSync';

interface MidiaStorageOnlineConfiguration {
    UseWorldStorage?: boolean;
    M3uUrl?: string;
    EpgUrl?: string;
    StrmOutputPath?: string;
    EnableAutoEpg?: boolean;
    AutoEpgLanguage?: string;
    MaxLinkValidationConcurrency?: number;
    CanaisM3uContent?: string;
    TunerHostId?: string;
    EpgListingProviderId?: string;
    LastSyncTime?: string;
    LastSyncDurationSeconds?: number;
    SyncedFileCount?: number;
    LastSyncError?: string;
    EpgLastSyncTime?: string;
    EpgLastError?: string;
    EpgCompatibleChannelCount?: number;
    TotalChannelCount?: number;
}

interface MidiaStorageOnlineStatus {
    m3uUrl?: string | null;
    strmPath?: string | null;
    hasCanais?: boolean;
    epgUrl?: string | null;
    epgGuidePath?: string | null;
    epgGuideUrl?: string | null;
    lastSync?: string | null;
    lastSyncDuration?: number | null;
    syncedFileCount?: number | null;
    totalChannelCount?: number | null;
    epgCompatibleChannelCount?: number | null;
    epgLastSyncTime?: string | null;
    epgLastError?: string | null;
    lastError?: string | null;
}

const fetchStatus = async (api: Api, options?: AxiosRequestConfig) => {
    const response = await fetch(api.basePath + '/MidiaStorageOnline/status', {
        signal: options?.signal as AbortSignal | undefined,
        headers: {
            Authorization: 'MediaBrowser Token="' + api.accessToken + '"'
        }
    });

    if (!response.ok) {
        throw new Error('HTTP ' + response.status);
    }

    return response.json() as Promise<MidiaStorageOnlineStatus>;
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const api = ServerConnections.getCurrentApi();
    if (!api) throw new Error('No Api instance available');

    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    const { data: currentConfig } = await getConfigurationApi(api).getNamedConfiguration({ key: CONFIG_KEY });
    const existingConfig = (currentConfig as MidiaStorageOnlineConfiguration | undefined) ?? {};
    const nextConfig: MidiaStorageOnlineConfiguration = {
        ...existingConfig,
        UseWorldStorage: data.UseWorldStorage?.toString() === 'on',
        M3uUrl: data.M3uUrl?.toString() ?? '',
        EpgUrl: data.EpgUrl?.toString() || undefined,
        StrmOutputPath: data.StrmOutputPath?.toString() || undefined,
        EnableAutoEpg: data.EnableAutoEpg?.toString() === 'on',
        AutoEpgLanguage: data.AutoEpgLanguage?.toString() || 'pt',
        MaxLinkValidationConcurrency: Number(data.MaxLinkValidationConcurrency?.toString() ?? '0') || 0
    };

    await getConfigurationApi(api)
        .updateNamedConfiguration({
            key: CONFIG_KEY,
            body: JSON.stringify(nextConfig)
        });

    void queryClient.invalidateQueries({
        queryKey: [ NAMED_CONFIG_QUERY_KEY, CONFIG_KEY ]
    });
    void queryClient.invalidateQueries({
        queryKey: STATUS_QUERY_KEY
    });

    return {
        isSaved: true
    };
};

export const Component = () => {
    const { api } = useApi();
    const navigation = useNavigation();
    const actionData = useActionData() as { isSaved?: boolean } | undefined;
    const isSubmitting = navigation.state === 'submitting';
    const startTask = useStartTask();
    const [ strmOutputPath, setStrmOutputPath ] = useState('');

    const {
        data: config,
        isPending: isConfigPending,
        isError: isConfigError
    } = useNamedConfiguration<MidiaStorageOnlineConfiguration>(CONFIG_KEY);
    const {
        data: status,
        isPending: isStatusPending,
        isError: isStatusError
    } = useQuery({
        queryKey: STATUS_QUERY_KEY,
        queryFn: ({ signal }) => fetchStatus(api!, { signal }),
        enabled: !!api
    });
    const {
        data: tasks,
        isPending: isTasksPending
    } = useLiveTasks({ isHidden: false });

    const syncTask = useMemo(() => (
        tasks?.find((value) => value.Key === TASK_KEY)
    ), [ tasks ]);

    useEffect(() => {
        if (!isConfigPending && !isConfigError) {
            setStrmOutputPath(config?.StrmOutputPath ?? '');
        }
    }, [ config, isConfigError, isConfigPending ]);

    const showStrmOutputPathPicker = useCallback(() => {
        const picker = new DirectoryBrowser();
        picker.show({
            path: strmOutputPath,
            validateWriteable: true,
            header: 'Selecionar pasta de saida dos STRM',
            instruction: 'Escolha uma pasta no servidor para salvar os arquivos STRM.',
            callback: (path: string) => {
                if (path) {
                    setStrmOutputPath(path);
                }

                picker.close();
            }
        });
    }, [ strmOutputPath ]);

    const startSync = () => {
        if (syncTask?.Id) {
            startTask.mutate({
                taskId: syncTask.Id
            });
        }
    };

    if (isConfigPending || isTasksPending) {
        return <Loading />;
    }

    return (
        <Page
            id='midiaStorageOnlinePage'
            title='Midia Storage Online'
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                {isConfigError ? (
                    <Alert severity='error'>{globalize.translate('HeaderError')}</Alert>
                ) : (
                    <Form method='POST'>
                        <Stack spacing={3}>
                            {!isSubmitting && actionData?.isSaved && (
                                <Alert severity='success'>{globalize.translate('SettingsSaved')}</Alert>
                            )}

                            <Typography variant='h1'>Midia Storage Online</Typography>
                            <Typography color='text.secondary'>
                                Configuracao nativa do servidor para canais, M3U e EPG.
                            </Typography>

                            <FormControl>
                                <FormControlLabel
                                    control={<Checkbox name='UseWorldStorage' defaultChecked={config?.UseWorldStorage ?? false} />}
                                    label='Usar storage mundial'
                                />
                            </FormControl>

                            <TextField
                                name='M3uUrl'
                                label='URL M3U'
                                defaultValue={config?.M3uUrl ?? ''}
                                fullWidth
                                helperText='Opcional quando o storage mundial estiver ativado.'
                            />

                            <TextField
                                name='EpgUrl'
                                label='URL EPG'
                                defaultValue={config?.EpgUrl ?? ''}
                                fullWidth
                            />

                            <TextField
                                name='StrmOutputPath'
                                label='Pasta de saida dos STRM'
                                value={strmOutputPath}
                                onChange={(event) => setStrmOutputPath(event.target.value)}
                                fullWidth
                                helperText='Se vazio, o servidor usa o diretorio padrao do sistema.'
                            />

                            <Button
                                variant='outlined'
                                startIcon={<FolderOpen />}
                                onClick={showStrmOutputPathPicker}
                            >
                                Pesquisar pasta
                            </Button>

                            <FormControl>
                                <FormControlLabel
                                    control={<Checkbox name='EnableAutoEpg' defaultChecked={config?.EnableAutoEpg ?? false} />}
                                    label='Ativar EPG automatico'
                                />
                            </FormControl>

                            <TextField
                                name='AutoEpgLanguage'
                                label='Idioma do EPG automatico'
                                defaultValue={config?.AutoEpgLanguage ?? 'pt'}
                                fullWidth
                            />

                            <TextField
                                name='MaxLinkValidationConcurrency'
                                label='Concorrencia da validacao de links'
                                type='number'
                                inputProps={{ min: 0, step: 1 }}
                                defaultValue={config?.MaxLinkValidationConcurrency ?? 0}
                                fullWidth
                                helperText='0 usa o valor automatico do servidor. O processamento continua em lotes de 500.'
                            />

                            <Stack direction='row' spacing={1.5}>
                                <Button type='submit' size='large'>
                                    Salvar
                                </Button>
                                <Button
                                    type='button'
                                    variant='outlined'
                                    onClick={startSync}
                                    disabled={!syncTask?.Id}
                                    loading={syncTask && syncTask.State !== TaskState.Idle}
                                    loadingPosition='start'
                                >
                                    Sincronizar agora
                                </Button>
                                {(syncTask && syncTask.State === TaskState.Running) && (
                                    <TaskProgress task={syncTask} />
                                )}
                            </Stack>

                            <Box>
                                <Typography variant='h2'>Status</Typography>
                                {isStatusPending ? (
                                    <Loading />
                                ) : isStatusError ? (
                                    <Alert severity='error'>{globalize.translate('HeaderError')}</Alert>
                                ) : status ? (
                                    <Stack spacing={1}>
                                        <Typography>Ultima sincronizacao: {status.lastSync ?? '-'}</Typography>
                                        <Typography>Arquivos gerados: {status.syncedFileCount ?? '-'}</Typography>
                                        <Typography>Total de canais: {status.totalChannelCount ?? '-'}</Typography>
                                        <Typography>Canais compativeis com EPG: {status.epgCompatibleChannelCount ?? '-'}</Typography>
                                        <Typography>URL M3U atual: {status.m3uUrl ?? '-'}</Typography>
                                        <Typography>URL EPG atual: {status.epgUrl ?? '-'}</Typography>
                                        <Typography>EPG guide: {status.epgGuideUrl ?? '-'}</Typography>
                                        <Typography>Pasta STRM: {status.strmPath ?? '-'}</Typography>
                                        {status.lastError && <Alert severity='error'>{status.lastError}</Alert>}
                                        {status.epgLastError && <Alert severity='warning'>{status.epgLastError}</Alert>}
                                    </Stack>
                                ) : null}
                            </Box>
                        </Stack>
                    </Form>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'MidiaStorageOnlinePage';
