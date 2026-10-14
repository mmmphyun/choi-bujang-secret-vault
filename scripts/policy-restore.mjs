import { restorePolicy } from '../src/policy-manager.mjs';

try {
  console.log('=== 안전 정책 사본 복원 절차 시작 ===');
  const result = restorePolicy();

  console.log(`복원 대상 버전: ${result.targetVersion}`);
  if (!result.restored) {
    console.log(result.message);
  } else {
    console.log(`성공적으로 복원된 항목: ${result.changes.length}개`);
    for (const change of result.changes) {
      console.log(`- ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)} (${change.impact})`);
    }
    console.log('\n정책 복원 완료: B의 A 자료 요청은 다시 거부(403)되며 A 정상 요청은 유지됩니다.');
  }
} catch (error) {
  console.error(`안전 정책 복원 실패: ${error.message}`);
  process.exit(1);
}
