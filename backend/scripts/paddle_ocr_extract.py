#!/usr/bin/env python3
import json
import os
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print('Usage: paddle_ocr_extract.py <file_path>', file=sys.stderr)
        return 2

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f'File not found: {file_path}', file=sys.stderr)
        return 2

    try:
        from paddleocr import PaddleOCR
    except Exception as exc:
        print(
            'PaddleOCR import failed. Install with: pip install paddleocr paddlepaddle. '
            f'Details: {exc}',
            file=sys.stderr,
        )
        return 3

    lang = os.environ.get('PADDLE_OCR_LANG', 'en')

    try:
        ocr = PaddleOCR(use_textline_orientation=True, lang=lang)
        if hasattr(ocr, 'predict'):
            result = ocr.predict(file_path)
        else:
            result = ocr.ocr(file_path)
    except Exception as exc:
        print(f'PaddleOCR extraction failed: {exc}', file=sys.stderr)
        return 4

    lines = []
    confidences = []

    def add_text_conf(text_part, score_part):
        text = str(text_part).strip() if text_part is not None else ''
        if not text:
            return
        lines.append(text)
        try:
            if score_part is not None:
                confidences.append(float(score_part))
        except Exception:
            pass

    if result:
        for page in result:
            if not page:
                continue

            if isinstance(page, dict):
                rec_texts = page.get('rec_texts') or []
                rec_scores = page.get('rec_scores') or []
                if rec_texts:
                    for idx, t in enumerate(rec_texts):
                        s = rec_scores[idx] if idx < len(rec_scores) else None
                        add_text_conf(t, s)
                    continue

            if isinstance(page, list):
                for item in page:
                    if isinstance(item, dict):
                        add_text_conf(item.get('text') or item.get('rec_text'), item.get('score') or item.get('rec_score'))
                        continue
                    if not item or len(item) < 2:
                        continue
                    data = item[1]
                    text_part = data[0] if len(data) > 0 else ''
                    score_part = data[1] if len(data) > 1 else 0
                    add_text_conf(text_part, score_part)

    payload = {
        'text': '\n'.join(lines),
        'lineCount': len(lines),
        'avgConfidence': (sum(confidences) / len(confidences)) if confidences else 0.0,
        'lang': lang,
    }

    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
