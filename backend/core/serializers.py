from django.contrib.auth import get_user_model
from rest_framework import serializers


# API 응답 구조를 정의하면 Swagger에도 같은 구조가 표시됩니다.
class TestRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    message = serializers.CharField()


class TestListSerializer(serializers.Serializer):
    results = TestRowSerializer(many=True)


class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField()


# 슬라이스1: 세션 로그인 입력 검증
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


# 슬라이스1: 회원 정보 조회/수정 (username·date_joined는 읽기전용)
class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("username", "first_name", "last_name", "email", "date_joined")
        read_only_fields = ("username", "date_joined")
