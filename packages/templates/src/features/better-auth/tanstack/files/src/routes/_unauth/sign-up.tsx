import {
  GithubLogoIcon,
  GoogleLogoIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "~/lib/auth-client";
import { hasAnyOAuth, oauthProviders } from "~/lib/auth-providers";

export const Route = createFileRoute("/_unauth/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<"email" | "google" | "github" | null>(
    null
  );

  const onEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending("email");
    const { error } = await authClient.signUp.email({ name, email, password });
    if (error) {
      toast.error(error.message ?? "Could not create account");
      setPending(null);
      return;
    }
    await router.navigate({ to: "/" });
    await router.invalidate();
  };

  const onSocial = async (provider: "google" | "github") => {
    setPending(provider);
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/",
    });
    if (error) {
      toast.error(error.message ?? `Could not sign up with ${provider}`);
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Get started in seconds</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasAnyOAuth ? (
          <>
            <div className="flex flex-col gap-2">
              {oauthProviders.google ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => onSocial("google")}
                >
                  {pending === "google" ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    <GoogleLogoIcon weight="bold" />
                  )}
                  Continue with Google
                </Button>
              ) : null}
              {oauthProviders.github ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => onSocial("github")}
                >
                  {pending === "github" ? (
                    <SpinnerIcon className="animate-spin" />
                  ) : (
                    <GithubLogoIcon weight="bold" />
                  )}
                  Continue with GitHub
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground uppercase">
                or
              </span>
              <Separator className="flex-1" />
            </div>
          </>
        ) : null}

        <form onSubmit={onEmailSubmit} className="flex flex-col gap-3">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending !== null}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending !== null}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending !== null}
            />
          </div>
          <Button type="submit" disabled={pending !== null}>
            {pending === "email" ? (
              <SpinnerIcon className="animate-spin" />
            ) : null}
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/sign-in"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
