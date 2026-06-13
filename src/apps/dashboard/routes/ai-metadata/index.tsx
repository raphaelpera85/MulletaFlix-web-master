import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Add from '@mui/icons-material/Add';
import Delete from '@mui/icons-material/Delete';
import Science from '@mui/icons-material/Science';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import toast from 'components/toast/toast';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { queryClient } from 'utils/query/queryClient';

type AiProvider = {
    Id: string;
    Provider: string;
    DisplayName: string;
    Enabled: boolean;
    BaseUrl: string;
    Model: string;
    ApiKey?: string;
    ClearApiKey?: boolean;
    ApiKeyConfigured?: boolean;
};

type AiMetadataConfiguration = {
    Enabled: boolean;
    DecisionMode: string;
    PrimaryProviderId?: string;
    JudgeProviderId?: string;
    Providers: AiProvider[];
    Automation: {
        MinimumSuggestionConfidence: number;
        AutomaticApplyConfidence: number;
        AllowAutomaticApply: boolean;
        RequireTwoProviderAgreement: boolean;
        ProtectExistingEpg: boolean;
        ExistingEpgReplaceConfidence: number;
        ProtectManualMetadata: boolean;
    };
    MediaTypes: {
        Movies: boolean;
        Series: boolean;
        Books: boolean;
        Channels: boolean;
        Logos: boolean;
        Epg: boolean;
    };
};

type ProviderPreset = {
    provider: string;
    label: string;
    baseUrl: string;
    model: string;
    needsKey: boolean;
};

const QUERY_KEY = ['AiMetadataConfiguration'];

const PROVIDER_PRESETS: ProviderPreset[] = [
    {
        provider: 'OpenAI',
        label: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        needsKey: true
    },
    {
        provider: 'OpenRouter',
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openai/gpt-4.1-mini',
        needsKey: true
    },
    {
        provider: 'DeepSeek',
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        needsKey: true
    },
    {
        provider: 'Gemini',
        label: 'Gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-1.5-flash',
        needsKey: true
    },
    {
        provider: 'Anthropic',
        label: 'Anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-haiku-latest',
        needsKey: true
    },
    {
        provider: 'AzureOpenAI',
        label: 'Azure OpenAI',
        baseUrl: '',
        model: '',
        needsKey: true
    },
    {
        provider: 'Ollama',
        label: 'Ollama Local',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1',
        needsKey: false
    },
    {
        provider: 'LMStudio',
        label: 'LM Studio',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model',
        needsKey: false
    }
];

const createDefaultConfiguration = (): AiMetadataConfiguration => ({
    Enabled: false,
    DecisionMode: 'single',
    Providers: [],
    Automation: {
        MinimumSuggestionConfidence: 70,
        AutomaticApplyConfidence: 90,
        AllowAutomaticApply: false,
        RequireTwoProviderAgreement: true,
        ProtectExistingEpg: true,
        ExistingEpgReplaceConfidence: 95,
        ProtectManualMetadata: true
    },
    MediaTypes: {
        Movies: true,
        Series: true,
        Books: true,
        Channels: true,
        Logos: true,
        Epg: true
    }
});

const createProvider = (preset: ProviderPreset): AiProvider => ({
    Id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    Provider: preset.provider,
    DisplayName: preset.label,
    Enabled: true,
    BaseUrl: preset.baseUrl,
    Model: preset.model,
    ApiKey: ''
});

