import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_TEXT_LENGTH = 12_000;

function cleanText(input: string) {
  return input
    .replace(/\u200B/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;

  return (
    text.slice(0, maxChars).trim() +
    "\n\n[Nội dung tệp đã được rút gọn để tiết kiệm xử lý.]"
  );
}

async function parsePdf(buffer: Buffer) {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({
    buffer,
  });

  return result.value || "";
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "Không tìm thấy file tải lên.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error: "File quá lớn. Vui lòng chọn file tối đa 3MB.",
        },
        { status: 400 },
      );
    }

    const lowerName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let textContent = "";

    if (file.type.startsWith("text/") || lowerName.endsWith(".txt")) {
      textContent = buffer.toString("utf8");
    } else if (lowerName.endsWith(".pdf")) {
      textContent = await parsePdf(buffer);
    } else if (lowerName.endsWith(".docx")) {
      textContent = await parseDocx(buffer);
    } else {
      return Response.json(
        {
          error: "Hiện chỉ hỗ trợ TXT, PDF và DOCX.",
        },
        { status: 400 },
      );
    }

    textContent = truncateText(cleanText(textContent), MAX_TEXT_LENGTH);

    if (!textContent.trim()) {
      return Response.json(
        {
          error: "Không đọc được nội dung từ file này.",
        },
        { status: 400 },
      );
    }

    return Response.json({
      fileName: file.name,
      textContent,
      charCount: textContent.length,
    });
  } catch (error) {
    console.error("PARSE_FILE_ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Có lỗi khi đọc nội dung file.",
      },
      { status: 500 },
    );
  }
}