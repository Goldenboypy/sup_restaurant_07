from django.test import SimpleTestCase


class SpaFallbackTests(SimpleTestCase):
    def test_react_spa_is_served_for_menu_routes(self):
        response = self.client.get('/menu/42')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="root"')
