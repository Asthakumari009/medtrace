"""The clinical detail the deck promises: clinician, facility, conditions, drugs.

Nothing here calls a model. These cover the gate between what Gemini returns
and what reaches the database, plus how that detail is rendered into the
grounding the chat answers from.
"""
import unittest

import pydantic

from chat import build_context
from extraction import wire_schema
from schemas import ExtractionResult, Medication


def _result(**overrides) -> dict:
    base = {
        "report_title": "Consultation note",
        "summary": "A follow-up visit with a prescription.",
        "observations": [],
    }
    base.update(overrides)
    return base


class MedicationValidationTests(unittest.TestCase):
    """A drug is only worth storing if it has a name; everything else is
    routinely missing from a real prescription."""

    def test_name_alone_is_enough(self):
        med = Medication.model_validate({"name": "Metformin"})
        self.assertIsNone(med.dose)
        self.assertIsNone(med.frequency)

    def test_blank_name_is_rejected(self):
        with self.assertRaises(pydantic.ValidationError):
            Medication.model_validate({"name": "   "})

    def test_name_is_stripped(self):
        self.assertEqual(Medication.model_validate({"name": " Metformin "}).name, "Metformin")

    def test_indian_frequency_notation_survives_verbatim(self):
        # "1-0-1" must not be normalised into anything else — it is what the
        # patient reads on the strip.
        med = Medication.model_validate({"name": "Metformin", "frequency": "1-0-1"})
        self.assertEqual(med.frequency, "1-0-1")


class ExtractionResultClinicalTests(unittest.TestCase):
    def test_clinical_detail_defaults_to_absent_not_invented(self):
        result = ExtractionResult.model_validate(_result())
        self.assertIsNone(result.doctor_name)
        self.assertIsNone(result.facility_name)
        self.assertEqual(result.diagnoses, [])
        self.assertEqual(result.medications, [])

    def test_blank_diagnoses_are_dropped(self):
        result = ExtractionResult.model_validate(
            _result(diagnoses=["Prediabetes", "", "   ", "Hypertension"])
        )
        self.assertEqual(result.diagnoses, ["Prediabetes", "Hypertension"])

    def test_a_drug_with_no_name_fails_the_whole_extraction(self):
        # Partial data must never land: the report is marked failed instead.
        with self.assertRaises(pydantic.ValidationError):
            ExtractionResult.model_validate(_result(medications=[{"dose": "500 mg"}]))

    def test_clinical_fields_reach_the_wire_schema(self):
        properties = wire_schema(ExtractionResult)["properties"]
        for field in ("doctor_name", "facility_name", "diagnoses", "medications"):
            self.assertIn(field, properties)


class GroundingTests(unittest.TestCase):
    """Chat can only answer "what did I take" if the drugs are in the context."""

    events = [
        {
            "report_id": "r1",
            "event_type": "report",
            "title": "Consultation note",
            "occurred_at": "2026-09-01",
            "summary": "Follow-up visit.",
        }
    ]

    def test_medications_and_diagnoses_are_rendered(self):
        context = build_context(
            self.events,
            {},
            {
                "r1": {
                    "doctor_name": "Dr. Meera Iyer",
                    "facility_name": "Lakeside Family Clinic",
                    "diagnoses": ["Prediabetes"],
                    "medications": [
                        {"name": "Metformin", "dose": "500 mg", "frequency": "1-0-1"}
                    ],
                }
            },
        )
        self.assertIn("Dr. Meera Iyer", context)
        self.assertIn("Lakeside Family Clinic", context)
        self.assertIn("DIAGNOSIS stated: Prediabetes", context)
        self.assertIn("MEDICATION: Metformin, 500 mg, 1-0-1", context)

    def test_a_report_with_no_clinical_detail_renders_unchanged(self):
        # Lab reports carry none of this; they must not grow empty labels that
        # the model could read as "the document said nothing was prescribed".
        context = build_context(self.events, {}, {"r1": {}})
        self.assertNotIn("MEDICATION", context)
        self.assertNotIn("doctor:", context)

    def test_missing_details_argument_still_works(self):
        # The share path and the tests both call build_context with two args.
        self.assertIn("Consultation note", build_context(self.events, {}))

    def test_drug_with_only_a_name_has_no_trailing_separator(self):
        context = build_context(
            self.events, {}, {"r1": {"medications": [{"name": "Metformin"}]}}
        )
        self.assertIn("MEDICATION: Metformin\n", context + "\n")


class VoiceMimeTests(unittest.TestCase):
    """The web build records webm/Opus, the phone records AAC. Whatever the
    model is told the bytes are has to be what they actually are."""

    def test_browser_codec_parameter_is_stripped_not_rejected(self):
        from main import _voice_mime

        self.assertEqual(_voice_mime("audio/webm;codecs=opus"), "audio/webm")

    def test_missing_content_type_falls_back_to_the_native_container(self):
        from main import _voice_mime

        self.assertEqual(_voice_mime(None), "audio/mp4")

    def test_unsupported_type_is_refused_rather_than_relabelled(self):
        from fastapi import HTTPException

        from main import _voice_mime

        with self.assertRaises(HTTPException) as caught:
            _voice_mime("application/zip")
        self.assertEqual(caught.exception.status_code, 415)


if __name__ == "__main__":
    unittest.main()
