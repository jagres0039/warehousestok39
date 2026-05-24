"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  placeholder: string;
  paramName?: string;
}

export function SearchInput({ placeholder, paramName = "q" }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramName) ?? "");
  const [, startTransition] = useTransition();

  function commit(next: string) {
    const url = new URL(pathname, "http://x");
    for (const [k, v] of params.entries()) {
      if (k !== paramName && k !== "page") url.searchParams.set(k, v);
    }
    if (next) url.searchParams.set(paramName, next);
    startTransition(() => {
      router.push(`${url.pathname}?${url.searchParams.toString()}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit(value.trim());
      }}
      className="flex max-w-sm gap-2"
    >
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
