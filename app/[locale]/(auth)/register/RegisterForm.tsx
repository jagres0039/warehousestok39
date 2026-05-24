"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { registerAction, type RegisterResult } from "./actions";

interface RegisterFormProps {
  locale: string;
}

export function RegisterForm({ locale }: RegisterFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<RegisterResult | undefined, FormData>(
    registerAction,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signUpTitle")}</CardTitle>
        <CardDescription>{t("signUpSubtitle")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <CardContent className="space-y-4">
          {state?.error === "EMAIL_TAKEN" && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t("emailTaken")}
            </div>
          )}
          <FormField
            id="organizationName"
            label={t("organizationName")}
            type="text"
            autoComplete="organization"
            error={state?.fieldErrors?.organizationName?.[0]}
          />
          <FormField
            id="name"
            label={t("name")}
            type="text"
            autoComplete="name"
            error={state?.fieldErrors?.name?.[0]}
          />
          <FormField
            id="email"
            label={t("email")}
            type="email"
            autoComplete="email"
            error={state?.fieldErrors?.email?.[0]}
          />
          <FormField
            id="password"
            label={t("password")}
            type="password"
            autoComplete="new-password"
            error={state?.fieldErrors?.password?.[0]}
            hint={t("passwordHint")}
          />
        </CardContent>
        <CardFooter className="flex-col gap-3 pt-2">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("creatingAccount") : t("createAccount")}
          </Button>
          <p className="text-center text-sm text-slate-500">
            {t("alreadyHaveAccount")}{" "}
            <Link href={`/${locale}/login`} className="font-medium text-primary hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  error?: string;
  hint?: string;
}

function FormField({ id, label, type, autoComplete, error, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} autoComplete={autoComplete} required />
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
