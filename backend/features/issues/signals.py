from django.dispatch import receiver

from core.signals import username_changed

from .models import IssueComment, RegionalIssue


@receiver(username_changed)
def follow_username_change(sender, old_username, new_username, **kwargs):
    """본인 수정·삭제 판단이 끊기지 않도록 작성자 아이디를 새 아이디로 바꿉니다."""
    RegionalIssue.objects.filter(author_username__iexact=old_username).update(author_username=new_username)
    IssueComment.objects.filter(author_username__iexact=old_username).update(author_username=new_username)
