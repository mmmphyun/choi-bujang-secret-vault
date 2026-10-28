import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStudentView, renderVulnerabilities, renderEvents, renderStatus, renderAction } from '../student/extension.mjs';

// 가상 경량 DOM 노드 구현
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this._textContent = '';
    this.eventListeners = {};
    this.className = '';
    this.id = '';
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map(c => c.textContent).join(' ');
    }
    return this._textContent;
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    const results = [];
    function search(node) {
      for (const child of node.children) {
        if (selector.startsWith('.') && child.className && child.className.includes(selector.slice(1))) {
          results.push(child);
        } else if (child.tagName === selector.toUpperCase()) {
          results.push(child);
        } else if (selector.startsWith('[') && selector.endsWith(']')) {
          const attr = selector.slice(1, -1);
          if (node.attributes.has(attr)) {
            results.push(node);
          }
        }
        search(child);
      }
    }
    search(this);
    return results;
  }

  querySelector(selector) {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }
}

// global document mock 설정
if (!globalThis.document) {
  globalThis.document = {
    createElement(tagName) {
      return new MockElement(tagName);
    },
    getElementById(id) {
      return null;
    },
    querySelector(selector) {
      return null;
    }
  };
}

test('1. student-source-changed: student/extension.mjs 파일 및 renderVulnerabilities export 확인', () => {
  const code = fs.readFileSync('student/extension.mjs', 'utf8');
  assert.ok(code.includes('export function renderVulnerabilities'), 'renderVulnerabilities 함수가 export 되어야 합니다.');
  
  const studentView = createStudentView();
  assert.equal(typeof studentView.renderVulnerabilities, 'function', 'createStudentView() 반환 객체에 renderVulnerabilities가 포함되어야 합니다.');
  assert.equal(typeof renderVulnerabilities, 'function', 'renderVulnerabilities가 독립 export 함수여야 합니다.');
});

test('2. exact_lock_version: package-lock.json 기록 버전과 정확히 일치하며 범위 기호가 없어야 함', () => {
  const container = new MockElement('div');
  const lockfile = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  const targetPkg = lockfile.packages['node_modules/@supabase/supabase-js'];
  const expectedVer = targetPkg.version; // e.g. "2.117.2"

  const mockData = {
    status: 'complete',
    lockfileVersion: lockfile.lockfileVersion,
    lockfileHash: 'sha256-abc123mock',
    checkedAt: '2026-10-28T03:00:00Z',
    packages: [
      {
        name: '@supabase/supabase-js',
        version: expectedVer,
        status: 'none_found',
        source: 'npm',
        checkedAt: '2026-10-28T03:00:00Z',
        vulnerabilities: []
      }
    ]
  };

  renderVulnerabilities({ status: 'ok', data: mockData }, container);

  const row = container.children[0].children[0].children[1].children[0];
  const pkgName = row.getAttribute('data-student-package-name');
  const pkgVer = row.getAttribute('data-student-package-version');

  assert.equal(pkgName, '@supabase/supabase-js', '패키지명이 정확히 일치해야 합니다.');
  assert.equal(pkgVer, expectedVer, '설치된 정확한 고정 버전이어야 합니다.');
  assert.ok(!pkgVer.startsWith('^') && !pkgVer.startsWith('~'), '버전 범위 기호(^, ~)가 포함되어서는 안 됩니다.');
  assert.ok(row.textContent.includes(expectedVer), '텍스트에도 정확한 버전이 포함되어야 합니다.');
});

test('3. osv_match: 패키지별 OSV 조회 결과 상태(known_vulnerabilities, none_found, unverifiable) 매핑 검증', () => {
  const container = new MockElement('div');
  const mockData = {
    status: 'complete',
    packages: [
      {
        name: 'pkg-known',
        version: '1.0.0',
        status: 'known_vulnerabilities',
        vulnerabilities: [{ id: 'GHSA-1234', modified: '2026-01-01' }]
      },
      {
        name: 'pkg-none',
        version: '2.0.0',
        status: 'none_found',
        vulnerabilities: []
      },
      {
        name: 'pkg-unverifiable',
        version: '3.0.0',
        status: 'unverifiable',
        vulnerabilities: []
      }
    ]
  };

  renderVulnerabilities({ status: 'ok', data: mockData }, container);
  const rows = container.children[0].children[0].children[1].children;

  assert.equal(rows.length, 3);
  assert.ok(rows[0].textContent.includes('알려진 항목 있음(known_vulnerabilities)'));
  assert.ok(rows[0].textContent.includes('GHSA-1234'));
  assert.ok(rows[1].textContent.includes('알려진 항목 없음(none_found)'));
  assert.ok(rows[2].textContent.includes('조회 확인 불가(unverifiable)'));
});

