"""Trust-boundary tests for the two extraction paths. No model is called."""
import unittest

from extraction import _MAX_TEXT_CHARS, extract_from_text, wire_schema
from schemas import ExtractionResult


class TextBoundaryTests(unittest.TestCase):
    """Text recognised on the device is still untrusted input: it is bounded
    and non-empty before anything reaches the model."""

    def test_empty_text_is_rejected(self):
        with self.assertRaises(ValueError):
            extract_from_text("")

    def test_whitespace_only_text_is_rejected(self):
        with self.assertRaises(ValueError):
            extract_from_text("   \n\t  ")

    def test_over_length_text_is_rejected(self):
        with self.assertRaises(ValueError) as caught:
            extract_from_text("9" * (_MAX_TEXT_CHARS + 1))
        self.assertIn(str(_MAX_TEXT_CHARS), str(caught.exception))

    def test_text_at_the_limit_passes_the_boundary(self):
        # Reaching the model is the failure we want here: it proves the guard
        # let the input through rather than rejecting it as too long.
        with self.assertRaises(Exception) as caught:
            extract_from_text("5.8 %" + "x" * (_MAX_TEXT_CHARS - 5))
        self.assertNotIsInstance(caught.exception, ValueError)


class WireSchemaTests(unittest.TestCase):
    """Both paths send the same schema, and Vertex constrained decoding
    rejects length bounds, array limits, and date formats."""

    def test_serving_incompatible_constraints_are_stripped(self):
        schema = wire_schema(ExtractionResult)

        def walk(node):
            if isinstance(node, dict):
                for key in ("minLength", "maxLength", "minItems", "maxItems", "format"):
                    self.assertNotIn(key, node)
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)

        walk(schema)

    def test_the_strict_model_still_enforces_what_the_wire_schema_drops(self):
        with self.assertRaises(Exception):
            ExtractionResult.model_validate(
                {"report_title": "", "summary": "x", "observations": []}
            )


if __name__ == "__main__":
    unittest.main()
