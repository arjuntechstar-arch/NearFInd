import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './roles.js';
import { UserRole, type User } from '../entities/user.entity.js';

function contextFor(role: UserRole): ExecutionContext {
  const handler = () => undefined;
  Reflect.defineMetadata(ROLES_KEY, [UserRole.ADMIN], handler);
  const user = { role } as User;
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ currentUser: user }),
      getResponse: () => undefined,
      getNext: () => undefined,
    }),
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => ({ getData: () => undefined, getContext: () => undefined }),
    switchToWs: () => ({ getClient: () => undefined, getData: () => undefined, getPattern: () => undefined }),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

void describe('RolesGuard', () => {
  void it('allows an ADMIN for an ADMIN route', () => {
    const guard = new RolesGuard(new Reflector());
    assert.equal(guard.canActivate(contextFor(UserRole.ADMIN)), true);
  });

  void it('denies a USER for an ADMIN route', () => {
    const guard = new RolesGuard(new Reflector());
    assert.equal(guard.canActivate(contextFor(UserRole.USER)), false);
  });
});
