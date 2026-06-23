from .models import VisitorLog

class VisitorTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        path = request.path or ""
        accept = request.META.get("HTTP_ACCEPT", "")
        is_html_request = "text/html" in accept
        is_trackable_path = not (
            path.startswith("/admin/")
            or path.startswith("/api/")
            or path.startswith("/media/")
            or path.startswith("/static/")
            or path.startswith("/_next/")
            or path == "/favicon.ico"
        )

        if request.method == "GET" and is_html_request and is_trackable_path:
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = x_forwarded_for.split(",")[0] if x_forwarded_for else request.META.get("REMOTE_ADDR")

            try:
                VisitorLog.objects.create(
                    ip_address=ip,
                    path=path[:255],
                    method=request.method,
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
                )
            except Exception:
                # Analytics logging should never break the request pipeline.
                pass
        
        return response
