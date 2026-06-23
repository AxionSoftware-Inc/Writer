from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from .models import Article, Book, Course, Category, Tag, Documentation, Project

class BaseApiTestCase(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(username='admin', password='password123', email='admin@test.com')
        self.regular_user = User.objects.create_user(username='user', password='password123')
        self.quantum_project = Project.objects.create(name="Quantum Uz", slug="quantum-uz")
        self.ket_project = Project.objects.create(name="Ket Studio", slug="ket")
        self.category = Category.objects.create(name="Science", project=self.quantum_project)
        self.tag = Tag.objects.create(name="Physics", project=self.quantum_project)

class ArticleApiTests(BaseApiTestCase):
    def test_create_article(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('article-list')
        data = {
            'title': 'Test Article',
            'content': 'Test Content',
            'author': 'Tester',
            'category': self.category.id,
            'tags': [self.tag.id],
            'is_published': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Article.objects.count(), 1)

    def test_get_articles(self):
        Article.objects.create(title='A1', content='C1', category=self.category)
        url = reverse('article-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_retrieve_article_increments_views(self):
        article = Article.objects.create(title='A1', content='C1', category=self.category)
        url = reverse('article-detail', args=[article.id])
        self.assertEqual(article.views, 0)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        article.refresh_from_db()
        self.assertEqual(article.views, 1)

class BookApiTests(BaseApiTestCase):
    def test_create_book(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('book-list')
        data = {
            'title': 'Test Book',
            'author': 'Tester',
            'description': 'Description',
            'price': '9.99',
            'is_published': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_book_stats_increment(self):
        book = Book.objects.create(title='B1', author='A1', description='D1')
        url = reverse('book-detail', args=[book.id])
        self.client.get(url)
        book.refresh_from_db()
        self.assertEqual(book.views, 1)

class CourseApiTests(BaseApiTestCase):
    def test_create_course(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('course-list')
        data = {
            'title': 'Test Course',
            'instructor': 'Instructor',
            'description': 'Description',
            'level_type': 'Beginner',
            'is_published': True
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

class UserApiTests(BaseApiTestCase):
    def test_user_list_admin_only(self):
        url = reverse('users-list')
        # Anonymous
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Regular User
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Admin User
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

class DashboardApiTests(BaseApiTestCase):
    def test_dashboard_stats(self):
        Article.objects.create(title='A1', content='C1')
        Book.objects.create(title='B1', author='A1', description='D1')
        Course.objects.create(title='C1', instructor='I1', description='D1')
        
        url = reverse('admin-dashboard-stats')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['articles_count'], 1)
        self.assertEqual(response.data['books_count'], 1)
        self.assertEqual(response.data['courses_count'], 1)


class DocumentationApiTests(BaseApiTestCase):
    def test_docs_tree_is_project_scoped(self):
        root = Documentation.objects.create(
            project=self.ket_project,
            title='Getting Started',
            slug='getting-started',
            content='<p>Root</p>',
            order=1,
        )
        Documentation.objects.create(
            project=self.ket_project,
            title='Installation',
            slug='installation',
            content='<p>Child</p>',
            parent=root,
            order=1,
        )
        Documentation.objects.create(
            project=self.quantum_project,
            title='Installation',
            slug='installation',
            content='<p>Quantum installation</p>',
            order=1,
        )

        url = reverse('documentation-list')
        response = self.client.get(url, {'project': 'ket', 'tree': '1'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['slug'], 'getting-started')
        self.assertEqual(len(response.data[0]['children']), 1)
        self.assertEqual(response.data[0]['children'][0]['slug'], 'installation')

    def test_doc_parent_must_match_project(self):
        quantum_root = Documentation.objects.create(
            project=self.quantum_project,
            title='Quantum Root',
            slug='quantum-root',
            content='<p>Quantum</p>',
        )

        url = reverse('documentation-list')
        response = self.client.post(
            url,
            {
                'project': self.ket_project.id,
                'title': 'Broken Child',
                'slug': 'broken-child',
                'content': '<p>Broken</p>',
                'parent': quantum_root.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('parent', response.data)