test('4. lookup_unavailable: not_configured, not_checked, unverifiable 미조회 상태 구분 표시', () => {
  const statuses = ['not_configured', 'not_checked', 'unverifiable'];
  for (const st of statuses) {
    const container = new MockElement('div');
    renderVulnerabilities({
      status: 'ok',
      data: { status: st, packages: [] }
    }, container);

    const text = container.textContent;
    assert.ok(text.includes(st), `data.status 원래 값(${st})이 노출되어야 합니다.`);
    if (st === 'not_configured') {
      assert.ok(text.includes('조회 준비 미완료') || text.includes('설정 필요'));
    }
    if (st === 'not_checked') {
      assert.ok(text.includes('아직 조회 안 함') || text.includes('승인된 공개 조회 대상 없음'));
    }
    if (st === 'unverifiable') {
      assert.ok(text.includes('lock 파일 확인 불가'));
    }
  }
});

test('5. no_results_distinction: none_found와 미조회/조회불가를 취약점 없음으로 왜곡하지 않음', () => {
  const container = new MockElement('div');
  renderVulnerabilities({
    status: 'ok',
    data: {
      status: 'complete',
      packages: [
        {
          name: 'safe-lib',
          version: '1.0.0',
          status: 'none_found',
          vulnerabilities: []
        }
      ]
    }
  }, container);

  const text = container.textContent;
  assert.ok(text.includes('조회 범위에서 알려진 항목이 없습니다'), 'none_found는 조회 범위 내에서 없다는 뜻으로 설명해야 합니다.');
  assert.ok(text.includes('OSV는 알려진 취약점 데이터베이스입니다'), 'OSV 안전 보장 한계 고지문이 포함되어야 합니다.');
});

test('6. partial_preservation: unverifiable 상태여도 vulnerabilities가 전달되면 취약점 ID 보존 및 부분확인 표기', () => {
  const container = new MockElement('div');
  const mockData = {
    status: 'partial',
    packages: [
      {
        name: 'partial-pkg',
        version: '1.2.3',
        status: 'unverifiable',
        vulnerabilities: [
          { id: 'CVE-2026-9999', modified: '2026-05-01T00:00:00Z' }
        ]
      }
    ]
  };

  renderVulnerabilities({ status: 'ok', data: mockData }, container);
  const row = container.children[0].children[0].children[1].children[0];

  assert.ok(row.textContent.includes('일부 확인·전체 조회 확인 불가(unverifiable)'), '부분 확인 및 조회 확인 불가 상태가 함께 표기되어야 합니다.');
  assert.ok(row.textContent.includes('CVE-2026-9999'), '수신된 취약점 ID는 삭제되지 않고 보존되어야 합니다.');
  assert.ok(row.textContent.includes('2026-05-01T00:00:00Z'), '수정 시각이 보존되어야 합니다.');
});

test('7. refresh_replaces & request_recovery: 새 응답이나 오류 복구 시 이전 결과 완전 초기화', () => {
  const container = new MockElement('div');

  // 1) 초기 오류 상태 렌더링
  renderVulnerabilities({
    status: 'error',
    error: { message: '네트워크 연결 실패' }
  }, container);
  assert.ok(container.textContent.includes('조회 실패: 네트워크 연결 실패'));

  // 2) 정상 응답으로 복구
  renderVulnerabilities({
    status: 'ok',
    data: {
      status: 'complete',
      packages: [{ name: 'lib-a', version: '1.0.0', status: 'none_found' }]
    }
  }, container);

  assert.ok(!container.textContent.includes('네트워크 연결 실패'), '이전 오류 메시지가 완전히 제거되어야 합니다.');
  assert.ok(container.textContent.includes('lib-a'), '새 결과가 정상 반영되어야 합니다.');
});

test('8. stale_response_blocked: loading 및 error 시 이전 표 잔존 차단', () => {
  const container = new MockElement('div');

  // 1) 먼저 ok 결과 렌더링
  renderVulnerabilities({
    status: 'ok',
    data: {
      status: 'complete',
      packages: [{ name: 'old-pkg', version: '0.1.0', status: 'none_found' }]
    }
  }, container);
  assert.ok(container.textContent.includes('old-pkg'));

  // 2) 로딩 상태 진입 시 이전 결과 잔존 차단
  renderVulnerabilities({ status: 'loading' }, container);
  assert.ok(!container.textContent.includes('old-pkg'), '로딩 중일 때 이전 패키지 결과가 남아있어서는 안 됩니다.');
  assert.ok(container.textContent.includes('조회 중(loading)'));

  // 3) idle 상태 진입 시에도 이전 결과 잔존 차단
  renderVulnerabilities({ status: 'idle' }, container);
  assert.ok(!container.textContent.includes('조회 중'), 'idle 전환 시 이전 로딩 문구가 제거되어야 합니다.');
  assert.ok(container.textContent.includes('조회 전(idle)'));
});

test('9. non_regression: 이전 단계 함수 회귀 검증', () => {
  const eventContainer = new MockElement('div');
  renderEvents({ status: 'ok', data: [] }, eventContainer);
  assert.ok(eventContainer.textContent.includes('기록이 없습니다'));

  const statusContainer = new MockElement('div');
  renderStatus({ devices: { status: 'ok', data: [] } }, statusContainer);
  assert.ok(statusContainer.textContent.length > 0);

  const actionEl = renderAction({ status: 'idle' });
  assert.ok(actionEl.textContent.includes('아직 미실행(idle)'));
});
