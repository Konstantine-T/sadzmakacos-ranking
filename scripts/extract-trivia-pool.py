# -*- coding: utf-8 -*-
"""Rebuild supabase/seed/trivia_questions.json from the 2015 ზოგადი უნარები PDFs.

    pdftotext -enc UTF-8 -layout variantN.pdf variantN.txt
    pdftotext -enc UTF-8          variantN.pdf variantN_raw.txt
    python scripts/extract-trivia-pool.py

WHY THIS FILE IS IN THE REPO. The first extraction ran from a scratch directory
and nobody could review what it had thrown away. It silently destroyed every
stacked fraction in the pool: pdftotext renders 1/5 as the numerator inline and
the denominator alone on the next line, and a filter meant to strip page numbers
ate the denominator. The question kept its numerator, still read as a complete
sentence, and shipped — 2015-III-Q80 asked for a ratio of "1" that was really
1/5, so the answer key no longer matched anything on screen. Extraction logic
that lives only in someone's scratch directory is how that happens twice.

The rule here is REFUSE, NEVER REPAIR. Every detector below drops a question
outright rather than trying to reconstruct it. A pool that is 20% smaller costs
two weeks of content; a pool with one silently wrong question costs the game's
credibility, and cannot be spotted from inside the app.

Four independent detectors, each earned by a real corruption found in review:

  1. orphan line      a line of nothing but stray short tokens inside a question
                      body. A stacked fraction leaves its denominator behind
                      like this — "5" for 1/5, "m n" for k/m and k/n.
  2. raw vs layout    the same question parsed from -layout and from raw reading
                      order must contain the same numbers, in the same order.
                      Catches anything the column heuristics moved or dropped.
  3. lost fraction    an option beginning "<digits> <letter>" was a fraction:
                      "4 b +3" is 4/(b+3).
  4. lost superscript "1,01*105" was 1.01x10^5 and "102 + 103" was 10^2 + 10^3;
                      pdftotext concatenates the exponent onto its base.

Sections dropped wholesale: ტექსტის გააზრება (needs its passage), რაოდენობრივი
შედარება (two-column A/B layout that does not survive linearisation), and
მონაცემთა ანალიზი (chart-based). Individual questions citing a figure go too —
nothing in the pool may need an image.
"""
import re, io, json, collections

ROMAN=["I","II","III","IV"]; LET=list("აბგდე")
ALLHEAD=["ანალოგიები","წინადადებების შევსება","ლოგიკა","წაკითხული ტექსტის გააზრება",
         "რაოდენობრივი შედარება","ამოცანები","მონაცემთა ანალიზი","მონაცემთა საკმარისობა"]
KEEP={"ანალოგიები","წინადადებების შევსება","ლოგიკა","ამოცანები","მონაცემთა საკმარისობა"}
CODE=re.compile(r'\d{6}[a-z]')
QST=re.compile(r'^\s*(\d{1,2})\.\s')
OPT=re.compile(r'^\s*\(([აბგდე])\)\s*(.*)$')
FIG=re.compile(r'ნახაზ|დიაგრამ|სქემა|გრაფიკ|ცხრილ|სურათ|იხ\.|წახნაგ')
MATHSYM=re.compile(r'[√∑∫≤≥≠±×÷π∞]')
MULDOT=re.compile(r'[⋅·]')
NUM=re.compile(r'\d+')

# ---------- answers ----------
toks=[t for t in io.open("answers_raw.txt",encoding="utf-8").read().split() if t]
blocks=[];cur=None;i=0
while i<len(toks):
    t=toks[i]
    if t in ROMAN and i+1<len(toks) and toks[i+1].startswith("ვარ"):
        cur=[t,[]];blocks.append(cur);i+=2;continue
    if cur is not None and len(t)==1 and t in LET: cur[1].append(t)
    i+=1
KEY={}
for bi,(rom,arr) in enumerate(blocks):
    off=1 if bi<4 else 41
    for j,a in enumerate(arr): KEY[(ROMAN.index(rom)+1, off+j)]=a
assert len(KEY)==320, len(KEY)

def is_footer(l):
    s=l.strip()
    return bool(CODE.search(s)) or s=='2015'

# A line of nothing but digits that is NOT a page footer. Inside a question this
# is a stacked-fraction denominator or a column value — the exact thing that
# silently destroyed 2015-III-Q80 last time.
def is_orphan(l):
    s=l.strip()
    if not s or is_footer(l): return False
    # Any line made only of stray short Latin/numeric tokens. A stacked fraction
    # leaves its denominator behind like this — "5" for 1/5, "m n" for k/m and
    # k/n. Georgian prose never looks like this, so it is a safe signal.
    return bool(re.fullmatch(r'(?:[A-Za-z0-9,\.]{1,3}\s+)*[A-Za-z0-9,\.]{1,3}', s))

def strip_raw_footers(body):
    """Drop page footers from a raw-mode body.

    In -layout output the page number and the doc code share one line, so
    is_footer() catches them together. In raw reading order they arrive as two
    separate lines — a bare number, then the code — and the bare number is
    indistinguishable from a fraction denominator unless we look ahead to the
    code that follows it.
    """
    keep=[]; n=len(body)
    for idx,l in enumerate(body):
        if is_footer(l): continue
        if re.fullmatch(r'\s*\d+\s*', l):
            nxt=next((body[j] for j in range(idx+1,n) if body[j].strip()), '')
            if CODE.search(nxt): continue        # page number preceding its doc code
        keep.append(l)
    return keep

