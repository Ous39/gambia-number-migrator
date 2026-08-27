import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireAdminAreaAccess } from '../src/middleware/auth';
import { websiteContentRouter } from '../src/routes/websiteContent';
import { inquiriesRouter } from '../src/routes/inquiries';
import { uploadsRouter } from '../src/routes/uploads';

function checkAccess(role: string, path: string, method = 'GET') {
  const req = { admin: { adminId: '1', username: role, role }, method, path } as Request;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn() as NextFunction;
  requireAdminAreaAccess(req, { status, json } as unknown as Response, next);
  return { status, next };
}

describe('communications role RBAC', () => {
  it('allows communications to read and manage website content', () => {
    expect(checkAccess('communications', '/website-content').next).toHaveBeenCalledOnce();
    expect(checkAccess('communications', '/website-content/announcements', 'POST').next).toHaveBeenCalledOnce();
  });

  it('allows communications to read and resolve enquiries', () => {
    expect(checkAccess('communications', '/inquiries').next).toHaveBeenCalledOnce();
    expect(checkAccess('communications', '/inquiries/some-id', 'PATCH').next).toHaveBeenCalledOnce();
  });

  it('denies communications access to payments and operators', () => {
    expect(checkAccess('communications', '/payments').status).toHaveBeenCalledWith(403);
    expect(checkAccess('communications', '/operators', 'POST').status).toHaveBeenCalledWith(403);
  });

  it('denies finance and support access to website content', () => {
    expect(checkAccess('finance', '/website-content').status).toHaveBeenCalledWith(403);
    expect(checkAccess('support', '/website-content').status).toHaveBeenCalledWith(403);
  });

  it('allows communications to upload a team photo but denies finance/support', () => {
    expect(checkAccess('communications', '/uploads/team-photo', 'POST').next).toHaveBeenCalledOnce();
    expect(checkAccess('finance', '/uploads/team-photo', 'POST').status).toHaveBeenCalledWith(403);
    expect(checkAccess('support', '/uploads/team-photo', 'POST').status).toHaveBeenCalledWith(403);
  });

  it('lets communications update an existing team member', () => {
    expect(checkAccess('communications', '/website-content/team/some-id', 'PUT').next).toHaveBeenCalledOnce();
  });
});

describe('public content and inquiry routes stay public', () => {
  it('mounts /public-content without an admin prefix', () => {
    const routes = (websiteContentRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => layer.route.path);
    expect(routes).toContain('/public-content');
    expect(routes.every((path: string) => path === '/public-content' || path.startsWith('/admin/'))).toBe(true);
  });

  it('mounts the public inquiry POST route outside /admin', () => {
    const routes = (inquiriesRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toContainEqual({ path: '/inquiries', methods: { post: true } });
    expect(routes).toContainEqual({ path: '/admin/inquiries', methods: { get: true } });
    expect(routes).toContainEqual({ path: '/admin/inquiries/:id', methods: { patch: true } });
  });

  it('exposes a full update route for team members alongside the active-toggle route', () => {
    const routes = (websiteContentRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toContainEqual({ path: '/admin/website-content/team/:id', methods: { put: true } });
    expect(routes).toContainEqual({ path: '/admin/website-content/team/:id', methods: { patch: true } });
  });

  it('mounts the team photo upload route under /admin', () => {
    const routes = (uploadsRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toContainEqual({ path: '/admin/uploads/team-photo', methods: { post: true } });
  });
});
