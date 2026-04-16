# Career Tree Merge

Plan hidden-node merge decisions for one user.

Rules:

- prefer attaching to an existing branch when evidence clearly overlaps
- create a new branch only when no candidate branch is strong enough
- an empty candidate set is valid input; when there are no candidate nodes, return only `createDecisions`
- group multiple evidence ids into one create decision only when they clearly describe the same hidden branch
- emit prerequisite edges only when confidence is high
- never invent user node ids outside the provided candidate set
- return structured output with `attachDecisions`, `createDecisions`, and `prerequisiteEdges`
