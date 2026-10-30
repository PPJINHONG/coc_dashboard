import uuid

from django.db import models


class DatabaseChangeLog(models.Model):
    change_key = models.UUIDField(default=uuid.uuid4, unique=True)
    action = models.CharField(max_length=30)
    table_name = models.CharField(max_length=63)
    actor_username = models.CharField(max_length=150)
    details = models.JSONField(default=dict, db_default={})
    sql_text = models.TextField(blank=True, default='', db_default='')
    created_at = models.DateTimeField(auto_now_add=True, db_default=models.functions.Now())

    class Meta:
        db_table = 'db_admin_change_logs'
        ordering = ['-id']