def clean(s):
    return re.sub(r'\s+',' ', CODE.sub('', s)).strip()

def sup(s):
    s=re.sub(r'(სმ|კმ|დმ|მმ|მ)2\b', r'\1²', s)
    return re.sub(r'(სმ|კმ|დმ|მმ|მ)3\b', r'\1³', s)

def nums(text): return NUM.findall(text)

out=[]; drop=collections.Counter()
for v in (1,2,3,4):
    lay=io.open(f"variant{v}.txt",encoding="utf-8").read().split("\n")
    raw=io.open(f"variant{v}_raw.txt",encoding="utf-8").read().split("\n")

    # raw bodies, for the independent numeric cross-check
    rawq={}
    rstarts=[(i,int(QST.match(l).group(1))) for i,l in enumerate(raw) if QST.match(l)
             and 1<=int(QST.match(l).group(1))<=80]
    seen=set(); rs=[]
    for i,n in rstarts:
        if n not in seen: seen.add(n); rs.append((i,n))
    rheads=[i for i,l in enumerate(raw) if l.strip() in ALLHEAD]
    for idx,(i,n) in enumerate(rs):
        end=rs[idx+1][0] if idx+1<len(rs) else len(raw)
        # Cut at a section heading exactly as the layout pass does, or the raw
        # body swallows the next section's intro prose and its numbers, and the
        # cross-check fires on questions that are perfectly fine.
        nx=[h for h in rheads if i<h<end]
        if nx: end=min(nx)
        rawq[n]=strip_raw_footers(raw[i:end])

    heads=[(i,l.strip()) for i,l in enumerate(lay) if l.strip() in ALLHEAD]
    hpos=[h for h,_ in heads]
    def sec_at(i):
        c="?"
        for hi,hs in heads:
            if hi<i: c=hs
        return c
    starts=[]; seen=set()
    for i,l in enumerate(lay):
        m=QST.match(l)
        if m:
            n=int(m.group(1))
            if 1<=n<=80 and n not in seen: seen.add(n); starts.append((i,n))

    for idx,(li,n) in enumerate(starts):
        end=starts[idx+1][0] if idx+1<len(starts) else len(lay)
        nxt=[h for h in hpos if li<h<end]
        if nxt: end=min(nxt)
        sec=sec_at(li)
        if sec not in KEEP: drop['section-excluded']+=1; continue
        body=[l for l in lay[li:end] if not is_footer(l)]

        # DETECTOR 1 — the bug that poisoned the last pool.
        if any(is_orphan(l) for l in body): drop['orphan-numeric-line']+=1; continue
        # DETECTOR 2 — layout and reading order must agree on every number.
        if n in rawq and nums(' '.join(body)) != nums(' '.join(rawq[n])):
            drop['raw-vs-layout-mismatch']+=1; continue

        prompt=[]; opts={}; k=None
        for l in body:
            if not l.strip(): continue
            m=OPT.match(l)
            if m: k=m.group(1); opts[k]=[m.group(2)]
            elif k: opts[k].append(l.strip())
            else: prompt.append(l.strip())
        if not prompt: drop['no-prompt']+=1; continue
        prompt[0]=re.sub(r'^\s*\d{1,2}\.\s*','',prompt[0])
        p=sup(clean(' '.join(prompt)))
        o=[sup(clean(' '.join(opts[x]))) for x in LET if x in opts]
        a=KEY.get((v,n))
        if a is None: drop['no-answer']+=1; continue
        ai=LET.index(a)
        if len(o)<4 or ai>=len(o): drop['option-count']+=1; continue
        if any(not x for x in o): drop['empty-option']+=1; continue
        if FIG.search(p) or any(FIG.search(x) for x in o): drop['figure']+=1; continue
        if MATHSYM.search(p) or any(MATHSYM.search(x) for x in o): drop['math-symbol']+=1; continue
        # DETECTOR 3 — a lost algebraic fraction bar: "4 b +3" was 4/(b+3).
        if any(re.match(r'^\d+\s+[a-zA-Z]', x) for x in o): drop['lost-fraction-bar']+=1; continue
        # DETECTOR 4 — lost superscripts. "1,01*105" was 1.01x10^5 and "102 + 103"
        # was 10^2 + 10^3; the exponent is simply concatenated onto the base.
        if MULDOT.search(p) or any(MULDOT.search(x) for x in o): drop['lost-superscript']+=1; continue
        if any(re.fullmatch(r'10\d(\s*[+\-]\s*10\d)*', x.strip()) for x in o): drop['lost-superscript']+=1; continue
        out.append({"source":f"2015-{ROMAN[v-1]}-Q{n}","section":sec,"prompt":p,
                    "options":o,"correct_index":ai})

# dedupe on normalised prompt
seenk={}; dupes=0
for q in out:
    k=re.sub(r'[^\w]+','',q["prompt"].lower())[:160]
    if k in seenk: dupes+=1
    else: seenk[k]=q
uniq=list(seenk.values())

print(f"kept {len(uniq)}  (dropped {dupes} duplicates)")
print("\nexclusions:")
for k,c in drop.most_common(): print(f"  {k:26s} {c}")
print("\nby section:")
for k,c in collections.Counter(q["section"] for q in uniq).most_common(): print(f"  {k:26s} {c}")
json.dump(uniq, io.open("rebuilt.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
