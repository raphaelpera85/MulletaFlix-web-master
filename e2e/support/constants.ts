export const STAGE_URL = process.env.STAGE_URL || 'http://127.0.0.1:8096';

export const TEST_USERS = {
    admin: {
        name: process.env.MFLX_ADMIN_USER || 'Raphael',
        password: process.env.MFLX_ADMIN_PASSWORD || 'Bug309c*'
    },
    common: {
        name: process.env.MFLX_COMMON_USER || 'mflx-user',
        password: process.env.MFLX_COMMON_PASSWORD || 'User@12345'
    }
} as const;

export const TEST_LIBRARY = {
    movies: process.env.MFLX_MOVIES_PATH || 'D:\\Users\\Raphael\\Videos\\Filmes',
    series: process.env.MFLX_SERIES_PATH || 'D:\\Users\\Raphael\\Videos\\Series',
    iptv: process.env.MFLX_IPTV_PATH || 'D:\\Users\\Raphael\\Documents\\Projetos\\m3u\\canais.m3u8'
} as const;
