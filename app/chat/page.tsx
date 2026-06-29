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

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  attachments?: ChatAttachment[];
};

type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  kind: "image" | "file";
  size?: number;
  dataUrl?: string;
  textContent?: string;
};

type AttachedFile = ChatAttachment;

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
      }. Response: ${rawText.slice(0, 200)}`,
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
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [showProjectInput, setShowProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const activeProject = useMemo(() => {
    return projects.find((project) => project.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const selectedModel = useMemo(() => {
    return (
      models.find((model) => model.id === selectedModelId) || models[0] || null
    );
  }, [models, selectedModelId]);

  const normalizedSessionSearch = normalizeSearchText(sessionSearch);

  const filteredSessions = sessions.filter((session) => {
    const matchProject = activeProjectId
      ? session.projectId === activeProjectId
      : true;

    const matchSearch = normalizedSessionSearch
      ? normalizeSearchText(session.title).includes(normalizedSessionSearch)
      : true;

    return matchProject && matchSearch;
  });

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

  function truncateClientText(text: string, maxChars: number) {
    if (text.length <= maxChars) return text;

    return (
      text.slice(0, maxChars).trim() +
      "\n\n[Nội dung tệp đã được rút gọn để tiết kiệm xử lý.]"
    );
  }

  async function compressImageToDataUrl(file: File): Promise<string> {
    const imageBitmap = await createImageBitmap(file);

    const maxSize = 1280;
    let { width, height } = imageBitmap;

    if (width > height && width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else if (height >= width && height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Không thể xử lý ảnh.");
    }

    ctx.drawImage(imageBitmap, 0, 0, width, height);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    while (dataUrl.length > 1_500_000 && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }

    if (dataUrl.length > 3_500_000) {
      throw new Error("Ảnh vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác.");
    }

    return dataUrl;
  }

  async function extractTextFromUploadedFile(file: File): Promise<string> {
    const lowerName = file.name.toLowerCase();

    if (file.type.startsWith("text/") || lowerName.endsWith(".txt")) {
      const text = await file.text();
      return truncateClientText(text, 12_000);
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/files/parse", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as {
      error?: string;
      textContent?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Không đọc được file.");
    }

    if (!data.textContent) {
      throw new Error("File không có nội dung đọc được.");
    }

    return data.textContent;
  }
  function resetComposerHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        id: crypto.randomUUID(),
        role: "SYSTEM",
        content: "Đã dừng phản hồi.",
      },
    ]);

    focusComposer();
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
        "API /api/projects",
      );

      if (!response.ok) {
        if (response.status === 401) {
          setProjects([]);
          setActiveProjectId(null);
          return;
        }

        throw new Error(
          data.error ||
            `Không tải được danh sách dự án. Status: ${response.status}`,
        );
      }

      setProjects(data.projects || []);
    } catch (error) {
      console.error("LOAD_PROJECTS_ERROR:", error);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách dự án.",
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
        "API /api/chat-sessions",
      );

      if (!response.ok) {
        if (response.status === 401) {
          setSessions([]);
          return;
        }

        throw new Error(
          data.error ||
            `Không tải được lịch sử chat. Status: ${response.status}`,
        );
      }

      setSessions(data.sessions || []);
    } catch (error) {
      console.error("LOAD_SESSIONS_ERROR:", error);

      setErrorText(
        error instanceof Error ? error.message : "Không tải được lịch sử chat.",
      );
    }
  }

  async function loadModels() {
    try {
      const response = await fetch("/api/models");
      const data = await readJson<ModelsResponse>(response, "API danh sách AI");

      if (!response.ok) {
        throw new Error(data.error || "Không tải được AI.");
      }

      const nextModels = data.models || [];

      setModels(nextModels);

      if (nextModels.length > 0) {
        setSelectedModelId((currentModelId) => {
          const currentModelStillExists = nextModels.some(
            (model) => model.id === currentModelId,
          );

          return currentModelStillExists ? currentModelId : nextModels[0].id;
        });
      }
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không tải được AI.",
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

      const data = await readJson<ProjectsResponse>(response, "API tạo dự án");

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
        error instanceof Error ? error.message : "Không tạo được dự án.",
      );
    }
  }

  async function deleteProject(projectId: string) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa dự án này không? Các cuộc trò chuyện sẽ được chuyển về mục Tất cả.",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await readJson<ApiError>(response, "API xóa dự án");

      if (!response.ok) {
        throw new Error(data.error || "Không xóa được dự án.");
      }

      setProjects((previousProjects) =>
        previousProjects.filter((project) => project.id !== projectId),
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
        error instanceof Error ? error.message : "Không xóa được dự án.",
      );
    }
  }
  function normalizeSearchText(text: string) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
  async function renameProject(projectId: string, currentName: string) {
    const name = window.prompt("Nhập tên project mới:", currentName)?.trim();

    if (!name || name === currentName) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await readJson<ProjectsResponse>(
        response,
        "API đổi tên project",
      );

      if (!response.ok) {
        throw new Error(data.error || "Không đổi tên được project.");
      }

      if (!data.project) {
        throw new Error("API không trả về project đã cập nhật.");
      }

      setProjects((previousProjects) =>
        previousProjects.map((project) =>
          project.id === projectId
            ? {
                ...project,
                name: data.project?.name || name,
              }
            : project,
        ),
      );

      setErrorText("");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Không đổi tên được project.",
      );
    }
  }

  function startNewChat(projectId?: string | null) {
    const nextProjectId = projectId === undefined ? activeProjectId : projectId;

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
        "API mở cuộc trò chuyện",
      );

      if (!response.ok) {
        throw new Error(data.error || "Không mở được cuộc trò chuyện.");
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
          : "Không mở được cuộc trò chuyện.",
      );
    }
  }

  async function renameSession(sessionId: string, currentTitle: string) {
    const title = window
      .prompt("Nhập tên cuộc trò chuyện mới:", currentTitle)
      ?.trim();

    if (!title || title === currentTitle) return;

    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      const data = await readJson<ChatSessionDetailResponse>(
        response,
        "API đổi tên cuộc trò chuyện",
      );

      if (!response.ok) {
        throw new Error(data.error || "Không đổi tên được cuộc trò chuyện.");
      }

      if (!data.chatSession) {
        throw new Error("API không trả về cuộc trò chuyện đã cập nhật.");
      }

      setSessions((previousSessions) =>
        previousSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: data.chatSession?.title || title,
                updatedAt: data.chatSession?.updatedAt || session.updatedAt,
              }
            : session,
        ),
      );

      setErrorText("");
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Không đổi tên được cuộc trò chuyện.",
      );
    }
  }

  async function moveSessionToProject(
    sessionId: string,
    nextProjectId: string | null,
  ) {
    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ projectId: nextProjectId }),
      });

      const data = await readJson<ChatSessionDetailResponse>(
        response,
        "API chuyển cuộc trò chuyện",
      );

      if (!response.ok) {
        throw new Error(data.error || "Không chuyển được cuộc trò chuyện.");
      }

      if (!data.chatSession) {
        throw new Error("API không trả về cuộc trò chuyện đã cập nhật.");
      }

      setSessions((previousSessions) =>
        previousSessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                projectId: data.chatSession?.projectId || null,
                updatedAt: data.chatSession?.updatedAt || session.updatedAt,
              }
            : session,
        ),
      );

      if (activeSessionId === sessionId) {
        setActiveProjectId(data.chatSession.projectId || null);
      }

      setDraggingSessionId(null);
      setErrorText("");
    } catch (error) {
      setDraggingSessionId(null);

      setErrorText(
        error instanceof Error
          ? error.message
          : "Không chuyển được cuộc trò chuyện.",
      );
    }
  }

  async function deleteSession(sessionId: string) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa cuộc trò chuyện này không?",
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/chat-sessions/${sessionId}`, {
        method: "DELETE",
      });

      const data = await readJson<ApiError>(
        response,
        "API xóa cuộc trò chuyện",
      );

      if (!response.ok) {
        throw new Error(data.error || "Không xóa được cuộc trò chuyện.");
      }

      setSessions((previousSessions) =>
        previousSessions.filter((session) => session.id !== sessionId),
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
          : "Không xóa được cuộc trò chuyện.",
      );
    }
  }

  function addImageFile(file: File) {
    if (file.size > MAX_IMAGE_SIZE) {
      setErrorText(`Ảnh "${file.name || "clipboard-image"}" vượt quá 10MB.`);
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
          kind: "image",
        },
      ]);
    };

    reader.readAsDataURL(file);
  }

  async function processAttachmentFiles(files: File[]) {
    if (files.length === 0) return;

    const nextFiles: AttachedFile[] = [];

    let imageCount = attachedFiles.filter(
      (file) => file.kind === "image",
    ).length;

    let normalFileCount = attachedFiles.filter(
      (file) => file.kind === "file",
    ).length;

    for (const file of files) {
      const lowerName = file.name.toLowerCase();

      if (file.type.startsWith("image/")) {
        if (imageCount >= 2) {
          continue;
        }

        if (!selectedModel?.supportsImage) {
          throw new Error("AI hiện tại chưa hỗ trợ đọc ảnh.");
        }

        const dataUrl = await compressImageToDataUrl(file);

        nextFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: "image/jpeg",
          kind: "image",
          size: file.size,
          dataUrl,
        });

        imageCount += 1;
        continue;
      }

      if (
        lowerName.endsWith(".txt") ||
        lowerName.endsWith(".pdf") ||
        lowerName.endsWith(".docx")
      ) {
        if (normalFileCount >= 1) {
          continue;
        }

        if (!selectedModel?.supportsFile) {
          throw new Error("AI hiện tại chưa hỗ trợ đọc file.");
        }

        const textContent = await extractTextFromUploadedFile(file);

        nextFiles.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type || "application/octet-stream",
          kind: "file",
          size: file.size,
          textContent,
        });

        normalFileCount += 1;
        continue;
      }

      throw new Error("Chỉ hỗ trợ ảnh, TXT, PDF và DOCX.");
    }

    if (nextFiles.length === 0) {
      setErrorText("Bạn chỉ được chọn tối đa 2 ảnh và 1 file.");
      return;
    }

    setAttachedFiles((previousFiles) => [...previousFiles, ...nextFiles]);
    setErrorText("");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);

    try {
      await processAttachmentFiles(files);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Không thể xử lý tệp đính kèm.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData.items);

    const imageItems = items.filter((item) => item.type.startsWith("image/"));

    if (imageItems.length === 0) return;

    if (!selectedModel?.supportsImage) {
      event.preventDefault();
      setErrorText("Model đang chọn chưa hỗ trợ đọc ảnh.");
      return;
    }

    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - attachedFiles.length);

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
      previousFiles.filter((file) => file.id !== fileId),
    );
  }

  async function copyMessage(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);

      window.setTimeout(() => {
        setCopiedMessageId((currentId) =>
          currentId === messageId ? null : currentId,
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
      setErrorText("Hiện chưa có AI khả dụng.");
      return;
    }

    if (attachedFiles.length > 0 && !selectedModel?.supportsImage) {
      setErrorText("AI đang chọn chưa hỗ trợ đọc ảnh.");
      return;
    }

    const messageAttachments: ChatAttachment[] = attachedFiles.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      kind: "file",
      dataUrl: file.dataUrl,
    }));

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "USER",
      content:
        messageText ||
        (messageAttachments.some((file) => file.kind === "image")
          ? "Đã gửi ảnh."
          : messageAttachments.some((file) => file.kind === "file")
            ? "Đã gửi tệp."
            : ""),
      attachments: messageAttachments,
    };

    const assistantMessageId = crypto.randomUUID();

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "ASSISTANT",
      content: "",
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
      assistantMessage,
    ]);

    setInput("");
    setAttachedFiles([]);
    resetComposerHeight();
    setIsLoading(true);
    setErrorText("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        signal: abortController.signal,
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
          attachments: messageAttachments.map((file) =>
            file.kind === "image"
              ? {
                  name: file.name,
                  type: file.type,
                  kind: "image",
                  dataUrl: file.dataUrl,
                }
              : {
                  name: file.name,
                  type: file.type,
                  kind: "file",
                  textContent: file.textContent,
                },
          ),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        try {
          const parsedError = JSON.parse(errorText) as { error?: string };
          throw new Error(
            parsedError.error || "Không thể nhận phản hồi từ AI.",
          );
        } catch {
          throw new Error(errorText || "Không thể nhận phản hồi từ AI.");
        }
      }

      const streamSessionId = response.headers.get("x-session-id");
      const isGuestResponse = response.headers.get("x-is-guest") === "true";

      if (!response.body) {
        throw new Error("Trình duyệt không hỗ trợ đọc stream.");
      }

      if (!isGuestResponse && streamSessionId) {
        setActiveSessionId(streamSessionId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let fullAnswer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullAnswer += chunk;

        setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: fullAnswer,
                }
              : message,
          ),
        );
      }

      const finalChunk = decoder.decode();
      if (finalChunk) {
        fullAnswer += finalChunk;

        setMessages((previousMessages) =>
          previousMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: fullAnswer,
                }
              : message,
          ),
        );
      }

      if (!fullAnswer.trim()) {
        throw new Error("AI không trả về nội dung.");
      }

      if (!isGuestResponse) {
        await loadSessions();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Không thể nhận phản hồi từ AI. Vui lòng thử lại.";

      setErrorText(message);

      setMessages((previousMessages) =>
        previousMessages.map((chatMessage) =>
          chatMessage.id === assistantMessageId
            ? {
                ...chatMessage,
                content: `Không thể trả lời: ${message}`,
              }
            : chatMessage,
        ),
      );
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      focusComposer();
    }
  }

  function renderAssistantContent(content: string) {
    const parts = content.split(/```([\s\S]*?)```/g);

    return parts.map((part, index) => {
      const isCodeBlock = index % 2 === 1;

      if (isCodeBlock) {
        const lines = part.replace(/^\n/, "").replace(/\n$/, "").split("\n");
        const firstLine = lines[0]?.trim() || "";
        const hasLanguage =
          firstLine.length > 0 &&
          firstLine.length < 20 &&
          !firstLine.includes(" ") &&
          !firstLine.includes(";") &&
          !firstLine.includes("(");

        const language = hasLanguage ? firstLine : "code";
        const code = hasLanguage ? lines.slice(1).join("\n") : lines.join("\n");

        return (
          <div
            key={`code-${index}`}
            className="my-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
              <span className="text-xs uppercase tracking-wide text-white/35">
                {language}
              </span>
            </div>

            <pre className="sidebar-scrollbar overflow-x-auto px-4 py-4 text-[13px] leading-6 text-white/80">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      if (!part.trim()) return null;

      return (
        <div key={`text-${index}`} className="whitespace-pre-wrap break-words">
          {part.trim()}
        </div>
      );
    });
  }

  const attachmentPreview =
    attachedFiles.length > 0 ? (
      <div className="mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {attachedFiles.map((file) => (
          <div
            key={file.id}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
          >
            <img
              src={file.dataUrl}
              alt={file.name}
              className="h-full w-full object-cover"
            />

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-5">
              <p className="truncate text-[10px] text-white/70">{file.name}</p>
            </div>

            <button
              type="button"
              onClick={() => removeAttachedFile(file.id)}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm text-white opacity-100 transition hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label={`Xóa ảnh ${file.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const composer = (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDraggingAttachment(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDraggingAttachment(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();

        if (event.currentTarget === event.target) {
          setIsDraggingAttachment(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingAttachment(false);

        const files = Array.from(event.dataTransfer.files || []);

        void processAttachmentFiles(files).catch((error) => {
          setErrorText(
            error instanceof Error
              ? error.message
              : "Không thể xử lý tệp đính kèm.",
          );
        });
      }}
      className={`relative rounded-[28px] border p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur transition ${
        isDraggingAttachment
          ? "border-emerald-400/60 bg-emerald-400/[0.08]"
          : "border-white/[0.08] bg-[#2b2b2b]/95"
      }`}
    >
      {isDraggingAttachment && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[24px] border border-dashed border-emerald-400/60 bg-black/55 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-sm font-semibold text-white">
              Thả ảnh hoặc file vào đây
            </div>
            <div className="mt-1 text-xs text-white/45">
              Hỗ trợ JPG, PNG, WEBP, TXT, PDF, DOCX
            </div>
          </div>
        </div>
      )}

      {attachmentPreview}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);

            event.currentTarget.style.height = "auto";
            event.currentTarget.style.height = `${Math.min(
              event.currentTarget.scrollHeight,
              180,
            )}px`;
          }}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          rows={messages.length === 0 ? 3 : 1}
          disabled={isLoading}
          placeholder={
            isLoading
              ? "AI SITIKI đang trả lời..."
              : "Nhắn tin cho AI SITIKI..."
          }
          className={`sidebar-scrollbar w-full resize-none bg-transparent px-4 py-3 pr-4 text-[15px] leading-7 text-white outline-none placeholder:text-white/35 disabled:cursor-not-allowed disabled:text-white/45 ${
            messages.length === 0 ? "min-h-24" : "max-h-[180px] min-h-12"
          }`}
        />
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 px-1 pb-1">
        <div className="flex min-w-0 items-center gap-2">
          <label
            className={`flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition ${
              selectedModel?.supportsImage || selectedModel?.supportsFile
                ? "cursor-pointer border-white/[0.08] bg-white/[0.04] text-white/65 hover:border-white/[0.14] hover:bg-white/[0.07] hover:text-white"
                : "cursor-not-allowed border-white/[0.04] bg-white/[0.02] text-white/25"
            }`}
            title={
              selectedModel?.supportsImage || selectedModel?.supportsFile
                ? "Đính kèm ảnh hoặc file"
                : "AI hiện tại chưa hỗ trợ tệp đính kèm"
            }
          >
            <span className="text-sm">＋</span>
            <span className="hidden sm:inline">Đính kèm</span>

            <input
              type="file"
              accept="image/*,.txt,.pdf,.docx"
              multiple
              disabled={
                !selectedModel?.supportsImage && !selectedModel?.supportsFile
              }
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="hidden min-w-0 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 sm:flex">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="max-w-[180px] truncate text-xs text-white/45">
              {selectedModel?.displayName || "Đang tải AI..."}
            </span>
          </div>

          {attachedFiles.length > 0 && (
            <span className="rounded-full bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/40">
              {attachedFiles.filter((file) => file.kind === "image").length} ảnh
              {attachedFiles.some((file) => file.kind === "file")
                ? ` · ${attachedFiles.filter((file) => file.kind === "file").length} file`
                : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {input.trim() && (
            <span className="hidden text-[11px] text-white/25 sm:inline">
              Enter để gửi · Shift Enter xuống dòng
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (isLoading) {
                stopGenerating();
                return;
              }

              void sendMessage();
            }}
            disabled={
              !isLoading &&
              (!selectedModelId ||
                (!input.trim() && attachedFiles.length === 0))
            }
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold shadow-lg shadow-black/20 transition hover:scale-105 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none ${
              isLoading
                ? "bg-white/15 text-white hover:bg-white/20"
                : "bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/30"
            }`}
            aria-label={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
            title={isLoading ? "Dừng phản hồi" : "Gửi tin nhắn"}
          >
            {isLoading ? (
              <span className="h-3.5 w-3.5 rounded-[4px] bg-white/80" />
            ) : (
              "↑"
            )}
          </button>
        </div>
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
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[320px] flex-col border-r border-white/[0.06] bg-black px-5 py-5 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-start justify-between">
          <button
            type="button"
            onClick={() => startNewChat(null)}
            className="min-w-0 text-left transition hover:opacity-85"
          >
            <span className="block text-[22px] font-bold leading-tight tracking-tight text-white">
              AI SITIKI
            </span>

            <span className="mt-1 block text-sm text-white/40">
              AI siêu tiết kiệm
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white"
            title="Thu gọn"
            aria-label="Thu gọn danh sách trò chuyện"
          >
            ‹
          </button>
        </div>

        <button
          type="button"
          onClick={() => startNewChat()}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left text-white transition hover:border-white/[0.12] hover:bg-white/[0.07]"
        >
          <span className="text-base">✎</span>
          <span className="text-[15px] font-medium">Chat mới</span>
        </button>

        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-3 transition focus-within:border-white/[0.16] focus-within:bg-white/[0.06]">
          <span className="text-sm text-white/35">⌕</span>

          <input
            value={sessionSearch}
            onChange={(event) => setSessionSearch(event.target.value)}
            placeholder="Tìm cuộc trò chuyện"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="sidebar-scrollbar h-full overflow-y-auto pr-1">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
                Dự án
              </h3>

              <button
                type="button"
                onClick={() =>
                  setShowProjectInput((previousValue) => !previousValue)
                }
                className="rounded-lg px-2 py-1 text-sm text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                title="Tạo project"
              >
                +
              </button>
            </div>

            {showProjectInput && (
              <div className="mb-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2">
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void createProject();
                    }
                  }}
                  placeholder="Tên project"
                  className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/[0.16]"
                  autoFocus
                />

                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void createProject()}
                    className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-white/85"
                  >
                    Tạo
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowProjectInput(false);
                      setNewProjectName("");
                    }}
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            <div
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (draggingSessionId) {
                  void moveSessionToProject(draggingSessionId, null);
                }
              }}
              className="mb-3"
            >
              <button
                type="button"
                onClick={selectAllChats}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  activeProjectId === null
                    ? "border-white/[0.08] bg-white/[0.07] text-white"
                    : draggingSessionId
                      ? "border-dashed border-white/[0.16] bg-white/[0.03] text-white/75"
                      : "border-transparent bg-transparent text-white/55 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                Tất cả
              </button>
            </div>

            {projects.length === 0 ? (
              <p className="rounded-2xl border border-white/[0.06] px-4 py-3 text-sm text-white/30">
                Chưa có project
              </p>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (draggingSessionId) {
                        void moveSessionToProject(
                          draggingSessionId,
                          project.id,
                        );
                      }
                    }}
                    className={`group flex items-center rounded-2xl border px-2 py-1.5 transition ${
                      activeProjectId === project.id
                        ? "border-white/[0.08] bg-white/[0.07] text-white"
                        : draggingSessionId
                          ? "border-dashed border-white/[0.16] bg-white/[0.03] text-white/75"
                          : "border-transparent text-white/55 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectProject(project.id)}
                      className="min-w-0 flex-1 px-2 py-2 text-left"
                      title={project.name}
                    >
                      <div className="truncate text-sm font-medium">
                        {project.name}
                      </div>

                      <div className="mt-0.5 text-[11px] text-white/[0.28]">
                        {
                          sessions.filter(
                            (session) => session.projectId === project.id,
                          ).length
                        }{" "}
                        cuộc trò chuyện
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void renameProject(project.id, project.name);
                      }}
                      className="hidden rounded-lg px-2 py-1 text-xs text-white/35 transition hover:bg-white/[0.08] hover:text-white group-hover:block"
                      title="Đổi tên project"
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteProject(project.id);
                      }}
                      className="hidden rounded-lg px-2 py-1 text-xs text-white/35 transition hover:bg-red-500/10 hover:text-red-300 group-hover:block"
                      title="Xóa project"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="my-5 border-t border-white/[0.06]" />

            <div className="mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/30">
                Lịch sử
              </h3>
            </div>

            {isLoadingData ? (
              <div className="space-y-3 px-2 py-2">
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] px-4 py-3 text-sm leading-5 text-white/30">
                {sessionSearch
                  ? "Không tìm thấy cuộc trò chuyện phù hợp."
                  : activeProjectId
                    ? "Project này chưa có chat."
                    : "Chưa có lịch sử chat."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    draggable
                    onDragStart={() => {
                      setDraggingSessionId(session.id);
                    }}
                    onDragEnd={() => {
                      setDraggingSessionId(null);
                    }}
                    className={`group flex cursor-grab items-center rounded-2xl border px-2 py-1.5 transition active:cursor-grabbing ${
                      activeSessionId === session.id
                        ? "border-white/[0.08] bg-white/[0.07] text-white"
                        : "border-transparent text-white/55 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                    }`}
                    title="Kéo cuộc trò chuyện này vào project"
                  >
                    <button
                      type="button"
                      onClick={() => void openSession(session.id)}
                      className="min-w-0 flex-1 px-2 py-2 text-left"
                      title={session.title}
                    >
                      <div className="truncate text-sm font-medium">
                        {session.title}
                      </div>

                      <div className="mt-0.5 truncate text-[11px] text-white/[0.28]">
                        {session.projectId
                          ? projects.find(
                              (project) => project.id === session.projectId,
                            )?.name || "Trong project"
                          : "Chưa xếp project"}
                      </div>
                    </button>

                    <select
                      value={session.projectId || ""}
                      onClick={(event) => event.stopPropagation()}
                      onMouseDown={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const nextProjectId = event.target.value || null;
                        void moveSessionToProject(session.id, nextProjectId);
                      }}
                      className="mr-1 hidden max-w-[85px] rounded-xl border border-white/[0.08] bg-[#171717] px-2 py-1 text-[11px] text-white/55 outline-none transition hover:border-white/[0.12] hover:text-white group-hover:block"
                      title="Chuyển vào project"
                    >
                      <option value="">Tất cả</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void renameSession(session.id, session.title);
                      }}
                      className="hidden rounded-lg px-2 py-1 text-xs text-white/35 transition hover:bg-white/[0.08] hover:text-white group-hover:block"
                      title="Đổi tên cuộc trò chuyện"
                    >
                      ✎
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteSession(session.id);
                      }}
                      className="hidden rounded-lg px-2 py-1 text-xs text-white/35 transition hover:bg-red-500/10 hover:text-red-300 group-hover:block"
                      title="Xóa cuộc trò chuyện"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <Link
            href="/billing"
            className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.07]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>

              <p className="mt-1 truncate text-xs text-white/45">
                Xem gói dịch vụ
              </p>
            </div>
          </Link>
        </div>
      </aside>

      <section
        className={`min-w-0 flex-1 transition-[padding] duration-300 ${
          sidebarOpen ? "md:pl-[320px]" : "pl-0"
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
                <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>AI SITIKI</span>
                </div>

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
                <p className="text-sm font-medium">Đang dùng Gemini miễn phí</p>

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
                        className="mx-auto max-w-xl rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-center text-xs text-white/35"
                      >
                        {message.content}
                      </div>
                    );
                  }

                  if (message.role === "USER") {
                    return (
                      <div key={message.id} className="flex justify-end">
                        <div className="group max-w-[90%] sm:max-w-[78%]">
                          <div className="rounded-[24px] rounded-br-lg border border-white/[0.06] bg-white/[0.07] px-5 py-3.5 shadow-sm">
                            {message.attachments &&
                              message.attachments.length > 0 && (
                                <div className="mb-3 grid grid-cols-2 gap-2">
                                  {message.attachments.map((file) => (
                                    <img
                                      key={file.id}
                                      src={file.dataUrl}
                                      alt={file.name}
                                      className="max-h-64 w-full rounded-2xl border border-white/[0.08] object-cover"
                                    />
                                  ))}
                                </div>
                              )}

                            {message.content && (
                              <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-white/90">
                                {message.content}
                              </div>
                            )}
                          </div>

                          <div className="mt-1 flex justify-end pr-2">
                            <span className="text-[11px] text-white/20">
                              Bạn
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.id} className="flex gap-3 sm:gap-4">
                      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-black text-black shadow-sm">
                        AI
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              AI SITIKI
                            </p>
                            <p className="mt-0.5 text-[11px] text-white/30">
                              Trợ lý AI
                            </p>
                          </div>

                          {message.content.trim() && (
                            <button
                              type="button"
                              onClick={() =>
                                void copyMessage(message.id, message.content)
                              }
                              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
                            >
                              {copiedMessageId === message.id
                                ? "Đã chép"
                                : "Sao chép"}
                            </button>
                          )}
                        </div>

                        <div className="rounded-[24px] rounded-tl-lg border border-white/[0.06] bg-white/[0.035] px-5 py-4 text-[15px] leading-8 text-white/85 shadow-sm">
                          {message.content.trim() ? (
                            <div className="space-y-3">
                              {renderAssistantContent(message.content)}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 py-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/30 [animation-delay:-0.2s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/30 [animation-delay:-0.1s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-white/30" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div
              className={`fixed bottom-0 right-0 z-30 bg-[#212121]/95 px-3 pb-4 pt-3 backdrop-blur transition-[left] duration-300 sm:px-4 ${
                sidebarOpen ? "left-0 md:left-[320px]" : "left-0"
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
