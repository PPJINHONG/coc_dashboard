import uuid

from django.core.signing import BadSignature
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import NavigationPreference

HIDEABLE_TABS = ('report', 'resources', 'staff', 'work', 'issues', 'logs')
COOKIE = 'coc_navigation'
COOKIE_SALT = 'coc-navigation-browser'


class PreferenceSerializer(serializers.ModelSerializer):
    hidden_tabs = serializers.ListField(child=serializers.ChoiceField(choices=HIDEABLE_TABS), max_length=len(HIDEABLE_TABS), required=False)

    class Meta:
        model = NavigationPreference
        fields = ['hidden_tabs', 'sidebar_collapsed']

    def validate_hidden_tabs(self, values):
        return list(dict.fromkeys(values))


@method_decorator(csrf_protect, name='dispatch')
@method_decorator(ensure_csrf_cookie, name='dispatch')
class NavigationPreferenceView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def get(self, request):
        return self.respond(request)

    @transaction.atomic
    def patch(self, request):
        return self.respond(request, save=True)

    def respond(self, request, save=False):
        try:
            browser_key = uuid.UUID(request.get_signed_cookie(COOKIE, salt=COOKIE_SALT))
        except (KeyError, BadSignature, ValueError):
            browser_key = uuid.uuid4()
        if request.user.is_authenticated:
            previous = NavigationPreference.objects.filter(browser_key=browser_key).first()
            defaults = {'hidden_tabs': previous.hidden_tabs, 'sidebar_collapsed': previous.sidebar_collapsed} if previous else {}
            preference, _ = NavigationPreference.objects.get_or_create(user=request.user, defaults=defaults)
        else:
            preference, _ = NavigationPreference.objects.get_or_create(browser_key=browser_key)
        preference = NavigationPreference.objects.select_for_update().get(pk=preference.pk)
        serializer = PreferenceSerializer(preference, data=request.data if save else {}, partial=True)
        if save:
            serializer.is_valid(raise_exception=True)
            serializer.save()
        response = Response(PreferenceSerializer(preference).data)
        response['Cache-Control'] = 'private, no-store'
        response.set_signed_cookie(COOKIE, str(browser_key), salt=COOKIE_SALT, max_age=365 * 24 * 3600, httponly=True, samesite='Lax', secure=request.is_secure())
        return response
