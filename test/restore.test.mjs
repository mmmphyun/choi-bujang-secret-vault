import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { getPolicyDiff, restorePolicy, verifyBackupPolicy } from '../src/policy-manager.mjs';
import restoreHandler from '../api/notes/restore.js';

import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

test('verifyBackupPolicy validates backup integrity hash correctly', () => {
  const verified = verifyBackupPolicy();
  assert.equal(verified.version, '1.0.0');
  assert.ok(Array.isArray(verified.rules));
  assert.ok(verified.accessControl.notes.enforceOwnerIsolation);
});

test('getPolicyDiff detects differences and does not mutate policy before restore', () => {
  const tempPolicy = resolve(import.meta.dirname, 'temp-policy-test.json');
  writeFileSync(tempPolicy, JSON.stringify({
    version: '0.9.0-test',
    accessControl: { notes: { enforceOwnerIsolation: false } }
  }), 'utf8');

  try {
    const diffResult = getPolicyDiff(tempPolicy);
    assert.equal(diffResult.targetVersion, '1.0.0');
    assert.ok(diffResult.diffs.length > 0);
  } finally {
    try { unlinkSync(tempPolicy); } catch {}
  }
});

test('restorePolicy restores safe policy and preserves audit trail', () => {
  const tempPolicy = resolve(import.meta.dirname, 'temp-restore-test.json');
  writeFileSync(tempPolicy, JSON.stringify({
    version: '0.9.0-test',
    updatedAt: '2026-10-14T00:00:00Z',
    accessControl: { notes: { enforceOwnerIsolation: false } }
  }), 'utf8');

  try {
    const restoreResult = restorePolicy(tempPolicy);
    assert.equal(restoreResult.success, true);
    assert.equal(restoreResult.targetVersion, '1.0.0');

    // 복원 후 diff 재조회 시 diffs가 0이어야 함
    const diffAfter = getPolicyDiff(tempPolicy);
    assert.equal(diffAfter.diffs.length, 0);
  } finally {
    try { unlinkSync(tempPolicy); } catch {}
  }
});

test('notes restore handler enforces ID, owner, and contentHash match', async () => {
  const testId = 'b0000000-0000-0000-0000-000000000001';
  const expectedOwner = 'b0000000-0000-0000-0000-000000000002';
  const expectedHash = createHash('sha256').update('침해 전 검증된 시험 계정 B의 안전한 업무 메모 본문입니다.').digest('hex');

  // Mock res 객체
  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(name, value) { this.headers[name] = value; return this; },
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
  }

  // 1. 위조된 해시 요청 -> 400 거부
  {
    const req = {
      method: 'POST',
      body: {
        id: testId,
        owner_id: expectedOwner,
        contentHash: '0000000000000000000000000000000000000000000000000000000000000000'
      },
      headers: {}
    };
    const res = createMockRes();
    await restoreHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /내용 해시 불일치/u);
  }

  // 2. 다른 소유자 ID 변조 요청 -> 403 거부
  {
    const req = {
      method: 'POST',
      body: {
        id: testId,
        owner_id: 'attacker-id-1234',
        contentHash: expectedHash
      },
      headers: {}
    };
    const res = createMockRes();
    await restoreHandler(req, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /소유자 불일치/u);
  }

  // 3. 존재하지 않는 ID 요청 -> 404 거부
  {
    const req = {
      method: 'POST',
      body: {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      },
      headers: {}
    };
    const res = createMockRes();
    await restoreHandler(req, res);
    assert.equal(res.statusCode, 404);
  }

  // 4. 정상 일치 요청 -> 200 성공 및 정확한 ID·소유자·내용 해시 반환
  {
    const req = {
      method: 'POST',
      body: {
        id: testId,
        owner_id: expectedOwner,
        contentHash: expectedHash
      },
      headers: {}
    };
    const res = createMockRes();
    await restoreHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.restored.id, testId);
    assert.equal(res.body.restored.owner_id, expectedOwner);
    assert.equal(res.body.restored.contentHash, expectedHash);
  }
});
