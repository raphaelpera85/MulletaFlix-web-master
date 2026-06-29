#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
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
const playwrightCli = path.join(repoRoot, 'node_modules', '@playwright', 'test', 'cli.js');
const workspaceRoot = path.resolve(repoRoot, '..');
const localAppDataRoot = process.env.LOCALAPPDATA || '';
const stageExe = path.join(workspaceRoot, 'stage', 'MulletaFlix.exe');
const stageDataDir = path.join(workspaceRoot, 'stage-data');
const legacyStageDataDir = path.join(workspaceRoot, 'stage', 'data', 'jellyfin-test');
const stageDatabaseTargets = [
    path.join(workspaceRoot, 'stage', 'data'),
    path.join(localAppDataRoot, 'MulletaFlix'),
    path.join(localAppDataRoot, 'jellyfin'),
    path.join(stageDataDir, 'data', 'mariadb_data'),
    path.join(stageDataDir, 'data', 'mariadb'),
    path.join(stageDataDir, 'config', 'system.xml'),
    path.join(legacyStageDataDir, 'data', 'mariadb_data'),
    path.join(legacyStageDataDir, 'data', 'mariadb'),
    path.join(legacyStageDataDir, 'config', 'system.xml')
];

function parseArgs(argv) {
    const args = {
        baseUrl: getStageBaseUrl(),
        reportDir,
        specDir,
        resetStage: process.env.PW_RESET_STAGE !== 'false'
    };

    for (const entry of argv) {
        if (entry.startsWith('--base-url=')) {
            args.baseUrl = entry.slice('--base-url='.length);
        } else if (entry.startsWith('--report-dir=')) {
            args.reportDir = path.resolve(entry.slice('--report-dir='.length));
        } else if (entry.startsWith('--spec-dir=')) {
            args.specDir = path.resolve(entry.slice('--spec-dir='.length));
        } else if (entry === '--no-reset-stage') {
            args.resetStage = false;
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function killStageProcess(imageName) {
    spawnSync('taskkill', [ '/IM', imageName, '/F' ], {
        windowsHide: true,
        stdio: 'ignore'
    });
}

async function removeTargets(targets) {
    for (const target of targets) {
        await rm(target, { recursive: true, force: true });
    }
}

async function resetStageWorkspace() {
    console.error('[playwright] resetting stage workspace');
    killStageProcess('MulletaFlix.exe');
    killStageProcess('mysqld.exe');
    await sleep(2000);
    await removeTargets(stageDatabaseTargets);
    await rm(stageDataDir, { recursive: true, force: true });
    await rm(legacyStageDataDir, { recursive: true, force: true });
    await mkdir(stageDataDir, { recursive: true });
}

async function startStageAndWaitClean(baseUrl) {
    console.error('[playwright] starting clean stage');
    const child = spawn(stageExe, [ `--datadir=${stageDataDir}` ], {
        windowsHide: true,
        stdio: 'ignore',
        detached: true
    });

    child.unref();

    for (let attempt = 1; attempt <= 120; attempt++) {
        const stageProbe = await probeStage(baseUrl);
        if (stageProbe.reachable) {
            if (stageProbe.startupWizardCompleted !== false) {
                throw new Error(`Stage is not clean after reset. StartupWizardCompleted=${String(stageProbe.startupWizardCompleted)}`);
            }

            console.error('[playwright] stage is clean');
            await sleep(10000);
            return stageProbe;
        }

        await sleep(2000);
    }

    throw new Error('Stage public info not available after clean start.');
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
    await rm(rawReportPath, { force: true });
    const specPatterns = [ '**/*.spec.ts', '**/*.spec.js', '**/*.spec.mjs' ];
    const specs = await fg(specPatterns, {
        cwd: args.specDir,
        absolute: true,
        onlyFiles: true
    });

    let initialStageProbe = null;
    if (args.resetStage) {
        await resetStageWorkspace();
        initialStageProbe = await startStageAndWaitClean(args.baseUrl || DEFAULT_STAGE_BASE_URL);
    }

    if (!specs.length) {
        const stageProbe = initialStageProbe || await probeStage(args.baseUrl || DEFAULT_STAGE_BASE_URL);
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

    const result = spawnSync(process.execPath, [
        playwrightCli,
        'test',
        '--config',
        configPath
    ], {
        cwd: repoRoot,
        env,
        stdio: 'inherit'
    });
    console.error(`[playwright] exit code: ${String(result.status)} signal=${String(result.signal || '')} error=${String(result.error?.message || '')}`);

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
            initialStageProbe
                ? `Stage inicial limpo confirmado com StartupWizardCompleted=${String(initialStageProbe.startupWizardCompleted)}`
                : 'Reset limpo do stage foi desabilitado para esta execuÃ§Ã£o.',
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
