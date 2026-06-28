import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function formatDate(value) {
    if (!value) {
        return 'n/a';
    }

    return new Date(value).toISOString();
}

function getConclusion(summary) {
    if (summary.status === 'no-specs') {
        return 'Infraestrutura pronta, mas ainda não há specs Playwright no diretório configurado.';
    }

    if (summary.status === 'probe-failed') {
        return 'O stage não respondeu ao probe básico. Verifique se o servidor limpo está no ar.';
    }

    if (summary.tests.failed > 0) {
        return 'A suíte falhou. Corrija os pontos listados no relatório antes de expandir a cobertura.';
    }

    if (summary.tests.total === 0) {
        return 'Nenhum teste foi executado. Verifique o diretório de specs configurado.';
    }

    return 'A suíte terminou sem falhas inesperadas e o fluxo base está pronto para expansão.';
}

export function buildPlaywrightReport(summary) {
    const conclusion = getConclusion(summary);

    return {
        ...summary,
        conclusion
    };
}

export function buildMarkdownReport(summary) {
    const report = buildPlaywrightReport(summary);

    return [
        `# ${report.title}`,
        '',
        `- Gerado em: ${formatDate(report.generatedAt)}`,
        `- Base URL: ${report.baseUrl}`,
        `- Status: ${report.status}`,
        `- Especificações encontradas: ${report.specCount}`,
        `- Total de testes: ${report.tests.total}`,
        `- Passou: ${report.tests.passed}`,
        `- Falhou: ${report.tests.failed}`,
        `- Ignorados: ${report.tests.skipped}`,
        `- Duração: ${report.tests.durationMs} ms`,
        '',
        '## Probe do Stage',
        '',
        `- Acessível: ${report.stageProbe.reachable ? 'sim' : 'não'}`,
        `- StartupWizardCompleted: ${typeof report.stageProbe.startupWizardCompleted === 'boolean' ? (report.stageProbe.startupWizardCompleted ? 'true' : 'false') : 'n/a'}`,
        report.stageProbe.error ? `- Erro: ${report.stageProbe.error}` : null,
        '',
        '## Conclusão',
        '',
        report.conclusion,
        '',
        '## Premissas',
        '',
        ...report.assumptions.map(item => `- ${item}`),
        '',
        '## Verificações de estado',
        '',
        `- Wizard limpo: ${report.stageChecks.wizard ? 'sim' : 'não'}`,
        `- Admin: ${report.stageChecks.admin ? 'sim' : 'não'}`,
        `- Usuário comum: ${report.stageChecks.user ? 'sim' : 'não'}`,
        `- Login: ${report.stageChecks.login ? 'sim' : 'não'}`
    ].filter(Boolean).join('\n');
}

export function buildJsonReport(summary) {
    return JSON.stringify(buildPlaywrightReport(summary), null, 2);
}

export async function writePlaywrightReportArtifacts(summary, outputDir) {
    const report = buildPlaywrightReport(summary);
    const absoluteDir = path.resolve(outputDir);

    await mkdir(absoluteDir, { recursive: true });

    const jsonPath = path.join(absoluteDir, 'playwright-summary.json');
    const markdownPath = path.join(absoluteDir, 'playwright-summary.md');

    await writeFile(jsonPath, buildJsonReport(report), 'utf8');
    await writeFile(markdownPath, buildMarkdownReport(report), 'utf8');

    return {
        report,
        jsonPath,
        markdownPath
    };
}
