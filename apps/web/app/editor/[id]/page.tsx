"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Editor } from "@/features/editor/components/Editor";

export default function EditorPage() {
  const params = useParams();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const noteId = params.id as string;
    if (noteId) {
      // Mock load - 实际应调用 API
      setTimeout(() => {
        setTitle("我的笔记");
        setContent("<p>欢迎使用 NexusNote 编辑器</p>");
        setLoading(false);
      }, 500);
    }
  }, [params.id]);

  const handleSave = async () => {
    // TODO: 保存到数据库
    console.log("Saving:", { title, content });
    alert("已保存");
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{
            width: 32,
            height: 32,
            border: "3px solid #e5e7eb",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
          }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <motion.input
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="笔记标题"
          style={{ fontSize: 24, fontWeight: "bold", border: "none", outline: "none", flex: 1 }}
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          style={{
            padding: "8px 20px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          保存
        </motion.button>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Editor content={content} onChange={setContent} placeholder="开始写作..." />
      </motion.div>
    </motion.div>
  );
}
