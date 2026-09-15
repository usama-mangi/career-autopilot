import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { formatSize, generateUUID } from "~/lib/utils";
import {
  parseResume,
  getAcceptTypes,
  getMaxFileSize,
  getFormatLabel,
  type ResumeFormat,
} from "~/lib/resume-parser";

export interface FileEntry {
  id: string;
  file: File;
  format: ResumeFormat;
  text: string;
  preview: string;
  status: "pending" | "parsing" | "ready" | "error";
  error?: string;
}

interface MultiFileUploaderProps {
  files: FileEntry[];
  onFilesChange: (files: FileEntry[]) => void;
}

const FORMAT_ICONS: Record<string, string> = {
  pdf: "/images/pdf.png",
  docx: "/images/pdf.png",
  txt: "/icons/info.svg",
  html: "/icons/info.svg",
  linkedin: "/icons/info.svg",
};

export default function MultiFileUploader({
  files,
  onFilesChange,
}: MultiFileUploaderProps) {
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newEntries: FileEntry[] = [];

      for (const file of acceptedFiles) {
        const entryId = generateUUID();
        const format = detectFormatFromName(file.name) || "pdf";

        const entry: FileEntry = {
          id: entryId,
          file,
          format,
          text: "",
          preview: "",
          status: "pending",
        };

        if (format !== "pdf") {
          entry.status = "parsing";
          newEntries.push(entry);
          onFilesChange([...files, ...newEntries]);

          try {
            const { format: fmt, result } = await parseResume(file);
            entry.format = fmt;
            entry.text = result.text;
            entry.preview = result.preview;
            entry.status = "ready";
          } catch (err) {
            entry.status = "error";
            entry.error =
              err instanceof Error ? err.message : "Failed to parse file";
          }
        } else {
          entry.status = "ready";
          newEntries.push(entry);
        }
      }

      // Batch update at the end for PDFs + completed non-PDFs
      onFilesChange([...files, ...newEntries]);
    },
    [files, onFilesChange],
  );

  const maxFileSize = getMaxFileSize();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: getAcceptTypes(),
    maxSize: maxFileSize,
  });

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    onFilesChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="panel-soft">
        <div {...getRootProps()}>
          <input {...getInputProps()} />
          <div className="space-y-4 cursor-pointer p-8">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="mx-auto w-16 h-16 flex items-center justify-center">
                <img src="/icons/info.svg" alt="upload" className="size-20" />
              </div>
              <p className="text-lg text-gray-500">
                <span className="font-semibold">Click to Upload</span> or drag
                and drop
              </p>
              <p className="text-lg text-gray-500">
                Select multiple resumes (PDF, DOCX, TXT, HTML, LinkedIn export)
              </p>
              <p className="text-sm text-gray-400">
                Max {formatSize(maxFileSize)} per file
              </p>
            </div>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-600">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </p>
          {files.map((entry) => (
            <div
              key={entry.id}
              className="uploader-selected-file"
            >
              <img
                src={FORMAT_ICONS[entry.format] || "/icons/info.svg"}
                alt={entry.format}
                className="size-10"
              />
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                      {entry.file.name}
                    </p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-badge-blue text-badge-blue-text">
                      {getFormatLabel(entry.format)}
                    </span>
                    {entry.status === "parsing" && (
                      <span className="text-xs text-gray-400 animate-pulse">
                        Parsing...
                      </span>
                    )}
                    {entry.status === "error" && (
                      <span className="text-xs text-red-500" title={entry.error}>
                        Error
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatSize(entry.file.size)}
                  </p>
                </div>
              </div>
              <button
                className="p-2 cursor-pointer"
                onClick={(e) => handleRemove(entry.id, e)}
              >
                <img src="/icons/cross.svg" alt="remove" className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function detectFormatFromName(name: string): ResumeFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".zip")) return "linkedin";
  return null;
}