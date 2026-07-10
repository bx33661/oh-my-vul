from __future__ import annotations

import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

from .run_evals import (
    EvalConfigurationError,
    build_targeted_case,
    load_stable_cases,
    render_json,
    render_junit,
    run_cases,
    summarize,
)


CHECKER = """#!/usr/bin/env python3
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--eval-id', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
text = args.output.read_text(encoding='utf-8')
if 'PASS' not in text:
    raise SystemExit('fixture assertion failed')
print(f'OK eval {args.eval_id}')
"""


class EvalRunnerTests(unittest.TestCase):
    def test_stable_run_captures_passes_failures_and_summary(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-evals-") as tmp:
            root = Path(tmp)
            self._write_fixture(root)
            cases = load_stable_cases(root)
            results = run_cases(cases)
            summary = summarize(results)

            self.assertEqual([case.id for case in cases], ["demo-pass", "demo-fail"])
            self.assertEqual(summary["total"], 2)
            self.assertEqual(summary["passed"], 1)
            self.assertEqual(summary["failed"], 1)
            self.assertFalse(summary["ok"])
            self.assertEqual(results[0].stdout.strip(), "OK eval 1")
            self.assertIn("fixture assertion failed", results[1].stderr)

    def test_json_and_junit_preserve_the_same_result_counts(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-evals-") as tmp:
            root = Path(tmp)
            self._write_fixture(root)
            results = run_cases(load_stable_cases(root))

            payload = json.loads(render_json(results))
            self.assertEqual(payload["schema_version"], "1")
            self.assertEqual((payload["total"], payload["passed"], payload["failed"]), (2, 1, 1))
            self.assertEqual(len(payload["results"]), 2)

            suite = ET.fromstring(render_junit(results))
            self.assertEqual(suite.tag, "testsuite")
            self.assertEqual(suite.attrib["tests"], "2")
            self.assertEqual(suite.attrib["failures"], "1")
            self.assertEqual(len(suite.findall("testcase")), 2)
            self.assertEqual(len(suite.findall("testcase/failure")), 1)

    def test_targeted_case_uses_existing_checker_and_explicit_output(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-evals-") as tmp:
            root = Path(tmp)
            self._write_fixture(root)
            output = root / "pass.md"
            case = build_targeted_case(root, "demo", 7, output)
            result = run_cases([case])[0]

            self.assertEqual(case.id, "demo-7")
            self.assertTrue(result.passed)

    def test_runner_rejects_unsafe_skill_and_manifest_paths(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-evals-") as tmp:
            root = Path(tmp)
            self._write_fixture(root)
            with self.assertRaisesRegex(EvalConfigurationError, "skill"):
                build_targeted_case(root, "../demo", 1, root / "pass.md")

            outside = root.parent / "outside-evals.json"
            outside.write_text('{"schema_version":"1","cases":[]}', encoding="utf-8")
            try:
                with self.assertRaisesRegex(EvalConfigurationError, "manifest"):
                    load_stable_cases(root, outside)
            finally:
                outside.unlink(missing_ok=True)

    @staticmethod
    def _write_fixture(root: Path) -> None:
        checker = root / "skills" / "demo" / "scripts" / "check_output.py"
        checker.parent.mkdir(parents=True, exist_ok=True)
        checker.write_text(CHECKER, encoding="utf-8")
        (root / "pass.md").write_text("PASS\n", encoding="utf-8")
        (root / "fail.md").write_text("FAIL\n", encoding="utf-8")
        manifest = root / "shared" / "evals" / "stable.json"
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(
            json.dumps(
                {
                    "schema_version": "1",
                    "cases": [
                        {
                            "id": "demo-pass",
                            "skill": "demo",
                            "eval_id": 1,
                            "checker": "skills/demo/scripts/check_output.py",
                            "output": "pass.md",
                        },
                        {
                            "id": "demo-fail",
                            "skill": "demo",
                            "eval_id": 2,
                            "checker": "skills/demo/scripts/check_output.py",
                            "output": "fail.md",
                        },
                    ],
                }
            ),
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
