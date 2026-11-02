from django.db import migrations, models


SQL = """
ALTER TABLE ops_regional_issues ADD COLUMN IF NOT EXISTS author_name varchar(150) DEFAULT '' NOT NULL;
ALTER TABLE ops_regional_issues ADD COLUMN IF NOT EXISTS author_username varchar(150) DEFAULT '' NOT NULL;
COMMENT ON COLUMN ops_regional_issues.author_name IS '화면에서 등록한 사용자 이름 (DB 관리 입력은 빈 값)';
COMMENT ON COLUMN ops_regional_issues.author_username IS '화면에서 등록한 사용자 아이디 (본인 수정·삭제 판단)';
"""


class Migration(migrations.Migration):
    dependencies = [('reporting', '0014_region_primary_key')]
    operations = [migrations.SeparateDatabaseAndState(
        # 신규 설치는 init SQL에 이미 열이 있으므로 IF NOT EXISTS로 양쪽을 맞춥니다.
        database_operations=[migrations.RunSQL(SQL)],
        state_operations=[
            migrations.AddField(model_name='regionalissue', name='author_name', field=models.CharField(blank=True, db_default='', default='', max_length=150)),
            migrations.AddField(model_name='regionalissue', name='author_username', field=models.CharField(blank=True, db_default='', default='', max_length=150)),
        ],
    )]
