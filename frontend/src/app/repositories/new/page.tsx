'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateRepository, useCreateRepositoryFromZip } from '@/hooks/useRepositories';
import { Github, Archive, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const repoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  source_type: z.enum(['github', 'zip']),
  source_url: z.string().url().optional().or(z.literal('')),
  default_branch: z.string().default('main'),
}).refine((data) => data.source_type !== 'github' || (data.source_url && data.source_url.length > 0), {
  message: 'GitHub URL is required for GitHub repositories',
  path: ['source_url'],
});

type RepoForm = z.infer<typeof repoSchema>;

export default function NewRepositoryPage() {
  const router = useRouter();
  const createMutation = useCreateRepository();
  const createZipMutation = useCreateRepositoryFromZip();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const form = useForm<RepoForm>({
    resolver: zodResolver(repoSchema),
    defaultValues: {
      name: '',
      source_type: 'github',
      source_url: '',
      default_branch: 'main',
    },
  });

  const onSubmit = async (data: RepoForm) => {
    try {
      if (data.source_type === 'zip') {
        if (!selectedFile) {
          setFileError('Please choose a .zip archive to upload');
          return;
        }
        await createZipMutation.mutateAsync({ name: data.name, file: selectedFile });
      } else {
        await createMutation.mutateAsync(data);
      }
      toast.success('Repository created successfully');
      router.push('/repositories');
      router.refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create repository';
      toast.error(message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/repositories" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to Repositories
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Repository</h1>
        <p className="text-muted-foreground">Connect a new repository for scanning</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Repository Details</CardTitle>
          <CardDescription>Enter the repository information to start scanning</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form id="repository-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository Name</FormLabel>
                    <FormControl>
                      <Input placeholder="my-awesome-project" {...field} disabled={createMutation.isPending} />
                    </FormControl>
                    <FormDescription>A display name for your repository</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="source_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedFile(null);
                        setFileError(null);
                      }}
                      defaultValue={field.value}
                      disabled={createMutation.isPending || createZipMutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="github">
                          <div className="flex items-center gap-2">
                            <Github className="h-4 w-4" />
                            <span>GitHub Repository</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="zip">
                          <div className="flex items-center gap-2">
                            <Archive className="h-4 w-4" />
                            <span>ZIP Upload</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch('source_type') === 'zip' && (
                <div className="space-y-2">
                  <Label htmlFor="zip-archive">ZIP Archive</Label>
                  <Input
                    id="zip-archive"
                    type="file"
                    accept=".zip,application/zip"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFile(file);
                      setFileError(file ? null : 'Please choose a .zip archive to upload');
                    }}
                    disabled={createMutation.isPending || createZipMutation.isPending}
                  />
                  <p className="text-sm text-muted-foreground">
                    {selectedFile ? `Selected: ${selectedFile.name}` : 'Upload a .zip archive of your repository source code'}
                  </p>
                  {fileError && <p className="text-sm font-medium text-destructive">{fileError}</p>}
                </div>
              )}

              <FormField
                control={form.control}
                name="source_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GitHub URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/user/repo"
                        {...field}
                        disabled={createMutation.isPending || form.watch('source_type') !== 'github'}
                      />
                    </FormControl>
                    <FormDescription>
                      Required for GitHub repositories. Must be a valid GitHub repository URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_branch"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Branch</FormLabel>
                    <FormControl>
                      <Input placeholder="main" {...field} disabled={createMutation.isPending} />
                    </FormControl>
                    <FormDescription>The default branch to scan (usually `main` or `master`)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/repositories">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" form="repository-form" disabled={createMutation.isPending || createZipMutation.isPending} className="w-full sm:w-auto">
            {createMutation.isPending || createZipMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Repository'
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-info/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            ZIP Upload Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>For ZIP uploads, prepare a ZIP file containing your repository source code.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Include all source files you want scanned</li>
            <li>Exclude build artifacts, node_modules, .git, venv, etc.</li>
            <li>Maximum file size: 100MB</li>
            <li>Supported languages: Python, JavaScript, TypeScript</li>
          </ul>
          <p className="text-primary font-medium">Your archive is stored securely and only extracted into an isolated sandbox when a scan runs.</p>
        </CardContent>
      </Card>
    </div>
  );
}