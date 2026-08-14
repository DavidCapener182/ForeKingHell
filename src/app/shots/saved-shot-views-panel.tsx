"use client";

import Link from "next/link";
import { ListFilter } from "lucide-react";

import { saveShotViewAction } from "@/app/feature-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeatureIdeasData } from "@/lib/feature-ideas";

export function SavedShotViewsPanel({ data }: { data: FeatureIdeasData }) {
  return (
    <Card data-saved-shot-views>
      <CardHeader className="flex-row items-start justify-between gap-3 border-b">
        <div>
          <CardTitle>Saved shot views</CardTitle>
          <CardDescription>
            Fast filters for driver misses, wedge windows, recent form and user-defined groups.
          </CardDescription>
        </div>
        <Badge variant="secondary">{data.savedViews.length} views</Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ListFilter className="size-4" aria-hidden />
              Open saved view
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Shot explorer views</DropdownMenuLabel>
            {data.savedViews.map((view) => (
              <DropdownMenuItem key={view.id} asChild>
                <Link href={view.href} prefetch={false} className="grid gap-0.5">
                  <span className="font-medium">{view.name}</span>
                  <span className="text-xs text-muted-foreground">{view.description}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Save current filters</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Save the current shot view</DialogTitle>
              <DialogDescription>
                Name this filter set so it can be opened from Shot Explorer later.
              </DialogDescription>
            </DialogHeader>
            <form action={saveShotViewAction} className="grid gap-3">
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Input name="name" placeholder="My tournament attempts" required />
                <Input name="description" placeholder="What this view is for" />
                <Select name="club" defaultValue="__all__">
                  <SelectTrigger aria-label="Saved view club filter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All clubs</SelectItem>
                    {data.savedViewOptions.clubs.map((club) => (
                      <SelectItem key={club.value} value={club.value}>
                        {club.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select name="category" defaultValue="__all__">
                  <SelectTrigger aria-label="Saved view category filter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {data.savedViewOptions.categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input name="from" type="date" aria-label="Saved view start date" />
                <Input name="to" type="date" aria-label="Saved view end date" />
                <Input name="q" placeholder="Search term or note" />
                <label className="flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground">
                  <Checkbox name="pinned" />
                  Pin view
                </label>
              </div>
              <DialogFooter>
                <Button type="submit">
                  <ListFilter className="size-4" />
                  Save view
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
