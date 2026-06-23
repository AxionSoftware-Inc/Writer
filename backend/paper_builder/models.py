from django.db import models
from django.utils import timezone
from django.utils.text import slugify

class ScientificPaper(models.Model):
    DOCUMENT_KIND_CHOICES = [
        ("paper", "Paper"),
        ("book", "Book"),
        ("report", "Report"),
    ]

    title = models.CharField(max_length=500, blank=True, null=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True, null=True)
    abstract = models.TextField(blank=True, null=True)
    content = models.TextField(blank=True, null=True)
    authors = models.CharField(max_length=500, blank=True, null=True)
    keywords = models.CharField(max_length=500, blank=True, null=True)
    document_kind = models.CharField(max_length=50, choices=DOCUMENT_KIND_CHOICES, default="paper")
    branding_enabled = models.BooleanField(default=True)
    branding_label = models.CharField(max_length=160, blank=True, default="Powered by MathSphere Writer")
    article = models.OneToOneField(
        "application.Article",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_paper",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=50, default='draft', choices=[('draft', 'Draft'), ('published', 'Published')])

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title or "Untitled Paper"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        update_fields: list[str] = []

        if not self.slug:
            self.slug = self.build_slug()
            update_fields.append("slug")

        if self.status == "published":
            article = self.sync_public_article()
            if article and self.article_id != article.id:
                self.article = article
                update_fields.append("article")
            if self.published_at is None:
                self.published_at = timezone.now()
                update_fields.append("published_at")
        elif self.article_id:
            if self.article.is_published:
                self.article.is_published = False
                self.article.save()
            if self.published_at is not None:
                self.published_at = None
                update_fields.append("published_at")

        if update_fields:
            super().save(update_fields=update_fields)

    def build_slug(self) -> str:
        base = slugify(self.title or "untitled-paper") or "untitled-paper"
        return f"paper-{self.pk}-{base}"[:255]

    def build_branding_colophon(self) -> str:
        if not self.branding_enabled:
            return ""

        label = (self.branding_label or "Powered by MathSphere Writer").strip()
        return f"_{label}_" if label else ""

    def append_branding(self, content: str) -> str:
        trimmed = (content or "").strip()
        colophon = self.build_branding_colophon()

        if not colophon:
            return trimmed

        if not trimmed:
            return colophon

        return f"{trimmed}\n\n---\n\n{colophon}"

    def build_compiled_content(self) -> str:
        sections = list(self.sections.order_by("order", "id"))
        if not sections:
            return self.append_branding(self.content or "")

        chunks: list[str] = []
        for section in sections:
            section_content = (section.content or "").strip()
            if not section_content:
                continue

            if section.title and not section_content.lstrip().startswith("#"):
                chunks.append(f"## {section.title}\n\n{section_content}")
            else:
                chunks.append(section_content)

        return self.append_branding("\n\n---\n\n".join(chunks))

    def get_public_article_slug(self) -> str:
        base = slugify(self.title or "scientific-paper") or "scientific-paper"
        return f"journal-paper-{self.pk}-{base}"[:255]

    def estimate_read_time_minutes(self) -> int:
        words = len((self.content or "").split())
        return max(1, round(words / 200)) if words else 1

    def sync_public_article(self):
        from application.models import Article

        article = self.article or Article()
        article.title = (self.title or "Untitled Paper").strip()
        article.slug = self.get_public_article_slug()
        article.content = self.build_compiled_content() or (self.content or "").strip()
        article.summary = (self.abstract or "").strip() or None
        article.author = (self.authors or "").strip() or None
        # Project assignment removed as Project model was deleted
        article.read_time_minutes = self.estimate_read_time_minutes()
        article.is_published = self.status == "published"
        article.save()
        return article


class ScientificPaperSection(models.Model):
    SECTION_KIND_CHOICES = [
        ("frontmatter", "Frontmatter"),
        ("chapter", "Chapter"),
        ("section", "Section"),
        ("appendix", "Appendix"),
        ("references", "References"),
    ]
    PROGRESS_STATE_CHOICES = [
        ("todo", "Todo"),
        ("drafting", "Drafting"),
        ("done", "Done"),
    ]

    paper = models.ForeignKey(ScientificPaper, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, blank=True)
    kind = models.CharField(max_length=50, choices=SECTION_KIND_CHOICES, default="section")
    progress_state = models.CharField(max_length=20, choices=PROGRESS_STATE_CHOICES, default="todo")
    order = models.PositiveIntegerField(default=1)
    content = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]
        constraints = [
            models.UniqueConstraint(fields=["paper", "slug"], name="unique_paper_section_slug"),
        ]

    def __str__(self):
        return f"{self.paper_id}::{self.title}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self.build_slug()
        super().save(*args, **kwargs)

    def build_slug(self) -> str:
        base = slugify(self.title or "section") or "section"
        if self.paper_id:
            return f"{base}-{self.paper_id}-{self.order}"[:255]
        return f"{base}-{self.order}"[:255]


class PaperLaboratoryUsage(models.Model):
    paper = models.ForeignKey(ScientificPaper, on_delete=models.CASCADE, related_name="laboratory_usages")
    saved_result = models.ForeignKey("laboratory.SavedLaboratoryResult", on_delete=models.CASCADE, related_name="paper_usages")
    block_id = models.CharField(max_length=120)
    module_slug = models.SlugField(max_length=64)
    section_path = models.CharField(max_length=500, blank=True, default="")
    imported_revision = models.PositiveIntegerField(default=1)
    synced_revision = models.PositiveIntegerField(default=1)
    linked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-linked_at"]
        constraints = [
            models.UniqueConstraint(fields=["paper", "block_id"], name="unique_paper_lab_block_usage"),
        ]

    def __str__(self):
        return f"paper={self.paper_id} block={self.block_id} result={self.saved_result_id}"
