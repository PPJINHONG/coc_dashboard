from core.roles import can_write, is_admin

JOB_TITLES = ['책임', '그룹장', '팀장', '관리자']


def title_level(title):
    return JOB_TITLES.index(title) if title in JOB_TITLES else 0


def editor_level(user):
    return 3 if is_admin(user) else -1


def can_manage_person(user, person):
    return is_admin(user)


def can_edit_person(user, person):
    return can_manage_person(user, person) or owns_profile(user, person)


def owns_profile(user, person):
    return bool(can_write(user) and user.is_active and person.account_id == user.pk)
