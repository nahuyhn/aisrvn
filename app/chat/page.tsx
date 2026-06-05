"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Project = {
  id: string;
  name: string;
};

type ChatSession = {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

const SUGGESTIONS = [
  "Lên ý tưởng AI wrapper SaaS",
  "Giải thích Next.js App Router",
  "Viết landing page cho app AI",
  "So sánh Gemini, GPT, Claude và DeepSeek",
];

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorText, setErrorText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeProject = useMemo(() => {
    return projects.find((project) => project.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchSearch = session.title
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchProject = activeProjectId
        ? session.projectId === activeProjectId
        : true;

      return matchSearch && matchProject;
    });
  }, [sessions, search, activeProjectId]);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      await Promise.all([loadProjects(), loadSessions()]);
      setIsLoadingData(false);
    }

    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects", {
        cache: "no-store",
      });

      const data = await res.json();

      if (res.ok) {
        setProjects(data.projects || []);
      }
    } catch {
      setErrorText("Không tải được danh sách project.");
    }
  }

  async function loadSessions() {
    try {
      const res = await fetch("/api/chat-sessions", {
        cache: "no-store",
      });

      const rawText = await res.text();

      let data: any = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          `API /api/chat-sessions không trả JSON. Status: ${
            res.status
          }. Response: ${rawText.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(
          data.error || `Không tải được lịch sử chat. Status: ${res.status}`
        );
      }

      setSessions(data.sessions || []);
      setErrorText("");
    } catch (error) {
      console.error("LOAD_SESSIONS_ERROR:", error);

      setErrorText(
        error instanceof Error ? error.message : "Không tải được lịch sử chat."
      );
    }
  }

  async function createProject() {
    const name = newProjectName.trim();

    if (!name) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không tạo được project.");
      }

      setProjects((prev) => [data.project, ...prev]);
      setActiveProjectId(data.project.id);
      setActiveSessionId(null);
      setMessages([]);
      setNewProjectName("");
      setShowProjectInput(false);
      setErrorText("");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không tạo được project."
      );
    }
  }

  async function deleteProject(projectId: string) {
    const ok = confirm(
      "Bạn có chắc muốn xóa project này không? Chat trong project sẽ được chuyển về Tất cả chat."
    );

    if (!ok) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Không xóa được project.");
      }

      setProjects((prev) => prev.filter((project) => project.id !== projectId));

      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        setActiveSessionId(null);
        setMessages([]);
      }

      await loadSessions();
      setErrorText("");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không xóa được project."
      );
    }
  }

  function startNewChat(projectId?: string | null) {
    setActiveSessionId(null);
    setActiveProjectId(projectId ?? activeProjectId);
    setMessages([]);
    setInput("");
    setErrorText("");
  }

  async function openSession(sessionId: string) {
    try {
      setErrorText("");

      const res = await fetch(`/api/chat-sessions/${sessionId}`, {
        cache: "no-store",
      });

      const rawText = await res.text();

      let data: any = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          "API mở lịch sử chat không trả về JSON. Kiểm tra file app/api/chat-sessions/[id]/route.ts."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Không mở được cuộc trò chuyện.");
      }

      setActiveSessionId(data.chatSession.id);
      setActiveProjectId(data.chatSession.projectId || null);
      setMessages(data.chatSession.messages || []);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Không mở được cuộc trò chuyện."
      );
    }
  }

  async function deleteSession(sessionId: string) {
    const ok = confirm("Bạn có chắc muốn xóa cuộc trò chuyện này không?");

    if (!ok) return;

    try {
      const res = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: "DELETE",
      });

      const rawText = await res.text();

      let data: any = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          `API xóa chat không trả JSON. Status: ${
            res.status
          }. Response: ${rawText.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Không xóa được cuộc trò chuyện.");
      }

      setSessions((prev) =>
        prev.filter((session) => session.id !== sessionId)
      );

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }

      setErrorText("");
    } catch (error) {
      console.error("DELETE_SESSION_ERROR:", error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không xóa được cuộc trò chuyện."
      );
    }
  }

  async function sendMessage(text?: string) {
    const messageText = (text || input).trim();

    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "USER",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setErrorText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          projectId: activeProjectId,
          message: messageText,
        }),
      });

      const rawText = await res.text();

      let data: any = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(rawText || "API không trả về JSON hợp lệ.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Chat failed");
      }

      setActiveSessionId(data.sessionId);

      if (data.chatSession) {
        setSessions((prev) => {
          const rest = prev.filter(
            (session) => session.id !== data.chatSession.id
          );

          return [data.chatSession, ...rest];
        });
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      await loadSessions();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Có lỗi khi gọi AI. Hãy kiểm tra Gemini API key.";

      setErrorText(message);

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: `Có lỗi khi gọi AI: ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-[#212121] text-white">
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/10 bg-black transition-all duration-300 ${
          sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
        }`}
      >
        <div className="flex h-full w-[280px] flex-col px-3 py-4">
          <div className="mb-5 flex items-center justify-between px-2">
            <button
              onClick={() => startNewChat(activeProjectId)}
              className="text-xl font-semibold hover:text-white/80"
            >
              AI Wrapper
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              title="Đóng sidebar"
            >
              ◧
            </button>
          </div>

          <button
            onClick={() => startNewChat(activeProjectId)}
            className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] hover:bg-white/10"
          >
            <span className="text-lg">✎</span>
            <span>New chat</span>
          </button>

          <div className="mb-5 flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/10">
            <span className="text-lg">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/45"
            />
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-sm font-semibold text-white/80">Projects</p>

              <button
                onClick={() => setShowProjectInput((prev) => !prev)}
                className="rounded-md px-2 py-1 text-sm text-white/60 hover:bg-white/10 hover:text-white"
                title="Tạo project"
              >
                +
              </button>
            </div>

            {showProjectInput && (
              <div className="mb-2 rounded-xl bg-[#202020] p-2">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createProject();
                  }}
                  placeholder="Tên project..."
                  className="w-full rounded-lg bg-[#303030] px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={createProject}
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black hover:bg-white/90"
                  >
                    Tạo
                  </button>

                  <button
                    onClick={() => {
                      setShowProjectInput(false);
                      setNewProjectName("");
                    }}
                    className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveProjectId(null);
                  setActiveSessionId(null);
                  setMessages([]);
                }}
                className={`w-full truncate rounded-xl px-3 py-2.5 text-left text-sm ${
                  activeProjectId === null
                    ? "bg-[#303030] text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                Tất cả chat
              </button>

              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-white/35">
                  Chưa có project
                </p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group flex items-center rounded-xl ${
                      activeProjectId === project.id
                        ? "bg-[#303030] text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveProjectId(project.id);
                        setActiveSessionId(null);
                        setMessages([]);
                      }}
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                      title={project.name}
                    >
                      <span className="mr-2">📁</span>
                      {project.name}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      className="mr-2 hidden rounded-md px-2 py-1 text-xs text-white/45 hover:bg-white/10 hover:text-red-300 group-hover:block"
                      title="Xóa project"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <p className="mb-2 px-3 text-sm font-semibold text-white/80">
              Chats
            </p>

            {isLoadingData ? (
              <div className="space-y-2 px-3">
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="px-3 py-2 text-sm leading-5 text-white/35">
                {search
                  ? "Không tìm thấy chat"
                  : activeProjectId
                    ? "Project này chưa có chat"
                    : "Chưa có lịch sử chat"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center rounded-xl ${
                      activeSessionId === session.id
                        ? "bg-[#303030] text-white"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <button
                      onClick={() => openSession(session.id)}
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                      title={session.title}
                    >
                      {session.title}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="mr-2 hidden rounded-md px-2 py-1 text-xs text-white/45 hover:bg-white/10 hover:text-red-300 group-hover:block"
                      title="Xóa chat"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-white/10 pt-3">
            <a
              href="/billing"
              className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-white/10"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                U
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-none">
                  Tài khoản
                </p>
                <p className="mt-1 text-xs text-white/50">Free plan</p>
              </div>
            </a>
          </div>
        </div>
      </aside>

      <section
        className={`min-h-screen flex-1 transition-all duration-300 ${
          sidebarOpen ? "pl-[280px]" : "pl-0"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[#212121]/90 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                title="Mở sidebar"
              >
                ☰
              </button>
            )}

            <div className="min-w-0">
              <p className="truncate text-lg font-medium">
                Gemini Flash · Free
              </p>

              <p className="truncate text-xs text-white/40">
                {activeProject
                  ? `Project: ${activeProject.name}`
                  : "Không thuộc project nào"}
              </p>
            </div>
          </div>

          <a
            href="/pricing"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
          >
            Upgrade
          </a>
        </header>

        {errorText && (
          <div className="mx-auto mt-4 max-w-3xl px-4">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorText}
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl flex-col items-center justify-center px-4 pb-28">
            <h1 className="text-center text-3xl font-semibold md:text-4xl">
              Tôi có thể giúp gì cho bạn?
            </h1>

            <p className="mt-3 text-center text-sm text-white/45">
              {activeProject
                ? `Cuộc trò chuyện mới sẽ được lưu trong project "${activeProject.name}".`
                : "Cuộc trò chuyện mới sẽ được lưu vào lịch sử chung."}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="mt-8 w-full"
            >
              <div className="rounded-[28px] bg-[#303030] p-3 shadow-xl">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={3}
                  disabled={isLoading}
                  placeholder="Nhắn tin cho AI Wrapper"
                  className="min-h-24 w-full resize-none bg-transparent px-3 py-3 text-base text-white outline-none placeholder:text-white/45"
                />

                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="rounded-full bg-[#424242] px-3 py-1.5 text-xs text-white/70">
                    Gemini Flash
                  </span>

                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-5 grid w-full gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => sendMessage(item)}
                  className="rounded-2xl border border-white/10 bg-[#2a2a2a] px-4 py-3 text-left text-sm text-white/70 hover:bg-[#333333] hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-3xl px-4 pb-40 pt-8">
              <div className="space-y-8">
                {messages.map((message) =>
                  message.role === "USER" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[80%] rounded-3xl bg-[#303030] px-5 py-3 text-[15px] leading-7">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                        AI
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">AI Wrapper</p>

                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(message.content)
                            }
                            className="rounded-lg px-2 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white"
                          >
                            Copy
                          </button>
                        </div>

                        <div className="whitespace-pre-wrap text-[15px] leading-8 text-white/85">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  )
                )}

                {isLoading && (
                  <div className="flex gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                      AI
                    </div>

                    <div className="flex-1 space-y-3 pt-2">
                      <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
                      <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
                      <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/10" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div
              className={`fixed bottom-0 right-0 z-40 bg-[#212121] px-4 pb-5 pt-3 transition-all duration-300 ${
                sidebarOpen ? "left-[280px]" : "left-0"
              }`}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="mx-auto max-w-3xl"
              >
                <div className="rounded-[28px] bg-[#303030] p-2 shadow-xl">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    disabled={isLoading}
                    placeholder="Nhắn tin cho AI Wrapper"
                    className="max-h-36 min-h-11 w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-white/45"
                  />

                  <div className="flex items-center justify-between px-2 pb-1">
                    <span className="text-xs text-white/35">
                      Gemini Flash · Free
                    </span>

                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ↑
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-center text-xs text-white/25">
                  AI có thể trả lời sai. Hãy kiểm tra lại thông tin quan trọng.
                </p>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}