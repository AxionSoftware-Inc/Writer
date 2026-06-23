from django.core.exceptions import ValidationError
from django.db import models

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class Tag(models.Model):
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name

class Article(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True, null=True)
    content = models.TextField()
    summary = models.TextField(blank=True, null=True)
    author = models.CharField(max_length=100, blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='articles')
    tags = models.ManyToManyField(Tag, blank=True)
    cover_image = models.ImageField(upload_to='articles/images/', blank=True, null=True)
    views = models.PositiveIntegerField(default=0)
    read_time_minutes = models.PositiveIntegerField(default=5)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Book(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True, null=True)
    author = models.CharField(max_length=255)
    description = models.TextField()
    cover_image = models.ImageField(upload_to='books/covers/', blank=True, null=True)
    pdf_file = models.FileField(upload_to='books/pdfs/', blank=True, null=True)
    sample_pdf_file = models.FileField(upload_to='books/samples/', blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_free = models.BooleanField(default=False)
    pages = models.PositiveIntegerField(blank=True, null=True)
    language = models.CharField(max_length=50, default='O\'zbek')
    published_date = models.DateField(blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='books')
    tags = models.ManyToManyField(Tag, blank=True)
    views = models.PositiveIntegerField(default=0)
    downloads = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Course(models.Model):
    LEVEL_CHOICES = (
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Advanced', 'Advanced'),
    )

    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True, null=True)
    instructor = models.CharField(max_length=255)
    description = models.TextField()
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_free = models.BooleanField(default=False)
    level_type = models.CharField(max_length=50, choices=LEVEL_CHOICES, default='Beginner')
    duration_hours = models.DecimalField(max_digits=5, decimal_places=1, blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='courses')
    tags = models.ManyToManyField(Tag, blank=True)
    views = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class VisitorLog(models.Model):
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    path = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["timestamp"]),
            models.Index(fields=["path"]),
            models.Index(fields=["timestamp", "path"]),
        ]

    def __str__(self):
        return f"{self.ip_address} visited {self.path} at {self.timestamp}"
