-- 가상 메모 테이블 생성 (학습용 Supabase)
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  owner_id uuid,
  created_at timestamptz default now()
);

-- RLS 활성화 (anon 및 authenticated 역할에 select 정책을 부여하지 않아 차단)
alter table notes enable row level security;

-- 가상 메모 4건 삽입
insert into notes (title, content) values
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록');

-- 5단계: PUBLIC, anon, authenticated 직접 권한 전면 회수 (서버리스 함수 service_role만 허용)
revoke all on table notes from public;
revoke all on table notes from anon;
revoke all on table notes from authenticated;

