# Plano Playwright - Admin e Usuario Comum

Escopo:
- Manter o stage limpo.
- Testar primeiro a area admin.
- Depois validar a sessao do usuario comum criado pelo fluxo admin.
- Nao incluir o wizard nesta suite.

Fonte de credenciais e estado:
- Admin login via `MULLETA_ADMIN_USER` e `MULLETA_ADMIN_PASSWORD`.
- Usuario comum compartilhado salvo em arquivo temporario do sistema.
- Navegacao feita com `window.Dashboard.navigate(...)`, nao com deep link direto.
- Limpeza final do usuario de teste via `window.ApiClient.deleteUser(...)`.

## Mapa de cobertura

| Area | Rota | Elementos e funcoes | Como o teste valida |
| --- | --- | --- | --- |
| Dashboard principal | `/dashboard` | Widgets de status, tarefas, dispositivos, logs e alertas | Abre a pagina, espera o `#dashboardPage` e confirma a shell admin carregada |
| Configuracoes gerais | `/dashboard/settings` | `ServerName`, `UICulture`, `CachePath`, `MetadataPath`, `QuickConnectAvailable`, `LibraryScanFanoutConcurrency`, `ParallelImageEncodingLimit`, botao `Save` | Abre a pagina e confere que o formulario principal esta visivel |
| Usuarios | `/dashboard/users` | Botao `Adicionar Usuario`, cards de usuario, menu de cada card | Confirma lista e entrada para criacao de usuario |
| Criar usuario | `/dashboard/users/add` | `txtUsername`, `txtPassword`, acesso a bibliotecas, canais, `Save`, `Cancel` | Preenche usuario unico, habilita acesso total quando existir, submete e captura o `userId` |
| Perfil do usuario | `/dashboard/users/:id/profile` | Tabs `Perfil`, `Acesso`, `Controle Parental`, `Senha`; `chkRemoteAccess`, `chkEnableLiveTvAccess`, `selectSyncPlayAccess` | Abre a tab, valida os campos e submete sem alterar a politica |
| Acesso do usuario | `/dashboard/users/:id/access` | Acesso a bibliotecas, canais e dispositivos | Abre a tab, valida os grupos e submete sem modificar o estado |
| Controle parental | `/dashboard/users/:id/parentalcontrol` | `selectMaxParentalRating`, unrated items, tags permitidas/bloqueadas, schedule, `Add` e `Save` | Abre a tab e valida todos os blocos e botoes principais |
| Senha do usuario | `/dashboard/users/:id/password` | `txtCurrentPassword`, `txtNewPassword`, `txtNewPasswordConfirm`, `ResetPassword`, `SavePassword` | Exercita validacao de confirmacao divergente sem salvar |
| Licencas | `/dashboard/users/licenses` | Tabela, status, duracao, `Aplicar`, `Revogar` | Garante que a pagina e a grade de licencas carregam |
| Bibliotecas | `/dashboard/libraries` | `ButtonAddMediaLibrary`, `ButtonScanAllLibraries`, cards de bibliotecas | Abre a pagina e valida a area de criacao e escaneamento |
| Playback - streaming | `/dashboard/playback/streaming` | `StreamingBitrateLimit`, `Save` | Confere o campo de bitrate e o botao de salvamento |
| Logs | `/dashboard/logs` | `EnableWarningMessage`, `SlowResponseTime`, `Save`, lista de logs | Abre o formulario e valida os controles de log |
| Dispositivos | `/dashboard/devices` | Edicao inline, delete por linha, `DeleteAll` | Confere a tabela e os acoes principais |
| Plugins | `/dashboard/plugins` | Busca, filtros por status/categoria, `ManageRepositories` | Garante a pagina de plugins e a acao de repositorio |
| Branding | `/dashboard/branding` | `LoginDisclaimer`, `CustomCss`, splash screen, upload/delete, `Save` | Valida os campos e botoes da tela de branding |
| Activity | `/dashboard/activity` | Filtros `All`, `User`, `System`, colunas de atividade | Abre a tela e valida a troca de visao |
| Networking | `/dashboard/networking` | Campos de rede, acesso remoto, certificados | Fica na proxima leva de automacao de formulario |
| Keys | `/dashboard/keys` | Chaves de API e revogacao | Fica na proxima leva de automacao |
| Live TV | `/dashboard/livetv` e subrotas | Tuner, provider, recordings | Fica na proxima leva de automacao |
| Jobs / Backups | `/dashboard/jobs`, `/dashboard/backups` | Execucao e manutencao operacional | Fica na proxima leva de automacao |

## Ordem de execucao

1. Login admin.
2. Criacao do usuario comum.
3. Revisao das tabs do usuario.
4. Smoke das telas principais do dashboard admin.
5. Logout admin.
6. Login do usuario comum criado.
7. Validacao da home e da sessao.
8. Logout do usuario comum.
9. Limpeza do usuario de teste via API.

## Observacoes de resiliencia

- Preferir `id`, `name` e classes reais do DOM em vez de textos genéricos.
- Quando um painel depender de dados do ambiente, validar a presenca do bloco e nao apenas a visibilidade.
- Em telas com traducao, usar seletores estruturais sempre que possivel.
- Em tabs e formularios que salvam estado, submeter sem alterar o dado original quando a operacao nao precisa ser persistente.
- Em validacoes destrutivas, testar a regra de erro sem gravar no banco.
