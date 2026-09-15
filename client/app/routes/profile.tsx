import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-store";
import { api } from "~/lib/api";
import { PageShell, PageHeader, Button, Input, Textarea, Card, ScoreCircle, useToastHelpers, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Profile" },
];

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToastHelpers();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [completion, setCompletion] = useState<any>(null);

  // Edit states
  const [editing, setEditing] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [education, setEducation] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isPending && !isAuthenticated) navigate("/login");
  }, [isPending, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) loadProfile();
  }, [isAuthenticated]);

  async function loadProfile() {
    try {
      const data = await api.profile.get();
      setProfileData(data.user);
      setCompletion(data.completion);
      setHeadline(data.user.headline || "");
      setSummary(data.user.summary || "");
      setLocation(data.user.location || "");
      setPhone(data.user.phone || "");
      setLinkedinUrl(data.user.linkedinUrl || "");
      setGithubUrl(data.user.githubUrl || "");
      setWebsiteUrl(data.user.websiteUrl || "");
      setEducation(data.profile.education || []);
      setExperience(data.profile.experience || []);
      setProjects(data.profile.projects || []);
      setSkills(data.profile.skills || []);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
    setLoading(false);
  }

  async function saveSection(section: string) {
    setSaving(true);
    try {
      if (section === 'basic') {
        await api.profile.updateUser({ headline, summary, location, phone });
      } else if (section === 'links') {
        await api.profile.updateUser({ linkedinUrl, githubUrl, websiteUrl });
      } else if (section === 'education') {
        await api.profile.update({ education });
      } else if (section === 'experience') {
        await api.profile.update({ experience });
      } else if (section === 'skills') {
        await api.profile.update({ skills });
      } else if (section === 'projects') {
        await api.profile.update({ projects });
      }
      // Reload to get updated completion
      const data = await api.profile.get();
      setCompletion(data.completion);
      setEditing(null);
      toastSuccess("Saved", "Profile updated");
    } catch (err) {
      reportError(err, { title: "Save failed", toastError, retry: () => saveSection(section) });
    }
    setSaving(false);
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
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter(s => s !== skill));
  }

  if (isPending || loading) {
    return (
      <PageShell>
        <div className="grid gap-6 lg:grid-cols-3 animate-pulse">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const pct = completion?.percentage || 0;

  return (
    <PageShell maxWidth="xl">
      <PageHeader title="Profile" subtitle="Manage your professional profile" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sidebar: completion */}
        <div className="space-y-6">
          <Card className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <ScoreCircle score={pct} size="lg" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">Profile Complete</p>
            <p className="text-xs text-gray-500">
              {pct === 100 ? "Your profile is complete!" : "Complete your profile to generate resumes"}
            </p>
          </Card>

          {/* Section checklist */}
          <Card className="p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Sections</p>
            <div className="space-y-2">
              {completion?.sections?.map((section: any) => (
                <div key={section.name} className="flex items-center justify-between text-sm">
                  <span className={section.complete ? 'text-success font-medium' : 'text-gray-600'}>{section.name}</span>
                  <span className={`text-xs font-semibold ${section.complete ? 'text-success' : 'text-gray-400'}`}>
                    {section.complete ? '✓' : `${section.percentage}%`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main: editable sections */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Basic Information</h3>
              {editing !== 'basic' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('basic')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('basic')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'basic' ? (
              <div className="space-y-3">
                <Input label="Headline" value={headline} onChange={e => setHeadline(e.target.value)} />
                <Textarea label="Summary" value={summary} onChange={e => setSummary(e.target.value)} rows={4} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} />
                  <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-400">Headline:</span> <span className="font-medium text-gray-900">{profileData?.headline || '—'}</span></p>
                <p><span className="text-gray-400">Summary:</span> <span className="text-gray-700 line-clamp-2">{profileData?.summary || '—'}</span></p>
                <p><span className="text-gray-400">Location:</span> <span className="text-gray-700">{profileData?.location || '—'}</span></p>
                <p><span className="text-gray-400">Phone:</span> <span className="text-gray-700">{profileData?.phone || '—'}</span></p>
              </div>
            )}
          </Card>

          {/* Education */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Education</h3>
              {editing !== 'education' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('education')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('education')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'education' ? (
              <div className="space-y-3">
                {education.map((edu, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 relative">
                    {education.length > 1 && (
                      <button onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-xs text-red-500">Remove</button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="School" value={edu.school} onChange={e => updateEducation(i, 'school', e.target.value)} />
                      <Input label="Degree" value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} />
                    </div>
                    <Input label="Field" value={edu.field} onChange={e => updateEducation(i, 'field', e.target.value)} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={addEducation}>+ Add</Button>
              </div>
            ) : (
              education.length > 0 ? education.map((edu, i) => (
                <div key={i} className="text-sm mb-2">
                  <p className="font-medium text-gray-900">{edu.degree}{edu.field ? ` in ${edu.field}` : ''}</p>
                  <p className="text-gray-500">{edu.school}</p>
                </div>
              )) : <p className="text-sm text-gray-400">No education added</p>
            )}
          </Card>

          {/* Experience */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Experience</h3>
              {editing !== 'experience' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('experience')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('experience')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'experience' ? (
              <div className="space-y-3">
                {experience.map((exp, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 relative">
                    {experience.length > 1 && (
                      <button onClick={() => removeExperience(i)} className="absolute top-2 right-2 text-xs text-red-500">Remove</button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Company" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                      <Input label="Title" value={exp.title} onChange={e => updateExperience(i, 'title', e.target.value)} />
                    </div>
                    <Textarea label="Description" value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} rows={2} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={addExperience}>+ Add</Button>
              </div>
            ) : (
              experience.length > 0 ? experience.map((exp, i) => (
                <div key={i} className="text-sm mb-2">
                  <p className="font-medium text-gray-900">{exp.title} at {exp.company}</p>
                  {exp.description && <p className="text-gray-500 line-clamp-2">{exp.description}</p>}
                </div>
              )) : <p className="text-sm text-gray-400">No experience added</p>
            )}
          </Card>

          {/* Skills */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Skills</h3>
              {editing !== 'skills' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('skills')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('skills')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'skills' ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Add a skill" value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput); } }} />
                  <Button variant="secondary" onClick={() => addSkill(skillInput)}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                      {s}
                      <button onClick={() => removeSkill(s)} className="text-primary-400 hover:text-primary-600">×</button>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map(s => <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{s}</span>)}
                </div>
              ) : <p className="text-sm text-gray-400">No skills added</p>
            )}
          </Card>

          {/* Projects */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Projects</h3>
              {editing !== 'projects' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('projects')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('projects')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'projects' ? (
              <div className="space-y-3">
                {projects.map((proj, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2 relative">
                    <button onClick={() => setProjects(projects.filter((_, j) => j !== i))} className="absolute top-2 right-2 text-xs text-red-500">Remove</button>
                    <Input label="Project Name" value={proj.name || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], name: e.target.value }; setProjects(updated); }} />
                    <Input label="Description" value={proj.description || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], description: e.target.value }; setProjects(updated); }} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="Project URL" value={proj.url || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], url: e.target.value }; setProjects(updated); }} />
                      <Input label="GitHub URL" value={proj.githubUrl || ''} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], githubUrl: e.target.value }; setProjects(updated); }} />
                    </div>
                    <Input label="Technologies" value={(proj.technologies || []).join(', ')} onChange={e => { const updated = [...projects]; updated[i] = { ...updated[i], technologies: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) }; setProjects(updated); }} />
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => setProjects([...projects, { name: '', description: '', url: '', githubUrl: '', technologies: [] }])}>+ Add Project</Button>
              </div>
            ) : (
              projects.length > 0 ? projects.map((proj, i) => (
                <div key={i} className="text-sm mb-3">
                  <p className="font-medium text-gray-900">{proj.name}</p>
                  {proj.description && <p className="text-gray-500 line-clamp-1">{proj.description}</p>}
                  {proj.technologies?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {proj.technologies.map((t: string) => <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>)}
                    </div>
                  )}
                </div>
              )) : <p className="text-sm text-gray-400">No projects added</p>
            )}
          </Card>

          {/* Links */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Online Presence</h3>
              {editing !== 'links' ? (
                <Button variant="ghost" size="sm" onClick={() => setEditing('links')}>Edit</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveSection('links')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                </div>
              )}
            </div>
            {editing === 'links' ? (
              <div className="space-y-3">
                <Input label="LinkedIn" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
                <Input label="GitHub" value={githubUrl} onChange={e => setGithubUrl(e.target.value)} />
                <Input label="Website" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {linkedinUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 w-20">LinkedIn</span>
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{linkedinUrl}</a>
                  </div>
                )}
                {githubUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 w-20">GitHub</span>
                    <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{githubUrl}</a>
                  </div>
                )}
                {websiteUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400 w-20">Website</span>
                    <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{websiteUrl}</a>
                  </div>
                )}
                {!linkedinUrl && !githubUrl && !websiteUrl && <p className="text-gray-400">No links added</p>}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
