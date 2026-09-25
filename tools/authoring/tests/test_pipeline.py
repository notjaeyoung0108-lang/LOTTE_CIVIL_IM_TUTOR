import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline import Review, Draft, Calculation, passed, evaluate, validate_draft

class Gates(unittest.TestCase):
    def review(self, **changes):
        data = dict(field_depth=4, procedural_specificity=4, question_generation=4, numerical_consistency=4, field_language=4, pedagogical_clarity=4, cross_function_connection=4, unsupported_claim_risk=1, numerical_issues=[], critical_issues=[], unsupported_claims=[], revision_requests=[], **{'pass': True})
        data.update(changes)
        return Review.model_validate(data)

    def test_critical_cannot_be_hidden_by_scores(self):
        self.assertTrue(passed(self.review()))
        for changes in [{'critical_issues':['unsafe']}, {'numerical_issues':['wrong duration']}, {'unsupported_claims':['company rule']}, {'procedural_specificity':3}, {'unsupported_claim_risk':2}, {'pass':False}]:
            self.assertFalse(passed(self.review(**changes)))

    def test_arithmetic_and_resource_examples(self):
        self.assertEqual(evaluate('12 / 3'), 4)
        self.assertEqual(evaluate('max(3+5,3+2)'), 8)
        self.assertEqual(evaluate('8-max(3+1,3+2)'), 3)
        self.assertEqual(evaluate('ceil(13/3)'), 5)
        self.assertEqual(evaluate('1200000+300000-200000'), 1300000)

    def test_llm_code_never_executes(self):
        for expr in ["__import__('os').system('echo bad')", '(1).__class__', '2**100000', '[x for x in range(5)]', 'float("nan")', '1/0']:
            with self.assertRaises((ValueError, ZeroDivisionError)):
                evaluate(expr)

    def test_wrong_calculation_blocked(self):
        draft = Draft(markdown='교육용 가정 ' * 600, calculations=[Calculation(label='duration', expression='12/3', expected=3, unit='day', assumptions='fixed crew')])
        self.assertTrue(validate_draft(draft, 3000))
        draft.calculations[0].expected=4
        self.assertEqual(validate_draft(draft, 3000), [])

if __name__ == '__main__':
    unittest.main()

class Workflow(unittest.TestCase):
    def test_failed_revisions_never_publish(self):
        import tempfile
        import pipeline as p
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runner = object.__new__(p.Runner)
            draft = Draft(markdown='교육용 가정 ' * 600, calculations=[])
            calls = []
            def call(role, item, payload, schema):
                calls.append((role, payload))
                return draft
            runner.call = call
            runner.reviews = lambda *args: {'field_reviewer': Gates().review(critical_issues=['자료 위치 누락'])}
            with patch.object(p, 'ROOT', root), patch.object(p, 'OUT', root/'docs/a01'), patch.object(p, 'CACHE', root/'cache'), patch.dict(p.os.environ, {'MAX_REVISION':'3'}):
                self.assertFalse(runner.generate('A01-4', {'purpose':'test'}))
                state = p.json.loads((p.OUT/'audit/A01-4.json').read_text())
                self.assertEqual(state['status'], 'needs_manual_review')
                self.assertEqual(state['revision_count'], 3)
                self.assertEqual(len(calls), 4)
                self.assertIn('specific_feedback', calls[-1][1])
                self.assertFalse((p.OUT/'layer1/A01-4.md').exists())

    def test_editor_regression_blocks_publication(self):
        import tempfile
        import pipeline as p
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            runner = object.__new__(p.Runner)
            runner.call = lambda role, *args: Draft(markdown='교육용 가정 '* (600 if role=='field_writer' else 400), calculations=[])
            runner.reviews = lambda *args: {'field_reviewer': Gates().review()}
            with patch.object(p, 'ROOT', root), patch.object(p, 'OUT', root/'docs/a01'), patch.object(p, 'CACHE', root/'cache'), patch.dict(p.os.environ, {'MAX_REVISION':'0'}):
                self.assertFalse(runner.generate('A01-4', {}))
                state = p.json.loads((p.OUT/'audit/A01-4.json').read_text())
                self.assertEqual(state['history'][-1]['stage'], 'edited')
                self.assertTrue(state['history'][-1]['local_issues'])
                self.assertFalse((p.OUT/'layer1/A01-4.md').exists())

class Operations(unittest.TestCase):
    def test_api_key_priority_and_missing_key(self):
        import pipeline as p
        from unittest.mock import patch
        with patch.object(p,'load_dotenv'), patch.object(p,'OpenAI') as client:
            with patch.dict(p.os.environ,{'OPENAI_API':'test-primary','OPENAI_API_KEY':'test-fallback'},clear=True):
                p.Runner()
                self.assertEqual(client.call_args.kwargs['api_key'],'test-primary')
            with patch.dict(p.os.environ,{'OPENAI_API_KEY':'test-fallback'},clear=True):
                p.Runner()
                self.assertEqual(client.call_args.kwargs['api_key'],'test-fallback')
            with patch.dict(p.os.environ,{},clear=True):
                with self.assertRaisesRegex(RuntimeError,'OPENAI_API'):
                    p.Runner()

    def test_scenarios_blocked_until_all_layer1_pass(self):
        import tempfile
        import pipeline as p
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp, patch.object(p,'OUT',Path(tmp)):
            runner=object.__new__(p.Runner)
            with self.assertRaisesRegex(RuntimeError,'9개 챕터'):
                runner.layer1()

class CacheIntegrity(unittest.TestCase):
    def test_pass_cache_skips_calls_but_detects_changed_artifact(self):
        import tempfile
        import pipeline as p
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            runner=object.__new__(p.Runner)
            calls=[]
            def call(role,*args):
                calls.append(role)
                return Draft(markdown='교육용 가정 '*600,calculations=[])
            runner.call=call
            runner.reviews=lambda *args: {'field_reviewer':Gates().review()}
            with patch.object(p,'ROOT',root),patch.object(p,'OUT',root/'docs/a01'),patch.object(p,'CACHE',root/'cache'):
                self.assertTrue(runner.generate('A01-4',{'scope':'duration'}))
                self.assertEqual(len(calls),2)
                self.assertTrue(runner.generate('A01-4',{'scope':'duration'}))
                self.assertEqual(len(calls),2)
                target=p.OUT/'layer1/A01-4.md'
                target.write_text(target.read_text()+'unreviewed edit')
                self.assertTrue(runner.generate('A01-4',{'scope':'duration'}))
                self.assertEqual(len(calls),4)
