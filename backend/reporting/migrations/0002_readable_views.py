from django.db import migrations

SQL = """
CREATE OR REPLACE VIEW report_infrastructure_by_week AS
SELECT w.week_start, r.region_code, r.region_name, s.service_code, s.service_name,
       w.zone_name, w.host_count, w.vm_count, w.compute_rack_count, w.storage_rack_count,
       w.remarks, w.updated_at
FROM infra_weekly_resources w
JOIN ops_regions r ON r.region_code = w.region_code
JOIN ops_services s ON s.service_code = w.service_code
WHERE w.is_included;

CREATE OR REPLACE VIEW report_staff_by_week AS
SELECT a.week_start, r.region_code, r.region_name, m.staff_code, m.staff_name,
       a.role, a.company_name, a.status, a.work_mode, a.remarks
FROM ops_weekly_staff_assignments a
JOIN ops_regions r ON r.region_code = a.region_code
JOIN ops_staff_members m ON m.id = a.staff_member_id
WHERE a.is_included;

CREATE OR REPLACE VIEW report_work_by_week AS
SELECT w.week_start, r.region_code, r.region_name, w.work_type, w.scope,
       w.total_count, w.completed_count, w.total_count - w.completed_count AS pending_count,
       CASE WHEN w.total_count > 0 THEN ROUND(100.0 * w.completed_count / w.total_count, 1) END AS completion_percent,
       w.batch_count, w.delayed_count, w.mttr_minutes, w.remarks
FROM ops_weekly_work_summaries w
JOIN ops_regions r ON r.region_code = w.region_code
WHERE w.is_included;

COMMENT ON TABLE ops_regions IS '공통 리전 기준정보: KR상암·KR광주·KR가산 및 추가 리전';
COMMENT ON TABLE ops_services IS '공통 서비스 기준정보: Hcloud, CCS 등';
COMMENT ON TABLE ops_staff_members IS '공통 운영 인력 기준정보: 로그인 계정과 별개';
COMMENT ON TABLE report_weeks IS '보고 기간: 월요일 week_start, 작성중/확정, 동시 편집 버전';
COMMENT ON TABLE infra_weekly_resources IS '주별 리전·서비스·존 자산 스냅샷: Host·VM·Compute/Storage 랙';
COMMENT ON TABLE k8s_weekly_clusters IS '주별 리전·서비스·플랫폼 클러스터·노드 수량';
COMMENT ON TABLE ops_weekly_staff_assignments IS '주별 인력 배치: 리전·역할·소속사·근무 상태';
COMMENT ON TABLE ops_weekly_work_summaries IS '주별 요청·변경·장애 건수: 비율과 미완료 수량은 조회 시 계산';
COMMENT ON TABLE ops_issues IS '주를 넘어 이어지는 이슈 식별자';
COMMENT ON TABLE ops_weekly_issue_updates IS '주별 이슈 내용·리전·중요도·상태·진행률·담당자';
COMMENT ON TABLE ops_issue_comments IS '선택한 주의 이슈에 달린 댓글';
COMMENT ON TABLE ops_change_logs IS 'UI 변경 감사 이력: 주·기능·작성자·변경 전후 데이터';
"""


class Migration(migrations.Migration):
    dependencies = [('reporting', '0001_initial')]
    operations = [migrations.RunSQL(SQL, reverse_sql='DROP VIEW IF EXISTS report_work_by_week; DROP VIEW IF EXISTS report_staff_by_week; DROP VIEW IF EXISTS report_infrastructure_by_week;')]
