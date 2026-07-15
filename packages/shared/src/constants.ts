import type { PublishedRulesPayload } from './types';

export const API_BASE_URL = 'http://localhost:8089/api';
export const ADMIN_PORT = 5173;
export const API_PORT = 8089;
export const POSTGRES_PORT = 5434;
export const APP_NAME = 'Gambia Number Migrator';

export const DEFAULT_RULES_PAYLOAD: PublishedRulesPayload = {
  versionNumber: 0,
  publishedAt: 'offline-unavailable',
  operators: [
    { id: 'offline-qcell', name: 'QCell', code: 'QCELL', newPrefix: '83', color: '#6E3482', status: 'active', notes: 'PURA Phase 1 operator configuration.' },
    { id: 'offline-comium', name: 'Comium', code: 'COMIUM', newPrefix: '86', color: '#A56ABD', status: 'active', notes: 'PURA Phase 1 operator configuration.' },
    { id: 'offline-africell', name: 'Africell', code: 'AFRICELL', newPrefix: '87', color: '#49225B', status: 'active', notes: 'PURA Phase 1 operator configuration.' }
  ],
  rules: []
};
