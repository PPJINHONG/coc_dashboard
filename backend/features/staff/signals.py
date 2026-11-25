"""명시적으로 연결한 회원·인력의 성명만 동기화합니다. 이름으로 계정을 연결하지 않습니다."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save, pre_delete
from django.db.models.deletion import ProtectedError
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError

from reporting.models import ChangeLog, StaffMember
from .models import StaffAssignment, StaffColumn


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def account_name_changed(sender, instance, raw=False, **kwargs):
    if raw or not instance.first_name:
        return
    member_ids = StaffAssignment.objects.filter(account_id=instance.pk).values_list('staff_id', flat=True)
    if len(instance.first_name) > 100 and member_ids.exists():
        raise ValidationError('운영 인력과 연결된 회원의 성명은 100자 이하로 입력하세요.')
    StaffMember.objects.filter(pk__in=member_ids).update(staff_name=instance.first_name)


@receiver(post_save, sender=StaffMember)
def staff_name_changed(sender, instance, raw=False, **kwargs):
    if raw:
        return
    for account in get_user_model().objects.filter(staff_profile__staff_id=instance.pk):
        old_username = account.username
        account.first_name = instance.staff_name
        account.username = instance.staff_name
        account.save(update_fields=['first_name', 'username'])
        if old_username != account.username:
            from core.signals import username_changed
            username_changed.send(sender=type(account), old_username=old_username, new_username=account.username)


@receiver(post_save, sender=StaffAssignment)
def account_link_changed(sender, instance, raw=False, **kwargs):
    if raw or not instance.account_id or not instance.account.first_name:
        return
    name = instance.account.first_name
    if len(name) > 100:
        raise ValidationError('연결할 회원의 성명은 100자 이하로 입력하세요.')
    StaffMember.objects.filter(pk=instance.staff_id).update(staff_name=name)
    instance.staff.staff_name = name


@receiver(post_save, sender=ChangeLog)
def restored_staff_name(sender, instance, created, **kwargs):
    if not created or instance.section != 'staff' or instance.action != 'restore':
        return
    for change in instance.restore_data.get('changes', []):
        if change.get('model') == StaffMember._meta.label_lower and change.get('after'):
            name = change['after']['staff_name']
            for account in get_user_model().objects.filter(staff_profile__staff_id=change['after']['id']):
                old_username = account.username
                account.first_name = name
                account.username = name
                account.save(update_fields=['first_name', 'username'])
                if old_username != name:
                    from core.signals import username_changed
                    username_changed.send(sender=type(account), old_username=old_username, new_username=name)


@receiver(pre_delete, sender=StaffColumn)
def protect_used_column(sender, instance, **kwargs):
    if StaffAssignment.objects.filter(custom_values__has_key=instance.key).exists():
        raise ProtectedError('인력에 값이 저장된 추가 열은 제거할 수 없습니다.', [instance])
