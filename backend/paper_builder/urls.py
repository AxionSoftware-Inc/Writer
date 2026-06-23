from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ScientificPaperViewSet

router = DefaultRouter()
router.register(r'papers', ScientificPaperViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
