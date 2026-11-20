"""운영 인력의 고정 항목·사용자 추가 열 정의와 입력 검증."""
from rest_framework.exceptions import ValidationError

from .models import StaffAssignment, StaffChoice, StaffColumn

BASE_GRADES = ('L1', 'L2', 'L3', 'L4')
RESERVED_LABELS = {'도메인', '국가', '권역', '성명', '직책', '소속사', '재직 상태', '현재 상태', '업무 투입일',
                   '회사 퇴사일', '등급', '업무', '근무지', 'PC IP', '오토에버 계정', 'Z 계정', '연결 회원', '현장대리인'}


def item_definitions(with_grade=False):
    result = [{'key': 'work_location', 'label': '근무지', 'scoped': True, 'custom': False},
              {'key': 'company_name', 'label': '소속사', 'scoped': False, 'custom': False}]
    if with_grade:
        result.append({'key': 'grade', 'label': '등급', 'scoped': False, 'custom': False})
    result.extend({'key': column.key, 'label': column.label, 'scoped': False, 'custom': True}
                  for column in StaffColumn.objects.all())
    return result


def validate_custom_values(values, instance=None):
    if not isinstance(values, dict) or len(values) > 100:
        raise ValidationError({'custom_values': '추가 열은 100개 이하의 항목과 값으로 보내세요.'})
    known = set(StaffColumn.objects.values_list('key', flat=True))
    previous = instance.custom_values if instance else {}
    result = dict(previous)
    for key, value in values.items():
        if key not in known or not isinstance(value, str) or len(value) > 150:
            raise ValidationError({'custom_values': '등록된 추가 열과 150자 이하의 선택값을 사용하세요.'})
        value = value.strip()
        if value and value != previous.get(key) and not StaffChoice.objects.filter(kind=key, value=value).exists():
            raise ValidationError({'custom_values': '추가 열의 값은 등록된 항목에서 선택하세요.'})
        if value:
            result[key] = value
        else:
            result.pop(key, None)
    return result


def known_item_values(kind):
    if kind.startswith('custom_'):
        return [{'value': row.custom_values[kind], 'country_code': ''}
                for row in StaffAssignment.objects.filter(custom_values__has_key=kind)
                if row.custom_values.get(kind)]
    if kind in ('company_name', 'work_location', 'grade'):
        return list(StaffAssignment.objects.exclude(**{kind: ''}).values('country_code', kind))
    return []


def choice_rows(with_grade=False):
    rows = StaffChoice.objects.all()
    if not with_grade:
        rows = rows.exclude(kind='grade')
    return list(rows.values('id', 'kind', 'country_code', 'value'))


def item_catalog(with_grade=False):
    result = item_definitions(with_grade)
    configured = choice_rows(with_grade)
    for item in result:
        values = {}
        for row in configured:
            if row['kind'] == item['key']:
                values[(row['country_code'], row['value'])] = {'value': row['value'], 'country_code': row['country_code'],
                                                             'choice_id': row['id'], 'uses': 0, 'default': False}
        if item['key'] == 'grade':
            for value in BASE_GRADES:
                entry = values.setdefault(('', value), {'value': value, 'country_code': '', 'choice_id': None, 'uses': 0})
                entry['default'] = True
        for row in known_item_values(item['key']):
            value = row.get('value', row.get(item['key']))
            country = row.get('country_code', '') if item['scoped'] else ''
            entry = values.setdefault((country, value), {'value': value, 'country_code': country,
                                                        'choice_id': None, 'uses': 0, 'default': False})
            entry['uses'] += 1
        item['values'] = sorted(values.values(), key=lambda row: (row['country_code'], row['value']))
    return result
