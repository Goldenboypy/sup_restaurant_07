import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse


class ViteProxyMiddleware:
    """Serve the built React SPA from Django and fall back to the Vite dev server only when needed."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.dist_dir = Path(settings.BASE_DIR).parent / "guest-app" / "dist"
        self.index_file = self.dist_dir / "index.html"

    def __call__(self, request):
        if self._should_serve_spa(request):
            return self._serve_spa_or_asset(request)
        return self.get_response(request)

    def _should_serve_spa(self, request):
        path = request.path or "/"
        if request.method not in {"GET", "HEAD"}:
            return False
        if path in {"/", "/index.html"}:
            return False
        if path.startswith(("/api/", "/admin/", "/static/", "/ws/", "/media/")):
            return False
        if path.startswith(("/__", "/src/", "/@vite/", "/node_modules/")):
            return False
        return True

    def _serve_spa_or_asset(self, request):
        path = request.path or "/"

        if self.index_file.exists():
            if path in {"/", "/index.html"} or path.startswith(("/shop", "/login", "/cart", "/orders", "/checkout", "/products", "/categories")):
                return self._build_response(self.index_file, "text/html; charset=utf-8")

            candidate = self.dist_dir / path.lstrip("/")
            if candidate.exists() and candidate.is_file():
                content_type, _ = mimetypes.guess_type(str(candidate))
                if not content_type:
                    content_type = "application/octet-stream"
                return self._build_response(candidate, content_type)

            return self._build_response(self.index_file, "text/html; charset=utf-8")

        try:
            import requests
            vite_url = f"http://localhost:5173{path}"
            vite_response = requests.get(vite_url, timeout=3)
            if vite_response.status_code == 200:
                return HttpResponse(
                    vite_response.content,
                    content_type=vite_response.headers.get("content-type", "text/html; charset=utf-8"),
                    status=200,
                )
        except Exception:
            pass

        return self.get_response(request)

    def _build_response(self, file_path: Path, content_type: str):
        content = file_path.read_bytes()
        return HttpResponse(content, content_type=content_type)
