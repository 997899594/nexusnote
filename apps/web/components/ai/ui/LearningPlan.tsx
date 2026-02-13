"use client";

import { BookOpen, ChevronRight, Clock, Target } from "lucide-react";

interface LearningPlanProps {
  topic: string;
  duration: string;
  level: "beginner" | "intermediate" | "advanced";
  phases?: Array<{
    name: string;
    tasks: string[];
  }>;
}

const levelLabels = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "高级",
};

const levelColors = {
  beginner: "bg-green-100 text-green-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-purple-100 text-purple-700",
};

export function LearningPlan({ topic, duration, level, phases }: LearningPlanProps) {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 my-2">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">学习计划</h3>
            <p className="text-sm text-gray-600">{topic}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${levelColors[level]}`}>
          {levelLabels[level]}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{duration}</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          <span>{phases?.length || 0} 个阶段</span>
        </div>
      </div>

      {phases && phases.length > 0 && (
        <div className="space-y-3">
          {phases.map((phase, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border border-indigo-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-medium text-indigo-600">
                  {i + 1}
                </div>
                <span className="font-medium text-gray-900">{phase.name}</span>
              </div>
              <ul className="space-y-1 pl-8">
                {phase.tasks.map((task, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(!phases || phases.length === 0) && (
        <div className="text-sm text-gray-500 italic">正在生成详细计划...</div>
      )}
    </div>
  );
}
