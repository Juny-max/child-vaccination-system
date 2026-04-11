import re
from pathlib import Path
from docx import Document

ROOT = Path(r"c:\Users\Junior Owusu\Desktop\Final Year Project\child-vaccination-system")
DOCS = ROOT / "docs"

chapter_files = {
    "CHAPTER ONE": DOCS / "CHAPTER ONE  (1).docx",
    "CHAPTER TWO": DOCS / "CHAPTER 2.docx",
    "CHAPTER THREE": DOCS / "CHAPTER-3.docx",
}
ref_file = DOCS / "CHAPTER 5 REFERENCES.docx"
out_file = DOCS / "citation_audit_dump.md"


def get_text_paragraphs(path: Path):
    doc = Document(str(path))
    return [p.text.strip() for p in doc.paragraphs]


def parse_references(path: Path):
    refs = {}
    for p in get_text_paragraphs(path):
        m = re.match(r"^\[(\d+)\]\s*(.*)$", p)
        if m:
            refs[int(m.group(1))] = m.group(2).strip()
    return refs


refs = parse_references(ref_file)
lines = []
lines.append("# Citation Audit Dump")
lines.append("")
lines.append("## Reference Map (Chapter 5)")
for n in sorted(refs):
    lines.append(f"[{n}] {refs[n]}")
lines.append("")

for chapter, path in chapter_files.items():
    lines.append(f"## {chapter}")
    paragraphs = get_text_paragraphs(path)
    cited_count = 0
    for idx, text in enumerate(paragraphs, start=1):
        if not text:
            continue
        nums = sorted(set(int(x) for x in re.findall(r"\[(\d+)\]", text)))
        if nums:
            cited_count += 1
            lines.append(f"- P{idx}: {text}")
            lines.append(f"  refs: {nums}")
    lines.append(f"- Total cited paragraphs: {cited_count}")
    lines.append("")

out_file.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote: {out_file}")
