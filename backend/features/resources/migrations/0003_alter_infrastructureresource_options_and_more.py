"""인프라 서비스 외래키를 자유 입력 문자열로 바꾸고 기존 표시 이름을 보존합니다.

서비스 테이블을 제거하기 전에 자원 행의 서비스 코드를 기존 서비스 이름으로 옮깁니다.
과거 자원 복구 원본도 service_id에서 service 문자열로 바꿉니다.
"""
from django.db import migrations, models


def convert_payload(value, names):
    if isinstance(value, list):
        return [convert_payload(item, names) for item in value]
    if not isinstance(value, dict):
        return value
    result = {key: convert_payload(item, names) for key, item in value.items()}
    if "service_id" in result:
        service = result.pop("service_id")
        result["service"] = names.get(str(service), service)
    elif "service" in result:
        service = result["service"]
        result["service"] = names.get(str(service), service)
    return result


def preserve_service_names(apps, schema_editor):
    Resource = apps.get_model("resources", "InfrastructureResource")
    Service = apps.get_model("reporting", "Service")
    ChangeLog = apps.get_model("reporting", "ChangeLog")
    names = {
        str(service.service_code): service.service_name
        for service in Service.objects.all()
    }

    changed = [(code, name) for code, name in names.items() if code != name]
    temporary = {}
    for index, (code, _name) in enumerate(changed):
        marker = f"__service_name_move_{index}__"
        temporary[marker] = names[code]
        Resource.objects.filter(service=code).update(service=marker)
    for marker, name in temporary.items():
        Resource.objects.filter(service=marker).update(service=name)

    for log in ChangeLog.objects.filter(section="resources").iterator():
        before = convert_payload(log.before_data, names)
        after = convert_payload(log.after_data, names)
        restore = convert_payload(log.restore_data, names)
        fields = []
        if before != log.before_data:
            log.before_data = before
            fields.append("before_data")
        if after != log.after_data:
            log.after_data = after
            fields.append("after_data")
        if restore != log.restore_data:
            log.restore_data = restore
            fields.append("restore_data")
        if fields:
            log.save(update_fields=fields)


class Migration(migrations.Migration):

    dependencies = [
        ("reporting", "0020_change_log_restore"),
        ("resources", "0002_monthly_period"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="infrastructureresource",
            options={"ordering": ["-period_month", "region_id", "service", "id"]},
        ),
        migrations.AlterModelTableComment(
            name="infrastructureresource",
            table_comment="월별 인프라 자원: 기준 월·리전·자유 입력 서비스별 Host·VM·Compute Rack·Storage Rack 수량",
        ),
        migrations.AlterField(
            model_name="infrastructureresource",
            name="service",
            field=models.CharField(max_length=80),
        ),
        migrations.RunPython(preserve_service_names, migrations.RunPython.noop),
    ]
