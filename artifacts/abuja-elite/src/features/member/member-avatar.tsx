import { initialsOf, useSignedPhoto } from "@/lib/supabase/directory";

/** A member's photo, or their initials when there is none (or it cannot be shown). */
export function MemberAvatar({ path, name, size = "md" }: { path: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const photo = useSignedPhoto(path);
  return (
    <span className={`member-avatar member-avatar-${size}`} aria-hidden={photo.data ? undefined : "true"}>
      {photo.data ? <img src={photo.data} alt={`Photo of ${name}`} loading="lazy" /> : <span>{initialsOf(name)}</span>}
    </span>
  );
}
