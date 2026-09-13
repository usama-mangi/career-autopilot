import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { cn } from "~/lib/utils";
import { useResumeStore } from "~/lib/resume-store";
import type { GeneratedResume } from "types";
import { PageShell, PageHeader, Button, Input, Textarea, Card, useToastHelpers, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Edit Resume" },
];

interface BulletEditorProps {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}

function BulletEditor({ bullets, onChange }: BulletEditorProps) {
  return (
    <div className="space-y-2">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={bullet}
            onChange={(e) => {
              const next = [...bullets];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder="Achievement or responsibility..."
          />
          <button
            type="button"
            onClick={() => onChange(bullets.filter((_, j) => j !== i))}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...bullets, ""])}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
      >
        + Add bullet
      </button>
    </div>
  );
}

interface SkillsEditorProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

function SkillsEditor({ skills, onChange }: SkillsEditorProps) {
  const [input, setInput] = useState("");

  const addSkill = () => {
    const skill = input.trim();
    if (skill && !skills.includes(skill)) {
      onChange([...skills, skill]);
      setInput("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
          placeholder="Type a skill and press Enter..."
        />
        <Button variant="secondary" size="sm" onClick={addSkill}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-lg text-sm"
          >
            {skill}
            <button
              type="button"
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              className="ml-1 hover:text-primary-900"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ResumeEditPage() {
  const { id } = useParams();
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();
  const updateResume = useResumeStore((s) => s.updateResume);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resume, setResume] = useState<any>(null);

  // Contact info (user-level fields)
  const [contact, setContact] = useState({
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    githubUrl: "",
    websiteUrl: "",
  });

  // Structured resume content
  const [content, setContent] = useState<any>({
    summary: "",
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    publications: [],
    volunteer: [],
    references: [],
    customSections: [],
  });

  const [activeSection, setActiveSection] = useState<string>("summary");

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && id) loadData();
  }, [isAuthenticated, id]);

  async function loadData() {
    try {
      const [resumeData, profileData] = await Promise.all([
        api.resumes.get(id!),
        api.profile.get(),
      ]);
      setResume(resumeData);

      // Populate content from generatedContent or fallback
      const raw = resumeData.generatedContent || (resumeData.textContent ? parseTextToContent(resumeData.textContent) : null);
      if (raw) {
        setContent({
          summary: raw.summary || "",
          experience: raw.experience || [],
          education: raw.education || [],
          skills: raw.skills || [],
          projects: raw.projects || [],
          certifications: raw.certifications || [],
          languages: raw.languages || [],
          awards: raw.awards || [],
          publications: raw.publications || [],
          volunteer: raw.volunteer || [],
          references: raw.references || [],
          customSections: raw.customSections || [],
        });

        // Contact info: prefer generatedContent.basics, fallback to profile
        const basics = (raw as any).basics || {};
        setContact({
          name: basics.name || profileData.user?.name || "",
          headline: basics.headline || profileData.user?.headline || "",
          email: basics.email || profileData.user?.email || "",
          phone: basics.phone || profileData.user?.phone || "",
          location: basics.location || profileData.user?.location || "",
          linkedinUrl: basics.linkedin || profileData.user?.linkedinUrl || "",
          githubUrl: basics.github || profileData.user?.githubUrl || "",
          websiteUrl: basics.website || profileData.user?.websiteUrl || "",
        });
      } else {
        // No generated content — fall back to profile
        if (profileData.user) {
          setContact({
            name: profileData.user.name || "",
            headline: profileData.user.headline || "",
            email: profileData.user.email || "",
            phone: profileData.user.phone || "",
            location: profileData.user.location || "",
            linkedinUrl: profileData.user.linkedinUrl || "",
            githubUrl: profileData.user.githubUrl || "",
            websiteUrl: profileData.user.websiteUrl || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to load resume:", err);
    }
    setLoading(false);
  }

  function parseTextToContent(text: string): any {
    const result: any = {
      summary: "",
      experience: [],
      education: [],
      skills: [],
      projects: [],
    };

    const lines = text.split("\n");
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "PROFESSIONAL SUMMARY") { currentSection = "summary"; continue; }
      if (trimmed === "EXPERIENCE") { currentSection = "experience"; continue; }
      if (trimmed === "EDUCATION") { currentSection = "education"; continue; }
      if (trimmed === "SKILLS") { currentSection = "skills"; continue; }
      if (trimmed === "PROJECTS") { currentSection = "projects"; continue; }

      // Skip header lines (name, headline, contact info, LinkedIn, GitHub, Website)
      if (!currentSection) continue;

      if (currentSection === "summary") {
        result.summary = result.summary ? result.summary + " " + trimmed : trimmed;
      } else if (currentSection === "skills") {
        result.skills = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
        currentSection = "";
      }
    }

    return result;
  }

  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      // Embed contact info into generatedContent.basics so it persists
      const contentWithBasics = {
        ...content,
        basics: {
          name: contact.name,
          headline: contact.headline,
          email: contact.email,
          phone: contact.phone,
          location: contact.location,
          linkedin: contact.linkedinUrl,
          github: contact.githubUrl,
          website: contact.websiteUrl,
        },
      };
      await api.resumes.updateContent(id, {
        generatedContent: contentWithBasics,
        contactInfo: contact,
      } as any);
      updateResume(id, contentWithBasics);
      toastSuccess("Resume updated", "Your changes have been saved");
      navigate(`/resumes/${id}`);
    } catch (err) {
      reportError(err, { title: "Save failed", toastError });
    }
    setSaving(false);
  }, [id, content, contact, updateResume]);

  // Experience helpers
  const addExperience = () => {
    setContent((prev: any) => ({
      ...prev,
      experience: [
        ...prev.experience,
        { title: "", company: "", startDate: "", endDate: "", bullets: [""] },
      ],
    }));
    setActiveSection("experience");
  };

  const updateExperience = (index: number, update: any) => {
    setContent((prev: any) => ({
      ...prev,
      experience: prev.experience.map((exp: any, i: number) => (i === index ? { ...exp, ...update } : exp)),
    }));
  };

  const removeExperience = (index: number) => {
    setContent((prev: any) => ({
      ...prev,
      experience: prev.experience.filter((_: any, i: number) => i !== index),
    }));
  };

  // Education helpers
  const addEducation = () => {
    setContent((prev: any) => ({
      ...prev,
      education: [
        ...prev.education,
        { degree: "", field: "", school: "", startDate: "", endDate: "" },
      ],
    }));
    setActiveSection("education");
  };

  const updateEducation = (index: number, update: any) => {
    setContent((prev: any) => ({
      ...prev,
      education: prev.education.map((edu: any, i: number) => (i === index ? { ...edu, ...update } : edu)),
    }));
  };

  const removeEducation = (index: number) => {
    setContent((prev: any) => ({
      ...prev,
      education: prev.education.filter((_: any, i: number) => i !== index),
    }));
  };

  // Project helpers
  const addProject = () => {
    setContent((prev: any) => ({
      ...prev,
      projects: [
        ...prev.projects,
        { name: "", description: "", technologies: [] },
      ],
    }));
    setActiveSection("projects");
  };

  const updateProject = (index: number, update: any) => {
    setContent((prev: any) => ({
      ...prev,
      projects: prev.projects.map((p: any, i: number) => (i === index ? { ...p, ...update } : p)),
    }));
  };

  const removeProject = (index: number) => {
    setContent((prev: any) => ({
      ...prev,
      projects: prev.projects.filter((_: any, i: number) => i !== index),
    }));
  };

  // Certification helpers
  const addCertification = () => {
    setContent((prev: any) => ({ ...prev, certifications: [...(prev.certifications || []), { name: "", issuer: "", date: "" }] }));
    setActiveSection("certifications");
  };
  const updateCertification = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, certifications: prev.certifications.map((c: any, j: number) => j === i ? { ...c, ...update } : c) }));
  };
  const removeCertification = (i: number) => {
    setContent((prev: any) => ({ ...prev, certifications: prev.certifications.filter((_: any, j: number) => j !== i) }));
  };

  // Language helpers
  const addLanguage = () => {
    setContent((prev: any) => ({ ...prev, languages: [...(prev.languages || []), { name: "", proficiency: "" }] }));
    setActiveSection("languages");
  };
  const updateLanguage = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, languages: prev.languages.map((l: any, j: number) => j === i ? { ...l, ...update } : l) }));
  };
  const removeLanguage = (i: number) => {
    setContent((prev: any) => ({ ...prev, languages: prev.languages.filter((_: any, j: number) => j !== i) }));
  };

  // Award helpers
  const addAward = () => {
    setContent((prev: any) => ({ ...prev, awards: [...(prev.awards || []), { title: "", issuer: "", date: "" }] }));
    setActiveSection("awards");
  };
  const updateAward = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, awards: prev.awards.map((a: any, j: number) => j === i ? { ...a, ...update } : a) }));
  };
  const removeAward = (i: number) => {
    setContent((prev: any) => ({ ...prev, awards: prev.awards.filter((_: any, j: number) => j !== i) }));
  };

  // Publication helpers
  const addPublication = () => {
    setContent((prev: any) => ({ ...prev, publications: [...(prev.publications || []), { title: "", publisher: "", date: "" }] }));
    setActiveSection("publications");
  };
  const updatePublication = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, publications: prev.publications.map((p: any, j: number) => j === i ? { ...p, ...update } : p) }));
  };
  const removePublication = (i: number) => {
    setContent((prev: any) => ({ ...prev, publications: prev.publications.filter((_: any, j: number) => j !== i) }));
  };

  // Volunteer helpers
  const addVolunteer = () => {
    setContent((prev: any) => ({ ...prev, volunteer: [...(prev.volunteer || []), { organization: "", role: "", startDate: "", endDate: "", description: "" }] }));
    setActiveSection("volunteer");
  };
  const updateVolunteer = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, volunteer: prev.volunteer.map((v: any, j: number) => j === i ? { ...v, ...update } : v) }));
  };
  const removeVolunteer = (i: number) => {
    setContent((prev: any) => ({ ...prev, volunteer: prev.volunteer.filter((_: any, j: number) => j !== i) }));
  };

  // Reference helpers
  const addReference = () => {
    setContent((prev: any) => ({ ...prev, references: [...(prev.references || []), { name: "", title: "", company: "", email: "" }] }));
    setActiveSection("references");
  };
  const updateReference = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, references: prev.references.map((r: any, j: number) => j === i ? { ...r, ...update } : r) }));
  };
  const removeReference = (i: number) => {
    setContent((prev: any) => ({ ...prev, references: prev.references.filter((_: any, j: number) => j !== i) }));
  };

  // Custom section helpers
  const addCustomSection = () => {
    setContent((prev: any) => ({ ...prev, customSections: [...(prev.customSections || []), { title: "", content: "" }] }));
    setActiveSection("customSections");
  };
  const updateCustomSection = (i: number, update: any) => {
    setContent((prev: any) => ({ ...prev, customSections: prev.customSections.map((s: any, j: number) => j === i ? { ...s, ...update } : s) }));
  };
  const removeCustomSection = (i: number) => {
    setContent((prev: any) => ({ ...prev, customSections: prev.customSections.filter((_: any, j: number) => j !== i) }));
  };

  if (isPending || loading) {
    return (
      <PageShell>
        <div className="max-w-4xl mx-auto py-12 animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated || !resume) {
    navigate("/login");
    return null;
  }

  const sections = [
    { id: "contact", label: "Contact Info" },
    { id: "summary", label: "Summary" },
    { id: "experience", label: "Experience" },
    { id: "education", label: "Education" },
    { id: "skills", label: "Skills" },
    { id: "projects", label: "Projects" },
    { id: "certifications", label: "Certifications" },
    { id: "languages", label: "Languages" },
    { id: "awards", label: "Awards" },
    { id: "publications", label: "Publications" },
    { id: "volunteer", label: "Volunteer" },
    { id: "references", label: "References" },
    { id: "customSections", label: "Custom Sections" },
  ];

  return (
    <PageShell maxWidth="2xl">
      <PageHeader
        title="Edit Resume"
        subtitle="Modify your resume content section by section"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar navigation */}
        <div className="lg:w-48 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors text-left whitespace-nowrap",
                  activeSection === section.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Link
              to={`/resumes/${id}`}
              className="text-center text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 min-w-0">
          <Card className="p-6">
            {/* Contact Info Section */}
            {activeSection === "contact" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                <p className="text-sm text-gray-500">These fields are from your profile and appear on the resume header.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Full Name" value={contact.name} onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))} />
                  <Input label="Headline" value={contact.headline} onChange={(e) => setContact((p) => ({ ...p, headline: e.target.value }))} placeholder="e.g. Senior Software Engineer" />
                  <Input label="Email" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} />
                  <Input label="Phone" value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} />
                  <Input label="Location" value={contact.location} onChange={(e) => setContact((p) => ({ ...p, location: e.target.value }))} />
                  <Input label="LinkedIn URL" value={contact.linkedinUrl} onChange={(e) => setContact((p) => ({ ...p, linkedinUrl: e.target.value }))} />
                  <Input label="GitHub URL" value={contact.githubUrl} onChange={(e) => setContact((p) => ({ ...p, githubUrl: e.target.value }))} />
                  <Input label="Website URL" value={contact.websiteUrl} onChange={(e) => setContact((p) => ({ ...p, websiteUrl: e.target.value }))} />
                </div>
              </div>
            )}

            {/* Summary Section */}
            {activeSection === "summary" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Professional Summary</h3>
                <p className="text-sm text-gray-500">A 2-3 sentence summary of your professional background and goals.</p>
                <Textarea
                  value={(content as any).summary}
                  onChange={(e: any) => setContent((p: any) => ({ ...p, summary: e.target.value }))}
                  rows={4}
                  placeholder="Experienced software engineer with expertise in..."
                />
              </div>
            )}

            {/* Experience Section */}
            {activeSection === "experience" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Experience</h3>
                  <Button variant="secondary" size="sm" onClick={addExperience}>+ Add</Button>
                </div>
                {content.experience.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No experience entries yet. Click "+ Add" to add one.</p>
                )}
                {content.experience.map((exp: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Experience {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeExperience(i)}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Job Title" value={exp.title} onChange={(e) => updateExperience(i, { title: e.target.value })} placeholder="e.g. Software Engineer" />
                      <Input label="Company" value={exp.company} onChange={(e) => updateExperience(i, { company: e.target.value })} placeholder="e.g. Google" />
                      <Input label="Start Date" value={exp.startDate} onChange={(e) => updateExperience(i, { startDate: e.target.value })} placeholder="e.g. Jan 2022" />
                      <Input label="End Date" value={exp.endDate} onChange={(e) => updateExperience(i, { endDate: e.target.value })} placeholder="e.g. Present" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bullet Points</label>
                      <BulletEditor
                        bullets={(exp.bullets || []) as string[]}
                        onChange={(bullets) => updateExperience(i, { bullets })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Education Section */}
            {activeSection === "education" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Education</h3>
                  <Button variant="secondary" size="sm" onClick={addEducation}>+ Add</Button>
                </div>
                {content.education.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No education entries yet.</p>
                )}
                {content.education.map((edu: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Education {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeEducation(i)}
                        className="text-red-400 hover:text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Degree" value={edu.degree} onChange={(e) => updateEducation(i, { degree: e.target.value })} placeholder="e.g. B.S." />
                      <Input label="Field" value={edu.field} onChange={(e) => updateEducation(i, { field: e.target.value })} placeholder="e.g. Computer Science" />
                      <Input label="School" value={edu.school} onChange={(e) => updateEducation(i, { school: e.target.value })} placeholder="e.g. MIT" />
                      <Input label="Start Date" value={edu.startDate} onChange={(e) => updateEducation(i, { startDate: e.target.value })} placeholder="e.g. Sep 2018" />
                      <Input label="End Date" value={edu.endDate} onChange={(e) => updateEducation(i, { endDate: e.target.value })} placeholder="e.g. Jun 2022" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Skills Section */}
            {activeSection === "skills" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
                <p className="text-sm text-gray-500">Add skills relevant to your target role. Ordered by relevance.</p>
                <SkillsEditor
                  skills={(content.skills || []).map((s: any) => typeof s === "string" ? s : s.name || "")}
                  onChange={(skills: string[]) => setContent((p: any) => ({ ...p, skills }))}
                />
              </div>
            )}

            {/* Projects Section */}
            {activeSection === "projects" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
                  <Button variant="secondary" size="sm" onClick={addProject}>+ Add</Button>
                </div>
                {content.projects.length === 0 && (
                  <p className="text-sm text-gray-500 italic">No projects yet.</p>
                )}
                {content.projects.map((proj: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Project {i + 1}</span>
                      <button type="button" onClick={() => removeProject(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <Input label="Project Name" value={proj.name} onChange={(e) => updateProject(i, { name: e.target.value })} placeholder="e.g. AI Resume Analyzer" />
                    <Textarea label="Description" value={proj.description} onChange={(e) => updateProject(i, { description: e.target.value })} rows={2} placeholder="What does this project do?" />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Technologies</label>
                      <SkillsEditor
                        skills={(proj.technologies || []) as string[]}
                        onChange={(technologies) => updateProject(i, { technologies })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bullet Points</label>
                      <BulletEditor
                        bullets={(proj.bullets || proj.highlights || []) as string[]}
                        onChange={(bullets) => updateProject(i, { bullets })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Certifications Section */}
            {activeSection === "certifications" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Certifications</h3>
                  <Button variant="secondary" size="sm" onClick={addCertification}>+ Add</Button>
                </div>
                {(content.certifications || []).length === 0 && <p className="text-sm text-gray-500 italic">No certifications yet.</p>}
                {(content.certifications || []).map((cert: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Certification {i + 1}</span>
                      <button type="button" onClick={() => removeCertification(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Name" value={cert.name} onChange={(e) => updateCertification(i, { name: e.target.value })} placeholder="e.g. AWS Solutions Architect" />
                      <Input label="Issuer" value={cert.issuer} onChange={(e) => updateCertification(i, { issuer: e.target.value })} placeholder="e.g. Amazon" />
                      <Input label="Date" value={cert.date} onChange={(e) => updateCertification(i, { date: e.target.value })} placeholder="e.g. Jan 2024" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Languages Section */}
            {activeSection === "languages" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Languages</h3>
                  <Button variant="secondary" size="sm" onClick={addLanguage}>+ Add</Button>
                </div>
                {(content.languages || []).length === 0 && <p className="text-sm text-gray-500 italic">No languages yet.</p>}
                {(content.languages || []).map((lang: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Language {i + 1}</span>
                      <button type="button" onClick={() => removeLanguage(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Language" value={lang.name || lang.language || ""} onChange={(e) => updateLanguage(i, { name: e.target.value, language: e.target.value })} placeholder="e.g. Spanish" />
                      <Input label="Proficiency" value={lang.proficiency} onChange={(e) => updateLanguage(i, { proficiency: e.target.value })} placeholder="e.g. Fluent" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Awards Section */}
            {activeSection === "awards" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Awards & Honors</h3>
                  <Button variant="secondary" size="sm" onClick={addAward}>+ Add</Button>
                </div>
                {(content.awards || []).length === 0 && <p className="text-sm text-gray-500 italic">No awards yet.</p>}
                {(content.awards || []).map((award: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Award {i + 1}</span>
                      <button type="button" onClick={() => removeAward(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Title" value={award.title || award.name || ""} onChange={(e) => updateAward(i, { title: e.target.value, name: e.target.value })} placeholder="e.g. Employee of the Year" />
                      <Input label="Issuer" value={award.issuer} onChange={(e) => updateAward(i, { issuer: e.target.value })} placeholder="e.g. Google" />
                      <Input label="Date" value={award.date} onChange={(e) => updateAward(i, { date: e.target.value })} placeholder="e.g. Dec 2023" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Publications Section */}
            {activeSection === "publications" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Publications</h3>
                  <Button variant="secondary" size="sm" onClick={addPublication}>+ Add</Button>
                </div>
                {(content.publications || []).length === 0 && <p className="text-sm text-gray-500 italic">No publications yet.</p>}
                {(content.publications || []).map((pub: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Publication {i + 1}</span>
                      <button type="button" onClick={() => removePublication(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Title" value={pub.title || pub.name || ""} onChange={(e) => updatePublication(i, { title: e.target.value, name: e.target.value })} placeholder="e.g. Distributed Systems Patterns" />
                      <Input label="Publisher" value={pub.publisher} onChange={(e) => updatePublication(i, { publisher: e.target.value })} placeholder="e.g. ACM" />
                      <Input label="Date" value={pub.date} onChange={(e) => updatePublication(i, { date: e.target.value })} placeholder="e.g. Mar 2023" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Volunteer Section */}
            {activeSection === "volunteer" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Volunteer Experience</h3>
                  <Button variant="secondary" size="sm" onClick={addVolunteer}>+ Add</Button>
                </div>
                {(content.volunteer || []).length === 0 && <p className="text-sm text-gray-500 italic">No volunteer experience yet.</p>}
                {(content.volunteer || []).map((vol: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Volunteer {i + 1}</span>
                      <button type="button" onClick={() => removeVolunteer(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Organization" value={vol.organization} onChange={(e) => updateVolunteer(i, { organization: e.target.value })} placeholder="e.g. Red Cross" />
                      <Input label="Role" value={vol.role} onChange={(e) => updateVolunteer(i, { role: e.target.value })} placeholder="e.g. Volunteer Coordinator" />
                      <Input label="Start Date" value={vol.startDate} onChange={(e) => updateVolunteer(i, { startDate: e.target.value })} placeholder="e.g. Jan 2022" />
                      <Input label="End Date" value={vol.endDate} onChange={(e) => updateVolunteer(i, { endDate: e.target.value })} placeholder="e.g. Present" />
                    </div>
                    <Textarea label="Description" value={vol.description} onChange={(e) => updateVolunteer(i, { description: e.target.value })} rows={2} placeholder="What did you do?" />
                  </div>
                ))}
              </div>
            )}

            {/* References Section */}
            {activeSection === "references" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">References</h3>
                  <Button variant="secondary" size="sm" onClick={addReference}>+ Add</Button>
                </div>
                {(content.references || []).length === 0 && <p className="text-sm text-gray-500 italic">No references yet.</p>}
                {(content.references || []).map((ref: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Reference {i + 1}</span>
                      <button type="button" onClick={() => removeReference(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input label="Name" value={ref.name} onChange={(e) => updateReference(i, { name: e.target.value })} placeholder="e.g. Jane Smith" />
                      <Input label="Title" value={ref.title} onChange={(e) => updateReference(i, { title: e.target.value })} placeholder="e.g. Engineering Manager" />
                      <Input label="Company" value={ref.company} onChange={(e) => updateReference(i, { company: e.target.value })} placeholder="e.g. Google" />
                      <Input label="Email" value={ref.email} onChange={(e) => updateReference(i, { email: e.target.value })} placeholder="e.g. jane@google.com" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Sections */}
            {activeSection === "customSections" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Custom Sections</h3>
                  <Button variant="secondary" size="sm" onClick={addCustomSection}>+ Add</Button>
                </div>
                {(content.customSections || []).length === 0 && <p className="text-sm text-gray-500 italic">No custom sections yet.</p>}
                {(content.customSections || []).map((cs: any, i: number) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-medium text-gray-400">Section {i + 1}</span>
                      <button type="button" onClick={() => removeCustomSection(i)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                    </div>
                    <Input label="Section Title" value={cs.title || cs.name || ""} onChange={(e) => updateCustomSection(i, { title: e.target.value, name: e.target.value })} placeholder="e.g. Leadership" />
                    <Textarea label="Content" value={cs.content} onChange={(e) => updateCustomSection(i, { content: e.target.value })} rows={4} placeholder="Section content (one item per line)..." />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
