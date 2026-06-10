import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import { useUserLicense, useSetUserLicense, useRevokeUserLicense } from '../api/useUserLicense';
import confirm from 'components/confirm/confirm';
import toast from 'components/toast/toast';

interface LicenseProps {
    userId: string;
}

const License = ({ userId }: LicenseProps) => {
    const { data: license, isLoading, isError, error, refetch } = useUserLicense(userId);
    const setLicenseMutation = useSetUserLicense();
    const revokeLicenseMutation = useRevokeUserLicense();

    const [durationHours, setDurationHours] = useState<string>('');
    const [adminNotes, setAdminNotes] = useState<string>('');

    // Handle 404 as "no active license"
    const isNoLicense = isError && (error as any)?.response?.status === 404;
    const hasLicense = !!license && !isNoLicense;

    const handleDurationChange = (event: SelectChangeEvent) => {
        setDurationHours(event.target.value);
    };

    const handleSave = () => {
        if (!durationHours) {
            toast('Por favor, selecione uma duração para a licença.');
            return;
        }

        const duration = parseInt(durationHours, 10);
        setLicenseMutation.mutate({
            userId,
            request: {
                durationHours: duration === -1 ? null : duration,
                adminNotes: adminNotes.trim() || null
            }
        }, {
            onSuccess: () => {
                toast('Licença atualizada com sucesso!');
                setDurationHours('');
                setAdminNotes('');
                void refetch();
            },
            onError: (err) => {
                toast(`Erro ao salvar licença: ${(err as any)?.message || 'Erro desconhecido'}`);
            }
        });
    };

    const handleRevoke = () => {
        confirm({
            title: 'Revogar Licença',
            text: 'Tem certeza que deseja revogar a licença deste usuário? O acesso do usuário será liberado (sem restrição de tempo) até que uma nova licença seja atribuída.',
            confirmText: 'Revogar',
            cancelText: 'Cancelar'
        }).then(() => {
            revokeLicenseMutation.mutate(userId, {
                onSuccess: () => {
                    toast('Licença revogada com sucesso!');
                    void refetch();
                },
                onError: (err) => {
                    toast(`Erro ao revogar licença: ${(err as any)?.message || 'Erro desconhecido'}`);
                }
            });
        }).catch(() => {
            // Cancelled
        });
    };

    if (isLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    // Determine status and style details
    let statusLabel = 'Sem Licença Ativa';
    let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    let statusDetails = 'Este usuário não possui nenhuma licença ativa no momento. O acesso ao sistema é irrestrito.';

    if (hasLicense && license) {
        if (license.IsUnlimited) {
            statusLabel = '♾️ Licença Ilimitada';
            chipColor = 'info';
            statusDetails = 'Esta conta possui acesso por tempo ilimitado ao servidor.';
        } else if (license.IsExpired) {
            statusLabel = '🔴 Licença Expirada';
            chipColor = 'error';
            statusDetails = `Esta conta expirou em ${new Date(license.ExpirationDate!).toLocaleString()}. O acesso foi desativado automaticamente.`;
        } else {
            statusLabel = '🟢 Licença Ativa';
            chipColor = 'success';
            statusDetails = `Esta conta está ativa. Tempo restante: ${license.TimeRemaining}.`;
        }
    }

    return (
        <Stack spacing={3} sx={{ maxWidth: 800, margin: '0 auto', mt: 2 }}>
            {/* Status Section */}
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                <Box sx={{ p: 3, background: 'linear-gradient(135deg, rgba(33,150,243,0.08) 0%, rgba(30,136,229,0.03) 100%)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Typography variant="h5" fontWeight="bold">
                            Status da Assinatura
                        </Typography>
                        <Chip label={statusLabel} color={chipColor} variant="filled" sx={{ fontWeight: 'bold', fontSize: '1rem', height: 36 }} />
                    </Stack>
                </Box>
                <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                            {statusDetails}
                        </Typography>

                        {hasLicense && license && (
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Data de Início
                                    </Typography>
                                    <Typography variant="body2" fontWeight="medium">
                                        {new Date(license.StartDate).toLocaleString()}
                                    </Typography>
                                </Box>
                                {!license.IsUnlimited && license.ExpirationDate && (
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Data de Expiração
                                        </Typography>
                                        <Typography variant="body2" fontWeight="medium">
                                            {new Date(license.ExpirationDate).toLocaleString()}
                                        </Typography>
                                    </Box>
                                )}
                                {license.AdminNotes && (
                                    <Box sx={{ gridColumn: '1 / -1' }}>
                                        <Typography variant="caption" color="text.secondary" display="block">
                                            Observações do Administrador
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                            "{license.AdminNotes}"
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {/* Management Form */}
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <Typography variant="h5" fontWeight="bold">
                        Configurar / Renovar Licença
                    </Typography>
                </Box>
                <CardContent sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel id="duration-select-label">Duração da Licença</InputLabel>
                            <Select
                                labelId="duration-select-label"
                                value={durationHours}
                                onChange={handleDurationChange}
                                label="Duração da Licença"
                            >
                                <MenuItem value=""><em>Selecione...</em></MenuItem>
                                <MenuItem value="1">Teste (1 Hora)</MenuItem>
                                <MenuItem value="730">1 Mês (~30 dias)</MenuItem>
                                <MenuItem value="2190">3 Meses (~90 dias)</MenuItem>
                                <MenuItem value="4380">6 Meses (~180 dias)</MenuItem>
                                <MenuItem value="8760">12 Meses (1 Ano)</MenuItem>
                                <MenuItem value="-1">♾️ Tempo Ilimitado</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Observações do Administrador"
                            multiline
                            rows={3}
                            placeholder="Adicione notas sobre o pagamento ou detalhes do usuário..."
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            variant="outlined"
                            fullWidth
                        />

                        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 1 }}>
                            {hasLicense && (
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={handleRevoke}
                                    disabled={revokeLicenseMutation.isPending}
                                >
                                    Revogar Licença
                                </Button>
                            )}
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleSave}
                                disabled={!durationHours || setLicenseMutation.isPending}
                            >
                                {setLicenseMutation.isPending ? 'Salvando...' : 'Salvar Licença'}
                            </Button>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
};

export default License;
