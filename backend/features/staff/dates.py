from rest_framework.exceptions import ValidationError


DATE_LABELS = {
    'hire_date': '입사일',
    'resignation_date': '퇴사일',
    'deployment_date': '업무 투입일',
    'assignment_end_date': '업무 종료일',
}


def validate_staff_dates(values, instance):
    dates = {key: values.get(key, getattr(instance, key, None)) for key in DATE_LABELS}
    for key in ('hire_date', 'deployment_date'):
        if dates[key] is None and (instance is None or key in values and getattr(instance, key) is not None):
            raise ValidationError({key: f'{DATE_LABELS[key]}을 선택하세요.'})
    for start, end in [('hire_date', 'resignation_date'), ('deployment_date', 'assignment_end_date'),
                       ('deployment_date', 'resignation_date')]:
        if dates[start] and dates[end] and dates[start] > dates[end]:
            raise ValidationError({end: f'{DATE_LABELS[end]}은 {DATE_LABELS[start]}보다 빠를 수 없습니다.'})
