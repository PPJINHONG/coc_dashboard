"""명시적으로 연결한 회원·인력의 성명만 동기화합니다. 이름으로 계정을 연결하지 않습니다."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.exceptions import ValidationError

from reporting.models import ChangeLog, StaffMember
from .models import StaffAssignment


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
    if not raw:
        get_user_model().objects.filter(staff_profile__staff_id=instance.pk).update(first_name=instance.staff_name)


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
            get_user_model().objects.filter(staff_profile__staff_id=change['after']['id']).update(first_name=change['after']['staff_name'])
