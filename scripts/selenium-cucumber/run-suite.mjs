#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import fg from 'fast-glob';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const defaultReportDir = path.join(repoRoot, 'tests', 'selenium-cucumber', 'reports');
const defaultRawReport = path.join(defaultReportDir, 'raw-results.json');
const workspaceRoot = path.resolve(repoRoot, '..');
const localAppDataRoot = process.env.LOCALAPPDATA || '';
const stageExe = path.join(workspaceRoot, 'stage', 'MulletaFlix.exe');
const stageDataDir = path.join(workspaceRoot, 'stage-data');
const legacyStageDataDir = path.join(workspaceRoot, 'stage', 'data', 'jellyfin-test');
const localStageDataDir = path.join(localAppDataRoot, 'MulletaFlix');
const localJellyfinDataDir = path.join(localAppDataRoot, 'jellyfin');
const cucumberBin = path.join(repoRoot, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber-js');
const stageDatabaseTargets = [
    path.join(workspaceRoot, 'stage', 'data'),
    localStageDataDir,
    localJellyfinDataDir,
    path.join(stageDataDir, 'data', 'mariadb_data'),
    path.join(stageDataDir, 'data', 'mariadb'),
    path.join(stageDataDir, 'config', 'system.xml'),
    path.join(legacyStageDataDir, 'data', 'mariadb_data'),
    path.join(legacyStageDataDir, 'data', 'mariadb'),
    path.join(legacyStageDataDir, 'config', 'system.xml')
];

function parseArgs(argv) {
    const args = {
        reportDir: defaultReportDir,
        rawReportFile: defaultRawReport,
        summaryFile: path.resolve(repoRoot, '..', 'RELATORIO-SELENIUM-CUCUMBER.md'),
        baseUrl: process.env.STAGE_URL || 'http://127.0.0.1:8096'
    };

    for (const entry of argv) {
        if (entry.startsWith('--report-dir=')) {
            args.reportDir = path.resolve(entry.slice('--report-dir='.length));
        } else if (entry.startsWith('--raw-report=')) {
            args.rawReportFile = path.resolve(entry.slice('--raw-report='.length));
        } else if (entry.startsWith('--summary-file=')) {
            args.summaryFile = path.resolve(entry.slice('--summary-file='.length));
        } else if (entry.startsWith('--base-url=')) {
            args.baseUrl = entry.slice('--base-url='.length);
        }
    }

    return args;
}

async function ensureDir(filePath) {
    await mkdir(path.dirname(filePath), { recursive: true });
}

async function loadJson(filePath) {
    if (!existsSync(filePath)) {
        return null;
    }

    const content = await readFile(filePath, 'utf8');
    if (!content.trim()) {
        return null;
    }

    return JSON.parse(content);
}

async function loadJsonWithRetry(filePath, attempts = 20, delayMs = 500) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const parsed = await loadJson(filePath);
        if (parsed !== null) {
            return parsed;
        }

        if (attempt < attempts) {
            await sleep(delayMs);
        }
    }

    return null;
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

async function cleanupStageDatabase() {
    console.error('[selenium-cucumber] cleaning stage database artifacts');
    await removeTargets(stageDatabaseTargets);
}

async function resetStageWorkspace() {
    console.error('[selenium-cucumber] resetting stage workspace');
    killStageProcess('MulletaFlix.exe');
    killStageProcess('mysqld.exe');
    await sleep(2000);
    await cleanupStageDatabase();
    await rm(stageDataDir, { recursive: true, force: true });
    await rm(legacyStageDataDir, { recursive: true, force: true });
    await mkdir(stageDataDir, { recursive: true });
}

async function startStageAndWaitClean(baseUrl) {
    console.error('[selenium-cucumber] starting stage');
    const child = spawn(stageExe, [ `--datadir=${stageDataDir}` ], {
        windowsHide: true,
        stdio: 'ignore',
        detached: true
    });

    child.unref();

    const stageProbe = await probeStagePublicInfo(baseUrl, 120, 2000);
    if (stageProbe.StartupWizardCompleted !== false) {
        throw new Error(`Stage is not clean after reset. StartupWizardCompleted=${String(stageProbe.StartupWizardCompleted)}`);
    }

    console.error('[selenium-cucumber] stage is clean');
    await sleep(10000);

    return stageProbe;
}

