import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, Button, Input, Textarea, Card, useToastHelpers, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot — Complete Your Profile" },
];

const STEPS = ["Basic Info", "Education", "Experience", "Skills", "Projects", "Links", "Review"];

const SUGGESTED_SKILLS = [
  "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust", "C++", "C#",
  "React", "Vue", "Angular", "Next.js", "Node.js", "Express", "Django", "FastAPI",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform",
  "PostgreSQL", "MySQL", "MongoDB", "Redis",
  "Git", "CI/CD", "GraphQL", "REST API",
  "Machine Learning", "TensorFlow", "PyTorch",
  "Communication", "Leadership", "Problem Solving", "Team Management",
];

// Validation schemas per step
const validateStep = (step: number, data: any): Record<string, string> => {
  const errors: Record<string, string> = {};

  switch (step) {
    case 0: // Basic Info
      if (!data.headline?.trim()) {
        errors.headline = "Required — this becomes your resume header";
      } else if (data.headline.length < 5) {
        errors.headline = "Too short — be specific (e.g. 'Senior Frontend Engineer')";
      }
      if (!data.summary?.trim()) {
        errors.summary = "Required — AI uses this to generate your resume summary";
      } else if (data.summary.length < 20) {
        errors.summary = "Add more detail — aim for 2-3 sentences about your experience";
      }
      if (!data.location?.trim()) {
        errors.location = "Required — helps match local/remote roles";
      }
      break;
    case 1: // Education
      if (!data.education?.some((e: any) => e.school?.trim() && e.degree?.trim())) {
        errors.education = "Add at least one education entry";
      }
      data.education?.forEach((edu: any, i: number) => {
        if (edu.startDate && edu.endDate && new Date(edu.endDate) < new Date(edu.startDate)) {
          errors[`education_${i}_dates`] = "End date must be after start date";
        }
      });
      break;
    case 2: // Experience
      if (!data.experience?.some((e: any) => e.company?.trim() && e.title?.trim())) {
        errors.experience = "Add at least one work experience";
      }
      break;
    case 3: // Skills
      if (data.skills?.length < 3) {
        errors.skills = "Add at least 3 skills for AI matching";
      }
      break;
  }

  return errors;
};

