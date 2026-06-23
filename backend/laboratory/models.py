import uuid
import hashlib
import json

from django.db import models

class LaboratoryModule(models.Model):
    CATEGORY_CHOICES = (
        ("matrix", "Matrix"),
        ("integral", "Integral"),
        ("differential", "Differential"),
        ("analysis", "Analysis"),
        ("geometry", "Geometry"),
        ("custom", "Custom"),
    )

    COMPUTATION_MODE_CHOICES = (
        ("client", "Client"),
        ("hybrid", "Hybrid"),
        ("server", "Server"),
    )

    title = models.CharField(max_length=120)
    slug = models.SlugField(unique=True)
    summary = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="custom")
    icon_name = models.CharField(max_length=64, default="FlaskConical")
    accent_color = models.CharField(max_length=32, default="blue")
    computation_mode = models.CharField(
        max_length=16,
        choices=COMPUTATION_MODE_CHOICES,
        default="client",
    )
    estimated_minutes = models.PositiveIntegerField(default=10)
    sort_order = models.PositiveIntegerField(default=0)
    is_enabled = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "title"]

    def __str__(self):
        return self.title


class SavedLaboratoryResult(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    module_slug = models.SlugField(max_length=64, db_index=True)
    module_title = models.CharField(max_length=120)
    mode = models.CharField(max_length=64, blank=True, default="")
    title = models.CharField(max_length=180)
    summary = models.CharField(max_length=255, blank=True, default="")
    report_markdown = models.TextField()
    input_snapshot = models.JSONField(default=dict, blank=True)
    structured_payload = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    revision = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.module_slug}: {self.title}"


class LaboratorySolveJob(models.Model):
    STATUS_CHOICES = (
        ("queued", "Queued"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancel_requested", "Cancel requested"),
        ("cancelled", "Cancelled"),
    )

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    module = models.CharField(max_length=64, db_index=True)
    operation = models.CharField(max_length=64, default="solve")
    payload = models.JSONField(default=dict)
    payload_hash = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="queued", db_index=True)
    progress = models.PositiveSmallIntegerField(default=0)
    estimated_runtime_ms = models.PositiveIntegerField(default=0)
    timeout_ms = models.PositiveIntegerField(default=30000)
    result = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True, default="")
    cache_hit = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)
    cancel_requested = models.BooleanField(default=False)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["module", "payload_hash", "status"]),
        ]

    @staticmethod
    def hash_payload(payload: dict) -> str:
        encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def __str__(self):
        return f"{self.module}:{self.operation}:{self.status}:{self.public_id}"


class LaboratoryEventLog(models.Model):
    EVENT_CHOICES = (
        ("saved_result_created", "Saved result created"),
        ("saved_result_updated", "Saved result updated"),
        ("solve_job_created", "Solve job created"),
        ("solve_job_completed", "Solve job completed"),
        ("solve_job_failed", "Solve job failed"),
        ("solve_job_cancelled", "Solve job cancelled"),
        ("ai_explain_requested", "AI explain requested"),
        ("ai_explain_failed", "AI explain failed"),
    )

    event_type = models.CharField(max_length=64, choices=EVENT_CHOICES, db_index=True)
    module = models.CharField(max_length=64, blank=True, default="", db_index=True)
    object_public_id = models.UUIDField(null=True, blank=True, db_index=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["module", "created_at"]),
        ]

    def __str__(self):
        return f"{self.event_type}:{self.module}:{self.object_public_id}"
