"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RetryApi({
  label,
  loading,
}: {
  label: string;
  loading: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn btn-secondary"
      disabled={pending}
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? loading : label}
    </button>
  );
}
