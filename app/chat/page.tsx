
"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

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

type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  attachments?: ChatAttachment[];
};

type AttachedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

type AiModel = {
  id: string;
  provider: string;
  model: string;
  displayName: string;
  description: string | null;
  category: string;
  supportsImage: boolean;
  supportsFile: boolean;
  isFree: boolean;
  sortOrder: number;
};

type ApiError = {
  error?: string;
};

type ProjectsResponse = ApiError & {
  projects?: Project[];
  project?: Project;
};

type SessionsResponse = ApiError & {
  sessions?: ChatSession[];
};

type ModelsResponse = ApiError & {
  models?: AiModel[];
};

type ChatSessionDetailResponse = ApiError & {
  chatSession?: ChatSession & {
    messages?: ChatMessage[];
  };
};

type SendMessageResponse = ApiError & {
  answer?: string;
  sessionId?: string;
  isGuest?: boolean;
  chatSession?: ChatSession;
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_COUNT = 4;

async function readJson<T>(response: Response, apiName: string): Promise<T> {
  const rawText = await response.text();

  if (!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    throw new Error(
      `${apiName} không trả về JSON hợp lệ. Status: ${
        response.status
      }. Response: ${rawText.slice(0, 200)}`
    );
  }
}

export default function ChatPage() {
  const { data: session } = useSession();

const displayName =
  session?.user?.name?.trim() ||
  session?.user?.email?.split("@")[0] ||
  "Người dùng";

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProject = useMemo(() => {
    return projects.find((project) => project.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const selectedModel = useMemo(() => {
    return (
      models.find((model) => model.id === selectedModelId) ||
      models[0] ||
      null
    );
  }, [models, selectedModelId]);

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesSearch =
        !normalizedSearch ||
        session.title.toLowerCase().includes(normalizedSearch);

      const matchesProject = activeProjectId
        ? session.projectId === activeProjectId
        : true;

      return matchesSearch && matchesProject;
    });
  }, [sessions, search, activeProjectId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    function syncSidebar() {
      setSidebarOpen(mediaQuery.matches);
    }

    syncSidebar();
    mediaQuery.addEventListener("change", syncSidebar);

    return () => {
      mediaQuery.removeEventListener("change", syncSidebar);
    };
  }, []);

  useEffect(() => {
    async function init() {
      setIsLoadingData(true);

      await Promise.all([loadProjects(), loadSessions(), loadModels()]);

      setIsLoadingData(false);
    }

    void init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isLoading]);

  function closeSidebarOnMobile() {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }

  function focusComposer() {
    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  }

  async function loadProjects() {
    try {
      const response = await fetch("/api/projects", {
        cache: "no-store",
      });

      const data = await readJson<ProjectsResponse>(
        response,
        "API /api/projects"
      );

      if (!response.ok) {
        if (response.status === 401) {
          setProjects([]);
          setActiveProjectId(null);
          return;
        }

        throw new Error(
          data.error ||
            `Không tải được danh sách dự án. Status: ${response.status}`
        );
      }

      setProjects(data.projects || []);
    } catch (error) {
      console.error("LOAD_PROJECTS_ERROR:", error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách dự án."
      );
    }
  }

  async function loadSessions() {
    try {
      const response = await fetch("/api/chat-sessions", {
        cache: "no-store",
      });

      const data = await readJson<SessionsResponse>(
        response,
        "API /api/chat-sessions"
      );

      if (!response.ok) {
        if (response.status === 401) {
          setSessions([]);
          return;
        }

        throw new Error(
          data.error ||
            `Không tải được lịch sử chat. Status: ${response.status}`
        );
      }

      setSessions(data.sessions || []);
    } catch (error) {
      console.error("LOAD_SESSIONS_ERROR:", error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không tải được lịch sử chat."
      );
    }
  }

  async function loadModels() {
    try {
      const response = await fetch("/api/models", {
        cache: "no-store",
      });

      const data = await readJson<ModelsResponse>(
        response,
        "API /api/models"
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Không tải được danh sách model AI."
        );
      }

      const nextModels = data.models || [];

      setModels(nextModels);

      setSelectedModelId((currentModelId) => {
        const currentModelStillExists = nextModels.some(
          (model) => model.id === currentModelId
        );

        if (currentModelStillExists) {
          return currentModelId;
        }

        return nextModels[0]?.id || null;
      });
    } catch (error) {
      console.error("LOAD_MODELS_ERROR:", error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách model AI."
      );
    }
  }

  async function createProject() {
    const name = newProjectName.trim();

    if (!name) {
      setErrorText("Hãy nhập tên dự án.");
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await readJson<ProjectsResponse>(
        response,
        "API tạo dự án"
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Bạn cần đăng nhập để tạo dự án.");
        }

        throw new Error(data.error || "Không tạo được dự án.");
      }

      if (!data.project) {
        throw new Error("API không trả về dự án vừa tạo.");
      }

      setProjects((previousProjects) => [
        data.project as Project,
        ...previousProjects,
      ]);

      setActiveProjectId(data.project.id);
      setActiveSessionId(null);
      setMessages([]);
      setAttachedFiles([]);
      setNewProjectName("");
      setShowProjectInput(false);
      setErrorText("");

      closeSidebarOnMobile();
      focusComposer();
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không tạo được dự án."
      );
    }
  }

  async function deleteProject(projectId: string) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa dự án này không? Các cuộc trò chuyện sẽ được chuyển về mục Tất cả."
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await readJson<ApiError>(
        response,
        "API xóa dự án"
      );

      if (!response.ok) {
        throw new Error(data.error || "Không xóa được dự án.");
      }

      setProjects((previousProjects) =>
        previousProjects.filter((project) => project.id !== projectId)
      );

      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        setActiveSessionId(null);
        setMessages([]);
        setAttachedFiles([]);
      }

      await loadSessions();
      setErrorText("");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không xóa được dự án."
      );
    }
  }

  function startNewChat(projectId?: string | null) {
    const nextProjectId =
      projectId === undefined ? activeProjectId : projectId;

    setActiveSessionId(null);
    setActiveProjectId(nextProjectId);
    setMessages([]);
    setInput("");
    setAttachedFiles([]);
    setErrorText("");

    closeSidebarOnMobile();
    focusComposer();
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId);
    setActiveSessionId(null);
    setMessages([]);
    setAttachedFiles([]);
    setErrorText("");

    closeSidebarOnMobile();
    focusComposer();
  }

  function selectAllChats() {
    setActiveProjectId(null);
    setActiveSessionId(null);
    setMessages([]);
    setAttachedFiles([]);
    setErrorText("");

    closeSidebarOnMobile();
    focusComposer();
  }

  async function openSession(sessionId: string) {
    try {
      setErrorText("");

      const response = await fetch(`/api/chat-sessions/${sessionId}`, {
        cache: "no-store",
      });

      const data = await readJson<ChatSessionDetailResponse>(
        response,
        "API mở cuộc trò chuyện"
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Không mở được cuộc trò chuyện."
        );
      }

      if (!data.chatSession) {
        throw new Error("Không tìm thấy dữ liệu cuộc trò chuyện.");
      }

      setActiveSessionId(data.chatSession.id);
      setActiveProjectId(data.chatSession.projectId || null);
      setMessages(data.chatSession.messages || []);
      setAttachedFiles([]);
      setErrorText("");

      closeSidebarOnMobile();
      focusComposer();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Không mở được cuộc trò chuyện."
      );
    }
  }

  async function deleteSession(sessionId: string) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa cuộc trò chuyện này không?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: "DELETE",
      });

      const data = await readJson<ApiError>(
        response,
        "API xóa cuộc trò chuyện"
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Không xóa được cuộc trò chuyện."
        );
      }

      setSessions((previousSessions) =>
        previousSessions.filter((session) => session.id !== sessionId)
      );

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setAttachedFiles([]);
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

  function addImageFile(file: File) {
    if (file.size > MAX_IMAGE_SIZE) {
      setErrorText(
        `Ảnh "${file.name || "clipboard-image"}" vượt quá 10MB.`
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string") return;

      setAttachedFiles((previousFiles) => [
        ...previousFiles,
        {
          id: crypto.randomUUID(),
          name: file.name || `pasted-image-${Date.now()}.png`,
          type: file.type || "image/png",
          size: file.size,
          dataUrl: result,
        },
      ]);
    };

    reader.readAsDataURL(file);
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    event.target.value = "";

    if (files.length === 0) return;

    if (!selectedModel?.supportsImage) {
      setErrorText("Model đang chọn chưa hỗ trợ đọc ảnh.");
      return;
    }

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== files.length) {
      setErrorText("Hiện tại AI SITIKI chỉ hỗ trợ đính kèm ảnh.");
    }

    const availableSlots = Math.max(
      0,
      MAX_IMAGE_COUNT - attachedFiles.length
    );

    if (availableSlots === 0) {
      setErrorText(`Mỗi tin nhắn chỉ được gửi tối đa ${MAX_IMAGE_COUNT} ảnh.`);
      return;
    }

    if (imageFiles.length > availableSlots) {
      setErrorText(
        `Mỗi tin nhắn chỉ được gửi tối đa ${MAX_IMAGE_COUNT} ảnh.`
      );
    }

    imageFiles.slice(0, availableSlots).forEach(addImageFile);
  }

  function handlePaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) {
    const items = Array.from(event.clipboardData.items);

    const imageItems = items.filter((item) =>
      item.type.startsWith("image/")
    );

    if (imageItems.length === 0) return;

    if (!selectedModel?.supportsImage) {
      event.preventDefault();
      setErrorText("Model đang chọn chưa hỗ trợ đọc ảnh.");
      return;
    }

    const availableSlots = Math.max(
      0,
      MAX_IMAGE_COUNT - attachedFiles.length
    );

    if (availableSlots === 0) {
      event.preventDefault();
      setErrorText(`Mỗi tin nhắn chỉ được gửi tối đa ${MAX_IMAGE_COUNT} ảnh.`);
      return;
    }

    event.preventDefault();

    imageItems.slice(0, availableSlots).forEach((item) => {
      const file = item.getAsFile();

      if (file) {
        addImageFile(file);
      }
    });
  }

  function removeAttachedFile(fileId: string) {
    setAttachedFiles((previousFiles) =>
      previousFiles.filter((file) => file.id !== fileId)
    );
  }

  async function copyMessage(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);

      window.setTimeout(() => {
        setCopiedMessageId((currentId) =>
          currentId === messageId ? null : currentId
        );
      }, 1500);
    } catch {
      setErrorText("Không sao chép được nội dung.");
    }
  }

  async function sendMessage(customText?: string) {
    const messageText = (customText ?? input).trim();

    if ((!messageText && attachedFiles.length === 0) || isLoading) {
      return;
    }

    if (!selectedModelId) {
      setErrorText("Hiện chưa có model AI khả dụng.");
      return;
    }

    if (attachedFiles.length > 0 && !selectedModel?.supportsImage) {
      setErrorText("Model đang chọn chưa hỗ trợ đọc ảnh.");
      return;
    }

    const messageAttachments: ChatAttachment[] = attachedFiles.map(
      (file) => ({
        id: file.id,
        name: file.name,
        type: file.type,
        dataUrl: file.dataUrl,
      })
    );

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "USER",
      content:
        messageText ||
        (messageAttachments.length > 0 ? "Đã gửi ảnh." : ""),
      attachments: messageAttachments,
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
    ]);

    setInput("");
    setAttachedFiles([]);
    setIsLoading(true);
    setErrorText("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          projectId: activeProjectId,
          modelId: selectedModelId,
          message:
            messageText ||
            (messageAttachments.length > 0
              ? "Hãy mô tả nội dung trong ảnh này."
              : ""),
          attachments: messageAttachments.map((file) => ({
            name: file.name,
            type: file.type,
            dataUrl: file.dataUrl,
          })),
        }),
      });

      const data = await readJson<SendMessageResponse>(
        response,
        "API chat"
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Không thể nhận phản hồi từ AI."
        );
      }

      if (!data.answer) {
        throw new Error("AI không trả về nội dung.");
      }

      if (data.isGuest) {
        setActiveSessionId(null);
      } else if (data.sessionId) {
        setActiveSessionId(data.sessionId);

        if (data.chatSession) {
          setSessions((previousSessions) => {
            const remainingSessions = previousSessions.filter(
              (session) => session.id !== data.chatSession?.id
            );

            return [
              data.chatSession as ChatSession,
              ...remainingSessions,
            ];
          });
        }
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ASSISTANT",
        content: data.answer,
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        assistantMessage,
      ]);

      if (!data.isGuest) {
        await loadSessions();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể nhận phản hồi từ AI. Vui lòng thử lại.";

      setErrorText(message);

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: crypto.randomUUID(),
          role: "ASSISTANT",
          content: `Không thể trả lời: ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      focusComposer();
    }
  }

  const attachmentPreview =
    attachedFiles.length > 0 ? (
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        {attachedFiles.map((file) => (
          <div
            key={file.id}
            className="relative h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-black/30"
          >
            <img
              src={file.dataUrl}
              alt={file.name}
              className="h-full w-full object-cover"
            />

            <button
              type="button"
              onClick={() => removeAttachedFile(file.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-sm text-white transition hover:bg-red-500"
              aria-label={`Xóa ảnh ${file.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const composer = (
    <div className="rounded-[26px] border border-white/5 bg-[#303030] p-2 shadow-2xl">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onPaste={handlePaste}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void sendMessage();
          }
        }}
        rows={messages.length === 0 ? 3 : 1}
        disabled={isLoading}
        placeholder="Nhắn tin cho AI SITIKI"
        className={`w-full resize-none bg-transparent px-4 py-3 text-[15px] text-white outline-none placeholder:text-white/40 ${
          messages.length === 0
            ? "min-h-24"
            : "max-h-40 min-h-11"
        }`}
      />

      {attachmentPreview}

      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <label
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              selectedModel?.supportsImage
                ? "cursor-pointer bg-[#424242] text-white/70 hover:bg-[#4a4a4a]"
                : "cursor-not-allowed bg-white/5 text-white/25"
            }`}
            title={
              selectedModel?.supportsImage
                ? "Đính kèm ảnh"
                : "Model này chưa hỗ trợ ảnh"
            }
          >
            + Ảnh

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={!selectedModel?.supportsImage}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <span className="max-w-[150px] truncate text-xs text-white/35 sm:max-w-[240px]">
            {selectedModel?.displayName || "Đang tải model..."}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={
            isLoading ||
            !selectedModelId ||
            (!input.trim() && attachedFiles.length === 0)
          }
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Gửi tin nhắn"
        >
          ↑
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex min-h-[100dvh] overflow-x-hidden bg-[#212121] text-white">
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          aria-label="Đóng danh sách trò chuyện"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[280px] flex-col border-r border-white/10 bg-black transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-5 flex items-center justify-between px-2">
            <button
              type="button"
              onClick={() => startNewChat(null)}
              className="text-left transition hover:opacity-80"
            >
              <span className="block text-lg font-bold tracking-tight">
                AI SITIKI
              </span>

              <span className="block text-[10px] text-white/40">
                AI siêu tiết kiệm
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white"
              title="Thu gọn"
              aria-label="Thu gọn danh sách trò chuyện"
            >
              ‹
            </button>
          </div>

          <button
            type="button"
            onClick={() => startNewChat()}
            className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition hover:bg-white/10"
          >
            <span className="text-lg">✎</span>
            <span>Chat mới</span>
          </button>

          <div className="mb-5 flex items-center gap-3 rounded-xl px-3 py-2.5 transition focus-within:bg-white/10 hover:bg-white/10">
            <span className="text-lg text-white/50">⌕</span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm cuộc trò chuyện"
              className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
            />
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-sm font-semibold text-white/75">
                Dự án
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowProjectInput((previousValue) => !previousValue)
                }
                className="rounded-lg px-2 py-1 text-sm text-white/50 transition hover:bg-white/10 hover:text-white"
                title="Tạo dự án"
              >
                +
              </button>
            </div>

            {showProjectInput && (
              <div className="mb-2 rounded-xl bg-[#202020] p-2">
                <input
                  value={newProjectName}
                  onChange={(event) =>
                    setNewProjectName(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void createProject();
                    }
                  }}
                  placeholder="Tên dự án"
                  className="w-full rounded-lg bg-[#303030] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                  autoFocus
                />

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void createProject()}
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-white/85"
                  >
                    Tạo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProjectInput(false);
                      setNewProjectName("");
                    }}
                    className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <button
                type="button"
                onClick={selectAllChats}
                className={`w-full truncate rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeProjectId === null
                    ? "bg-[#303030] text-white"
                    : "text-white/55 hover:bg-white/10 hover:text-white"
                }`}
              >
                Tất cả
              </button>

              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-white/30">
                  Chưa có dự án
                </p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group flex items-center rounded-xl transition ${
                      activeProjectId === project.id
                        ? "bg-[#303030] text-white"
                        : "text-white/55 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectProject(project.id)}
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                      title={project.name}
                    >
                      <span className="mr-2">▱</span>
                      {project.name}
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteProject(project.id);
                      }}
                      className="mr-2 hidden rounded-md px-2 py-1 text-xs text-white/40 transition hover:bg-white/10 hover:text-red-300 group-hover:block"
                      title="Xóa dự án"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="mb-2 px-3 text-sm font-semibold text-white/75">
              Lịch sử
            </p>

            {isLoadingData ? (
              <div className="space-y-3 px-3 py-2">
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="px-3 py-2 text-sm leading-5 text-white/30">
                {search
                  ? "Không tìm thấy"
                  : activeProjectId
                    ? "Dự án chưa có chat"
                    : "Chưa có lịch sử"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center rounded-xl transition ${
                      activeSessionId === session.id
                        ? "bg-[#303030] text-white"
                        : "text-white/55 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void openSession(session.id)}
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm"
                      title={session.title}
                    >
                      {session.title}
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteSession(session.id);
                      }}
                      className="mr-2 hidden rounded-md px-2 py-1 text-xs text-white/40 transition hover:bg-white/10 hover:text-red-300 group-hover:block"
                      title="Xóa cuộc trò chuyện"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <Link
  href="/billing"
  className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-white/10"
>
  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-black">
    {displayName.charAt(0).toUpperCase()}
  </div>

  <div className="min-w-0">
    <p className="truncate text-sm font-medium leading-none">
      {displayName}
    </p>

    <p className="mt-1 truncate text-xs text-white/40">
      Xem gói dịch vụ
    </p>
  </div>
</Link>
          </div>
        </div>
      </aside>

      <section
        className={`min-w-0 flex-1 transition-[padding] duration-300 ${
          sidebarOpen ? "md:pl-[280px]" : "pl-0"
        }`}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/5 bg-[#212121]/90 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-white/65 transition hover:bg-white/10 hover:text-white"
                title="Mở danh sách trò chuyện"
                aria-label="Mở danh sách trò chuyện"
              >
                ☰
              </button>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <select
                  value={selectedModelId || ""}
                  onChange={(event) => {
                    setSelectedModelId(event.target.value);
                    setAttachedFiles([]);
                    setErrorText("");
                  }}
                  disabled={models.length === 0}
                  className="max-w-[175px] rounded-xl border border-white/10 bg-[#303030] px-3 py-2 text-sm text-white outline-none disabled:opacity-40 sm:max-w-[220px]"
                  aria-label="Chọn model AI"
                >
                  {models.length === 0 ? (
                    <option value="">Không có model</option>
                  ) : (
                    models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName}
                      </option>
                    ))
                  )}
                </select>

                {selectedModel?.isFree && (
                  <span className="hidden rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/40 sm:inline">
                    MIỄN PHÍ
                  </span>
                )}
              </div>

              {activeProject && (
                <p className="mt-1 max-w-[190px] truncate text-xs text-white/35">
                  {activeProject.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href="/billing"
              className="hidden rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Thanh toán
            </Link>

            <Link
              href="/terms"
              className="hidden rounded-xl px-3 py-2 text-sm text-white/50 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            >
              Điều khoản
            </Link>

            <Link
              href="/billing#plans"
              className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/85 sm:px-4"
            >
              Nâng cấp
            </Link>
          </div>
        </header>

        {selectedModel?.isFree && (
          <div className="mx-auto mt-4 w-full max-w-3xl px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Đang dùng Gemini miễn phí
                </p>

                <p className="mt-1 text-xs leading-5 text-white/40">
                  Phù hợp trải nghiệm cơ bản. Nâng cấp để dùng OpenAI.
                </p>
              </div>

              <Link
                href="/billing#plans"
                className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/85"
              >
                Xem gói
              </Link>
            </div>
          </div>
        )}

        {errorText && (
          <div className="mx-auto mt-4 max-w-3xl px-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <span className="min-w-0">{errorText}</span>

              <button
                type="button"
                onClick={() => setErrorText("")}
                className="shrink-0 text-red-200/60 transition hover:text-red-100"
                aria-label="Đóng thông báo lỗi"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-[calc(100dvh-150px)] max-w-3xl flex-col items-center justify-center px-4 pb-10 pt-8">
            <div className="mb-5">
  <Image
    src="/aisitiki-logo.jpg"
    alt="AI SITIKI"
    width={72}
    height={72}
    className="mx-auto h-[72px] w-[72px] rounded-2xl object-contain"
    priority
  />
</div>

<h1 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">
  Bạn muốn hỏi gì?
</h1>

            <p className="mt-3 text-center text-sm text-white/40">
  {selectedModel?.isFree
    ? "Bản hiện tại dùng Gemini miễn phí. Nâng cấp để dùng OpenAI."
    : "Bắt đầu cuộc trò chuyện với AI SITIKI."}
</p>


            <form
  onSubmit={(event) => {
    event.preventDefault();
    void sendMessage();
  }}
  className="mt-8 w-full"
>
  {composer}
</form>

            <p className="mt-3 text-center text-xs text-white/25">
              AI có thể trả lời sai. Hãy kiểm tra thông tin quan trọng.
            </p>
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-3xl px-4 pb-44 pt-8">
              <div className="space-y-8">
                {messages.map((message) => {
                  if (message.role === "SYSTEM") {
                    return (
                      <div
                        key={message.id}
                        className="text-center text-xs text-white/30"
                      >
                        {message.content}
                      </div>
                    );
                  }

                  if (message.role === "USER") {
                    return (
                      <div key={message.id} className="flex justify-end">
                        <div className="max-w-[88%] rounded-3xl bg-[#303030] px-5 py-3 text-[15px] leading-7 sm:max-w-[80%]">
                          {message.attachments &&
                            message.attachments.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {message.attachments.map((file) => (
                                  <img
                                    key={file.id}
                                    src={file.dataUrl}
                                    alt={file.name}
                                    className="max-h-64 max-w-full rounded-2xl border border-white/10 object-contain"
                                  />
                                ))}
                              </div>
                            )}

                          {message.content && (
                            <div className="whitespace-pre-wrap break-words">
                              {message.content}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="flex gap-3 sm:gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-black">
                        AI
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">
                            AI SITIKI
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void copyMessage(
                                message.id,
                                message.content
                              )
                            }
                            className="rounded-lg px-2 py-1 text-xs text-white/35 transition hover:bg-white/10 hover:text-white"
                          >
                            {copiedMessageId === message.id
                              ? "Đã chép"
                              : "Sao chép"}
                          </button>
                        </div>

                        <div className="whitespace-pre-wrap break-words text-[15px] leading-8 text-white/85">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-3 sm:gap-4">
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
              className={`fixed bottom-0 right-0 z-30 bg-[#212121]/95 px-3 pb-4 pt-3 backdrop-blur transition-[left] duration-300 sm:px-4 ${
                sidebarOpen ? "left-0 md:left-[280px]" : "left-0"
              }`}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendMessage();
                }}
                className="mx-auto max-w-3xl"
              >
                {composer}

                <p className="mt-2 text-center text-xs text-white/25">
                  AI có thể trả lời sai. Hãy kiểm tra thông tin quan trọng.
                </p>
              </form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
