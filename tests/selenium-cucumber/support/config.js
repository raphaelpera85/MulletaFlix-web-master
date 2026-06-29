const path = require('node:path');

const ROOT_URL = (process.env.STAGE_URL || process.env.PW_BASE_URL || 'http://127.0.0.1:8096').replace(/\/+$/, '');

module.exports = {
    ROOT_URL,
    ADMIN_USER: process.env.MFLX_ADMIN_USER || 'Raphael',
    ADMIN_PASSWORD: process.env.MFLX_ADMIN_PASSWORD || 'Bug309c*',
    COMMON_USER: process.env.MFLX_COMMON_USER || 'mflx-user',
    COMMON_PASSWORD: process.env.MFLX_COMMON_PASSWORD || 'User@12345',
    MOVIES_PATH: process.env.MFLX_MOVIES_PATH || 'D:\\Users\\Raphael\\Videos\\Filmes',
    SERIES_PATH: process.env.MFLX_SERIES_PATH || 'D:\\Users\\Raphael\\Videos\\Series',
    IPTV_PATH: process.env.MFLX_IPTV_PATH || 'D:\\Users\\Raphael\\Documents\\Projetos\\m3u\\canais.m3u8',
    REPORT_DIR: process.env.SELENIUM_CUCUMBER_REPORT_DIR
        || path.join(process.cwd(), 'tests', 'selenium-cucumber', 'reports'),
    RAW_REPORT_FILE: process.env.SELENIUM_CUCUMBER_RAW_REPORT
        || path.join(process.cwd(), 'tests', 'selenium-cucumber', 'reports', 'raw-results.json'),
    HEADLESS: process.env.SELENIUM_HEADLESS !== 'false'
};
