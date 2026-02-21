"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data - 实际应调用 API
    setTimeout(() => {
      setCards([
        {
          id: "1",
          front: "什么是 Machine Learning？",
          back: "机器学习是人工智能的一个分支，通过让计算机从数据中学习并改进性能，而无需明确编程。",
        },
        {
          id: "2",
          front: "监督学习的定义？",
          back: "监督学习是从有标签的训练数据中学习，建立输入到输出的映射关系。",
        },
        {
          id: "3",
          front: "神经网络的基本单元？",
          back: "神经元是神经网络的基本单元，接收输入、计算加权和并通过激活函数产生输出。",
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleNext = (quality: number) => {
    setFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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

  if (cards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ maxWidth: 600, margin: "0 auto", padding: 40, textAlign: "center" }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>闪卡复习</h1>
        <p style={{ color: "#666" }}>暂无闪卡，开始学习并创建闪卡吧！</p>
      </motion.div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: 20,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "20px 0",
          borderBottom: "1px solid #eee",
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>闪卡复习</h1>
        <span style={{ color: "#666" }}>
          {currentIndex + 1} / {cards.length}
        </span>
      </header>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={{ rotateX: 90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setFlipped(!flipped)}
            style={{
              width: "100%",
              minHeight: 300,
              padding: 32,
              background: flipped ? "#6366f1" : "#fff",
              color: flipped ? "#fff" : "#333",
              borderRadius: 16,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 20,
              transformStyle: "preserve-3d",
              perspective: 1000,
            }}
          >
            {flipped ? currentCard.back : currentCard.front}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ textAlign: "center", color: "#999", margin: "16px 0" }}
      >
        点击卡片翻转
      </motion.p>

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ display: "flex", gap: 12, justifyContent: "center", padding: "20px 0" }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNext(1)}
              style={{
                padding: "12px 24px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              忘记
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNext(2)}
              style={{
                padding: "12px 24px",
                background: "#f59e0b",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              模糊
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleNext(3)}
              style={{
                padding: "12px 24px",
                background: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              记住
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
