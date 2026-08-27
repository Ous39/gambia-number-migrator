import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireAdminAreaAccess } from '../src/middleware/auth';
import { operatorsRouter } from '../src/routes/operators';

function checkAccess(role: string, method: string) {
  const req = { admin: { adminId: '1', username: role, role }, method, path: '/operators' } as Request;
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const next = vi.fn() as NextFunction;
  requireAdminAreaAccess(req, { status, json } as unknown as Response, next);
  return { status, next };
}

describe('operator management RBAC', () => {
  it.each(['POST', 'PUT', 'DELETE'])('denies viewer %s mutations', (method) => {
    const result = checkAccess('viewer', method);
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });

  it.each(['POST', 'PUT', 'DELETE'])('denies finance %s mutations', (method) => {
    const result = checkAccess('finance', method);
    expect(result.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });

  it.each(['operations', 'admin', 'owner'])('allows %s to manage operators', (role) => {
    expect(checkAccess(role, 'POST').next).toHaveBeenCalledOnce();
  });

  it('keeps only GET public and mounts mutations below /admin', () => {
    const routes = (operatorsRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toContainEqual({ path: '/operators', methods: { get: true } });
    expect(routes.filter((route: any) => route.methods.post || route.methods.put || route.methods.delete))
      .toEqual([
        { path: '/admin/operators', methods: { post: true } },
        { path: '/admin/operators/:id', methods: { put: true } },
        { path: '/admin/operators/:id', methods: { delete: true } },
      ]);
  });
});

describe('support device access', () => {
  it.each(['GET', 'POST', 'PUT', 'DELETE'])('allows support %s access to device administration', (method) => {
    const req = { admin: { adminId: '1', username: 'support', role: 'support' }, method, path: '/devices/device-1' } as Request;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const next = vi.fn() as NextFunction;
    requireAdminAreaAccess(req, { status, json } as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});
