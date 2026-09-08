import {useQuery} from '@tanstack/react-query';
import {getSupabaseClient} from '@/lib/supabase/client';
import { toLagosInput, fromLagosInput } from '@/lib/content-validation';
import { useModal } from '@/hooks/use-modal';
import { getDraft, setDraft, clearDraft } from '@/lib/admin-draft-store';
import './admin-dashboard.css';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Inbox,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  Eye,
  EyeOff,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { AdminDashboardCounts } from '@/lib/supabase/content';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type Tables = Database['public']['Tables'];
type Member = Tables['members']['Row'];
type Collaboration = Tables['collaborations']['Row'];
type Event = Tables['events']['Row'];
type Story = Tables['stories']['Row'];
type GalleryItem = Tables['gallery_items']['Row'];
type SiteSetting = Tables['site_settings']['Row'];
type ContentRecord = Member | Collaboration | Event | Story | GalleryItem | SiteSetting;

export type DashboardResource = 'members' | 'collaborations' | 'events' | 'stories' | 'gallery_items' | 'site_settings';
export type DashboardSection = 'overview' | DashboardResource;

export interface AdminAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isError: boolean;
  hasSession: boolean;
  email?: string | null;
  displayName?: string | null;
  userId?: string | null;
  onRetry: () => void;
}

export type SignInHandler = (email: string, password: string) => Promise<void> | void;

export interface MediaUploadResult {
  path: string;
  previewUrl?: string;
}

export type MediaUploadHandler = (
  file: File,
  context: { resource: DashboardResource; field: string; recordId?: string },
) => Promise<MediaUploadResult> | MediaUploadResult;

export interface AdminDashboardProps {
  auth: AdminAuthState;
  members?: Member[];
  collaborations?: Collaboration[];
  events?: Event[];
  stories?: Story[];
  galleryItems?: GalleryItem[];
  siteSettings?: SiteSetting[];
  loading?: Partial<Record<DashboardResource, boolean>>;
  errors?: Partial<Record<DashboardResource | 'auth', string | null>>;
  onRetry?: (resource?: DashboardResource) => void;
  onSignOut: () => void | Promise<void>;
  onCreate?: (resource: DashboardResource, payload: Record<string, unknown>) => Promise<void> | void;
  onUpdate?: (resource: DashboardResource, id: string, payload: Record<string, unknown>) => Promise<void> | void;
  onDelete?: (resource: DashboardResource, id: string) => Promise<void> | void;
  onUploadMedia?: MediaUploadHandler;
  createMediaPreview?: (path: string) => Promise<string>;
  resolveMediaUrl?: (path: string) => string;
  onSignIn?: SignInHandler;
  counts?: AdminDashboardCounts | null;
  countsLoading?: boolean;
  countsError?: string | null;
  onRetryCounts?: () => void;
}

const resourceLabels: Record<DashboardResource, string> = {
  members: 'Members',
  collaborations: 'Collaborations',
  events: 'Events',
  stories: 'Stories',
  gallery_items: 'Gallery',
  site_settings: 'Site settings',
};

const resourceDescriptions: Record<DashboardResource, string> = {
  members: 'People and profiles approved for the public journal.',
  collaborations: 'Partners and cultural collaborators.',
  events: 'Published and scheduled city experiences.',
  stories: 'Editorial work in draft or ready for release.',
  gallery_items: 'Image-led moments and visual archives.',
  site_settings: 'Public-facing identity, links and configuration.',
};

const navItems: Array<{ id: DashboardSection; label: string; icon: typeof LayoutGrid }> = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'stories', label: 'Stories', icon: FileText },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'collaborations', label: 'Collaborations', icon: FolderOpen },
  { id: 'gallery_items', label: 'Gallery', icon: ImageIcon },
  { id: 'site_settings', label: 'Site settings', icon: Settings2 },
];

