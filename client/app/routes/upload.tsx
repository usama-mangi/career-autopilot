import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import { parseResume, type ResumeFormat } from "~/lib/resume-parser";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { SkeletonPage } from "~/components/Skeleton";
import { PageShell, PageHeader, Button, Input, Textarea, useToastHelpers, reportError } from "~/components/ui";
import { describeError } from "~/lib/api";

export default function Upload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedInfo, setParsedInfo] = useState<{
    format: ResumeFormat;
    text: string;
    preview: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    jobTitle: "",
    jobDescription: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  if (!isPending && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  if (isPending) return <SkeletonPage />;

  function handleFileSelect(file: File | null) {
    setFile(file);
    if (!file) setParsedInfo(null);
  }

  function handleParsed(
    info: { format: ResumeFormat; text: string; preview: string } | null,
  ) {
    setParsedInfo(info);
  }

  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validateForm() {
    const newErrors: Record<string, string> = {};
    if (!formData.companyName.trim()) newErrors.companyName = "Company name is required";
    if (!formData.jobTitle.trim()) newErrors.jobTitle = "Job title is required";
    if (!file) newErrors.file = "Please upload a resume";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!validateForm()) return;

    setIsProcessing(true);

    try {
      setStatusText("Uploading and analyzing...");

      const apiFormData = new FormData();
      if (file) apiFormData.append("file", file);
      apiFormData.append("companyName", formData.companyName);
      apiFormData.append("jobTitle", formData.jobTitle);
      apiFormData.append("jobDescription", formData.jobDescription || "");

      const result = await api.resumes.create(apiFormData);

      setStatusText("Analysis complete, redirecting...");
      navigate(`/resumes/${result.id}`);
    } catch (err) {
      setStatusText(describeError(err, "Error: Failed to process resume"));
      reportError(err, { title: "Analysis failed", toastError, retry: () => handleSubmit() });
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Resume Analysis"
        subtitle={isProcessing ? statusText : "Upload your resume to get an ATS score and improvement tips."}
      />

      {!isProcessing && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-xl">
          <Input
            label="Company Name"
            placeholder="Company Name"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            error={errors.companyName}
            required
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
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Upload Resume</label>
            <FileUploader
              onFileSelect={handleFileSelect}
              onParsed={handleParsed}
              textPreview={parsedInfo?.preview ?? null}
            />
            {errors.file && <p className="mt-1.5 text-sm text-red-600" role="alert">{errors.file}</p>}
          </div>
          <Button className="w-fit" disabled={isProcessing}>
            Analyze Resume
          </Button>
        </form>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center gap-6 mt-8">
          <img src="/images/resume-scan.gif" className="w-64" alt="Processing" />
          <p className="text-lg text-gray-600">{statusText}</p>
        </div>
      )}
    </PageShell>
  );
}