async function probeStagePublicInfo(baseUrl, attempts = 30, delayMs = 1000) {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    let lastProbe = {
        StartupWizardCompleted: null,
        Id: null,
        error: 'Stage public info not available yet.'
    };

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch(`${normalizedBaseUrl}/System/Info/Public`, {
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const info = await response.json();
            if (typeof info?.StartupWizardCompleted !== 'undefined') {
                return info;
            }

            lastProbe = info;
        } catch (error) {
            lastProbe = {
                StartupWizardCompleted: null,
                Id: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }

        await sleep(delayMs);
    }

    return lastProbe;
}

function statsFromReport(raw) {
    const summary = {
        features: 0,
        scenarios: 0,
        steps: 0,
        passed: 0,
        failed: 0,
        skipped: 0
    };

    if (!Array.isArray(raw)) {
        return summary;
    }

    summary.features = raw.length;

    for (const feature of raw) {
        for (const element of feature.elements || []) {
            summary.scenarios += 1;
            for (const step of element.steps || []) {
                if (step.hidden) {
                    continue;
                }

                summary.steps += 1;
                const result = step.result?.status;
                if (result === 'passed') {
                    summary.passed += 1;
                } else if (result === 'failed') {
                    summary.failed += 1;
                } else if (result === 'skipped' || result === 'undefined' || result === 'pending') {
                    summary.skipped += 1;
                }
            }
        }
    }

    return summary;
}

async function writeSummary(summaryFile, summary) {
    const content = [
        '# Relatorio Selenium Cucumber',
        '',
        `## Conclusao`,
        '',
        summary.status === 'success'
            ? 'A execucao Selenium Cucumber passou no stage limpo e validou a trilha principal planejada.'
            : 'A execucao Selenium Cucumber falhou e precisa de ajuste antes de ser usada como regressao confiavel.',
        '',
        '### Resumo',
        '',
        `- Features: ${summary.stats.features}`,
        `- Cenarios: ${summary.stats.scenarios}`,
        `- Steps: ${summary.stats.steps}`,
        `- Passos aprovados: ${summary.stats.passed}`,
        `- Passos falhos: ${summary.stats.failed}`,
        `- Passos ignorados: ${summary.stats.skipped}`,
        `- Stage limpo: ${summary.stageClean ? 'sim' : 'nao'}`,
        `- StartupWizardCompleted: ${String(summary.startupWizardCompleted)}`,
        '',
        '### Conclusao Tecnica',
        '',
        summary.status === 'success'
            ? '- O runner consegue abrir wizard, admin e usuario comum a partir do stage limpo.'
            : '- Verifique o step que falhou e ajuste seletor, espera ou fluxo de navegacao.',
        '',
        '### Proximo Passo',
        '',
        summary.status === 'success'
            ? 'Expandir a suite para backend/API, BD e IPTV mantendo a mesma ordem de prioridade.'
            : 'Corrigir a falha atual antes de ampliar a cobertura.'
    ].join('\n');

    await ensureDir(summaryFile);
    await writeFile(summaryFile, content, 'utf8');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    console.error('[selenium-cucumber] runner started');
    await mkdir(args.reportDir, { recursive: true });
    await resetStageWorkspace();

    const cucumberJson = args.rawReportFile;
    const featureFiles = await fg('tests/selenium-cucumber/features/**/*.feature', {
        cwd: repoRoot,
        absolute: true,
        onlyFiles: true
    });
    const supportFiles = await fg([
        'tests/selenium-cucumber/support/world.js',
        'tests/selenium-cucumber/support/hooks.js',
        'tests/selenium-cucumber/steps/**/*.js'
    ], {
        cwd: repoRoot,
        absolute: true,
        onlyFiles: true
    });

    const stageProbe = await startStageAndWaitClean(args.baseUrl);
    console.error(`[selenium-cucumber] stage probe: StartupWizardCompleted=${String(stageProbe.StartupWizardCompleted)} Id=${String(stageProbe.Id || '')}`);

    if (!featureFiles.length) {
        await writeSummary(args.summaryFile, {
            status: 'failed',
            stageClean: true,
            startupWizardCompleted: stageProbe.StartupWizardCompleted,
            stats: statsFromReport(null)
        });
        console.error('No Selenium Cucumber feature files were found.');
        process.exitCode = 1;
        return;
    }

    const cucumberJsonFormatPath = path.relative(repoRoot, cucumberJson).replace(/\\/g, '/');
    const cucumberArgs = [
        ...supportFiles.flatMap(file => [ '--require', file ]),
        '--format', 'progress',
        '--format', `json:${cucumberJsonFormatPath}`,
        'tests/selenium-cucumber/features/**/*.feature'
    ];

    const env = {
        ...process.env,
        STAGE_URL: args.baseUrl,
        SELENIUM_CUCUMBER_RAW_REPORT: cucumberJson,
        SELENIUM_CUCUMBER_REPORT_DIR: args.reportDir
    };

    const result = spawnSync(process.execPath, [ cucumberBin, ...cucumberArgs ], {
        cwd: repoRoot,
        env,
        stdio: 'inherit'
    });
    console.error(`[selenium-cucumber] cucumber exit code: ${String(result.status)} signal=${String(result.signal || '')} error=${String(result.error?.message || '')}`);

    const rawReport = await loadJsonWithRetry(cucumberJson);

    const summary = {
        status: result.status === 0 ? 'success' : 'failed',
        stageClean: stageProbe.StartupWizardCompleted === false,
        startupWizardCompleted: stageProbe.StartupWizardCompleted,
        stats: statsFromReport(rawReport)
    };

    await writeSummary(args.summaryFile, summary);
    process.exitCode = result.status === 0 ? 0 : 1;
}

main().catch(async error => {
    console.error('[selenium-cucumber] fatal error:', error);
    const summaryFile = path.resolve(repoRoot, '..', 'RELATORIO-SELENIUM-CUCUMBER.md');
    await writeFile(summaryFile, [
        '# Relatorio Selenium Cucumber',
        '',
        '## Conclusao',
        '',
        `Falha ao executar a suite: ${error instanceof Error ? error.message : String(error)}`
    ].join('\n'), 'utf8');
    console.error(error);
    process.exitCode = 1;
});
