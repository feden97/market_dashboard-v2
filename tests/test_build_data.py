import unittest
from scripts.data_utils import normalize_ipc_items


class InflationConversionTests(unittest.TestCase):
    def test_api_units_are_always_percentages(self):
        history = normalize_ipc_items([
            {"fecha": "2026-01-01", "valor": 2.9},
            {"fecha": "2026-02-01", "valor": 0.5},
            {"fecha": "2026-03-01", "valor": 1},
            {"fecha": "2026-04-01", "valor": -0.5},
            {"fecha": "2026-05-01", "valor": 0},
        ])
        expected = {"2026-01": .029, "2026-02": .005, "2026-03": .01, "2026-04": -.005, "2026-05": 0}
        self.assertEqual(history.keys(), expected.keys())
        for month, value in expected.items():
            self.assertAlmostEqual(history[month], value)

    def test_bad_dates_and_values_do_not_poison_snapshot(self):
        self.assertEqual(normalize_ipc_items([
            None, {}, {"fecha": "2026-02-30", "valor": 2},
            {"fecha": "2026-02-01", "valor": float('inf')},
            {"fecha": "2026-02-01", "valor": True},
            {"fecha": "2026-02-01", "valor": -100},
            {"fecha": "2026-02-01", "valor": None},
        ]), {})
        self.assertEqual(normalize_ipc_items(None), {})


if __name__ == '__main__':
    unittest.main()
