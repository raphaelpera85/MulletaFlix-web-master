#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import fg from 'fast-glob';
import {
    DEFAULT_STAGE_BASE_URL,
    fetchStagePublicInfo,
    getStageBaseUrl,
    writePlaywrightReportArtifacts
} from '../../tests/playwright/support/index.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const reportDir = path.join(repoRoot, 'reports', 'playwright');
const configPath = path.join(repoRoot, 'playwright.stage.config.ts');
const specDir = path.join(repoRoot, 'tests', 'playwright', 'specs');

function parseArgs(argv) {
    const args = {
        baseUrl: getStageBaseUrl(),
        reportDir,
        specDir
    };

    for (const entry of argv) {
        if (entry.startsWith('--base-url=')) {
            args.baseUrl = entry.slice('--base-url='.length);
        } else if (entry.startsWith('--report-dir=')) {
            args.reportDir = path.resolve(entry.slice('--report-dir='.length));
        } else if (entry.startsWith('--spec-dir=')) {
            args.specDir = path.resolve(entry.slice('--spec-dir='.length));
        }
    }

    return args;
}

async function probeStage(baseUrl) {
    try {
        const info = await fetchStagePublicInfo(baseUrl);
        return {
            reachable: true,
            startupWizardCompleted: Boolean(info?.StartupWizardCompleted),
            systemId: info?.Id || null,
            error: null
        };
    } catch (error) {
        return {
            reachable: false,
            startupWizardCompleted: null,
            systemId: null,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

function createSummaryBase(baseUrl, specCount) {
    return {
        title: 'MulletaFlix Playwright Summary',
        generatedAt: new Date().toISOString(),
        baseUrl,
        status: 'no-specs',
        specCount,
        tests: {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0
        },
        stageProbe: {
            reachable: false,
            startupWizardCompleted: null,
            systemId: null,
            error: null
        },
        stageChecks: {
            wizard: false,
            admin: false,
            user: false,
            login: false
        },
        assumptions: []
    };
}

function extractStats(rawReport) {
    const stats = rawReport?.stats || {};
    return {
        total: Number(stats.expected || 0) + Number(stats.unexpected || 0) + Number(stats.flaky || 0) + Number(stats.skipped || 0),
        passed: Number(stats.expected || 0),
        failed: Number(stats.unexpected || 0),
        skipped: Number(stats.skipped || 0),
        durationMs: Number(stats.duration || 0)
    };
}

async function loadRawReport(rawReportPath) {
    if (!existsSync(rawReportPath)) {
        return null;
    }

    return JSON.parse(await readFile(rawReportPath, 'utf8'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const rawReportPath = path.join(args.reportDir, 'raw-results.json');
    const specPatterns = [ '**/*.spec.ts', '**/*.spec.js', '**/*.spec.mjs' ];
    const specs = await fg(specPatterns, {
        cwd: args.specDir,
        absolute: true,
        onlyFiles: true
    });

    if (!specs.length) {
        const stageProbe = await probeStage(args.baseUrl || DEFAULT_STAGE_BASE_URL);
        const summary = createSummaryBase(args.baseUrl, specs.length);
        summary.stageProbe = stageProbe;
        summary.status = stageProbe.reachable ? 'no-specs' : 'probe-failed';
        summary.stageChecks.wizard = stageProbe.reachable && stageProbe.startupWizardCompleted === false;
        summary.assumptions = [
            'A suíte deve continuar mirando o stage limpo em http://127.0.0.1:8096 por padrão.',
            'Nenhum spec Playwright foi encontrado no diretório configurado.',
            stageProbe.reachable
                ? 'O stage respondeu ao probe do endpoint público.'
                : `Probe do stage falhou: ${stageProbe.error || 'erro desconhecido'}`,
            stageProbe.reachable
                ? `StartupWizardCompleted=${String(stageProbe.startupWizardCompleted)}`
                : 'Não foi possível confirmar o estado limpo do stage.'
        ];

        const { jsonPath, markdownPath } = await writePlaywrightReportArtifacts(summary, args.reportDir);
        console.log(`Relatório Playwright salvo em:\n- ${jsonPath}\n- ${markdownPath}`);
        process.exitCode = stageProbe.reachable ? 0 : 1;
        return;
    }

    const env = {
        ...process.env,
        PW_BASE_URL: args.baseUrl,
        PW_JSON_REPORT: rawReportPath
    };

    const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
        'playwright',
        'test',
        '--config',
        configPath
    ], {
        cwd: repoRoot,
        env,
        stdio: 'inherit'
    });

    const rawReport = await loadRawReport(rawReportPath);
    const stageProbe = await probeStage(args.baseUrl);

    const summary = {
        title: 'MulletaFlix Playwright Summary',
        generatedAt: new Date().toISOString(),
        baseUrl: args.baseUrl,
        status: result.status === 0 ? 'success' : 'failed',
        specCount: specs.length,
        tests: rawReport ? extractStats(rawReport) : {
            total: 0,
            passed: 0,
            failed: result.status === 0 ? 0 : 1,
            skipped: 0,
            durationMs: 0
        },
        stageProbe,
        stageChecks: {
            wizard: stageProbe.reachable && stageProbe.startupWizardCompleted === false,
            admin: stageProbe.reachable && stageProbe.startupWizardCompleted === true,
            user: stageProbe.reachable && stageProbe.startupWizardCompleted === true,
            login: stageProbe.reachable && stageProbe.startupWizardCompleted === true
        },
        assumptions: [
            'Os specs devem continuar separados do código de apoio em tests/playwright/specs.',
            'O runner usa o stage limpo em 127.0.0.1:8096 por padrão.',
            `StartupWizardCompleted=${String(stageProbe.startupWizardCompleted)}`,
            rawReport
                ? 'O relatório JSON cru do Playwright foi gerado e consolidado pelo runner.'
                : 'O relatório JSON cru do Playwright não foi encontrado; o resumo foi derivado do exit code.'
        ]
    };

    const { jsonPath, markdownPath } = await writePlaywrightReportArtifacts(summary, args.reportDir);
    console.log(`Relatório Playwright salvo em:\n- ${jsonPath}\n- ${markdownPath}`);

    process.exitCode = result.status === 0 && summary.tests.failed === 0 ? 0 : 1;
}

main().catch(async error => {
    const summary = {
        title: 'MulletaFlix Playwright Summary',
        generatedAt: new Date().toISOString(),
        baseUrl: getStageBaseUrl(),
        status: 'failed',
        specCount: 0,
        tests: {
            total: 0,
            passed: 0,
            failed: 1,
            skipped: 0,
            durationMs: 0
        },
        stageProbe: {
            reachable: false,
            startupWizardCompleted: null,
            systemId: null,
            error: error instanceof Error ? error.message : String(error)
        },
        stageChecks: {
            wizard: false,
            admin: false,
            user: false,
            login: false
        },
        assumptions: [
            `Runner failure: ${error instanceof Error ? error.message : String(error)}`
        ]
    };

    await writePlaywrightReportArtifacts(summary, reportDir);
    console.error(error);
    process.exitCode = 1;
});
