import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import MultiFileUploader, {
  type FileEntry,
} from "~/components/MultiFileUploader";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, useToastHelpers, reportError } from "~/components/ui";

interface ProcessingFile {
  name: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error";
  error?: string;
}

export default function BatchUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [processingProgress, setProcessingProgress] = useState<ProcessingFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [formData, setFormData] = useState({
    companyName: "",
    jobTitle: "",
    jobDescription: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  if (!isPending && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};
    if (!formData.jobTitle.trim()) newErrors.jobTitle = "Job title is required";
    if (files.length === 0) newErrors.files = "Please upload at least one resume";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateForm()) return;

    setIsProcessing(true);
    const progress: ProcessingFile[] = files.map((f) => ({
      name: f.file.name,
      status: "pending" as const,
    }));
    setProcessingProgress(progress);

    setCurrentFileIndex(0);
    progress[0].status = "uploading";
    setProcessingProgress([...progress]);

    try {
      const apiFormData = new FormData();
      files.forEach((f) => apiFormData.append("files", f.file));
      apiFormData.append("companyName", formData.companyName);
      apiFormData.append("jobTitle", formData.jobTitle);
      apiFormData.append("jobDescription", formData.jobDescription || "");

      const batch = await api.batches.create(apiFormData);

      progress.forEach((p) => {
        p.status = "done";
      });
      setProcessingProgress([...progress]);

      toastSuccess("Batch analysis complete", `${files.length} resumes processed`);
      navigate(`/batch/${batch.id}`);
    } catch (err) {
      progress.forEach((p) => {
        p.status = "error";
        p.error = err instanceof Error ? err.message : "Unknown error";
      });
      setProcessingProgress([...progress]);
      reportError(err, { title: "Batch analysis failed", toastError });
    }
  }

  const hasErrors = processingProgress.some((p) => p.status === "error");
  const doneCount = processingProgress.filter((p) => p.status === "done").length;

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Batch Resume Analysis"
        subtitle={isProcessing
          ? `Processing resume ${currentFileIndex + 1} of ${files.length}...`
          : "Upload multiple resumes and compare them against the same job description."}
      />

      {isProcessing ? (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" />
          <div className="w-full max-w-xl flex flex-col gap-3">
            {processingProgress.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    {p.status === "pending" && "Waiting..."}
                    {p.status === "uploading" && "Uploading..."}
                    {p.status === "analyzing" && "Analyzing with AI..."}
                    {p.status === "done" && "Done"}
                    {p.status === "error" && `Error: ${p.error}`}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    p.status === "done"
                      ? "bg-green-100 text-green-700"
                      : p.status === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {p.status === "done" ? "Done" : p.status === "error" ? "Error" : "Processing"}
                </span>
              </div>
            ))}
          </div>
          {hasErrors && (
            <p className="text-sm text-red-500">
              {doneCount} of {files.length} completed. Some files had errors.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-8 w-full max-w-xl">
          <Input
            label="Company Name"
            placeholder="Company Name"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            error={errors.companyName}
          />
          <Input
            label="Job Title"
            placeholder="Job Title"
            value={formData.jobTitle}
            onChange={(e) => handleInputChange("jobTitle", e.target.value)}
            error={errors.jobTitle}
            required
          />
          <Textarea
            label="Job Description"
            placeholder="Job Description"
            rows={5}
            value={formData.jobDescription}
            onChange={(e) => handleInputChange("jobDescription", e.target.value)}
          />
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Upload Resumes</label>
            <MultiFileUploader files={files} onFilesChange={setFiles} />
            {errors.files && <p className="mt-1.5 text-sm text-red-600" role="alert">{errors.files}</p>}
          </div>
          <Button type="submit" disabled={files.length === 0}>
            Analyze All Resumes ({files.length})
          </Button>
        </form>
      )}
    </PageShell>
  );
}