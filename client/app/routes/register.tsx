import { useState, type FormEvent, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { signUp, useSession } from "~/lib/auth-store";
import { PageShell, PageHeader, Button, Input, useToastHelpers, ErrorBanner, reportError } from "~/components/ui";

export const meta = () => [
  { title: "Career Autopilot | Register" },
  { name: "description", content: "Create your account" },
];

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const { error: toastError } = useToastHelpers();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isPending && session) {
      navigate("/jobs", { replace: true });
    }
  }, [isPending, session, navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signUp.email({ email, password, name: name || "" });
      // useSession will update automatically via atom listener
    } catch (err) {
      reportError(err, { title: "Registration failed", toastError, setError });
      setLoading(false);
    }
  }

  if (isPending) {
    return (
      <PageShell>
        <div className="min-h-screen flex items-center justify-center">
          <img src="/images/resume-scan-2.gif" className="w-[200px]" alt="Loading" />
        </div>
      </PageShell>
    );
  }

  if (session) return null;

  return (
    <PageShell maxWidth="sm" className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        <PageHeader
          title="Create Account"
          subtitle="Start your job search journey"
        />

        {error && <ErrorBanner error={error} />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Name (optional)"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-500 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </PageShell>
  );
}