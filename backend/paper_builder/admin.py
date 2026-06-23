from django.contrib import admin
from .models import ScientificPaper, ScientificPaperSection


class ScientificPaperSectionInline(admin.TabularInline):
    model = ScientificPaperSection
    extra = 0
    ordering = ("order", "id")

@admin.register(ScientificPaper)
class ScientificPaperAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'document_kind', 'status', 'article', 'published_at', 'created_at', 'updated_at')
    list_filter = ('document_kind', 'status', 'published_at', 'created_at')
    search_fields = ('title', 'authors', 'slug')
    inlines = [ScientificPaperSectionInline]
