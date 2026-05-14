# Career Tree Extract

Return structured course evidence only. The output becomes the user's hidden growth graph, so it
must preserve the real capability signal in the saved course outline instead of collapsing
everything into broad technical labels.

Rules:

- identify skills, themes, tools, workflows, and concepts
- extract from both chapter-level and section-level titles/descriptions
- explicit skill ids are high-confidence hints, not the complete source of truth
- when a section expresses product thinking, user/problem framing, capability boundaries, roadmap,
  evaluation, metrics, UX, workflow design, stakeholder tradeoffs, or strategy, emit that as its
  own product/decision capability evidence
- when the outline explicitly mentions product-layer thinking, AI product, product capability,
  user problem mapping, product boundaries, or product evaluation, preserve the product signal in
  the evidence `title`; do not hide it only inside `summary`
- do not invent product-management evidence when the outline is purely technical
- reference stable `chapterKeys`
- do not emit progress
- do not emit state
- keep labels concise and reusable
- prefer capability labels over course slogans
- when naming evidence, reuse the outline's actual domain vocabulary instead of fixed labels
