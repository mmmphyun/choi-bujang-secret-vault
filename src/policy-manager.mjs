import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const BACKUP_POLICY_FILE = resolve(root, 'src', 'policy-backup.json');
const ACTIVE_POLICY_FILE = resolve(root, 'src', 'policy-active.json');

/**
 * 정책 객체의 표준 정렬 문자열 생성 및 SHA-256 해시 계산
 */
export function calculatePolicyHash(policyData) {
  const { integrityHash, ...payload } = policyData;
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * 안전 정책 사본 무결성 검증
 * 사본이 없거나 해시 검증에 실패하면 즉시 중단(throw)
 */
export function verifyBackupPolicy(backupFilePath = BACKUP_POLICY_FILE) {
  if (!existsSync(backupFilePath)) {
    throw new Error('안전 정책 사본 파일이 존재하지 않습니다. 복원을 중단합니다.');
  }

  let backup;
  try {
    backup = JSON.parse(readFileSync(backupFilePath, 'utf8'));
  } catch {
    throw new Error('안전 정책 사본 파일의 형식이 올바르지 않습니다.');
  }

  const expectedHash = backup.integrityHash;
  if (!expectedHash) {
    throw new Error('안전 정책 사본에 무결성 검증 해시가 없습니다. 복원을 중단합니다.');
  }

  const calculatedHash = calculatePolicyHash(backup);
  if (calculatedHash !== expectedHash) {
    throw new Error(`안전 정책 사본 무결성 검증 실패 (기대값: ${expectedHash}, 계산값: ${calculatedHash}). 복원을 중단합니다.`);
  }

  return backup;
}

/**
 * 현재 시험 정책과 검증된 안전 사본 간의 변경 사항(diff) 계산
 * 실제 운영 정책은 건드리지 않고 차이만 추출
 */
export function getPolicyDiff(activeFilePath = ACTIVE_POLICY_FILE, backupFilePath = BACKUP_POLICY_FILE) {
  const verifiedBackup = verifyBackupPolicy(backupFilePath);

  if (!existsSync(activeFilePath)) {
    throw new Error('현재 시험 정책 파일이 존재하지 않습니다.');
  }

  const current = JSON.parse(readFileSync(activeFilePath, 'utf8'));
  const diffs = [];

  // 버전 및 메타데이터 차이
  if (current.version !== verifiedBackup.version) {
    diffs.push({
      field: 'version',
      current: current.version,
      target: verifiedBackup.version,
      impact: '정책 버전 변경'
    });
  }

  // 접근 제어 규칙 차이 분석
  const backupAC = verifiedBackup.accessControl || {};
  const currentAC = current.accessControl || {};

  const allServices = new Set([...Object.keys(backupAC), ...Object.keys(currentAC)]);
  for (const service of allServices) {
    const backupServiceRules = backupAC[service] || {};
    const currentServiceRules = currentAC[service] || {};

    const allKeys = new Set([...Object.keys(backupServiceRules), ...Object.keys(currentServiceRules)]);
    for (const key of allKeys) {
      const currentVal = JSON.stringify(currentServiceRules[key]);
      const targetVal = JSON.stringify(backupServiceRules[key]);
      if (currentVal !== targetVal) {
        diffs.push({
          field: `accessControl.${service}.${key}`,
          current: currentServiceRules[key],
          target: backupServiceRules[key],
          impact: `${service} 서비스 ${key} 접근 권한을 사본 기준으로 복원`
        });
      }
    }
  }

  return {
    targetVersion: verifiedBackup.version,
    currentVersion: current.version,
    diffs,
    verifiedBackup
  };
}

/**
 * 검증된 안전 정책 사본으로 시험 정책을 되돌리는 복원 절차
 * 실행 전에 바뀔 항목을 확인하고 다른 서비스 규칙 및 감사 이력 보존
 */
export function restorePolicy(activeFilePath = ACTIVE_POLICY_FILE, backupFilePath = BACKUP_POLICY_FILE) {
  const { targetVersion, currentVersion, diffs, verifiedBackup } = getPolicyDiff(activeFilePath, backupFilePath);

  if (diffs.length === 0) {
    return {
      success: true,
      restored: false,
      message: '현재 시험 정책이 이미 검증된 사본과 동일합니다.',
      targetVersion,
      changes: []
    };
  }

  // 바뀔 항목 목록 준비 (실행 전 확인용)
  const previewChanges = diffs.map(d => ({
    field: d.field,
    from: d.current,
    to: d.target,
    impact: d.impact
  }));

  // 현재 정책의 감사 이력이나 확장 메타데이터는 보존
  const current = JSON.parse(readFileSync(activeFilePath, 'utf8'));
  const restoredPolicy = {
    ...verifiedBackup,
    auditTrail: current.auditTrail || [{ event: 'initial_compromised', at: current.updatedAt }],
    restoredAt: new Date().toISOString()
  };

  restoredPolicy.auditTrail.push({
    event: 'policy_restored_from_backup',
    fromVersion: currentVersion,
    toVersion: targetVersion,
    changesCount: diffs.length,
    at: restoredPolicy.restoredAt
  });

  writeFileSync(activeFilePath, JSON.stringify(restoredPolicy, null, 2) + '\n', 'utf8');

  return {
    success: true,
    restored: true,
    targetVersion,
    changes: previewChanges
  };
}
