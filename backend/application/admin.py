from django.contrib import admin
from .models import Category, Tag, Article, Book, Course, VisitorLog

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'views', 'is_published', 'created_at')
    list_filter = ('is_published', 'category', 'created_at')
    search_fields = ('title', 'content', 'author')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'price', 'is_free', 'views', 'downloads', 'is_published')
    list_filter = ('is_published', 'is_free', 'category', 'language')
    search_fields = ('title', 'author', 'description')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('title', 'instructor', 'level_type', 'price', 'is_free', 'views', 'is_published')
    list_filter = ('is_published', 'is_free', 'level_type', 'category')
    search_fields = ('title', 'instructor', 'description')
    prepopulated_fields = {'slug': ('title',)}

@admin.register(VisitorLog)
class VisitorLogAdmin(admin.ModelAdmin):
    list_display = ('ip_address', 'path', 'method', 'timestamp')
    list_filter = ('method', 'timestamp')
    search_fields = ('ip_address', 'path')

    def has_add_permission(self, request):
        return False
    def has_change_permission(self, request, obj=None):
        return False
