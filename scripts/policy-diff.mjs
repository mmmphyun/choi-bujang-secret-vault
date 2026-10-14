import { getPolicyDiff } from '../src/policy-manager.mjs';

try {
  const result = getPolicyDiff();
  console.log('=== 안전 정책 사본 대조 결과 ===');
  console.log(`복원 대상 버전: ${result.targetVersion} (현재 버전: ${result.currentVersion})`);
  console.log(`변경 대상 항목 수: ${result.diffs.length}개\n`);

  if (result.diffs.length === 0) {
    console.log('차이 없음: 현재 시험 정책이 검증된 사본과 일치합니다.');
  } else {
    console.log('--- 변경 예정 항목 및 범위 ---');
    for (const d of result.diffs) {
      console.log(`[${d.field}]`);
      console.log(`  현재값: ${JSON.stringify(d.current)}`);
      console.log(`  복원값: ${JSON.stringify(d.target)}`);
      console.log(`  영향:   ${d.impact}`);
    }
  }
} catch (error) {
  console.error(`안전 정책 대조 실패: ${error.message}`);
  process.exit(1);
}
