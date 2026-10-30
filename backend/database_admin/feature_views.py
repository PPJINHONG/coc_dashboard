from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from reporting.models import IssueComment
from reporting.services import bump, lock_state, record_log
from .services import log_change
from .views import AdminView, payload


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='first_name', max_length=150)
    password = serializers.CharField(write_only=True, required=False, min_length=8, max_length=128, trim_whitespace=False)

    class Meta:
        model = get_user_model()
        fields = ['id', 'name', 'username', 'email', 'is_staff', 'is_active', 'password', 'date_joined', 'last_login']
        read_only_fields = ['id', 'email', 'date_joined', 'last_login']
        extra_kwargs = {'username': {'validators': []}}

    def validate_username(self, value):
        value = value.strip().lower()
        if not (self.instance and self.instance.username == value == 'admin@admin'):
            serializers.EmailField(max_length=150).run_validation(value)
        users = get_user_model().objects.filter(Q(username__iexact=value) | Q(email__iexact=value))
        if self.instance:
            users = users.exclude(pk=self.instance.pk)
        if users.exists():
            raise serializers.ValidationError('이미 사용 중인 이메일 아이디입니다.')
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({'password': '새 계정의 비밀번호를 입력하세요.'})
        if self.instance and self.instance.pk == self.context['request'].user.pk:
            if attrs.get('is_active') is False or attrs.get('is_staff') is False:
                raise serializers.ValidationError('현재 로그인한 관리자의 활성 상태와 관리자 권한은 해제할 수 없습니다.')
        if self.instance and self.instance.is_superuser and (attrs.get('is_active') is False or attrs.get('is_staff') is False):
            raise serializers.ValidationError('최고 관리자 계정의 활성 상태와 권한은 유지해야 합니다.')
        if 'password' in attrs:
            candidate = get_user_model()(username=attrs.get('username', getattr(self.instance, 'username', '')), first_name=attrs.get('first_name', getattr(self.instance, 'first_name', '')))
            try:
                validate_password(attrs['password'], candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': exc.messages}) from exc
        return attrs

    def create(self, values):
        password = values.pop('password')
        return get_user_model().objects.create_user(**values, email=values['username'], password=password)

    def update(self, instance, values):
        password = values.pop('password', None)
        for key, value in values.items():
            setattr(instance, key, value)
        instance.email = instance.username
        if password is not None:
            instance.set_password(password)
        instance.save()
        if password is not None and instance.pk == self.context['request'].user.pk:
            update_session_auth_hash(self.context['request'], instance)
        return instance


class AccountsView(AdminView):
    def get(self, request):
        return Response(AccountSerializer(get_user_model().objects.order_by('id'), many=True).data)

    @transaction.atomic
    def post(self, request):
        state = lock_state()
        serializer = AccountSerializer(data=payload(request), context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            raise ValidationError('이미 사용 중인 아이디입니다.') from exc
        bump(state)
        log_change(request, 'insert', 'auth_user', {'changes': serializer.data})
        return Response(serializer.data, status=201)


class AccountView(AdminView):
    @transaction.atomic
    def patch(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        before = AccountSerializer(instance).data
        serializer = AccountSerializer(instance, data=payload(request), partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            raise ValidationError('이미 사용 중인 아이디입니다.') from exc
        bump(state)
        log_change(request, 'update', 'auth_user', {'before': before, 'changes': serializer.data, 'password_changed': 'password' in request.data})
        return Response(serializer.data)

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        if instance.pk == request.user.pk or instance.is_superuser:
            raise ValidationError('현재 로그인한 계정과 최고 관리자 계정은 삭제할 수 없습니다.')
        if str(payload(request).get('confirm_username', '')) != instance.username:
            raise ValidationError('삭제할 계정의 이메일 아이디를 확인하세요.')
        before = AccountSerializer(instance).data
        instance.delete()
        bump(state)
        log_change(request, 'delete', 'auth_user', {'before': before})
        return Response(status=204)


class AdminCommentSerializer(serializers.ModelSerializer):
    issue_title = serializers.CharField(source='issue.title', read_only=True)

    class Meta:
        model = IssueComment
        fields = ['id', 'issue', 'issue_title', 'author_name', 'author_username', 'content', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {'content': {'max_length': 5000}, 'author_name': {'allow_blank': False}}


class AdminCommentsView(AdminView):
    def get(self, request):
        return Response(AdminCommentSerializer(IssueComment.objects.select_related('issue').all(), many=True).data)

    @transaction.atomic
    def post(self, request):
        return self.save(request)

    @transaction.atomic
    def patch(self, request, pk):
        return self.save(request, pk)

    def save(self, request, pk=None):
        state = lock_state()
        instance = get_object_or_404(IssueComment, pk=pk) if pk is not None else None
        before = AdminCommentSerializer(instance).data if instance else {}
        serializer = AdminCommentSerializer(instance, data=payload(request), partial=instance is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        bump(state)
        record_log(request, 'issues', 'comment_update' if instance else 'comment', '관리자 댓글 저장', before=before, after=serializer.data)
        log_change(request, 'update' if instance else 'insert', 'ops_issue_comments', {'before': before, 'changes': serializer.data})
        return Response(serializer.data, status=200 if instance else 201)

    @transaction.atomic
    def delete(self, request, pk):
        state = lock_state()
        instance = get_object_or_404(IssueComment, pk=pk)
        before = AdminCommentSerializer(instance).data
        instance.delete()
        bump(state)
        record_log(request, 'issues', 'comment_delete', '관리자 댓글 삭제', before=before)
        log_change(request, 'delete', 'ops_issue_comments', {'before': before})
        return Response(status=204)
