import React, { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Cached from '@mui/icons-material/Cached';
import Stop from '@mui/icons-material/Stop';
import ImageSearch from '@mui/icons-material/ImageSearch';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { queryClient } from 'utils/query/queryClient';

const QUERY_KEY = ['JobQueueStatus'];

type JobQueueItem = {
    Id: string;
    CorrelationId?: string;
    Kind: string;
    Title: string;
    Status: string;
    Progress: number;
    Phase: string;
    Summary: string;
    ErrorMessage?: string;
    CreatedAt: string;
    StartedAt?: string;
    FinishedAt?: string;
    Cancellable: boolean;
    Logs: string[];
};

type JobQueueStatus = {
    Queued: number;
    Running: number;
    Completed: number;
    Failed: number;
    Cancelled: number;
    ActiveWorkers: number;
    MaxWorkers: number;
    Jobs: JobQueueItem[];
};

const getApiClient = () => ServerConnections.getCurrentApiClient();

const getErrorMessage = (error: unknown): string => {
    const requestError = error as {
        message?: string;
        responseJSON?: { message?: string; Message?: string };
        responseText?: string;
    };

    return requestError.responseJSON?.message
        || requestError.responseJSON?.Message
        || requestError.responseText
        || requestError.message
        || 'erro desconhecido';
};

const postJson = async <T,>(url: string, body?: unknown): Promise<T> => {
    const apiClient = getApiClient();
    return apiClient!.ajax({
        type: 'POST',
        url: apiClient!.getUrl(url),
        data: body ? JSON.stringify(body) : undefined,
        contentType: 'application/json'
    }) as Promise<T>;
};

const statusColor = (status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' => {
    switch (status) {
        case 'Running':
            return 'primary';
        case 'Completed':
            return 'success';
        case 'Cancelled':
            return 'warning';
        case 'Failed':
            return 'error';
        default:
            return 'default';
    }
};

const formatDate = (value?: string) => {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'medium'
    }).format(new Date(value));
};

