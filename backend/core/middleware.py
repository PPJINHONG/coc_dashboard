from django.http import JsonResponse

from .security import FORCE_CHANGE_MESSAGE, must_change_password


class ForcePasswordChangeMiddleware:
    ALLOWED_PATHS = {
        "/api/app-config/",
        "/api/auth/csrf/",
        "/api/auth/login/",
        "/api/auth/logout/",
        "/api/auth/password/",
        "/api/me/",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.path.startswith("/api/")
            and request.path not in self.ALLOWED_PATHS
            and must_change_password(request.user)
        ):
            return JsonResponse({"detail": FORCE_CHANGE_MESSAGE}, status=403)
        return self.get_response(request)
