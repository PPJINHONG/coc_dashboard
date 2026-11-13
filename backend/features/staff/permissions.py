from core.roles import can_write, can_manage_members, staff_edit_countries, user_role

JOB_TITLES = ['책임', '그룹장', '팀장', '관리자']


def title_level(title):
    # 기존 자유 입력 직책은 일반 인력으로 유지합니다.
    return JOB_TITLES.index(title) if title in JOB_TITLES else 0


def editor_level(user):
    return {'admin': 3, 'team_lead': 2, 'group_lead': 1}.get(user_role(user), -1)


def can_manage_person(user, person):
    target_level = max(title_level(person.job_title), editor_level(person.account) if person.account_id else 0)
    return person.country_code in staff_edit_countries(user) and target_level <= editor_level(user)


def can_edit_person(user, person):
    return can_manage_person(user, person) or owns_profile(user, person)


def owns_profile(user, person):
    return bool(can_write(user) and user.is_active and person.account_id == user.pk)


def can_view_grade(user):
    return can_manage_members(user)