const JobCard = ({ job, onCancel, isCancelling }: {
    job: JobQueueItem;
    onCancel: (id: string) => void;
    isCancelling: boolean;
}) => {
    const latestLogs = useMemo(() => job.Logs?.slice(-5) ?? [], [job.Logs]);

    return (
        <Paper sx={{ p: 2, border: '1px solid rgba(255,255,255,.08)' }}>
            <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' gap={1}>
                    <Box>
                        <Typography variant='h6'>{job.Title}</Typography>
                        <Typography variant='body2' color='text.secondary'>{job.Kind} • {job.Phase}</Typography>
                    </Box>
                    <Stack direction='row' gap={1} alignItems='center'>
                        <Chip label={job.Status} color={statusColor(job.Status)} size='small' />
                        <Button
                            variant='outlined'
                            color='warning'
                            startIcon={<Stop />}
                            disabled={!job.Cancellable || isCancelling}
                            onClick={() => onCancel(job.Id)}
                        >
                            Parar
                        </Button>
                    </Stack>
                </Stack>
                <Box>
                    <Stack direction='row' justifyContent='space-between'>
                        <Typography variant='caption'>Progresso</Typography>
                        <Typography variant='caption'>{job.Progress}%</Typography>
                    </Stack>
                    <LinearProgress variant='determinate' value={job.Progress} />
                </Box>
                <Typography variant='body2'>{job.Summary || job.ErrorMessage || 'Sem detalhes.'}</Typography>
                <Grid container spacing={1}>
                    <Grid item xs={12} md={4}>
                        <Typography variant='caption' color='text.secondary'>Criado</Typography>
                        <Typography variant='body2'>{formatDate(job.CreatedAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant='caption' color='text.secondary'>Inicio</Typography>
                        <Typography variant='body2'>{formatDate(job.StartedAt)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <Typography variant='caption' color='text.secondary'>Fim</Typography>
                        <Typography variant='body2'>{formatDate(job.FinishedAt)}</Typography>
                    </Grid>
                </Grid>
                {latestLogs.length > 0 && (
                    <Box sx={{
                        bgcolor: 'rgba(0,0,0,.35)',
                        borderRadius: 1,
                        p: 1.5,
                        fontFamily: 'monospace',
                        fontSize: '.8rem',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {latestLogs.join('\n')}
                    </Box>
                )}
            </Stack>
        </Paper>
    );
};

const JobsPage = () => {
    const apiClient = getApiClient();
    const {
        data,
        isLoading,
        error
    } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => apiClient!.getJSON(apiClient!.getUrl('JobQueue/Status')) as Promise<JobQueueStatus>,
        refetchInterval: 2500
    });

    const cancelMutation = useMutation({
        mutationFn: async (id: string) => postJson(`JobQueue/Cancel/${id}`),
        onSuccess: async () => {
            toast('Trabalho cancelado.');
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onError: error => toast(`Erro ao cancelar: ${getErrorMessage(error)}`)
    });

    const cancelAllMutation = useMutation({
        mutationFn: async () => postJson('JobQueue/CancelAll'),
        onSuccess: async () => {
            toast('Parada solicitada para a fila.');
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onError: error => toast(`Erro ao parar fila: ${getErrorMessage(error)}`)
    });

    const prewarmMutation = useMutation({
        mutationFn: async () => postJson('JobQueue/PrewarmImages', { Limit: 500 }),
        onSuccess: async () => {
            toast('Pre-aquecimento de imagens enfileirado.');
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onError: error => toast(`Erro ao enfileirar pre-aquecimento: ${getErrorMessage(error)}`)
    });

    if (isLoading) {
        return <Loading />;
    }

    return (
        <Page
            id='jobQueuePage'
            title='Fila de Trabalhos'
            className='mainAnimatedPage type-interior'
        >
            <Stack spacing={3} sx={{ p: { xs: 2, md: 3 } }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' gap={2}>
                    <Box>
                        <Typography variant='h3'>Fila de Trabalhos</Typography>
                        <Typography color='text.secondary'>
                            Acompanhe IA, metadados, capas, pré-aquecimento de imagens e rotinas internas do servidor.
                        </Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                        <Button
                            variant='contained'
                            startIcon={<ImageSearch />}
                            disabled={prewarmMutation.isPending}
                            onClick={() => prewarmMutation.mutate()}
                        >
                            Pré-aquecer imagens
                        </Button>
                        <Button
                            variant='outlined'
                            startIcon={<Cached />}
                            onClick={() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })}
                        >
                            Atualizar
                        </Button>
                        <Button
                            variant='outlined'
                            color='warning'
                            startIcon={<Stop />}
                            disabled={cancelAllMutation.isPending}
                            onClick={() => cancelAllMutation.mutate()}
                        >
                            Parar todos
                        </Button>
                    </Stack>
                </Stack>

                {error && <Alert severity='error'>{getErrorMessage(error)}</Alert>}

                {data && (
                    <>
                        <Grid container spacing={2}>
                            {[
                                ['Na fila', data.Queued],
                                ['Executando', data.Running],
                                ['Concluidos', data.Completed],
                                ['Falhas', data.Failed],
                                ['Cancelados', data.Cancelled],
                                ['Workers', `${data.ActiveWorkers}/${data.MaxWorkers}`]
                            ].map(([label, value]) => (
                                <Grid item xs={6} md={2} key={label}>
                                    <Paper sx={{ p: 2 }}>
                                        <Typography variant='caption' color='text.secondary'>{label}</Typography>
                                        <Typography variant='h5'>{value}</Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>

                        <Stack spacing={2}>
                            {data.Jobs.length === 0 ? (
                                <Alert severity='info'>Nenhum trabalho registrado ainda.</Alert>
                            ) : data.Jobs.map(job => (
                                <JobCard
                                    key={job.Id}
                                    job={job}
                                    onCancel={id => cancelMutation.mutate(id)}
                                    isCancelling={cancelMutation.isPending}
                                />
                            ))}
                        </Stack>
                    </>
                )}
            </Stack>
        </Page>
    );
};

export default JobsPage;
