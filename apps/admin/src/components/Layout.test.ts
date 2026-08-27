import { describe, expect, it } from 'vitest';
import { allowedNavPaths, navAreasByRole } from './Layout';

const allPaths = ['/', '/operators', '/rules', '/transition', '/payments', '/support-devices', '/notifications', '/website-content', '/inquiries', '/app-config', '/audit', '/team'];

describe('role-based navigation', () => {
  it('gives owner, admin, and viewer every section', () => {
    for (const role of ['owner', 'admin', 'viewer']) {
      expect(allowedNavPaths(role, allPaths)).toEqual(allPaths);
    }
  });

  it('limits operations to migration/notification/config sections', () => {
    expect(allowedNavPaths('operations', allPaths).sort()).toEqual(
      ['/', '/operators', '/rules', '/transition', '/notifications', '/app-config'].sort()
    );
  });

  it('limits finance to dashboard and payments only', () => {
    expect(allowedNavPaths('finance', allPaths)).toEqual(['/', '/payments']);
  });

  it('limits support to dashboard, devices, and notifications', () => {
    expect(allowedNavPaths('support', allPaths).sort()).toEqual(['/', '/support-devices', '/notifications'].sort());
  });

  it('limits communications to the public website content, enquiries, and notifications', () => {
    expect(allowedNavPaths('communications', allPaths).sort()).toEqual(
      ['/', '/website-content', '/inquiries', '/notifications'].sort()
    );
    expect(allowedNavPaths('communications', allPaths)).not.toContain('/payments');
    expect(allowedNavPaths('communications', allPaths)).not.toContain('/operators');
  });

  it('hides audit logs and team access from every non-owner role', () => {
    for (const role of Object.keys(navAreasByRole).filter((role) => role !== 'owner' && role !== 'admin' && role !== 'viewer')) {
      expect(allowedNavPaths(role, allPaths)).not.toContain('/audit');
      expect(allowedNavPaths(role, allPaths)).not.toContain('/team');
    }
  });

  it('falls back to viewer-level (full) visibility for an unrecognized role', () => {
    expect(allowedNavPaths('unknown-role', allPaths)).toEqual(allPaths);
  });
});
