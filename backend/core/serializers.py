from rest_framework import serializers


# API 응답 구조를 정의하면 Swagger에도 같은 구조가 표시됩니다.
class TestRowSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    message = serializers.CharField()


class TestListSerializer(serializers.Serializer):
    results = TestRowSerializer(many=True)


class ErrorSerializer(serializers.Serializer):
    error = serializers.CharField()
