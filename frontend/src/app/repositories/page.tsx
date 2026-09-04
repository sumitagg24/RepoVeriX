'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitBranch, Plus, Search, MoreHorizontal, Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { useRepositories, useCreateRepository, useDeleteRepository } from '@/hooks/useRepositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Repository } from '@/types/api';

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

export default function RepositoriesPage() {
  const { data: repositories, isLoading, refetch } = useRepositories();
  const createMutation = useCreateRepository();
  const deleteMutation = useDeleteRepository();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRepo, setEditingRepo] = useState<RepoForm | null>(null);

  const form = useForm<RepoForm>({
    resolver: zodResolver(repoSchema),
    defaultValues: {
      name: '',
      source_type: 'github',
      source_url: '',
      default_branch: 'main',
    },
  });

  const filteredRepos = repositories?.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const onSubmit = async (data: RepoForm) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Repository created successfully');
      setDialogOpen(false);
      form.reset();
      refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create repository';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repository? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Repository deleted');
      refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete repository';
      toast.error(message);
    }
};
const handleEditClick = (repo: Repository) => {
    setEditingRepo({
      name: repo.name,
      source_type: repo.source_type,
      source_url: repo.source_url || '',
      default_branch: repo.default_branch,
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repositories</h1>
          <p className="text-muted-foreground">Manage your code repositories for scanning</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Repository
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingRepo ? 'Edit Repository' : 'Add Repository'}</DialogTitle>
              <DialogDescription>
                {editingRepo ? 'Update repository details' : 'Connect a new repository for scanning'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="my-awesome-project" {...field} />
                      </FormControl>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="github">GitHub Repository</SelectItem>
                          <SelectItem value="zip">ZIP Upload</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          disabled={form.watch('source_type') !== 'github'}
                        />
                      </FormControl>
                      <FormDescription>
                        Required for GitHub repositories
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
                        <Input placeholder="main" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? 'Saving...' : editingRepo ? 'Update' : 'Create Repository'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Repository List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="text-center py-12">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No repositories found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Get started by adding your first repository'}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <DialogTrigger>
                    <Link href="#">Add Repository</Link>
                  </DialogTrigger>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredRepos.map((repo) => (
                <div key={repo.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-primary/10 rounded-lg flex-shrink-0">
                        <GitBranch className="h-6 w-6 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <Link href={`/repositories/${repo.id}`} className="font-medium truncate block hover:text-primary">
                          {repo.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                          <Badge variant="outline" className="capitalize">{repo.source_type}</Badge>
                          <Badge variant="outline">{repo.default_branch}</Badge>
                          <span className="capitalize">{repo.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {repo.source_url && (
                        <a
                          href={repo.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                          title="Open in GitHub"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/repositories/${repo.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/scans/new?repo=${repo.id}`}>
                              <Search className="mr-2 h-4 w-4" />
                              New Scan
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(repo.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}