import React, { useCallback, useEffect, useRef, useState } from 'react';
import Page from 'components/Page';
import globalize from 'lib/globalize';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Loading from 'components/loading/LoadingComponent';
import RefreshIcon from '@mui/icons-material/Refresh';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import { ServerConnections } from 'lib/jellyfin-apiclient';

const POLL_INTERVAL = 15000;

interface UnidentifiedItem {
    Id: string;
    Name: string;
    Path: string | null;
    Type: string;
    DateCreated: string;
}

export const Component = () => {
    const [tab, setTab] = useState(0);
    const [items, setItems] = useState<UnidentifiedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<string | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const mediaType = tab === 0 ? 'Movies' : 'Series';
    const typeLabel = tab === 0 ? globalize.translate('Movies') : globalize.translate('Series');

    const fetchItems = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const api = ServerConnections.getCurrentApi();
            if (!api) throw new Error('No API available');
            const baseUrl = api.basePath;
            const token = api.accessToken;
            const resp = await fetch(baseUrl + '/Items/Unidentified?mediaType=' + mediaType, {
                headers: { Authorization: 'MediaBrowser Token="' + token + '"' }
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const result = await resp.json();
            setItems(result as UnidentifiedItem[]);
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch items');
        } finally {
            setLoading(false);
        }
    }, [mediaType]);

    const startPolling = useCallback(() => {
        stopPolling();
        pollingRef.current = setInterval(() => fetchItems(true), POLL_INTERVAL);
    }, [fetchItems]);

    const stopPolling = useCallback(() => {
        if (pollingRef.current !== null) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    }, []);

    useEffect(() => {
        fetchItems();
        startPolling();
        const onFocus = () => fetchItems(true);
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchItems(true);
                startPolling();
            } else {
                stopPolling();
            }
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            stopPolling();
        };
    }, [fetchItems, startPolling, stopPolling]);

    return (
        <Page
            id='unidentifiedMediaPage'
            title={globalize.translate('UnidentifiedMedia')}
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant='h4' sx={{ flexGrow: 1 }}>
                        {globalize.translate('UnidentifiedMedia')}
                    </Typography>
                    {lastUpdate && (
                        <Chip
                            label={'Auto-refresh: ' + lastUpdate}
                            size='small'
                            variant='outlined'
                            sx={{ mr: 1 }}
                        />
                    )}
                    <IconButton onClick={() => fetchItems()} title={globalize.translate('ButtonRefresh')} size='large'>
                        <RefreshIcon />
                    </IconButton>
                </Box>
                <Typography variant='body1' sx={{ mb: 2, color: 'text.secondary' }}>
                    {globalize.translate('UnidentifiedMediaDescription')}
                </Typography>

                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    sx={{ mb: 2 }}
                >
                    <Tab label={globalize.translate('Movies')} />
                    <Tab label={globalize.translate('Series')} />
                </Tabs>

                {loading && <Loading />}

                {error && (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!loading && !error && items.length === 0 && (
                    <Alert severity='success'>
                        {globalize.translate('NoUnidentifiedItems', typeLabel)}
                    </Alert>
                )}

                {!loading && !error && items.length > 0 && (
                    <>
                        <Typography variant='subtitle1' sx={{ mb: 1 }}>
                            {items.length} {globalize.translate('ItemsFound', typeLabel)}
                        </Typography>
                        <TableContainer component={Paper}>
                            <Table size='small'>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{globalize.translate('Name')}</TableCell>
                                        <TableCell>{globalize.translate('Path')}</TableCell>
                                        <TableCell>{globalize.translate('DateAdded')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((item) => (
                                        <TableRow key={item.Id}>
                                            <TableCell>
                                                <a
                                                    href={`#/details?id=${item.Id}`}
                                                    title={globalize.translate('Identify')}
                                                    style={{ cursor: 'pointer', fontWeight: 500, color: 'inherit', textDecoration: 'underline' }}
                                                >
                                                    {item.Name}
                                                </a>
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.Path ?? '-'}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(item.DateCreated).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'UnidentifiedMediaPage';
