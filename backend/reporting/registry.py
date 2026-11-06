"""앱별 feature.py에 적은 내용을 모아 공통 API가 사용합니다.

각 앱(공통 앱·기능 앱)의 feature.py에 `FEATURE = Feature(...)`를 두면 아래 공통 기능에 자동으로 반영됩니다.
공통 파일에 기능 이름을 나열하지 않으므로 두 사람이 서로 다른 기능을 추가해도 같은 파일을 고치지 않습니다.

- sections: 현재값 조회(/api/operations/current/)와 관리자 일괄 저장(/api/db-admin/sections/<key>/)
- totals: 현재값 응답의 합계(totals)에 더할 값
- tables: DB 관리 > DB 원본에서 읽기 전용으로 보여 줄 테이블과 이름
- tabs: 개인 탭 숨김(/api/navigation/preferences/)을 허용할 화면 탭 ID
"""

from dataclasses import dataclass, field
from functools import cache
from importlib import import_module
from typing import Callable

from django.apps import apps


@dataclass(frozen=True)
class Section:
    """관리자 일괄 저장과 현재값 조회에 쓰는 기능별 현재값 테이블."""

    key: str  # API와 화면에서 쓰는 이름. 화면 기능 폴더 이름과 같게 둡니다(예: resources).
    model: type
    serializer: type
    # 같은 값이면 한 행으로 보는 열 조합. 비우면 id 없는 행은 항상 새로 추가합니다.
    unique_fields: tuple = ()
    related: tuple = ()  # 조회할 때 함께 불러올 연결 데이터(select_related)
    prefetch: tuple = ()  # 조회할 때 미리 불러올 하위 목록(prefetch_related)

    def rows(self):
        queryset = self.model.objects.all()
        if self.related:
            queryset = queryset.select_related(*self.related)
        if self.prefetch:
            queryset = queryset.prefetch_related(*self.prefetch)
        return queryset


@dataclass(frozen=True)
class Feature:
    tabs: tuple = ()
    tables: dict = field(default_factory=dict)
    sections: tuple = ()
    totals: Callable[[], dict] | None = None


@cache
def features():
    found = []
    for config in apps.get_app_configs():
        name = f"{config.name}.feature"
        try:
            module = import_module(name)
        except ModuleNotFoundError as exc:
            if exc.name != name:
                raise
            continue
        found.append(module.FEATURE)
    return tuple(found)


def sections():
    return {section.key: section for feature in features() for section in feature.sections}


def hideable_tabs():
    return tuple(tab for feature in features() for tab in feature.tabs)


def table_labels():
    return {name: label for feature in features() for name, label in feature.tables.items()}


def totals():
    result = {}
    for feature in features():
        if feature.totals:
            result.update(feature.totals())
    return result
