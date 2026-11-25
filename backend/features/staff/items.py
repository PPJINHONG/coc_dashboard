"""웹에서 정의하는 운영 인력 추가 열과 선택값 검증."""

from rest_framework.exceptions import ValidationError

from .dates import DATE_LABELS
from .models import StaffAssignment, StaffChoice, StaffColumn, StaffTableLayout

RESERVED_LABELS = {
    '이름', '리전', '도메인', '국가', '권역', '성명', '직책', '재직 상태', '현재 상태', '업무 투입일',
    '회사 퇴사일', '업무', 'PC IP', '오토에버 계정', 'Z 계정', '연결 회원', '현장대리인', *DATE_LABELS.values(),
}


def item_definitions():
    return [
        {
            'key': column.key,
            'label': column.label if column.label not in DATE_LABELS.values() else f'{column.label} (기존 추가 열)',
            'custom': True,
            'allow_free_text': column.allow_free_text,
            'column_id': column.pk,
            'position': column.position,
        }
        for column in StaffColumn.objects.all()
    ]


def column_order():
    keys = list(StaffColumn.objects.values_list('key', flat=True))
    layout = StaffTableLayout.objects.filter(pk=1).first() or StaffTableLayout()
    positions = {**layout.date_positions, 'staff_name': layout.name_position, 'country_code': layout.region_position}
    for position, key in sorted((position, key) for key, position in positions.items()):
        keys.insert(position, key)
    return keys + [key for key in DATE_LABELS if key not in keys]


def save_base_positions(keys):
    StaffTableLayout.objects.update_or_create(pk=1, defaults={
        'name_position': keys.index('staff_name'), 'region_position': keys.index('country_code'),
        'date_positions': {key: keys.index(key) for key in DATE_LABELS},
    })


def validate_custom_values(values, instance=None):
    if not isinstance(values, dict) or len(values) > 100:
        raise ValidationError({'custom_values': '추가 열은 100개 이하의 항목과 값으로 보내세요.'})
    columns = {column.key: column for column in StaffColumn.objects.all()}
    previous = instance.custom_values if instance else {}
    result = dict(previous)
    for key, value in values.items():
        column = columns.get(key)
        if column is None or not isinstance(value, str) or len(value) > 150:
            raise ValidationError({'custom_values': '등록된 추가 열과 150자 이하의 선택값을 사용하세요.'})
        value = value.strip()
        if value and value != previous.get(key) and not column.allow_free_text:
            if not StaffChoice.objects.filter(kind=key, value=value).exists():
                raise ValidationError({'custom_values': f'‘{column.label}’은 등록된 항목 값에서 선택하세요.'})
        if value:
            result[key] = value
        else:
            result.pop(key, None)
    return result


def choice_rows():
    return list(StaffChoice.objects.values('id', 'kind', 'value'))


def item_catalog():
    items = item_definitions()
    by_key = {item['key']: {} for item in items}
    for row in choice_rows():
        by_key[row['kind']][row['value']] = {'value': row['value'], 'choice_id': row['id'], 'uses': 0}
    for values in StaffAssignment.objects.values_list('custom_values', flat=True):
        for key, value in values.items():
            if key in by_key and value:
                entry = by_key[key].setdefault(value, {'value': value, 'choice_id': None, 'uses': 0})
                entry['uses'] += 1
    for item in items:
        item['values'] = sorted(by_key[item['key']].values(), key=lambda row: row['value'])
    return items + [{'key': key, 'label': label, 'custom': False, 'allow_free_text': False, 'values': []}
                    for key, label in DATE_LABELS.items()]
