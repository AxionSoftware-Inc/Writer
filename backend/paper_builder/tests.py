import json

from rest_framework import status
from rest_framework.test import APITestCase

from application.models import Article
from laboratory.models import SavedLaboratoryResult
from paper_builder.models import PaperLaboratoryUsage, ScientificPaper


class ScientificPaperApiTests(APITestCase):
    def test_published_paper_syncs_to_public_article(self):
        response = self.client.post(
            "/api/builder/papers/",
            {
                "title": "Fourier Analysis Notes",
                "abstract": "A concise overview of Fourier techniques.",
                "authors": "A. Mathematician",
                "status": "published",
                "branding_enabled": True,
                "branding_label": "Powered by MathSphere Writer",
                "sections": [
                    {
                        "title": "Introduction",
                        "kind": "section",
                        "progress_state": "drafting",
                        "order": 1,
                        "content": "This paper studies transforms.",
                    },
                    {
                        "title": "Results",
                        "kind": "section",
                        "progress_state": "done",
                        "order": 2,
                        "content": "We compare periodic and aperiodic cases.",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        paper = ScientificPaper.objects.get(pk=response.data["id"])

        self.assertIsNotNone(paper.article_id)
        self.assertIsNotNone(paper.slug)
        self.assertIsNotNone(paper.published_at)
        self.assertEqual(paper.article.title, paper.title)
        self.assertEqual(paper.article.summary, paper.abstract)
        self.assertEqual(paper.article.author, paper.authors)
        self.assertTrue(paper.article.is_published)
        self.assertEqual(paper.sections.count(), 2)
        self.assertEqual(paper.sections.order_by("order").first().progress_state, "drafting")
        self.assertIn("## Introduction", paper.content)
        self.assertIn("_Powered by MathSphere Writer_", paper.content)
        self.assertIn("_Powered by MathSphere Writer_", paper.article.content)

    def test_published_paper_requires_title_and_content(self):
        response = self.client.post(
            "/api/builder/papers/",
            {
                "title": "",
                "content": "",
                "status": "published",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_switching_to_draft_unpublishes_public_article(self):
        paper = ScientificPaper.objects.create(
            title="Topology Draft",
            abstract="Abstract",
            content="Initial content",
            status="published",
        )

        response = self.client.patch(
            f"/api/builder/papers/{paper.id}/",
            {"status": "draft"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        paper.refresh_from_db()
        self.assertIsNotNone(paper.article_id)
        self.assertIsNone(paper.published_at)
        self.assertFalse(paper.article.is_published)

    def test_list_supports_status_and_search_filters(self):
        ScientificPaper.objects.create(title="Algebra Draft", content="x", status="draft")
        ScientificPaper.objects.create(title="Geometry Final", content="x", status="published")

        response = self.client.get("/api/builder/papers/?status=published&q=Geometry")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Geometry Final")


class PublicArticleSyncTests(APITestCase):
    def test_synced_article_is_visible_in_public_articles_api(self):
        paper = ScientificPaper.objects.create(
            title="Number Theory",
            abstract="Prime numbers and more.",
            content="# Number Theory\n\nPrime exploration.",
            authors="N. Researcher",
            status="published",
        )

        response = self.client.get(f"/api/articles/{paper.article.slug}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Number Theory")
        self.assertEqual(response.data["summary"], "Prime numbers and more.")
        self.assertEqual(Article.objects.filter(source_paper=paper).count(), 1)

    def test_synced_article_appears_in_public_list(self):
        paper = ScientificPaper.objects.create(
            title="Combinatorics",
            abstract="Counting methods.",
            content="Published content",
            status="published",
        )

        response = self.client.get("/api/articles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["id"] == paper.article_id for item in response.data))

    def test_unpublished_synced_article_is_hidden_from_public_articles_api(self):
        paper = ScientificPaper.objects.create(
            title="Hidden draft",
            content="Still in progress",
            status="published",
        )
        paper.status = "draft"
        paper.save()

        response = self.client.get("/api/articles/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(any(item["id"] == paper.article_id for item in response.data))


class LaboratoryUsageTests(APITestCase):
    def setUp(self):
        self.saved_result = SavedLaboratoryResult.objects.create(
            module_slug="integral-studio",
            module_title="Integral Studio",
            mode="single",
            title="Integral packet",
            summary="Saved exact result",
            report_markdown="# Integral\n\n- result",
            input_snapshot={"expression": "x^2"},
            structured_payload={"id": "seed", "moduleSlug": "integral-studio", "kind": "single", "title": "Integral packet"},
            metadata={},
        )

    def test_paper_create_registers_laboratory_usage(self):
        block = {
            "id": "lab-block-1",
            "status": "ready",
            "moduleSlug": "integral-studio",
            "kind": "single",
            "title": "Integral result",
            "summary": "Exact symbolic result",
            "generatedAt": "2026-03-28T10:00:00Z",
            "savedResultId": str(self.saved_result.public_id),
            "savedResultRevision": 1,
            "metrics": [],
        }
        response = self.client.post(
            "/api/builder/papers/",
            {
                "title": "Usage registry draft",
                "sections": [
                    {
                        "title": "Findings",
                        "kind": "section",
                        "progress_state": "drafting",
                        "order": 1,
                        "content": f"## Findings\n\n```lab-result\n{json.dumps(block, indent=2)}\n```",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        paper = ScientificPaper.objects.get(pk=response.data["id"])
        usage = PaperLaboratoryUsage.objects.get(paper=paper, block_id="lab-block-1")
        self.assertEqual(usage.saved_result, self.saved_result)
        self.assertEqual(usage.module_slug, "integral-studio")

    def test_live_targets_and_live_sync_are_server_backed(self):
        paper = ScientificPaper.objects.create(
            title="Server-backed writer",
            content=(
                "## Results\n\n"
                "```lab-result\n"
                "{\n"
                '  "id": "live-block-1",\n'
                '  "status": "ready",\n'
                '  "moduleSlug": "integral-studio",\n'
                '  "kind": "single",\n'
                '  "title": "Integral result",\n'
                '  "summary": "Initial",\n'
                '  "generatedAt": "2026-03-28T10:00:00Z",\n'
                f'  "savedResultId": "{self.saved_result.public_id}",\n'
                '  "savedResultRevision": 1,\n'
                '  "metrics": []\n'
                "}\n"
                "```\n"
            ),
        )

        targets_response = self.client.get("/api/builder/papers/live-targets/")
        self.assertEqual(targets_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item["paperId"] == paper.id and item["id"] == "live-block-1" for item in targets_response.data))

        sync_response = self.client.post(
            f"/api/builder/papers/{paper.id}/live-sync/",
            {
                "block_id": "live-block-1",
                "saved_result_id": str(self.saved_result.public_id),
                "block": {
                    "id": "live-block-1",
                    "status": "ready",
                    "moduleSlug": "integral-studio",
                    "kind": "single",
                    "title": "Integral result",
                    "summary": "Updated from laboratory",
                    "generatedAt": "2026-03-28T10:05:00Z",
                    "savedResultId": str(self.saved_result.public_id),
                    "savedResultRevision": 1,
                    "metrics": [],
                    "sync": {
                        "revision": 2,
                        "pushedAt": "2026-03-28T10:05:00Z",
                        "sourceLabel": "Integral Studio",
                    },
                },
            },
            format="json",
        )

        self.assertEqual(sync_response.status_code, status.HTTP_200_OK)
        paper.refresh_from_db()
        self.assertIn("Updated from laboratory", paper.content)
        usage = PaperLaboratoryUsage.objects.get(paper=paper, block_id="live-block-1")
        self.assertEqual(usage.synced_revision, 2)
