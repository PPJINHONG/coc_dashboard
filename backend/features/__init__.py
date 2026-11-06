"""기능별 Django 앱 모음.

이 폴더 아래에 apps.py가 있는 폴더를 만들면 INSTALLED_APPS(config/settings.py)와
/api/ 주소(config/urls.py)에 자동으로 등록됩니다. 기능을 추가할 때 공통 설정 파일을 고치지 않습니다.
"""

from pathlib import Path


def discover():
    """기능 앱 모듈 이름(예: features.resources)을 폴더 이름순으로 돌려줍니다."""
    base = Path(__file__).resolve().parent
    return [f"features.{path.name}" for path in sorted(base.iterdir()) if (path / "apps.py").is_file()]