const resourceFields: Record<DashboardResource, Array<{
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'url' | 'datetime-local' | 'select' | 'number' | 'json';
  required?: boolean;
  options?: string[];
  media?: boolean;
}>> = {
  members: [
    { name: 'name', label: 'Name', required: true },
    { name: 'slug', label: 'Slug', required: true },
    { name: 'role', label: 'Role' },
    { name: 'category', label: 'Category' },
    { name: 'location', label: 'Location' },
    { name: 'bio', label: 'Bio', type: 'textarea' },
    { name: 'profile_image_path', label: 'Profile image', media: true },
    { name: 'instagram_url', label: 'Instagram URL', type: 'url' },
    { name: 'website_url', label: 'Website URL', type: 'url' },
    { name: 'sort_order', label: 'Sort order', type: 'number' },
  ],
  collaborations: [
    { name: 'name', label: 'Name', required: true },
    { name: 'slug', label: 'Slug', required: true },
    { name: 'category', label: 'Category' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'logo_path', label: 'Logo', media: true },
    { name: 'cover_image_path', label: 'Cover image', media: true },
    { name: 'website_url', label: 'Website URL', type: 'url' },
    { name: 'instagram_url', label: 'Instagram URL', type: 'url' },
    { name: 'sort_order', label: 'Sort order', type: 'number' },
  ],
  events: [
    { name: 'title', label: 'Title', required: true },
    { name: 'slug', label: 'Slug', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'starts_at', label: 'Starts at (Abuja time)', type: 'datetime-local', required: true },
    { name: 'ends_at', label: 'Ends at (Abuja time)', type: 'datetime-local' },
    { name: 'location', label: 'Location' },
    { name: 'cover_image_path', label: 'Cover image', media: true },
    { name: 'registration_url', label: 'Registration URL', type: 'url' },
    { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'cancelled'] },
  ],
  stories: [
    { name: 'title', label: 'Title', required: true },
    { name: 'slug', label: 'Slug', required: true },
    { name: 'category', label: 'Category' },
    { name: 'author_name', label: 'Author name' },
    { name: 'excerpt', label: 'Excerpt', type: 'textarea' },
    { name: 'content', label: 'Content', type: 'textarea', required: true },
    { name: 'cover_image_path', label: 'Cover image', media: true },
    { name: 'published_at', label: 'Published at (Abuja time)', type: 'datetime-local' },
  ],
  gallery_items: [
    { name: 'image_path', label: 'Image', media: true, required: true },
    { name: 'thumbnail_path', label: 'Thumbnail', media: true },
    { name: 'alt_text', label: 'Alt text', required: true },
    { name: 'caption', label: 'Caption', type: 'textarea' },
    { name: 'category', label: 'Category' },
    { name: 'event_id', label: 'Related experience' },
    { name: 'story_id', label: 'Related story' },
    { name: 'collaboration_id', label: 'Related collaboration' },
    { name: 'sort_order', label: 'Sort order', type: 'number' },
  ],
  site_settings: [
    { name: 'setting_key', label: 'Setting key', required: true },
    { name: 'value', label: 'Value (JSON)', type: 'json', required: true },
  ],
};

const getId = (record: ContentRecord) => record.id;

const displayValue = (record: ContentRecord) => {
  if ('name' in record) return record.name;
  if ('title' in record) return record.title;
  if ('setting_key' in record) return record.setting_key;
  if ('alt_text' in record) return record.alt_text;
  return (record as { id: string }).id;
};

const getImagePath = (record: ContentRecord): string | null => {
  if ('profile_image_path' in record) return record.profile_image_path;
  if ('cover_image_path' in record) return record.cover_image_path;
  if ('image_path' in record) return record.image_path;
  if ('logo_path' in record) return typeof record.logo_path === 'string' ? record.logo_path : null;
  return null;
};

const toLocalDateTime = toLagosInput;
const toIsoDateTime = fromLagosInput;

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'gold' | 'green' | 'red' }) {
  return <span className={cn('ae-badge', `ae-badge-${tone}`)}>{children}</span>;
}

function SkeletonRows() {
  return (
    <div className="space-y-3" aria-label="Loading content">
      {[1, 2, 3, 4].map((row) => <div key={row} className="ae-skeleton h-[68px] w-full" />)}
    </div>
  );
}

