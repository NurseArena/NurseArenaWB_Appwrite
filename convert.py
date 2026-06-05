#!/usr/bin/env python3
"""
convert.py — Convert NurseArena mock test .txt to uploadable CSV.

Usage:
    python convert.py input.txt [output.csv]

Input format (exported from your test editor):
    1. Topic: Anatomy – Lymphatic system
    Question: The thoracic duct drains lymph from all of the following EXCEPT:
    (A) Left upper extremity
    (B) Right lower extremity
    (C) Right side of the head and neck
    (D) Left side of the thorax
    Correct Answer: C
    Explanation: The thoracic duct drains the entire body...

Output CSV columns:
    question,option_a,option_b,option_c,option_d,correct,explanation

Exactly 100 questions expected. Upload at /admin/mock-tests/upload.
"""

import sys
import re
import csv
import os


def strip_prefix(text: str, prefix: str) -> str:
    """Remove a leading prefix (case-insensitive) and trim."""
    idx = text.lower().find(prefix.lower())
    if idx == -1:
        return text.strip()
    return text[idx + len(prefix):].strip()


def parse_questions(filepath: str) -> list[dict]:
    with open(filepath, 'r', encoding='utf-8') as f:
        raw = f.read()

    # Remove horizontal rule lines (===... and ---...)
    raw = re.sub(r'^[=\-]{10,}.*$\n?', '', raw, flags=re.MULTILINE)

    # Remove everything before the first question (line starting with "1.")
    raw = re.sub(r'\A.*?(?=\n1\.\s)', '', raw, flags=re.DOTALL)
    # Remove trailing content after last explanation (e.g., "END OF..." lines)
    raw = re.sub(r'\nEND\s+OF\s+.*$', '', raw, flags=re.IGNORECASE | re.DOTALL)

    questions: list[dict] = []
    # Split on lines that start with a number followed by a period
    blocks = re.split(r'\n(?=\d+\.\s)', raw.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()

        # Quick sanity: must have (A), (B), (C), (D) somewhere
        block_text = ' '.join(lines)
        if not all(f'({l})' in block_text for l in ('A', 'B', 'C', 'D')):
            continue

        q_text_parts: list[str] = []
        options: dict[str, str] = {'A': '', 'B': '', 'C': '', 'D': ''}
        correct = ''
        explanation = ''
        mode = 'question'

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            m_opt = re.match(r'^\(([A-D])\)\s*(.*)', stripped)
            if m_opt:
                mode = 'options'
                options[m_opt.group(1)] = m_opt.group(2).strip()
                continue

            m_correct = re.match(r'^Correct Answer:\s*([A-D])', stripped, re.IGNORECASE)
            if m_correct:
                mode = 'correct'
                correct = m_correct.group(1).upper()
                continue

            if re.match(r'^Explanation:\s*', stripped, re.IGNORECASE):
                mode = 'explanation'
                explanation = strip_prefix(stripped, 'Explanation:')
                continue

            if mode == 'question':
                # Strip leading number (e.g. "1." or "1. Topic: ...")
                # If line has "Topic:", skip it entirely (it's not question text)
                if re.match(r'^\d+\.\s*Topic:', stripped, re.IGNORECASE):
                    continue
                cleaned = re.sub(r'^\d+\.\s*', '', stripped)
                cleaned = strip_prefix(cleaned, 'Question:')
                if cleaned:
                    q_text_parts.append(cleaned)
            elif mode == 'options':
                for letter in ('D', 'C', 'B', 'A'):
                    if options[letter]:
                        options[letter] += ' ' + stripped
                        break
            elif mode == 'explanation':
                explanation = (explanation + ' ' + stripped) if explanation else stripped

        question = ' '.join(q_text_parts).strip()
        if not question:
            continue

        questions.append({
            'question': question,
            'option_a': options['A'],
            'option_b': options['B'],
            'option_c': options['C'],
            'option_d': options['D'],
            'correct': correct,
            'explanation': explanation,
        })

    return questions


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(input_path)[0] + '.csv'

    questions = parse_questions(input_path)

    with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'explanation',
        ])
        writer.writeheader()
        for q in questions:
            writer.writerow(q)

    print(f'Converted {len(questions)} questions')
    print(f'  Input : {input_path}')
    print(f'  Output: {output_path}')
    if len(questions) != 100:
        print(f'  Warning: expected 100 questions, got {len(questions)}')
    else:
        print('  Ready to upload at /admin/mock-tests/upload')


if __name__ == '__main__':
    main()