export const Component = () => {
    const api = ServerConnections.getCurrentApi();
    const [draft, setDraft] = useState<AiMetadataConfiguration>(createDefaultConfiguration());
    const [testResults, setTestResults] = useState<Record<string, string>>({});

    const {
        isPending,
        isError,
        error
    } = useQuery({
        queryKey: QUERY_KEY,
        enabled: !!api,
        queryFn: async () => {
            const response = await api!.axiosInstance.get<AiMetadataConfiguration>('/AiMetadata/Configuration');
            const value = response.data ?? createDefaultConfiguration();
            setDraft({
                ...createDefaultConfiguration(),
                ...value,
                Automation: {
                    ...createDefaultConfiguration().Automation,
                    ...value.Automation
                },
                MediaTypes: {
                    ...createDefaultConfiguration().MediaTypes,
                    ...value.MediaTypes
                },
                Providers: value.Providers ?? []
            });

            return value;
        }
    });

    const saveMutation = useMutation({
        mutationFn: async (configuration: AiMetadataConfiguration) => {
            await api!.axiosInstance.post('/AiMetadata/Configuration', configuration);
        },
        onSuccess: async () => {
            toast('Configuracao de IA salva com sucesso.');
            await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
        onError: (error) => {
            toast(`Erro ao salvar IA: ${(error as any)?.message || 'erro desconhecido'}`);
        }
    });

    const testMutation = useMutation({
        mutationFn: async (provider: AiProvider) => {
            const response = await api!.axiosInstance.post<{ Success: boolean; Message: string }>('/AiMetadata/TestProvider', {
                Provider: provider
            });
            return {
                providerId: provider.Id,
                ...response.data
            };
        },
        onSuccess: (result) => {
            setTestResults(prev => ({
                ...prev,
                [result.providerId]: result.Message
            }));
            toast(result.Message);
        },
        onError: (error, provider) => {
            const message = `Falha ao testar ${provider.DisplayName}: ${(error as any)?.message || 'erro desconhecido'}`;
            setTestResults(prev => ({
                ...prev,
                [provider.Id]: message
            }));
            toast(message);
        }
    });

    const enabledProviders = useMemo(() => (
        draft?.Providers.filter(provider => provider.Enabled) ?? []
    ), [draft]);

    const updateDraft = useCallback((patch: Partial<AiMetadataConfiguration>) => {
        setDraft(current => ({ ...current, ...patch }));
    }, []);

    const updateAutomation = useCallback((patch: Partial<AiMetadataConfiguration['Automation']>) => {
        setDraft(current => ({
            ...current,
            Automation: {
                ...current.Automation,
                ...patch
            }
        }));
    }, []);

    const updateMediaTypes = useCallback((patch: Partial<AiMetadataConfiguration['MediaTypes']>) => {
        setDraft(current => ({
            ...current,
            MediaTypes: {
                ...current.MediaTypes,
                ...patch
            }
        }));
    }, []);

    const updateProvider = useCallback((providerId: string, patch: Partial<AiProvider>) => {
        setDraft(current => ({
            ...current,
            Providers: current.Providers.map(provider => provider.Id === providerId ? {
                ...provider,
                ...patch
            } : provider)
        }));
    }, []);

    const addProvider = useCallback((presetName: string) => {
        const preset = PROVIDER_PRESETS.find(item => item.provider === presetName);
        if (!preset) return;

        setDraft(current => ({
            ...current,
            Providers: [
                ...current.Providers,
                createProvider(preset)
            ]
        }));
    }, []);

    const removeProvider = useCallback((providerId: string) => {
        setDraft(current => ({
            ...current,
            Providers: current.Providers.filter(provider => provider.Id !== providerId),
            PrimaryProviderId: current.PrimaryProviderId === providerId ? undefined : current.PrimaryProviderId,
            JudgeProviderId: current.JudgeProviderId === providerId ? undefined : current.JudgeProviderId
        }));
    }, []);

    const save = useCallback(() => {
        if (!draft) return;
        saveMutation.mutate(draft);
    }, [draft, saveMutation]);

    if (!api) {
        return (
            <Page
                id='dashboardAiMetadataPage'
                title='IA e Metadados'
                className='type-interior mainAnimatedPage'
            >
                <Box className='content-primary'>
                    <Stack spacing={3}>
                        <Typography variant='h1'>IA e Metadados</Typography>
                        <Alert severity='warning'>
                            Cliente de API ainda nao esta disponivel. Recarregue a pagina ou faca login novamente.
                        </Alert>
                    </Stack>
                </Box>
            </Page>
        );
    }

    if (isPending) {
        return <Loading />;
    }

    if (isError) {
        return (
            <Page
                id='dashboardAiMetadataPage'
                title='IA e Metadados'
                className='type-interior mainAnimatedPage'
            >
                <Box className='content-primary'>
                    <Stack spacing={3}>
                        <Typography variant='h1'>IA e Metadados</Typography>
                        <Alert severity='error'>
                            {`Nao foi possivel carregar a configuracao de IA: ${(error as any)?.message || 'erro desconhecido'}`}
                        </Alert>
                    </Stack>
                </Box>
            </Page>
        );
    }

    return (
        <Page
            id='dashboardAiMetadataPage'
            title='IA e Metadados'
            className='type-interior mainAnimatedPage'
        >
            <Box className='content-primary'>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant='h1'>IA e Metadados</Typography>
                        <Typography color='text.secondary'>
                            Configure multiplas IAs para sugerir titulos, logos, EPG e metadados de filmes, series, livros e canais.
                        </Typography>
                    </Stack>

                    {isError && (
                        <Alert severity='error'>Nao foi possivel carregar a configuracao de IA.</Alert>
                    )}

                    <Paper sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <FormControlLabel
                                control={(
                                    <Checkbox
                                        checked={draft.Enabled}
                                        onChange={event => updateDraft({ Enabled: event.target.checked })}
                                    />
                                )}
                                label='Ativar IA para curadoria de metadados'
                            />

                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel id='ai-decision-mode-label'>Modo de decisao</InputLabel>
                                        <Select
                                            labelId='ai-decision-mode-label'
                                            label='Modo de decisao'
                                            value={draft.DecisionMode}
                                            onChange={event => updateDraft({ DecisionMode: event.target.value })}
                                        >
                                            <MenuItem value='single'>Rapido: IA principal decide</MenuItem>
                                            <MenuItem value='consensus'>Consenso: varias IAs votam</MenuItem>
                                            <MenuItem value='council'>Conselho: IAs analisam e juiz decide</MenuItem>
                                            <MenuItem value='conservative'>Conservador: aplicar so com concordancia forte</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel id='ai-primary-provider-label'>IA principal</InputLabel>
                                        <Select
                                            labelId='ai-primary-provider-label'
                                            label='IA principal'
                                            value={draft.PrimaryProviderId ?? ''}
                                            onChange={event => updateDraft({ PrimaryProviderId: event.target.value })}
                                        >
                                            <MenuItem value=''>Nenhuma</MenuItem>
                                            {enabledProviders.map(provider => (
                                                <MenuItem key={provider.Id} value={provider.Id}>{provider.DisplayName}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth>
                                        <InputLabel id='ai-judge-provider-label'>IA juiz</InputLabel>
                                        <Select
                                            labelId='ai-judge-provider-label'
                                            label='IA juiz'
                                            value={draft.JudgeProviderId ?? ''}
                                            onChange={event => updateDraft({ JudgeProviderId: event.target.value })}
                                        >
                                            <MenuItem value=''>Nenhuma</MenuItem>
                                            {enabledProviders.map(provider => (
                                                <MenuItem key={provider.Id} value={provider.Id}>{provider.DisplayName}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </Stack>
                    </Paper>

                    <Paper sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant='h2'>Provedores</Typography>
                            <Grid container spacing={2}>
                                {PROVIDER_PRESETS.map(preset => (
                                    <Grid item xs={12} sm={6} md={3} key={preset.provider}>
                                        <Button
                                            fullWidth
                                            variant='outlined'
                                            startIcon={<Add />}
                                            onClick={() => addProvider(preset.provider)}
                                        >
                                            {preset.label}
                                        </Button>
                                    </Grid>
                                ))}
                            </Grid>

                            <Stack spacing={2}>
                                {draft.Providers.map(provider => {
                                    const preset = PROVIDER_PRESETS.find(item => item.provider === provider.Provider);
                                    return (
                                        <Paper key={provider.Id} variant='outlined' sx={{ p: 2 }}>
                                            <Stack spacing={2}>
                                                <Stack direction='row' alignItems='center' justifyContent='space-between' gap={2}>
                                                    <FormControlLabel
                                                        control={(
                                                            <Checkbox
                                                                checked={provider.Enabled}
                                                                onChange={event => updateProvider(provider.Id, { Enabled: event.target.checked })}
                                                            />
                                                        )}
                                                        label={`${provider.DisplayName || provider.Provider}${provider.ApiKeyConfigured ? ' - chave salva' : ''}`}
                                                    />
                                                    <IconButton aria-label='Remover provedor' onClick={() => removeProvider(provider.Id)}>
                                                        <Delete />
                                                    </IconButton>
                                                </Stack>

                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} md={3}>
                                                        <FormControl fullWidth>
                                                            <InputLabel>Provedor</InputLabel>
                                                            <Select
                                                                label='Provedor'
                                                                value={provider.Provider}
                                                                onChange={event => {
                                                                    const nextPreset = PROVIDER_PRESETS.find(item => item.provider === event.target.value);
                                                                    updateProvider(provider.Id, {
                                                                        Provider: event.target.value,
                                                                        DisplayName: nextPreset?.label ?? event.target.value,
                                                                        BaseUrl: nextPreset?.baseUrl ?? provider.BaseUrl,
                                                                        Model: nextPreset?.model ?? provider.Model
                                                                    });
                                                                }}
                                                            >
                                                                {PROVIDER_PRESETS.map(item => (
                                                                    <MenuItem key={item.provider} value={item.provider}>{item.label}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <TextField
                                                            fullWidth
                                                            label='Nome exibido'
                                                            value={provider.DisplayName}
                                                            onChange={event => updateProvider(provider.Id, { DisplayName: event.target.value })}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <TextField
                                                            fullWidth
                                                            label='URL base'
                                                            value={provider.BaseUrl}
                                                            onChange={event => updateProvider(provider.Id, { BaseUrl: event.target.value })}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <TextField
                                                            fullWidth
                                                            label='Modelo'
                                                            value={provider.Model}
                                                            onChange={event => updateProvider(provider.Id, { Model: event.target.value })}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            type='password'
                                                            label={preset?.needsKey === false ? 'API key opcional' : 'API key'}
                                                            helperText={provider.ApiKeyConfigured ? 'Deixe vazio para manter a chave salva.' : 'Informe a chave para salvar este provedor.'}
                                                            value={provider.ApiKey ?? ''}
                                                            onChange={event => updateProvider(provider.Id, { ApiKey: event.target.value, ClearApiKey: false })}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <FormControlLabel
                                                            control={(
                                                                <Checkbox
                                                                    checked={!!provider.ClearApiKey}
                                                                    onChange={event => updateProvider(provider.Id, { ClearApiKey: event.target.checked, ApiKey: '' })}
                                                                />
                                                            )}
                                                            label='Apagar chave salva'
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Button
                                                            fullWidth
                                                            variant='contained'
                                                            startIcon={<Science />}
                                                            disabled={testMutation.isPending}
                                                            onClick={() => testMutation.mutate(provider)}
                                                        >
                                                            Testar
                                                        </Button>
                                                    </Grid>
                                                </Grid>

                                                {testResults[provider.Id] && (
                                                    <Alert severity={testResults[provider.Id].includes('sucesso') ? 'success' : 'warning'}>
                                                        {testResults[provider.Id]}
                                                    </Alert>
                                                )}
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    </Paper>

                    <Paper sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant='h2'>Tipos de midia</Typography>
                            <Grid container spacing={1}>
                                {Object.entries(draft.MediaTypes).map(([key, value]) => (
                                    <Grid item xs={12} sm={6} md={4} key={key}>
                                        <FormControlLabel
                                            control={(
                                                <Checkbox
                                                    checked={value}
                                                    onChange={event => updateMediaTypes({ [key]: event.target.checked })}
                                                />
                                            )}
                                            label={key}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </Stack>
                    </Paper>

                    <Paper sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant='h2'>Automacao e seguranca</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        type='number'
                                        label='Confianca minima para sugestao'
                                        value={draft.Automation.MinimumSuggestionConfidence}
                                        onChange={event => updateAutomation({ MinimumSuggestionConfidence: Number(event.target.value) })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        type='number'
                                        label='Confianca para aplicar automatico'
                                        value={draft.Automation.AutomaticApplyConfidence}
                                        onChange={event => updateAutomation({ AutomaticApplyConfidence: Number(event.target.value) })}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        type='number'
                                        label='Confianca para trocar EPG existente'
                                        value={draft.Automation.ExistingEpgReplaceConfidence}
                                        onChange={event => updateAutomation({ ExistingEpgReplaceConfidence: Number(event.target.value) })}
                                    />
                                </Grid>
                            </Grid>

                            <Divider />

                            <Grid container spacing={1}>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={<Checkbox checked={draft.Automation.AllowAutomaticApply} onChange={event => updateAutomation({ AllowAutomaticApply: event.target.checked })} />}
                                        label='Permitir aplicacao automatica acima da confianca configurada'
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={<Checkbox checked={draft.Automation.RequireTwoProviderAgreement} onChange={event => updateAutomation({ RequireTwoProviderAgreement: event.target.checked })} />}
                                        label='Exigir concordancia de pelo menos 2 IAs'
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={<Checkbox checked={draft.Automation.ProtectExistingEpg} onChange={event => updateAutomation({ ProtectExistingEpg: event.target.checked })} />}
                                        label='Proteger EPG existente'
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={<Checkbox checked={draft.Automation.ProtectManualMetadata} onChange={event => updateAutomation({ ProtectManualMetadata: event.target.checked })} />}
                                        label='Nunca substituir metadados editados manualmente'
                                    />
                                </Grid>
                            </Grid>
                        </Stack>
                    </Paper>

                    <Stack direction='row' justifyContent='flex-end'>
                        <Button
                            size='large'
                            variant='contained'
                            disabled={saveMutation.isPending}
                            onClick={save}
                        >
                            Salvar configuracao de IA
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Page>
    );
};

Component.displayName = 'AiMetadataConfigurationPage';