function AccessGate({
  auth,
  error,
  onSignIn,
  onSignOut,
}: {
  auth: AdminAuthState;
  error?: string | null;
  onSignIn?: SignInHandler;
  onSignOut: AdminDashboardProps['onSignOut'];
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (auth.isLoading) {
    return <div className="ae-gate"><div className="ae-gate-card"><div className="ae-skeleton mb-6 h-3 w-24" /><div className="ae-skeleton mb-3 h-10 w-72" /><div className="ae-skeleton h-4 w-96 max-w-full" /></div></div>;
  }

  if (auth.isError) {
    return (
      <div className="ae-gate">
        <div className="ae-gate-card">
          <div className="ae-brand-lockup"><span>AE</span><span>ABUJA ELITE</span></div>
          <AlertCircle size={26} className="mt-10 text-destructive" />
          <p className="ae-kicker mt-5">Access check unavailable</p>
          <h1 className="ae-gate-title">We could not verify the desk.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">The workspace is closed until your session and administrator access can be verified.</p>
          <div className="ae-inline-error mt-6" role="alert"><AlertCircle size={16} /> {error || 'Unable to verify administrator access.'}</div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={auth.onRetry}>Retry verification</Button>
            <Button type="button" variant="outline" onClick={() => void onSignOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="ae-gate">
        <div className="ae-gate-card">
          <div className="ae-brand-lockup"><span>AE</span><span>ABUJA ELITE</span></div>
          <ShieldCheck size={26} className="mt-10 text-primary" />
          <p className="ae-kicker mt-5">Access restricted</p>
          <h1 className="ae-gate-title">This room is for the editors.</h1>
          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">Your account is authenticated, but it is not on the Abuja Elite editorial allowlist.</p>
          {error && <div className="ae-inline-error mt-6"><AlertCircle size={16} /> {error}</div>}
          <p className="mt-5 font-mono text-xs text-muted-foreground">{auth.email}</p>
          <Button type="button" variant="outline" className="mt-8" onClick={() => void onSignOut()}>
            <LogOut /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSignIn) {
      setFormError('Sign-in is not connected yet.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (signInError) {
      setFormError(signInError instanceof Error ? signInError.message : 'Unable to sign in. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ae-gate">
      <div className="ae-gate-card">
        <div className="ae-brand-lockup"><span>AE</span><span>ABUJA ELITE</span></div>
        <ShieldCheck size={26} className="mt-10 text-primary" />
        <p className="ae-kicker mt-5">Private editorial workspace</p>
        <h1 className="ae-gate-title">Sign in to the desk.</h1>
        <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
          Sign in with the approved editorial account to manage the public journal.
        </p>
         {(error || formError) && <div className="ae-inline-error mt-6" role="alert"><AlertCircle size={16} /> {formError || error}</div>}
        <form className="mt-8 space-y-5" onSubmit={submit}>
           <label className="ae-field" htmlFor="admin-email">
             <span className="ae-field-label">Email address</span>
             <Input id="admin-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="ae-input" />
          </label>
           <label className="ae-field" htmlFor="admin-password">
            <span className="ae-field-label">Password</span>
             <div className="relative">
               <Input id="admin-password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="ae-input pr-11" />
               <button type="button" className="ae-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                 {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
               </button>
             </div>
          </label>
          <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in securely'}</Button>
        </form>
      </div>
    </div>
  );
}

function StatusCluster({ record }: { record: ContentRecord }) {
  const published = 'published' in record ? record.published : false;
  const featured = 'featured' in record ? record.featured : false;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={published ? 'green' : 'muted'}>{published ? 'Published' : 'Draft'}</Badge>
      {featured && <Badge tone="gold"><Star size={11} /> Featured</Badge>}
      {'status' in record && record.status === 'cancelled' && <Badge tone="red">Cancelled</Badge>}
    </div>
  );
}

function MetricCard({
  label,
  count,
  icon: Icon,
  active,
  error,
  onClick,
}: {
  label: string;
  count?: number;
  icon: typeof Users;
  active?: boolean;
  error?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between"><span className="ae-kicker">{label}</span><Icon size={16} className="text-primary" /></div>
      <span className="mt-8 block font-serif text-4xl leading-none tracking-[-.06em]">
        {error ? <span className="text-2xl text-muted-foreground">—</span> : count ?? <span className="ae-skeleton inline-block h-9 w-12 align-middle" />}
      </span>
      <span className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        {error ? 'Unavailable' : onClick ? <>Open section <ArrowUpRight size={12} /></> : 'Upcoming module'}
      </span>
    </>
  );

  return onClick ? (
    <button type="button" className={cn('ae-metric text-left', active && 'ae-metric-active')} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="ae-metric text-left">{content}</div>
  );
}

function MediaField({
  resource,
  field,
  value,
  recordId,
  onChange,
  onUploadMedia,
  createMediaPreview,
  resolveMediaUrl,
}: {
  resource: DashboardResource;
  field: string;
  value: string;
  recordId?: string;
  onChange: (value: string) => void;
  onUploadMedia?: MediaUploadHandler;
  createMediaPreview?: (path: string) => Promise<string>;
  resolveMediaUrl?: (path: string) => string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let active = true;
    if (!value) {
      setPreview('');
    } else if (resolveMediaUrl) {
      setPreview(resolveMediaUrl(value));
    } else if (createMediaPreview) {
      void createMediaPreview(value)
        .then((url) => {
          if (active) setPreview(url);
        })
        .catch(() => {
          if (active) setPreview('');
        });
    } else {
      setPreview(value);
    }
    return () => {
      active = false;
    };
  }, [createMediaPreview, resolveMediaUrl, value]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!onUploadMedia) {
      setError('Media upload is not connected yet.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const result = await onUploadMedia(file, { resource, field, recordId });
      onChange(result.path);
      setPreview(result.previewUrl ?? '');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="ae-media-field">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="ae-media-thumb">
          {preview ? <img src={preview} alt="" /> : <ImageIcon size={17} />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground">{value || 'No image selected'}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">JPEG, PNG or WebP · up to 5 MiB</p>
        </div>
      </div>
      <label className={cn('ae-upload-button', (!onUploadMedia || uploading) && 'pointer-events-none opacity-50')}>
        <Upload size={14} /> {uploading ? 'Uploading' : 'Choose file'}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!onUploadMedia || uploading} onChange={handleFile} />
      </label>
      {value && <button type="button" disabled={uploading} onClick={()=>onChange('')} className="ae-text-button">Remove selection</button>}
      {error && <p className="basis-full text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function Editor({
  resource,
  record,
  onClose,
  onCreate,
  onUpdate,
  onUploadMedia,
  createMediaPreview,
  resolveMediaUrl,
  userId,
}: {
  resource: DashboardResource;
  record?: ContentRecord;
  onClose: () => void;
  onCreate?: AdminDashboardProps['onCreate'];
  onUpdate?: AdminDashboardProps['onUpdate'];
  onUploadMedia?: MediaUploadHandler;
  createMediaPreview?: (path: string) => Promise<string>;
  resolveMediaUrl?: (path: string) => string;
  userId?: string;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  useModal(drawerRef, onClose);
  const fields = resourceFields[resource];
  const isNew = !record;
  const recordId = record ? getId(record) : undefined;
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    fields.forEach((field) => {
      const sourceValue = record?.[field.name as keyof ContentRecord];
      if (field.name === 'value' && sourceValue !== undefined) values[field.name] = JSON.stringify(sourceValue, null, 2);
       else if (field.type === 'datetime-local' && typeof sourceValue === 'string') values[field.name] = toLocalDateTime(sourceValue);
       else if (field.type === 'select' && sourceValue === undefined) values[field.name] = field.options?.[0] ?? '';
      else values[field.name] = sourceValue ?? (field.type === 'number' ? 0 : '');
    });
    if (!isNew && record && 'published' in record) values.published = record.published;
    if (!isNew && record && 'featured' in record) values.featured = record.featured;
     if (resource === 'site_settings' && !('is_public' in (record ?? {}))) values.is_public = false;
    if (record && 'is_public' in record) values.is_public = record.is_public;
    return values;
  }, [fields, isNew, record]);
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty && userId) {
      const draft = getDraft(userId, resource, recordId);
      if (draft) {
        setValues(draft);
        setDirty(true);
      } else {
        setValues(initialValues);
      }
    }
  }, [userId, resource, recordId, dirty, initialValues]);

  useEffect(() => {
    if (dirty && userId) {
      setDraft(userId, resource, recordId, values);
    }
  }, [dirty, values, userId, resource, recordId]);

  const setValue = (name: string, value: unknown) => { setDirty(true); setValues((current) => ({ ...current, [name]: value })); };
  const handleClose = () => { if (userId) clearDraft(userId, resource, recordId); onClose(); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if(drawerRef.current?.querySelector('input[type=file]:disabled')){setError('Wait for the image upload to finish.');return;}
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      fields.forEach((field) => {
        if (field.type === 'number') payload[field.name] = Number(payload[field.name] || 0);
        if (field.name === 'value' && typeof payload[field.name] === 'string') {
          try { payload[field.name] = JSON.parse(payload[field.name] as string) as Json; } catch { throw new Error('Value must be valid JSON.'); }
        }
        if (field.type === 'datetime-local' && payload[field.name] === '') payload[field.name] = null;
        if (field.type === 'datetime-local' && typeof payload[field.name] === 'string' && payload[field.name]) payload[field.name] = toIsoDateTime(payload[field.name] as string);
        if (typeof payload[field.name] === 'string' && payload[field.name] === '') payload[field.name] = null;
      });
      if (isNew) {
        if (!onCreate) throw new Error('Create handler is not connected yet.');
        await onCreate(resource, payload);
      } else {
        if (!onUpdate) throw new Error('Update handler is not connected yet.');
        await onUpdate(resource, getId(record), payload);
      }
      if (userId) clearDraft(userId, resource, recordId);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this record.');
      setTimeout(() => {
        const firstInvalid = drawerRef.current?.querySelector('[aria-invalid="true"]') as HTMLElement | null;
        firstInvalid?.focus();
      }, 0);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ae-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleClose(); }}>
      <aside ref={drawerRef} className="ae-drawer" role="dialog" aria-modal="true" aria-label={`${isNew ? 'Create' : 'Edit'} ${resourceLabels[resource]}`}>
        <div className="ae-drawer-head">
          <div><p className="ae-kicker">{isNew ? 'New record' : 'Edit record'}</p><h2 className="mt-2 font-serif text-3xl tracking-[-.04em]">{resourceLabels[resource]}</h2></div>
          <button type="button" className="ae-icon-button" onClick={handleClose} aria-label="Close editor"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="ae-drawer-body">
            <p className="mb-7 text-sm leading-6 text-muted-foreground">{resourceDescriptions[resource]}</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.name} className={cn('ae-field', (field.type === 'textarea' || field.type === 'json' || field.media) && 'sm:col-span-2')}>
                  <span className="ae-field-label">{field.label}{field.required && <b className="ml-1 text-primary">*</b>}</span>
                   {['event_id','story_id','collaboration_id'].includes(field.name) ? <RelatedContent field={field.name} value={String(values[field.name]??'')} onChange={value=>setValue(field.name,value)}/> : field.media ? (
                    <MediaField resource={resource} field={field.name} value={String(values[field.name] ?? '')} recordId={record ? getId(record) : undefined} onChange={(value) => setValue(field.name, value)} onUploadMedia={onUploadMedia} createMediaPreview={createMediaPreview} resolveMediaUrl={resolveMediaUrl} />
                  ) : field.type === 'textarea' || field.type === 'json' ? (
                    <Textarea required={field.required} rows={field.type === 'json' ? 7 : 5} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)} className="ae-input resize-y" />
                  ) : field.type === 'select' ? (
                    <select required={field.required} className="ae-input" value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)}>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <Input required={field.required} type={field.type ?? 'text'} value={String(values[field.name] ?? '')} onChange={(event) => setValue(field.name, event.target.value)} className="ae-input" />
                  )}
                </label>
              ))}
            </div>
            {resource !== 'site_settings' && resource !== 'events' && resource !== 'gallery_items' && (
              <div className="mt-7 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
                <label className="ae-toggle-row"><span><b>Published</b><small>Visible on the public site</small></span><Switch checked={Boolean(values.published)} onCheckedChange={(checked) => setValue('published', checked)} /></label>
                <label className="ae-toggle-row"><span><b>Featured</b><small>Eligible for highlighted placement</small></span><Switch checked={Boolean(values.featured)} onCheckedChange={(checked) => setValue('featured', checked)} /></label>
              </div>
            )}
            {resource === 'events' && <div className="mt-7 border-t border-border pt-6"><label className="ae-toggle-row"><span><b>Published</b><small>Visible on the public site</small></span><Switch checked={Boolean(values.published)} onCheckedChange={(checked) => setValue('published', checked)} /></label><label className="ae-toggle-row mt-3"><span><b>Featured</b><small>Eligible for highlighted placement</small></span><Switch checked={Boolean(values.featured)} onCheckedChange={(checked) => setValue('featured', checked)} /></label></div>}
            {resource === 'gallery_items' && <div className="mt-3 border-t border-border pt-3"><label className="ae-toggle-row"><span><b>Published</b><small>Visible on the public site</small></span><Switch checked={Boolean(values.published)} onCheckedChange={(checked) => setValue('published', checked)} /></label><label className="ae-toggle-row mt-3"><span><b>Featured</b><small>Eligible for highlighted placement</small></span><Switch checked={Boolean(values.featured)} onCheckedChange={(checked) => setValue('featured', checked)} /></label></div>}
            {resource === 'site_settings' && <div className="mt-7 border-t border-border pt-6"><label className="ae-toggle-row"><span><b>Public setting</b><small>Allow this value to be read by the public site</small></span><Switch checked={Boolean(values.is_public)} onCheckedChange={(checked) => setValue('is_public', checked)} /></label></div>}
            {error && <div className="ae-inline-error mt-6"><AlertCircle size={16} /> {error}</div>}
          </div>
          <div className="ae-drawer-foot"><Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : <><Check /> Save record</>}</Button></div>
        </form>
      </aside>
    </div>
  );
}

