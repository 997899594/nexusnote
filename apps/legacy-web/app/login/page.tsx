"use client";

import { Brain, Github, Mail, Shield, Zap } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("credentials", {
        email,
        name,
        callbackUrl: "/",
      });
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">NexusNote</h1>
          <p className="text-slate-500 text-center mb-8">AI-Powered second brain</p>

          <div className="space-y-4">
            <button
              onClick={() => signIn("github", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>

            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              <Mail className="w-5 h-5 text-red-500" />
              Continue with Google
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-slate-400">Or development login</span>
              </div>
            </div>

            <form onSubmit={handleDevLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Demo User"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Enter Workspace"}
              </button>
            </form>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-4 h-4 text-indigo-500" />
              <span>Local-First Sync</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Zap className="w-4 h-4 text-indigo-500" />
              <span>AI-Native Search</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
