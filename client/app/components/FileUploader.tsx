import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { formatSize } from "~/lib/utils";
import {
  parseResume,
  getAcceptTypes,
  getMaxFileSize,
  getFormatLabel,
  type ResumeFormat,
} from "~/lib/resume-parser";

interface FileUploaderProps {
  onFileSelect?: (file: File | null) => void;
  onParsed?: (info: {
    format: ResumeFormat;
    text: string;
    preview: string;
  } | null) => void;
  textPreview?: string | null;
}

const FORMAT_ICONS: Record<string, string> = {
  pdf: "/images/pdf.png",
  docx: "/images/pdf.png",
  txt: "/icons/info.svg",
  html: "/icons/info.svg",
  linkedin: "/icons/info.svg",
};

export default function FileUploader({
  onFileSelect,
  onParsed,
  textPreview,
}: FileUploaderProps) {
  const [format, setFormat] = useState<ResumeFormat | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0] || null;
      setParseError(null);
      onFileSelect?.(file);
      onParsed?.(null);

      if (!file) {
        setFormat(null);
        return;
      }

      const detected = detectFormatFromName(file.name);
      setFormat(detected);

      // For non-PDF formats, parse and extract text
      if (detected && detected !== "pdf") {
        setParsing(true);
        try {
          const { format: fmt, result } = await parseResume(file);
          onParsed?.({ format: fmt, text: result.text, preview: result.preview });
        } catch (err) {
          setParseError(
            `Failed to parse: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        } finally {
          setParsing(false);
        }
      } else {
        // PDF: no text extraction needed here
        onParsed?.(null);
      }
    },
    [onFileSelect, onParsed],
  );

  const maxFileSize = getMaxFileSize();

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } =
    useDropzone({
      onDrop,
      multiple: false,
      accept: getAcceptTypes(),
      maxSize: maxFileSize,
    });

  const file = acceptedFiles[0] || null;

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onFileSelect?.(null);
    onParsed?.(null);
    setFormat(null);
    setParseError(null);
  }

  return (
    <div className="w-full panel-soft">
      <div {...getRootProps()}>
        <input {...getInputProps()} />

        <div className="space-y-4 cursor-pointer">
          {file && format ? (
            <div>
              <div
                className="uploader-selected-file"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={FORMAT_ICONS[format] || "/icons/info.svg"}
                  alt={format}
                  className="size-10"
                />
                <div className="flex items-center space-x-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                        {file.name}
                      </p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-badge-blue text-badge-blue-text">
                        {getFormatLabel(format)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  className="p-2 cursor-pointer"
                  onClick={handleRemove}
                >
                  <img src="/icons/cross.svg" alt="remove" className="size-4" />
                </button>
              </div>

              {/* Text preview for non-PDF formats */}
              {parsing && (
                <p className="text-sm text-gray-500 mt-2 animate-pulse">
                  Parsing resume...
                </p>
              )}
              {parseError && (
                <p className="text-sm text-red-500 mt-2">{parseError}</p>
              )}
              {textPreview && !parsing && (
                <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                    Preview
                  </p>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6 font-sans">
                    {textPreview}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3 mb-2">
              <div className="mx-auto w-16 h-16 flex items-center justify-center">
                <img src="/icons/info.svg" alt="upload" className="size-20" />
              </div>
              <p className="text-lg text-gray-500">
                <span className="font-semibold">Click to Upload</span> or drag
                and drop
              </p>
              <p className="text-lg text-gray-500">
                PDF, DOCX, TXT, HTML, LinkedIn export (max{" "}
                {formatSize(maxFileSize)})
              </p>
            </div>
          )}
        </div>
      </div>
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