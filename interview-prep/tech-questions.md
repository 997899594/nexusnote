# 技术面试题

基于 NexusNote 项目的技术面试题集合。

---

## 📋 目录

- [前端面试题](#前端面试题)
- [后端面试题](#后端面试题)
- [AI/ML 面试题](#aiml-面试题)
- [DevOps 面试题](#devops-面试题)
- [系统设计题](#系统设计题)

---

## 前端面试题

### React & Next.js

1. **Q: 解释一下 React 19 的新特性？**
   A: React 19 引入了服务器组件改进、新的并发特性、以及性能优化等。

2. **Q: Next.js 16 App Router 相对于 Pages Router 有什么优势？**
   A: 支持服务器组件、更清晰的目录结构、内置的布局和加载状态管理等。

3. **Q: 如何在 Next.js 中实现客户端和服务器组件的混合使用？**
   A: 使用 'use client' 指令标记客户端组件，利用服务器组件进行数据获取和静态渲染。

### TypeScript

4. **Q: 什么是泛型？请举例说明。**
   A: 泛型允许我们创建可重用的组件，这些组件可以处理多种类型而不是单一类型。

5. **Q: 如何使用 Zod 进行表单验证？**
   A: 定义 Zod schema，然后使用 parse 或 safeParse 方法验证数据。

### Tailwind CSS

6. **Q: Tailwind CSS 的工作原理是什么？**
   A: 提供一组原子化的 CSS 类，通过组合这些类来构建用户界面。

7. **Q: 如何自定义 Tailwind CSS 的主题？**
   A: 在 tailwind.config.js 中配置 theme.extend 对象。

### Tiptap & 富文本编辑

8. **Q: Tiptap 是什么？它与 ProseMirror 的关系是什么？**
   A: Tiptap 是基于 ProseMirror 的无头富文本编辑器框架，提供更友好的 API。

9. **Q: 如何扩展 Tiptap 编辑器？**
   A: 创建自定义扩展，实现 addNodeView、addCommands 等方法。

---

## 后端面试题

### Node.js & Express

10. **Q: 解释一下 Node.js 的事件循环？**
    A: Node.js 使用单线程事件循环来处理非阻塞 I/O 操作。

11. **Q: 什么是中间件？在 Next.js Route Handler 中如何使用？**
    A: 中间件是处理请求和响应的函数，可以在 Next.js 中用于身份验证、日志记录等。

### PostgreSQL & Drizzle ORM

12. **Q: Drizzle ORM 相对于 Prisma 有什么优势？**
    A: Drizzle 提供类型安全的 SQL 查询构建器，性能更好，更接近原生 SQL。

13. **Q: 如何在 PostgreSQL 中实现全文搜索？**
    A: 使用 tsvector 和 tsquery，或结合 pgvector 实现语义搜索。

14. **Q: 解释一下数据库索引的工作原理？**
    A: 索引是数据结构，用于加速数据库查询操作。

### 实时协作 (Y.js & PartyKit)

15. **Q: 什么是 CRDT？**
    A: Conflict-free Replicated Data Type，用于在分布式系统中实现无冲突的数据同步。

16. **Q: Y.js 是如何实现实时协作的？**
    A: Y.js 使用 CRDT 算法，确保多个用户可以同时编辑同一文档而不会产生冲突。

---

## AI/ML 面试题

### AI SDK v6 & Agents

17. **Q: 什么是 ToolLoopAgent？**
    A: AI SDK 中的代理框架，支持工具调用和循环执行。

18. **Q: 如何区分客户端工具和服务端工具？**
    A: 客户端工具没有 execute 函数，会暂停代理循环等待用户输入；服务端工具有 execute 函数，会自动执行。

19. **Q: 解释一下 sendAutomaticallyWhen 的作用？**
    A: 用于配置何时自动发送下一轮请求，通常在所有工具都有输出后触发。

### RAG & 向量搜索

20. **Q: 什么是 RAG？**
    A: Retrieval-Augmented Generation，检索增强生成，结合信息检索和文本生成。

21. **Q: pgvector 是如何工作的？**
    A: PostgreSQL 扩展，用于存储和查询向量嵌入，支持近似最近邻搜索。

22. **Q: 为什么使用 halfvec(4000) 而不是普通向量？**
    A: 半精度向量可以节省 50% 的存储空间，同时保持较好的搜索质量。

### Prompt Engineering

23. **Q: 什么是 Few-shot Learning？**
    A: 在提示词中提供少量示例，帮助模型更好地理解任务。

24. **Q: 如何设计一个好的系统提示词？**
    A: 明确角色定义、任务说明、输出格式要求、约束条件等。

---

## DevOps 面试题

### Docker & Kubernetes

25. **Q: Docker 镜像和容器的区别是什么？**
    A: 镜像是静态的模板，容器是镜像的运行实例。

26. **Q: 什么是 Kubernetes Deployment？**
    A: 用于管理 Pod 的生命周期，支持滚动更新和回滚。

### Turborepo & 单体仓库

27. **Q: 单体仓库的优缺点是什么？**
    A: 优点：代码共享方便、统一构建；缺点：仓库体积大、构建时间可能更长。

28. **Q: Turborepo 是如何优化构建的？**
    A: 使用缓存和任务调度，只重新构建变更的包。

### CI/CD

29. **Q: 什么是持续集成和持续部署？**
    A: CI 是频繁地将代码合并到主干，CD 是自动将代码部署到生产环境。

---

## 系统设计题

参见 [system-design.md](./system-design.md) 文件。

---

## 💡 答题技巧

1. **STAR 原则**：对于行为问题，使用 Situation-Task-Action-Result 结构
2. **先画框图**：对于系统设计问题，先画出高层架构图
3. **权衡分析**：每个技术决策都要讨论利弊
4. **保持简洁**：回答问题要清晰、有条理
5. **诚实面对**：不知道的问题就说不知道，然后展示思考过程

---

## 📚 推荐资源

- [AI SDK 文档](https://sdk.vercel.ai)
- [Next.js 文档](https://nextjs.org/docs)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [System Design Primer](https://github.com/donnemartin/system-design-primer)
EOF~