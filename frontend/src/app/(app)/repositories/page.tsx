"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Github, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateRepository,
  useDeleteRepository,
  useRepositories,
  useUploadRepository,
} from "@/hooks/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDate, apiErrorMessage } from "@/lib/utils";

export default function RepositoriesPage() {
  const list = useRepositories();
  const createRepo = useCreateRepository();
  const uploadRepo = useUploadRepository();
  const delRepo = useDeleteRepository();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [zipName, setZipName] = useState("");
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Repositories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect via GitHub URL or upload a ZIP. Ingestion is guarded; origins are never mutated.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="flex items-center gap-2 text-sm font-extrabold"><Github className="h-4 w-4" /> Connect GitHub repo</p>
            <div>
              <Label htmlFor="repo-name">Display name</Label>
              <Input id="repo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-app" />
            </div>
            <div>
              <Label htmlFor="repo-url">Clone URL</Label>
              <Input id="repo-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo.git" inputMode="url" />
            </div>
            <Button
              disabled={createRepo.isPending || !name.trim() || !url.trim()}
              onClick={async () => {
                try {
                  await createRepo.mutateAsync({
                    name: name.trim(),
                    source_type: "github",
                    source_url: url.trim(),
                    default_branch: "main",
                  });
                  setName("");
                  setUrl("");
                  toast.success("Repository connected");
                } catch (e) {
                  toast.error(apiErrorMessage(e, "Could not connect repo"));
                }
              }}
            >
              {createRepo.isPending ? "Connecting…" : "Connect repository"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="flex items-center gap-2 text-sm font-extrabold"><Upload className="h-4 w-4" /> Upload ZIP</p>
            <div>
              <Label htmlFor="zip-name">Display name</Label>
              <Input id="zip-name" value={zipName} onChange={(e) => setZipName(e.target.value)} placeholder="legacy-service" />
            </div>
            <div>
              <Label htmlFor="zip-file">Archive (.zip, traversal-checked)</Label>
              <Input id="zip-file" type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button
              variant="ink"
              disabled={uploadRepo.isPending || !zipName.trim() || !file}
              onClick={async () => {
                if (!file) return;
                try {
                  await uploadRepo.mutateAsync({ name: zipName.trim(), file });
                  setZipName("");
                  setFile(null);
                  toast.success("ZIP uploaded");
                } catch (e) {
                  toast.error(apiErrorMessage(e, "Upload failed"));
                }
              }}
            >
              {uploadRepo.isPending ? "Uploading…" : "Upload & ingest"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading repositories…</p>}
        {list.data?.map((r) => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-center gap-3 p-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold">
                  <Link href={`/repositories/${r.id}`} className="hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                </p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {r.source_type} · {r.source_url ?? "zip upload"} · {formatDate(r.created_at)}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 font-mono text-[11px] font-bold text-muted-foreground">
                {(r.primary_languages ?? []).join(" · ") || r.status}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/repositories/${r.id}`}>Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${r.name}`}
                onClick={async () => {
                  if (!confirm(`Delete ${r.name}?`)) return;
                  try {
                    await delRepo.mutateAsync(r.id);
                    toast.success("Repository deleted");
                  } catch (e) {
                    toast.error(apiErrorMessage(e, "Delete failed"));
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {!list.isLoading && !list.data?.length && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No repositories yet — connect one above to begin.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
