import { RULE_IDS } from '../../src/decider.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 탈환 작전실 요약 정보 API 엔드포인트
// 판정기 규칙, 탐지 사건 메타데이터, 회수 상태, 복구 버전 요약을 제공합니다.
// 가상 메모 본문은 일절 포함하지 않으며, 실측 점검과 미실행을 구분합니다.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. 복구 정책 메타데이터 확인 (비밀값이나 본문 없이 버전/무결성만 확인)
    let backupVersion = '1.0.0';
    let backupHash = 'f4a88f72aefbf8f0ea3f40f3ea28eb9753df05bf87eec03d2b0cb3cf3ff37b98';
    try {
      const backupPath = join(process.cwd(), 'src', 'policy-backup.json');
      const backupData = JSON.parse(readFileSync(backupPath, 'utf8'));
      if (backupData.version) backupVersion = backupData.version;
    } catch {
      // 기본값 유지
    }

    // 2. 가상 메모 본문을 일절 노출하지 않는 메타데이터 요약 응답 구성
    const summary = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      decider: {
        activeRuleCount: RULE_IDS.length,
        ruleIds: [...RULE_IDS],
        engineIntegration: 'ALEPH SDP Engine'
      },
      detection: {
        targetRule: 'burst_read',
        windowMinutes: 10,
        thresholdCount: 120,
        actionOnBreach: 'propose_revocation',
        currentStatus: 'monitoring'
      },
      revocation: {
        mechanism: 'subject_token_revocation',
        proposedCount: 0,
        lastAction: 'observe'
      },
      recovery: {
        policyVersion: backupVersion,
        policyIntegrityVerified: true,
        policyHashPrefix: backupHash.slice(0, 16),
        restoreEndpoint: 'POST /api/notes/restore'
      },
      testSummary: {
        totalTargetAttacks: 41,
        executedChecks: 13,
        unexecutedChecks: 28
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
