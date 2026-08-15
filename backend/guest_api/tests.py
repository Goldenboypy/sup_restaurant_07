from django.test import SimpleTestCase
from django.urls import reverse


class SpaFallbackTests(SimpleTestCase):
    def test_react_spa_is_served_for_menu_routes(self):
        response = self.client.get('/menu/42')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="root"')


class StaffLoginRouteTests(SimpleTestCase):
    def test_staff_login_route_is_available(self):
        url = reverse('staff-login')
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Staff log in')

    def test_staff_table_map_route_is_available(self):
        url = reverse('staff-table-map')
        response = self.client.get(url)

        self.assertEqual(response.status_code, 302)
        self.assertIn('/staff/login/', response['Location'])