export default function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Basic info
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");

  // Education
  const [education, setEducation] = useState<any[]>([{ school: "", degree: "", field: "", startDate: "", endDate: "" }]);

  // Experience
  const [experience, setExperience] = useState<any[]>([{ company: "", title: "", startDate: "", endDate: "", description: "", isCurrent: false }]);

  // Skills
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  // Projects (optional)
  const [projects, setProjects] = useState<any[]>([]);

  // Links
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [isAuthenticated]);

  async function loadProfile() {
    try {
      const data = await api.profile.get();
      if (data.user) {
        setHeadline(data.user.headline || "");
        setSummary(data.user.summary || "");
        setLocation(data.user.location || "");
        setPhone(data.user.phone || "");
        setLinkedinUrl(data.user.linkedinUrl || "");
        setGithubUrl(data.user.githubUrl || "");
        setWebsiteUrl(data.user.websiteUrl || "");
      }
      if (data.profile) {
        if (data.profile.education?.length) setEducation(data.profile.education);
        if (data.profile.experience?.length) setExperience(data.profile.experience);
        if (data.profile.projects?.length) setProjects(data.profile.projects);
        if (data.profile.skills?.length) setSkills(data.profile.skills);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    setFetching(false);
  }

  // Validate current step and return errors
  function validateCurrentStep(): Record<string, string> {
    return validateStep(step, { headline, summary, location, education, experience, skills });
  }

  // Mark field as touched and validate
  function handleBlur(fieldName: string) {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    const stepErrors = validateCurrentStep();
    setErrors(stepErrors);
  }

  // Check if current step can proceed
  function canProceed(): boolean {
    const stepErrors = validateCurrentStep();
    return Object.keys(stepErrors).length === 0;
  }

  async function handleFinish() {
    // Validate all steps before finishing
    const allErrors: Record<string, string> = {};
    for (let i = 0; i <= 5; i++) {
      const stepErrors = validateStep(i, { headline, summary, location, education, experience, skills });
      Object.assign(allErrors, stepErrors);
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      toastError("Validation error", "Please fix the highlighted fields before finishing.");
      return;
    }

    setLoading(true);
    try {
      await api.profile.updateUser({ headline, summary, location, phone, linkedinUrl, githubUrl, websiteUrl });
      await api.profile.update({ education, experience, projects, skills });
      await api.profile.completeOnboarding();
      toastSuccess("Profile complete", "Welcome to Career Autopilot!");
      navigate("/");
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, retry: handleFinish });
    }
    setLoading(false);
  }

  function addEducation() {
    setEducation([...education, { school: "", degree: "", field: "", startDate: "", endDate: "" }]);
  }

  function removeEducation(index: number) {
    setEducation(education.filter((_, i) => i !== index));
  }

  function updateEducation(index: number, field: string, value: string) {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    setEducation(updated);
    // Clear error for this field when user edits
    const errorKey = `education_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }

  function addExperience() {
    setExperience([...experience, { company: "", title: "", startDate: "", endDate: "", description: "", isCurrent: false }]);
  }

  function removeExperience(index: number) {
    setExperience(experience.filter((_, i) => i !== index));
  }

  function updateExperience(index: number, field: string, value: any) {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    setExperience(updated);
  }

  function addSkill(skill: string) {
    const s = skill.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      // Clear skills error when adding
      if (errors.skills) {
        setErrors(prev => {
          const next = { ...prev };
          delete next.skills;
          return next;
        });
      }
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter(s => s !== skill));
    // Re-validate skills count
    const newSkills = skills.filter(s => s !== skill);
    if (newSkills.length < 3) {
      setErrors(prev => ({ ...prev, skills: "Add at least 3 skills for AI matching" }));
    }
  }

  // Helper to show field error
  function fieldError(fieldName: string): string | undefined {
    if (!touched[fieldName]) return undefined;
    return errors[fieldName];
  }

  if (isPending || fetching) {
    return (
      <PageShell>
        <div className="max-w-2xl mx-auto py-12 animate-pulse">
          <div className="h-8 w-64 bg-[#F5EDE4] rounded mb-4" />
          <div className="h-4 w-48 bg-[#F5EDE4] rounded mb-8" />
          <div className="h-64 bg-[#F5EDE4] rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto">
        {/* Header — expedition style */}
        <div className="mb-8">
          <Link to="/" className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full border-2 border-primary-500 bg-primary-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">Career Autopilot</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Complete Your Profile</h1>
          <p className="text-sm text-gray-600">Tell us about yourself so your AI sherpa can map the best route for your career traverse.</p>
        </div>

        {/* Progress bar — route map style */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
            <span className="font-medium">Step {step + 1} of {STEPS.length}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-[#F5EDE4] rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-[10px] font-medium ${i <= step ? 'text-primary-600' : 'text-gray-400'}`}>{s}</span>
            ))}
          </div>
        </div>

        <Card className="p-6">
          {/* Step 0: Basic Info */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
                <p className="text-sm text-gray-600 mt-1">These fields feed directly into your AI-generated resume.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Professional Headline *</label>
                <p className="text-[11px] text-gray-500 mb-1.5">This becomes your resume header and appears in job matches.</p>
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  onBlur={() => handleBlur("headline")}
                  error={fieldError("headline")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Professional Summary *</label>
                <p className="text-[11px] text-gray-500 mb-1.5">AI uses this to generate your resume summary and tailor it per job.</p>
                <Textarea
                  placeholder="Write a brief summary of your experience and goals..."
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  onBlur={() => handleBlur("summary")}
                  rows={4}
                  error={fieldError("summary")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Location *</label>
                <p className="text-[11px] text-gray-500 mb-1.5">Helps match local and remote roles in your area.</p>
                <Input
                  placeholder="e.g. San Francisco, CA"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  onBlur={() => handleBlur("location")}
                  error={fieldError("location")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Phone</label>
                <Input
                  placeholder="e.g. +1 (555) 123-4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 1: Education */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Education</h2>
                <p className="text-sm text-gray-600 mt-1">Your academic background helps AI match you with roles requiring specific degrees.</p>
              </div>
              {errors.education && touched.education && (
                <p className="text-sm text-danger">{errors.education}</p>
              )}
              {education.map((edu, i) => (
                <div key={i} className="p-4 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1] space-y-3 relative">
                  {education.length > 1 && (
                    <button onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-xs text-danger hover:text-danger-600 font-medium">Remove</button>
                  )}
                  <Input
                    label="School *"
                    placeholder="e.g. Stanford University"
                    value={edu.school}
                    onChange={e => updateEducation(i, 'school', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Degree *"
                      placeholder="e.g. B.S."
                      value={edu.degree}
                      onChange={e => updateEducation(i, 'degree', e.target.value)}
                    />
                    <Input
                      label="Field of Study"
                      placeholder="e.g. Computer Science"
                      value={edu.field}
                      onChange={e => updateEducation(i, 'field', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start Date"
                      type="date"
                      value={edu.startDate}
                      onChange={e => updateEducation(i, 'startDate', e.target.value)}
                    />
                    <Input
                      label="End Date"
                      type="date"
                      value={edu.endDate}
                      onChange={e => updateEducation(i, 'endDate', e.target.value)}
                    />
                  </div>
                  {errors[`education_${i}_dates`] && (
                    <p className="text-xs text-danger">{errors[`education_${i}_dates`]}</p>
                  )}
                </div>
              ))}
              <Button variant="secondary" onClick={addEducation}>+ Add Education</Button>
            </div>
          )}

          {/* Step 2: Experience */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Work Experience</h2>
                <p className="text-sm text-gray-600 mt-1">AI uses your experience to match seniority levels and generate experience bullets.</p>
              </div>
              {errors.experience && touched.experience && (
                <p className="text-sm text-danger">{errors.experience}</p>
              )}
              {experience.map((exp, i) => (
                <div key={i} className="p-4 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1] space-y-3 relative">
                  {experience.length > 1 && (
                    <button onClick={() => removeExperience(i)} className="absolute top-2 right-2 text-xs text-danger hover:text-danger-600 font-medium">Remove</button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Company *"
                      placeholder="e.g. Google"
                      value={exp.company}
                      onChange={e => updateExperience(i, 'company', e.target.value)}
                    />
                    <Input
                      label="Title *"
                      placeholder="e.g. Software Engineer"
                      value={exp.title}
                      onChange={e => updateExperience(i, 'title', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start Date"
                      type="date"
                      value={exp.startDate}
                      onChange={e => updateExperience(i, 'startDate', e.target.value)}
                    />
                    <Input
                      label="End Date"
                      type="date"
                      value={exp.endDate}
                      onChange={e => updateExperience(i, 'endDate', e.target.value)}
                      disabled={exp.isCurrent}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={exp.isCurrent}
                      onChange={e => updateExperience(i, 'isCurrent', e.target.checked)}
                      className="w-4 h-4 text-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-gray-600">Currently working here</span>
                  </label>
                  <Textarea
                    label="Description"
                    placeholder="What did you do in this role? AI will use this to generate experience bullets."
                    value={exp.description}
                    onChange={e => updateExperience(i, 'description', e.target.value)}
                    rows={3}
                  />
                </div>
              ))}
              <Button variant="secondary" onClick={addExperience}>+ Add Experience</Button>
            </div>
          )}

          {/* Step 3: Skills */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
                <p className="text-sm text-gray-600 mt-1">Skills are how AI matches you to jobs. Add at least 3 for accurate matching.</p>
              </div>
              {errors.skills && (
                <p className="text-sm text-danger">{errors.skills}</p>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Type a skill and press Enter"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }}
                />
                <Button variant="secondary" onClick={() => addSkill(skillInput)} className="mt-0.5">Add</Button>
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {skills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm font-medium border border-primary-100">
                      {s}
                      <button onClick={() => removeSkill(s)} className="text-primary-400 hover:text-primary-600 ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}

              <div>                 <p className="text-xs font-medium text-gray-500 mb-2">Suggested skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_SKILLS.filter(s => !skills.includes(s)).slice(0, 20).map(s => (
                    <button
                      key={s}
                      onClick={() => addSkill(s)}
                      className="px-2.5 py-1 bg-[#F5EDE4] text-gray-600 rounded-full text-xs font-medium hover:bg-[#E8DDD1] transition-colors border border-[#E8DDD1]"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Projects (optional) */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
                <p className="text-sm text-gray-600 mt-1">Showcase your best work. This step is optional — you can skip it.</p>
              </div>
              {projects.map((proj, i) => (
                <div key={i} className="p-4 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1] space-y-3 relative">
                  <button onClick={() => setProjects(projects.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-xs text-danger hover:text-danger-600 font-medium">Remove</button>
                  <Input label="Project Name" placeholder="e.g. E-commerce Platform" value={proj.name || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], name: e.target.value }; setProjects(updated); }} />
                  <Input label="Description" placeholder="What does this project do?" value={proj.description || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], description: e.target.value }; setProjects(updated); }} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Project URL" placeholder="https://..." value={proj.url || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], url: e.target.value }; setProjects(updated); }} />
                    <Input label="GitHub URL" placeholder="https://github.com/..." value={proj.githubUrl || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], githubUrl: e.target.value }; setProjects(updated); }} />
                  </div>
                  <Input label="Technologies" placeholder="React, Node.js, PostgreSQL (comma-separated)" value={(proj.technologies || []).join(', ')} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], technologies: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }; setProjects(updated); }} />
                </div>
              ))}
              <Button variant="secondary" onClick={() => setProjects([...projects, { name: '', description: '', url: '', githubUrl: '', technologies: [] }])}>+ Add Project</Button>
            </div>
          )}

          {/* Step 5: Links */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Online Presence</h2>
                <p className="text-sm text-gray-600 mt-1">Add links to your professional profiles. This step is optional.</p>
              </div>
              <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/yourname" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
              <Input label="GitHub URL" placeholder="https://github.com/yourname" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} />
              <Input label="Website / Portfolio URL" placeholder="https://yourname.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
            </div>
          )}

          {/* Step 6: Review */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Review Your Profile</h2>
                <p className="text-sm text-gray-600 mt-1">Your AI sherpa will use this to generate your first tailored resume.</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Headline</p>
                  <p className="text-sm font-medium text-gray-900">{headline}</p>
                </div>
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Summary</p>
                  <p className="text-sm text-gray-700 line-clamp-3">{summary}</p>
                </div>
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</p>
                  <p className="text-sm font-medium text-gray-900">{location}</p>
                </div>
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Education ({education.length})</p>
                  {education.map((e, i) => <p key={i} className="text-sm text-gray-700">{e.degree} in {e.field || 'N/A'} — {e.school}</p>)}
                </div>
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Experience ({experience.length})</p>
                  {experience.map((e, i) => <p key={i} className="text-sm text-gray-700">{e.title} at {e.company}</p>)}
                </div>
                <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Skills ({skills.length})</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {skills.map(s => <span key={s} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs border border-primary-100">{s}</span>)}
                  </div>
                </div>
                {projects.length > 0 && (
                  <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Projects ({projects.length})</p>
                    {projects.map((p, i) => (
                      <div key={i} className="text-sm mb-1">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.technologies?.length > 0 && (
                          <span className="text-gray-500 ml-1">— {p.technologies.join(', ')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {(linkedinUrl || githubUrl || websiteUrl) && (
                  <div className="p-3 bg-[#FFF8F0] rounded-lg border border-[#E8DDD1]">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Links</p>
                    <div className="space-y-2 text-sm">
                      {linkedinUrl && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 w-20">LinkedIn</span>
                          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{linkedinUrl}</a>
                        </div>
                      )}
                      {githubUrl && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 w-20">GitHub</span>
                          <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{githubUrl}</a>
                        </div>
                      )}
                      {websiteUrl && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 w-20">Website</span>
                          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{websiteUrl}</a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>Back</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => {
              // Validate current step before proceeding
              const stepErrors = validateCurrentStep();
              setErrors(stepErrors);
              // Mark all fields as touched to show errors
              const allTouched: Record<string, boolean> = {};
              Object.keys(stepErrors).forEach(key => { allTouched[key] = true; });
              setTouched(prev => ({ ...prev, ...allTouched }));

              if (Object.keys(stepErrors).length === 0) {
                setStep(s => s + 1);
                setErrors({});
                setTouched({});
              }
            }} disabled={!canProceed()}>Next</Button>
          ) : (
            <Button onClick={handleFinish} disabled={loading}>
              {loading ? "Saving..." : "Finish & Start"}
            </Button>
          )}
        </div>
      </div>
    </PageShell>
  );
}