export function RecordList({
  resource,
  records,
  isLoading,
  error,
  query,
  onQueryChange,
  onEdit,
  onDelete,
  onRetry,
  resolveMediaUrl,
}: {
  resource: DashboardResource;
  records: ContentRecord[];
  isLoading?: boolean;
  error?: string | null;
  query: string;
  onQueryChange: (query: string) => void;
  onEdit: (record: ContentRecord) => void;
  onDelete: (record: ContentRecord) => void;
  onRetry?: () => void;
  resolveMediaUrl?: (path: string) => string;
}) {
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => JSON.stringify(record).toLowerCase().includes(normalized));
  }, [query, records]);

  return (
    <section className="ae-panel overflow-hidden">
      <div className="ae-list-toolbar">
        <div className="relative w-full max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Search ${resourceLabels[resource].toLowerCase()}`} className="ae-search-input pl-10" /></div>
        <span className="font-mono text-[11px] uppercase tracking-[.12em] text-muted-foreground">{isLoading ? 'Loading' : `${filtered.length} of ${records.length}`}</span>
      </div>
      {error && <div className="ae-error-row"><AlertCircle size={17} /><span>{error}</span>{onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}</div>}
      <div className="p-3 sm:p-5">
        {isLoading ? <SkeletonRows /> : filtered.length === 0 ? (
          <div className="ae-empty"><div className="ae-empty-mark"><FolderOpen size={20} /></div><h3>{query ? 'No records match this search' : `No ${resourceLabels[resource].toLowerCase()} yet`}</h3><p>{query ? 'Try another term or clear the search.' : 'Create the first record when the editorial team is ready.'}</p></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((record) => {
              const imagePath = getImagePath(record);
               const imageUrl = imagePath && resolveMediaUrl ? resolveMediaUrl(imagePath) : null;
              return (
                <div key={getId(record)} className="ae-record-row">
                  <div className="ae-record-image">{imageUrl ? <img src={imageUrl} alt="" /> : <span>{displayValue(record).slice(0, 1).toUpperCase()}</span>}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-foreground">{displayValue(record)}</h3><StatusCluster record={record} /></div><p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">{getId(record)}</p></div>
                  <div className="hidden min-w-24 text-right text-xs text-muted-foreground md:block">{'updated_at' in record ? new Date(record.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</div>
                  <div className="flex items-center gap-1"><Button type="button" size="icon" variant="ghost" onClick={() => onEdit(record)} aria-label={`Edit ${displayValue(record)}`}><Pencil size={15} /></Button><Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(record)} aria-label={`Delete ${displayValue(record)}`}><Trash2 size={15} /></Button></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Overview({
  counts,
  recent,
  loading,
  countsLoading,
  countsError,
  onRetryCounts,
  onNavigate,
  onEdit,
}: {
  counts: AdminDashboardCounts | null;
  recent: ContentRecord[];
  loading: boolean;
  countsLoading: boolean;
  countsError?: string | null;
  onRetryCounts?: () => void;
  onNavigate: (section: DashboardSection) => void;
  onEdit: (record: ContentRecord) => void;
}) {
  const countUnavailable = Boolean(countsError && !counts);
  return (
    <div className="space-y-7">
      <div className="ae-welcome"><div><p className="ae-kicker">Editorial desk / Today</p><h1 className="ae-page-title">Keep the signal clear.</h1><p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">A focused workspace for the people, places and stories that make Abuja worth paying attention to.</p></div><div className="ae-status-line"><span className="ae-live-dot" /> Protected workspace</div></div>
      {countsError && <div className="ae-error-row" role="alert"><AlertCircle size={17} /><span>{countsError}</span>{onRetryCounts && <Button size="sm" variant="outline" onClick={onRetryCounts}>Retry counts</Button>}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Stories" count={counts?.stories} error={countUnavailable} icon={FileText} active={false} onClick={() => onNavigate('stories')} />
        <MetricCard label="Events" count={counts?.events} error={countUnavailable} icon={CalendarDays} onClick={() => onNavigate('events')} />
        <MetricCard label="Members" count={counts?.members} error={countUnavailable} icon={Users} onClick={() => onNavigate('members')} />
        <MetricCard label="Collaborations" count={counts?.collaborations} error={countUnavailable} icon={FolderOpen} onClick={() => onNavigate('collaborations')} />
        <MetricCard label="Gallery" count={counts?.gallery_items} error={countUnavailable} icon={ImageIcon} onClick={() => onNavigate('gallery_items')} />
        <MetricCard label="Settings" count={counts?.site_settings} error={countUnavailable} icon={Settings2} onClick={() => onNavigate('site_settings')} />
        <MetricCard label="New applications" count={counts?.new_applications} error={countUnavailable} icon={Inbox} />
        <MetricCard label="New contact messages" count={counts?.new_contact_messages} error={countUnavailable} icon={MessageCircle} />
        <MetricCard label="Event interests" count={counts?.event_interests} error={countUnavailable} icon={CalendarDays} />
        <MetricCard label="Subscribed newsletter" count={counts?.subscribed_newsletters} error={countUnavailable} icon={Send} />
      </div>
      <div className="grid gap-7 xl:grid-cols-[1.35fr_.65fr]">
        <section className="ae-panel">
          <div className="ae-panel-head"><div><p className="ae-kicker">Recent movement</p><h2 className="ae-panel-title">Latest records</h2></div><Clock3 size={18} className="text-primary" /></div>
          {loading ? <div className="p-5"><SkeletonRows /></div> : recent.length === 0 ? <div className="ae-empty m-5"><div className="ae-empty-mark"><Clock3 size={20} /></div><h3>Nothing has moved yet</h3><p>New records will appear here after the first save.</p></div> : <div className="space-y-2 p-3 sm:p-5">{recent.map((record) => <button type="button" key={`${getId(record)}-${'updated_at' in record ? record.updated_at : ''}`} className="ae-record-row w-full text-left" onClick={() => onEdit(record)}><div className="ae-record-image"><span>{displayValue(record).slice(0, 1).toUpperCase()}</span></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{displayValue(record)}</h3><p className="mt-1 font-mono text-[10px] uppercase tracking-[.1em] text-muted-foreground">{'updated_at' in record ? new Date(record.updated_at).toLocaleString() : 'Site setting'}</p></div><ChevronRight size={16} className="text-muted-foreground" /></button>)}</div>}
        </section>
        <section className="ae-panel">
          <div className="ae-panel-head"><div><p className="ae-kicker">Release discipline</p><h2 className="ae-panel-title">Before you publish</h2></div><ShieldCheck size={18} className="text-primary" /></div>
          <div className="space-y-4 p-5 text-sm leading-6 text-muted-foreground"><p className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-primary" />Confirm the record has a clear public purpose.</p><p className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-primary" />Use image alt text that describes what is actually shown.</p><p className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-primary" />Keep drafts private until the detail is ready.</p></div>
        </section>
      </div>
    </div>
  );
}

export default function AdminDashboard({
  auth,
  members = [],
  collaborations = [],
  events = [],
  stories = [],
  galleryItems = [],
  siteSettings = [],
  counts = null,
  loading = {},
  countsLoading = false,
  errors = {},
  countsError,
  onRetry,
  onRetryCounts,
  onSignOut,
  onCreate,
  onUpdate,
  onDelete,
  onUploadMedia,
  createMediaPreview,
  resolveMediaUrl,
  onSignIn,
}: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ resource: DashboardResource; record?: ContentRecord }>();
  const [actionError, setActionError] = useState('');
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const recordsByResource: Record<DashboardResource, ContentRecord[]> = { members, collaborations, events, stories, gallery_items: galleryItems, site_settings: siteSettings };
  const allRecords = Object.values(recordsByResource).flat();
  const recent = useMemo(() => allRecords.filter((record): record is ContentRecord => 'updated_at' in record).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5), [allRecords]);
  const isBusy = Object.values(loading).some(Boolean);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    mobileCloseButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        document.querySelectorAll<HTMLElement>('#admin-navigation button, #admin-navigation a'),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [mobileNavOpen]);

  if (!auth.isAuthenticated || !auth.isAdmin) return <AccessGate auth={auth} error={errors.auth} onSignIn={onSignIn} onSignOut={onSignOut} />;

  const openCreate = (resource: DashboardResource) => { setActionError(''); setEditor({ resource }); };
  const openEdit = (resource: DashboardResource, record: ContentRecord) => { setActionError(''); setEditor({ resource, record }); };
  const handleDelete = async (resource: DashboardResource, record: ContentRecord) => {
    if (!onDelete) { setActionError('Delete handler is not connected yet.'); return; }
    if (!window.confirm(`Delete “${displayValue(record)}”? This cannot be undone.`)) return;
    setActionError('');
    try { await onDelete(resource, getId(record)); } catch (deleteError) { setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete this record.'); }
  };
  const sectionRecords = activeSection === 'overview' ? [] : recordsByResource[activeSection];

  return (
    <div className="ae-admin min-h-[100dvh]">
      <aside id="admin-navigation" className={cn('ae-sidebar', mobileNavOpen && 'ae-sidebar-open')}>
        <div className="ae-sidebar-brand"><div className="ae-monogram">AE</div><div><p className="font-serif text-lg tracking-[-.04em]">Abuja Elite</p><p className="ae-sidebar-caption">Editorial desk</p></div><button ref={mobileCloseButtonRef} type="button" className="ae-icon-button ml-auto md:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <nav className="mt-10 space-y-1" aria-label="Admin sections">
          <p className="ae-sidebar-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={cn('ae-nav-item', activeSection === id && 'ae-nav-item-active')} onClick={() => { setActiveSection(id); setQuery(''); setMobileNavOpen(false); }}><Icon size={16} /><span>{label}</span>{id === 'overview' && <span className="ml-auto text-[10px] text-primary">01</span>}</button>)}
        </nav>
        <div className="mt-auto hidden border-t border-border pt-5 md:block"><div className="flex items-center gap-3"><div className="ae-user-avatar">{(auth.displayName || auth.email || 'A').slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-semibold">{auth.displayName || 'Authorized editor'}</p><p className="truncate text-[10px] text-muted-foreground">{auth.email || 'Protected session'}</p></div></div><button type="button" className="ae-signout mt-5" onClick={() => void onSignOut()}><LogOut size={14} /> Sign out</button></div>
      </aside>
      {mobileNavOpen && <button type="button" className="ae-sidebar-overlay md:hidden" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="ae-main">
         <header className="ae-topbar"><button ref={mobileMenuButtonRef} type="button" className="ae-icon-button md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-controls="admin-navigation" aria-expanded={mobileNavOpen}><Menu size={19} /></button><div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex"><span>Abuja Elite</span><ChevronRight size={14} /><span className="text-foreground">{activeSection === 'overview' ? 'Overview' : resourceLabels[activeSection]}</span></div><div className="ml-auto flex items-center gap-3"><span className="ae-session-chip"><span className="ae-live-dot" /> Admin session</span><a href="/" target="_blank" rel="noreferrer" className="ae-icon-button" aria-label="Open public site"><ExternalLink size={16} /></a><button type="button" className="ae-icon-button" onClick={() => void onSignOut()} aria-label="Sign out"><LogOut size={16} /></button></div></header>
        <div className="ae-content">
          {actionError && <div className="ae-error-row mb-6"><AlertCircle size={17} /><span>{actionError}</span><button type="button" className="ml-auto" onClick={() => setActionError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
           {activeSection === 'overview' ? <Overview counts={counts} recent={recent} loading={isBusy} countsLoading={countsLoading} countsError={countsError} onRetryCounts={onRetryCounts} onNavigate={setActiveSection} onEdit={(record) => { const resource = (Object.entries(recordsByResource).find(([, records]) => records.some((item) => getId(item) === getId(record)))?.[0] ?? 'stories') as DashboardResource; openEdit(resource, record); }} /> : (
            <div className="space-y-7">
              <div className="ae-section-heading"><div><p className="ae-kicker">Manage / {resourceLabels[activeSection]}</p><h1 className="ae-page-title">{resourceLabels[activeSection]}</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{resourceDescriptions[activeSection]}</p></div><Button type="button" onClick={() => openCreate(activeSection)}><Plus size={16} /> New {activeSection === 'site_settings' ? 'setting' : activeSection === 'gallery_items' ? 'image' : activeSection.slice(0, -1)}</Button></div>
              <RecordList resource={activeSection} records={sectionRecords} isLoading={loading[activeSection]} error={errors[activeSection]} query={query} onQueryChange={setQuery} onEdit={(record) => openEdit(activeSection, record)} onDelete={(record) => void handleDelete(activeSection, record)} onRetry={() => onRetry?.(activeSection)} resolveMediaUrl={resolveMediaUrl} />
            </div>
          )}
        </div>
      </main>
      {editor && <Editor key={`${editor.resource}-${editor.record ? getId(editor.record) : 'new'}`} resource={editor.resource} record={editor.record} onClose={() => setEditor(undefined)} onCreate={onCreate} onUpdate={onUpdate} onUploadMedia={onUploadMedia} createMediaPreview={createMediaPreview} resolveMediaUrl={resolveMediaUrl} userId={auth.userId} />}
    </div>
  );
}
function RelatedContent({field,value,onChange}:{field:string;value:string;onChange:(value:string)=>void}){const resource=field==='event_id'?'events':field==='story_id'?'stories':'collaborations';const[search,setSearch]=useState('');const q=useQuery({queryKey:['admin','relation',resource,search],queryFn:async({signal})=>{const column=resource==='collaborations'?'name':'title';const{data,error}=await getSupabaseClient().from(resource).select('*').ilike(column,'%'+search.replace(/[\\%_]/g,'\\$&')+'%').order(column).order('id').limit(100).abortSignal(signal);if(error)throw error;return data;}});return <span><input className="ae-input mb-2" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a title…" aria-label="Search related content"/><select className="ae-input" value={value} onChange={e=>onChange(e.target.value)} disabled={q.isPending||q.isError}><option value="">No association</option>{value&&!q.data?.some(r=>r.id===value)&&<option value={value}>Current selection</option>}{q.data?.map(r=><option value={r.id} key={r.id}>{'title' in r?r.title:r.name}{r.published?'':' (draft)'}</option>)}</select>{q.isError&&<button type="button" onClick={()=>q.refetch()}>Could not load options. Retry</button>}<small>Shows up to 100 results. Search to narrow the list.</small></span>;}
