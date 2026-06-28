# Playwright Plan

## Objetivo
Cobrir o stage do MulletaFlix em ordem de prioridade:
1. Wizard
2. Admin
3. Usuario comum

## Premissas
- Sempre executar contra o stage limpo antes do wizard.
- Validar que `StartupWizardCompleted` começa `false`.
- Reaproveitar o stage do projeto local e nao um servidor instalado separado.

## Mapeamento de telas e acoes

### Wizard
- `wizard/start`
- `wizard/user`
- `wizard/library`
- `wizard/settings`
- `wizard/remoteaccess`
- `wizard/finish`

### Admin
- Login manual
- Dashboard de usuarios
- Criacao de usuario
- Edicao do usuario
- Tab `Profile`
- Tab `Access`
- Tab `Parental Control`
- Tab `Password`

### Usuario comum
- Login manual
- Acesso ao shell principal

## Cobertura inicial implementada
- Wizard: abre stage limpo, preenche configuracao inicial, cria admin e conclui setup.
- Admin: faz login, entra em usuarios, cria usuario comum e navega pelas tabs do cadastro.
- Usuario comum: autentica com o usuario criado e valida entrada na aplicacao.

## Relatorio
- JSON: `e2e/reports/playwright-report.json`
- Conclusao: `e2e/reports/playwright-conclusions.md`

## Proximos incrementos
- Cobrir `libraries`, `devices`, `activity`, `dashboard settings` e telas especiais do admin.
- Cobrir alteracao de senha e reset de senha.
- Cobrir selecoes por biblioteca, canais e permissões avançadas do usuario comum.
